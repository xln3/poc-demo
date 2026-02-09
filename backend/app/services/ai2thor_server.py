#!/usr/bin/env python3
"""AI2-THOR container HTTP service.

Runs inside the sim-ai2thor Docker container. Manages an AI2-THOR
Controller instance and exposes it via Flask HTTP endpoints on port 9090.

Usage:
    python3 ai2thor_server.py [port]
"""

import io
import json
import logging
import sys
import traceback

from flask import Flask, Response, jsonify, request

# Log to stderr to keep stdout clean for JSON output
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ai2thor_server")

app = Flask(__name__)

# Global controller state
_controller = None
_last_event = None
_config = {}


def _get_controller():
    global _controller
    if _controller is None:
        raise RuntimeError("Controller not initialized. Call /init first.")
    return _controller


# ── Health check ─────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "controller_active": _controller is not None,
    })


# ── Initialize controller ───────────────────────────────────

@app.route("/init", methods=["POST"])
def init_controller():
    global _controller, _last_event, _config

    data = request.get_json(force=True, silent=True) or {}
    scene = data.get("scene", "FloorPlan1")
    width = int(data.get("width", 640))
    height = int(data.get("height", 480))
    platform = data.get("platform", "CloudRendering")

    logger.info("Initializing AI2-THOR: scene=%s %dx%d platform=%s",
                scene, width, height, platform)

    # Shut down previous controller if any
    if _controller is not None:
        try:
            _controller.stop()
        except Exception:
            pass
        _controller = None

    try:
        import ai2thor.controller
        import ai2thor.platform

        platform_cls = getattr(ai2thor.platform, platform, None)
        if platform_cls is None:
            platform_cls = ai2thor.platform.CloudRendering

        _controller = ai2thor.controller.Controller(
            scene=scene,
            width=width,
            height=height,
            platform=platform_cls,
            renderDepthImage=False,
            renderInstanceSegmentation=False,
        )
        _last_event = _controller.last_event
        _config = {"scene": scene, "width": width, "height": height, "platform": platform}

        logger.info("AI2-THOR initialized: scene=%s", scene)
        return jsonify({
            "success": True,
            "scene": scene,
            "width": width,
            "height": height,
        })
    except Exception as e:
        logger.error("Init failed: %s\n%s", e, traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ── Step (execute action) ───────────────────────────────────

@app.route("/step", methods=["POST"])
def step():
    global _last_event

    data = request.get_json(force=True, silent=True) or {}
    action_name = data.pop("action", None)
    if not action_name:
        return jsonify({"success": False, "error": "Missing 'action' field"}), 400

    try:
        controller = _get_controller()
        event = controller.step(action=action_name, **data)
        _last_event = event

        # Build visible objects list
        visible_objects = []
        for obj in event.metadata.get("objects", []):
            if obj.get("visible"):
                visible_objects.append({
                    "objectId": obj["objectId"],
                    "objectType": obj.get("objectType", ""),
                    "position": obj.get("position", {}),
                })

        return jsonify({
            "success": event.metadata.get("lastActionSuccess", False),
            "action": action_name,
            "errorMessage": event.metadata.get("errorMessage", ""),
            "observation": {
                "agent_position": event.metadata.get("agent", {}).get("position", {}),
                "agent_rotation": event.metadata.get("agent", {}).get("rotation", {}),
                "visible_objects": visible_objects[:20],  # Limit to avoid huge payloads
            },
            "done": False,
            "reward": 0.0,
            "info": {
                "actionReturn": event.metadata.get("actionReturn"),
            },
        })
    except Exception as e:
        logger.error("Step failed: %s\n%s", e, traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ── Render current frame ────────────────────────────────────

@app.route("/render", methods=["GET"])
def render():
    try:
        controller = _get_controller()
        event = _last_event or controller.last_event
        frame = event.frame  # numpy uint8 HWC RGB array

        from PIL import Image
        img = Image.fromarray(frame, "RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)

        return Response(buf.read(), mimetype="image/jpeg")
    except Exception as e:
        logger.error("Render failed: %s\n%s", e, traceback.format_exc())
        return jsonify({"success": False, "error": str(e)}), 500


# ── Action space ────────────────────────────────────────────

@app.route("/action-space", methods=["GET"])
def action_space():
    actions = [
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
    return jsonify({"actions": actions})


# ── Stop controller ─────────────────────────────────────────

@app.route("/stop", methods=["POST"])
def stop():
    global _controller, _last_event
    if _controller is not None:
        try:
            _controller.stop()
        except Exception as e:
            logger.warning("Error stopping controller: %s", e)
        _controller = None
        _last_event = None
    return jsonify({"success": True, "message": "Controller stopped"})


# ── Main ────────────────────────────────────────────────────

def run_server(port):
    logger.info("Starting AI2-THOR HTTP server on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9090
    run_server(port)
