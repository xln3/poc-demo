"""AI2-THOR simulator adapter.

Runs AI2-THOR inside a Docker container with CloudRendering (Vulkan).
Requires the ``sim-ai2thor:latest`` Docker image to be available.

Communication pattern (same as container_rag.py):
    backend adapter  ──exec_in_container(curl)──►  ai2thor_server.py (Flask :9090)
"""

import json
import logging
import os
import time
import uuid
from typing import Dict

from .base import SimulatorBase
from .registry import SimulatorRegistry
from ..container import container_manager
from ...models.schemas import ContainerType, MEMORY_LIMITS

logger = logging.getLogger(__name__)

SIM_IMAGE = "sim-ai2thor:latest"
SIM_PORT = 9090
HEALTH_TIMEOUT_S = 60
INIT_TIMEOUT_S = 120


@SimulatorRegistry.register
class AI2ThorSimulator(SimulatorBase):
    """AI2-THOR embodied environment adapter backed by a real Docker container."""

    # session_id → container session_id mapping
    _sessions: Dict[str, str] = {}

    @property
    def engine_name(self) -> str:
        return "ai2thor"

    @property
    def engine_info(self) -> dict:
        return {
            "name": "ai2thor",
            "version": "0.1.0",
            "scenes": [
                {"id": "FloorPlan1", "label": "厨房"},
                {"id": "FloorPlan201", "label": "客厅"},
                {"id": "FloorPlan301", "label": "卧室"},
                {"id": "FloorPlan401", "label": "浴室"},
            ],
        }

    # ── Helpers ──────────────────────────────────────────────

    def _curl(self, container_sid: str, method: str, endpoint: str,
              data: dict = None, timeout: int = 60) -> dict:
        """Call the in-container HTTP service via curl."""
        if method == "GET":
            cmd = (
                f"curl -s --connect-timeout 5 --max-time {timeout} "
                f"http://127.0.0.1:{SIM_PORT}{endpoint}"
            )
        else:
            json_str = json.dumps(data or {}, ensure_ascii=False)
            escaped = json_str.replace("'", "'\"'\"'")
            cmd = (
                f"curl -s --connect-timeout 5 --max-time {timeout} "
                f"-X {method} -H 'Content-Type: application/json' "
                f"-d '{escaped}' http://127.0.0.1:{SIM_PORT}{endpoint}"
            )

        exit_code, stdout, stderr = container_manager.exec_in_container(
            container_sid,
            f"/bin/bash -c {json.dumps(cmd, ensure_ascii=False)}",
        )
        if exit_code != 0:
            raise RuntimeError(f"curl failed (exit={exit_code}): {stderr}")

        return json.loads(stdout)

    def _curl_binary(self, container_sid: str, endpoint: str,
                     timeout: int = 10) -> bytes:
        """Fetch binary data (JPEG frame) from the in-container service."""
        cmd = (
            f"curl -s --connect-timeout 5 --max-time {timeout} "
            f"http://127.0.0.1:{SIM_PORT}{endpoint} --output -"
        )
        exit_code, stdout_bytes, stderr_bytes = container_manager.exec_in_container_binary(
            container_sid,
            f"/bin/bash -c {json.dumps(cmd, ensure_ascii=False)}",
        )
        if exit_code != 0:
            raise RuntimeError(
                f"Binary curl failed (exit={exit_code}): {stderr_bytes.decode(errors='replace')}"
            )
        return stdout_bytes

    def _copy_server_script(self, container_sid: str):
        """Copy ai2thor_server.py into the container."""
        # ai2thor_server.py lives at backend/app/services/ai2thor_server.py
        # This file lives at backend/app/services/simulator/ai2thor.py
        script_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "ai2thor_server.py")
        )
        if not os.path.isfile(script_path):
            raise FileNotFoundError(f"ai2thor_server.py not found at {script_path}")
        with open(script_path, "rb") as f:
            content = f.read()
        container_manager.copy_file_to_container(
            container_sid, "/app/ai2thor_server.py", content
        )

    def _wait_for_health(self, container_sid: str):
        """Poll /health until the Flask server is ready."""
        for i in range(HEALTH_TIMEOUT_S):
            time.sleep(1)
            exit_code, stdout, _ = container_manager.exec_in_container(
                container_sid,
                f"curl -s --connect-timeout 2 http://127.0.0.1:{SIM_PORT}/health "
                "2>/dev/null || echo 'not_ready'",
            )
            if exit_code == 0 and "healthy" in stdout:
                logger.info("AI2-THOR server ready (waited %ds)", i + 1)
                return
        # Dump logs on failure
        _, log_out, _ = container_manager.exec_in_container(
            container_sid, "cat /tmp/ai2thor_server.log 2>/dev/null | tail -50"
        )
        raise RuntimeError(f"AI2-THOR server failed to start. Log:\n{log_out}")

    # ── SimulatorBase interface ──────────────────────────────

    async def start(self, config: dict) -> str:
        session_id = f"sim-ai2thor-{uuid.uuid4().hex[:8]}"
        scene = config.get("scene", "FloorPlan1")
        logger.info("AI2-THOR start: session=%s scene=%s", session_id, scene)

        # 1. Create container with Unity binary volume mount
        mem_limit = MEMORY_LIMITS[ContainerType.SIM_AI2THOR]

        # Volume 挂载宿主机预下载的 Unity 二进制（参考 safeagentbench）
        # 宿主机路径: /tmp/thor-download/releases/thor-CloudRendering-f0825767cd50d69f666c7f282e54abfe58f1e917
        # 容器路径: /root/.ai2thor/releases/thor-CloudRendering-f0825767cd50d69f666c7f282e54abfe58f1e917
        thor_release_id = "thor-CloudRendering-f0825767cd50d69f666c7f282e54abfe58f1e917"
        volumes = {
            f"/tmp/thor-download/releases/{thor_release_id}": {
                "bind": f"/root/.ai2thor/releases/{thor_release_id}",
                "mode": "ro",
            }
        }

        container_manager.get_or_create_container(
            image=SIM_IMAGE,
            session_id=session_id,
            mem_limit=mem_limit,
            volumes=volumes,
        )

        # 2. Start Flask server with Xvfb (container_manager overrides CMD with tail -f /dev/null)
        # Start Xvfb in background, then Flask server
        container_manager.exec_in_container(
            session_id,
            f"nohup bash -c 'Xvfb :99 -screen 0 1024x768x24 -nolisten tcp & "
            f"sleep 1 && DISPLAY=:99 python3 /app/ai2thor_server.py {SIM_PORT}' "
            f"> /tmp/ai2thor_server.log 2>&1 &",
        )

        # 3. Wait for /health
        self._wait_for_health(session_id)

        # 4. Initialize controller with scene config
        init_data = {
            "scene": scene,
            "width": config.get("width", 640),
            "height": config.get("height", 480),
            "platform": config.get("platform", "CloudRendering"),
        }
        result = self._curl(session_id, "POST", "/init", init_data, timeout=INIT_TIMEOUT_S)
        if not result.get("success"):
            error = result.get("error", "unknown")
            # Cleanup on failure
            container_manager.destroy_container(session_id)
            raise RuntimeError(f"AI2-THOR init failed: {error}")

        self._sessions[session_id] = session_id
        return session_id

    async def step(self, session_id: str, action: dict) -> dict:
        container_sid = self._sessions.get(session_id)
        if not container_sid:
            raise KeyError(f"Session not found: {session_id}")

        result = self._curl(container_sid, "POST", "/step", action)
        return {
            "observation": result.get("observation", {}),
            "reward": result.get("reward", 0.0),
            "done": result.get("done", False),
            "info": {
                "success": result.get("success", False),
                "errorMessage": result.get("errorMessage", ""),
                "action": result.get("action", ""),
                **(result.get("info") or {}),
            },
        }

    async def render(self, session_id: str) -> bytes:
        container_sid = self._sessions.get(session_id)
        if not container_sid:
            raise KeyError(f"Session not found: {session_id}")

        return self._curl_binary(container_sid, "/render")

    async def stop(self, session_id: str) -> None:
        container_sid = self._sessions.pop(session_id, None)
        if not container_sid:
            return

        logger.info("AI2-THOR stop: session=%s", session_id)
        try:
            self._curl(container_sid, "POST", "/stop", timeout=10)
        except Exception as e:
            logger.warning("Error calling /stop: %s", e)

        try:
            container_manager.destroy_container(container_sid)
        except Exception as e:
            logger.warning("Error destroying container: %s", e)

    async def get_action_space(self) -> dict:
        return {
            "actions": [
                {"name": "MoveAhead", "params": {}},
                {"name": "MoveBack", "params": {}},
                {"name": "RotateRight", "params": {"degrees": 90}},
                {"name": "RotateLeft", "params": {"degrees": 90}},
                {"name": "LookUp", "params": {"degrees": 30}},
                {"name": "LookDown", "params": {"degrees": 30}},
                {"name": "PickupObject", "params": {"objectId": "string"}},
                {"name": "PutObject", "params": {"objectId": "string"}},
                {"name": "OpenObject", "params": {"objectId": "string"}},
                {"name": "CloseObject", "params": {"objectId": "string"}},
                {"name": "ToggleObjectOn", "params": {"objectId": "string"}},
                {"name": "ToggleObjectOff", "params": {"objectId": "string"}},
            ]
        }
