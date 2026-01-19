from __future__ import annotations
import asyncio
import json
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from datetime import datetime
from ..models.schemas import (
    CreateContainerRequest,
    ToolCallRequest,
    ContainerInfo,
    ToolResult,
    LogEntry,
    LogType,
    LogStatus,
    ContainerStatus,
)
from ..services.container import container_manager
from ..services.tools import tool_executor
from ..services.log_manager import log_manager

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


@router.post("/container", response_model=ContainerInfo)
async def create_or_get_container(request: CreateContainerRequest):
    """Create a new container or get existing one for session."""
    try:
        info = container_manager.get_or_create_container(
            image=request.image,
            session_id=request.session_id
        )

        # Emit container start log
        await log_manager.emit_container_log(
            info.session_id,
            f"Container started: {info.container_id} ({info.image})",
            LogStatus.SUCCESS,
            {"container_id": info.container_id, "image": info.image}
        )

        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/container/{session_id}", response_model=ContainerInfo)
async def get_container_status(session_id: str):
    """Get container status for a session."""
    info = container_manager.get_container_status(session_id)
    if info.status == ContainerStatus.NOT_FOUND:
        raise HTTPException(status_code=404, detail="Session not found")
    return info


@router.delete("/container/{session_id}")
async def destroy_container(session_id: str):
    """Destroy a container."""
    success = container_manager.destroy_container(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    await log_manager.emit_container_log(
        session_id,
        "Container destroyed",
        LogStatus.WARNING
    )

    return {"success": True, "message": f"Session {session_id} destroyed"}


@router.get("/sessions", response_model=List[ContainerInfo])
async def list_sessions():
    """List all active sessions."""
    return container_manager.list_sessions()


@router.post("/tool", response_model=ToolResult)
async def execute_tool(request: ToolCallRequest):
    """Execute a tool in the sandbox."""
    # Check if container exists
    info = container_manager.get_container_status(request.session_id)
    if info.status == ContainerStatus.NOT_FOUND:
        raise HTTPException(status_code=404, detail="Session not found. Create a container first.")
    if info.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Container is not running")

    # Emit tool call log before execution
    await log_manager.emit_tool_log(
        request.session_id,
        f"Tool call: {request.tool.value}",
        LogStatus.NORMAL,
        {"tool": request.tool.value, "params": request.params}
    )

    # Execute tool
    result = await tool_executor.execute(
        session_id=request.session_id,
        tool=request.tool,
        params=request.params
    )

    # Emit result log
    status = LogStatus.SUCCESS if result.success else LogStatus.DANGER
    await log_manager.emit_tool_log(
        request.session_id,
        f"Tool result: {result.tool.value} - {'success' if result.success else 'failed'}",
        status,
        {"result": result.model_dump()}
    )

    return result


@router.websocket("/logs/{session_id}")
async def websocket_logs(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time logs."""
    await websocket.accept()

    # Create queue for this connection
    queue = log_manager.create_queue(session_id)

    # Send initial connection message
    initial_log = LogEntry(
        type=LogType.INFO,
        content=f"Connected to log stream for session {session_id}",
        status=LogStatus.NORMAL,
        timestamp=datetime.now().isoformat()
    )
    await websocket.send_text(initial_log.model_dump_json())

    try:
        while True:
            # Wait for new log entries
            try:
                log = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(log.model_dump_json())
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_text(json.dumps({"type": "heartbeat"}))
    except WebSocketDisconnect:
        pass
    finally:
        log_manager.remove_queue(session_id, queue)
