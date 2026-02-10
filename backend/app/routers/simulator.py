"""Simulator API Router - embodied agent simulation endpoints.

Manages simulator engine lifecycle: list engines, start/stop sessions,
execute actions, capture frames, and record video.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from jose import jwt
from pydantic import BaseModel
from typing import Optional

from ..auth.security import require_auth, require_admin, SECRET_KEY, ALGORITHM
from ..services.simulator import SimulatorBase, SimulatorRegistry

# Force adapter registration by importing them
from ..services.simulator import ai2thor as _ai2thor_mod  # noqa: F401
from ..services.simulator import carla as _carla_mod       # noqa: F401

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulator", tags=["Simulator"])

# Active sessions: session_id → SimulatorBase instance
_active_sessions: dict[str, SimulatorBase] = {}


class StartRequest(BaseModel):
    engine: str
    config: dict = {}


class StepRequest(BaseModel):
    action: dict


class RecordRequest(BaseModel):
    recording: bool


# ── Engine discovery ──────────────────────────────────────────────

@router.get("/engines", dependencies=[Depends(require_auth)])
def list_engines():
    """List available simulation engines."""
    return {"engines": SimulatorRegistry.list_engines()}


# ── Session lifecycle ─────────────────────────────────────────────

@router.post("/start", dependencies=[Depends(require_admin)])
async def start_session(req: StartRequest):
    """Start a new simulation session."""
    try:
        engine_cls = SimulatorRegistry.get(req.engine)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))

    engine = engine_cls()
    try:
        session_id = await engine.start(req.config)
    except Exception as e:
        logger.error("Failed to start %s: %s", req.engine, e)
        raise HTTPException(status_code=500, detail=f"Failed to start engine: {e}")

    _active_sessions[session_id] = engine
    action_space = await engine.get_action_space()

    return {
        "session_id": session_id,
        "engine": req.engine,
        "action_space": action_space,
    }


@router.post("/{session_id}/step", dependencies=[Depends(require_admin)])
async def step_session(session_id: str, req: StepRequest):
    """Execute one action step in the simulation."""
    engine = _active_sessions.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    try:
        result = await engine.step(session_id, req.action)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    except Exception as e:
        logger.error("Step failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return result


# ── Frame capture ─────────────────────────────────────────────────

@router.get("/{session_id}/frame", dependencies=[Depends(require_auth)])
async def get_frame(session_id: str):
    """Get current simulation frame as JPEG."""
    engine = _active_sessions.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    try:
        frame_bytes = await engine.render(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")
    except Exception as e:
        logger.error("Render failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return Response(content=frame_bytes, media_type="image/jpeg")


@router.websocket("/{session_id}/stream")
async def stream_frames(websocket: WebSocket, session_id: str, token: str = Query(None)):
    """WebSocket MJPEG frame stream for live viewing."""
    if not token:
        await websocket.close(code=4001, reason="Auth required")
        return
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    engine = _active_sessions.get(session_id)
    if not engine:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()
    try:
        while session_id in _active_sessions:
            frame = await engine.render(session_id)
            await websocket.send_bytes(frame)
            # TODO: configurable frame rate
            import asyncio
            await asyncio.sleep(1 / 10)  # ~10 FPS
    except WebSocketDisconnect:
        logger.info("Stream client disconnected: %s", session_id)
    except Exception as e:
        logger.error("Stream error: %s", e)


# ── Recording ─────────────────────────────────────────────────────

@router.post("/{session_id}/record", dependencies=[Depends(require_admin)])
async def toggle_recording(session_id: str, req: RecordRequest):
    """Start or stop recording simulation video."""
    engine = _active_sessions.get(session_id)
    if not engine:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    # TODO: Implement actual MP4 recording via ffmpeg in container
    return {
        "session_id": session_id,
        "recording": req.recording,
        "message": "Recording toggled (not yet implemented)",
    }


@router.get("/{session_id}/video", dependencies=[Depends(require_auth)])
async def get_video(session_id: str):
    """Get recorded MP4 video for a session."""
    # TODO: Return recorded MP4 file
    raise HTTPException(status_code=501, detail="Video recording not yet implemented")


# ── Cleanup ───────────────────────────────────────────────────────

@router.delete("/{session_id}", dependencies=[Depends(require_admin)])
async def stop_session(session_id: str):
    """Stop and destroy a simulation session."""
    engine = _active_sessions.pop(session_id, None)
    if not engine:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    try:
        await engine.stop(session_id)
    except Exception as e:
        logger.error("Stop failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    return {"session_id": session_id, "status": "stopped"}
