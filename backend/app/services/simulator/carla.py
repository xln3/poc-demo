"""CARLA driving simulator adapter.

Connects to a CARLA server container via the CARLA Python client.
Requires the ``sim-carla:latest`` Docker image to be available.
"""

import logging
import uuid
from typing import Dict

from .base import SimulatorBase
from .registry import SimulatorRegistry

logger = logging.getLogger(__name__)


@SimulatorRegistry.register
class CarlaSimulator(SimulatorBase):
    """CARLA autonomous driving environment adapter."""

    _sessions: Dict[str, dict] = {}

    @property
    def engine_name(self) -> str:
        return "carla"

    @property
    def engine_info(self) -> dict:
        return {
            "name": "carla",
            "version": "0.1.0",
            "scenes": [
                {"id": "Town01", "label": "小镇"},
                {"id": "Town02", "label": "住宅区"},
                {"id": "Town03", "label": "城市道路"},
                {"id": "Town04", "label": "高速公路"},
                {"id": "Town05", "label": "城市广场"},
            ],
        }

    async def start(self, config: dict) -> str:
        session_id = str(uuid.uuid4())
        scene = config.get("scene", "Town01")
        logger.info("CARLA start: session=%s scene=%s", session_id, scene)
        # TODO: Launch CARLA server container + connect client
        self._sessions[session_id] = {
            "scene": scene,
            "config": config,
            "steps": 0,
            "done": False,
        }
        return session_id

    async def step(self, session_id: str, action: dict) -> dict:
        sess = self._sessions.get(session_id)
        if not sess:
            raise KeyError(f"Session not found: {session_id}")
        sess["steps"] += 1
        logger.info("CARLA step %d: session=%s action=%s", sess["steps"], session_id, action.get("action"))
        # TODO: Forward action to CARLA client
        return {
            "observation": f"Executed {action.get('action', 'unknown')} in {sess['scene']}",
            "reward": 0.0,
            "done": False,
            "info": {"steps": sess["steps"]},
        }

    async def render(self, session_id: str) -> bytes:
        sess = self._sessions.get(session_id)
        if not sess:
            raise KeyError(f"Session not found: {session_id}")
        # TODO: Capture frame from CARLA camera sensor
        # Return 1x1 black JPEG placeholder
        return (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
            b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
            b"\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342"
            b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00"
            b"\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00"
            b"\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b"
            b"\xff\xda\x00\x08\x01\x01\x00\x00?\x00T\xdb\xae\x93(i\xa0\x00\x00"
            b"\xff\xd9"
        )

    async def stop(self, session_id: str) -> None:
        sess = self._sessions.pop(session_id, None)
        if sess:
            logger.info("CARLA stop: session=%s (after %d steps)", session_id, sess["steps"])
            # TODO: Destroy CARLA containers

    async def get_action_space(self) -> dict:
        return {
            "actions": [
                {"name": "throttle", "params": {"value": "float 0-1"}},
                {"name": "brake", "params": {"value": "float 0-1"}},
                {"name": "steer", "params": {"value": "float -1 to 1"}},
                {"name": "reverse", "params": {"value": "bool"}},
                {"name": "hand_brake", "params": {"value": "bool"}},
            ]
        }
