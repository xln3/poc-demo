from __future__ import annotations
import asyncio
import json
from typing import List, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from datetime import datetime
from ..models.schemas import (
    ToolCallRequest,
    ToolResult,
    LogEntry,
    LogType,
    LogStatus,
    ContainerStatus,
    TerminalImage,
    TerminalInfo,
    DeletedTerminalInfo,
    TerminalListResponse,
    DeletedTerminalsResponse,
    CleanupResult,
    CreateTerminalRequest,
    TerminalToolRequest,
)
from ..services.container import container_manager
from ..services.tools import tool_executor
from ..services.log_manager import log_manager
from ..services.terminal_sandbox_service import terminal_sandbox_service

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


# ============ Multi-Terminal Sandbox Endpoints ============


@router.post("/terminals", response_model=TerminalInfo)
async def create_terminal(request: CreateTerminalRequest):
    """创建终端容器

    Args:
        request: 包含 tag 和 image 的请求体

    Returns:
        TerminalInfo: 终端信息

    Raises:
        HTTPException 400: tag 格式无效
        HTTPException 409: tag 已被使用
    """
    try:
        info = await asyncio.to_thread(
            terminal_sandbox_service.create_terminal,
            tag=request.tag,
            image=request.image
        )

        # Emit container start log
        await log_manager.emit_container_log(
            info.session_id,
            f"Terminal created: {info.container_id} ({info.image}) [tag={info.tag}]",
            LogStatus.SUCCESS,
            {"container_id": info.container_id, "image": info.image, "tag": info.tag}
        )

        return info
    except ValueError as e:
        error_msg = str(e)
        if "已被使用" in error_msg:
            raise HTTPException(status_code=409, detail=error_msg)
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/terminals", response_model=TerminalListResponse)
async def list_terminals():
    """列出所有运行中的终端

    Returns:
        TerminalListResponse: 终端列表
    """
    terminals = await asyncio.to_thread(terminal_sandbox_service.list_terminals)
    return TerminalListResponse(terminals=terminals, count=len(terminals))


@router.get("/terminals/{tag}", response_model=TerminalInfo)
async def get_terminal_status(tag: str):
    """获取指定终端状态

    Args:
        tag: 终端标识

    Returns:
        TerminalInfo: 终端信息

    Raises:
        HTTPException 404: 终端不存在
    """
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        raise HTTPException(status_code=404, detail=f"终端 '{tag}' 不存在")
    return info


@router.delete("/terminals/{tag}")
async def destroy_terminal(tag: str):
    """销毁指定终端

    Args:
        tag: 终端标识

    Returns:
        成功消息

    Raises:
        HTTPException 404: 终端不存在
    """
    try:
        session_id = terminal_sandbox_service.get_session_id(tag)
        await asyncio.to_thread(terminal_sandbox_service.destroy_terminal, tag)

        if session_id:
            await log_manager.emit_container_log(
                session_id,
                f"Terminal destroyed [tag={tag}]",
                LogStatus.WARNING
            )

        return {"success": True, "message": f"终端 '{tag}' 已销毁"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/terminals/{tag}/tool", response_model=ToolResult)
async def execute_tool_in_terminal(tag: str, request: TerminalToolRequest):
    """在指定终端执行工具

    Args:
        tag: 终端标识
        request: 工具执行请求

    Returns:
        ToolResult: 执行结果

    Raises:
        HTTPException 404: 终端不存在
        HTTPException 400: 容器未运行
    """
    # Check if terminal exists
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        raise HTTPException(status_code=404, detail=f"终端 '{tag}' 不存在")
    if info.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail=f"终端 '{tag}' 未运行")

    session_id = info.session_id

    # Emit tool call log before execution
    await log_manager.emit_tool_log(
        session_id,
        f"Tool call: {request.tool.value}",
        LogStatus.NORMAL,
        {"tool": request.tool.value, "params": request.params}
    )

    # Execute tool
    result = await tool_executor.execute(
        session_id=session_id,
        tool=request.tool,
        params=request.params
    )

    # Emit result log
    status = LogStatus.SUCCESS if result.success else LogStatus.DANGER
    await log_manager.emit_tool_log(
        session_id,
        f"Tool result: {result.tool.value} - {'success' if result.success else 'failed'}",
        status,
        {"result": result.model_dump()}
    )

    return result


# ============ Deleted Terminals Management ============


@router.get("/deleted-terminals", response_model=DeletedTerminalsResponse)
async def list_deleted_terminals():
    """列出所有已删除终端

    Returns:
        DeletedTerminalsResponse: 已删除终端列表
    """
    terminals = await asyncio.to_thread(terminal_sandbox_service.list_deleted_terminals)
    total_size = sum(t.size_bytes for t in terminals)
    return DeletedTerminalsResponse(
        terminals=terminals,
        count=len(terminals),
        total_size_bytes=total_size
    )


@router.delete("/deleted-terminals/{name}", response_model=CleanupResult)
async def cleanup_deleted_terminal(name: str):
    """清理单个已删除终端

    Args:
        name: 已删除终端目录名（格式: {tag}-{timestamp}）

    Returns:
        CleanupResult: 清理结果
    """
    result = await asyncio.to_thread(
        terminal_sandbox_service.cleanup_deleted_terminal, name
    )
    return result


@router.delete("/deleted-terminals", response_model=CleanupResult)
async def cleanup_all_deleted_terminals(
    confirm: bool = Query(False, description="确认清理所有已删除终端")
):
    """清理所有已删除终端

    Args:
        confirm: 必须为 true 才会执行清理

    Returns:
        CleanupResult: 清理结果

    Raises:
        HTTPException 400: 未确认
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="需要设置 confirm=true 确认清理所有已删除终端"
        )

    result = await asyncio.to_thread(terminal_sandbox_service.cleanup_all_deleted)
    return result


# ============ Legacy Tool Endpoint (for existing frontend) ============


@router.post("/tool", response_model=ToolResult)
async def execute_tool(request: ToolCallRequest):
    """执行工具（兼容旧接口，通过 session_id 查找容器）

    Note: 新代码应使用 /terminals/{tag}/tool
    """
    # Check if container exists
    info = await asyncio.to_thread(
        container_manager.get_container_status, request.session_id
    )
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


# ============ WebSocket Logs ============


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
