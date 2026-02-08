from __future__ import annotations
import asyncio
import io
import json
import tarfile
from typing import List, Optional
from urllib.parse import quote
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query, File, UploadFile, Form, Header, Body, Request, Depends
from fastapi.responses import StreamingResponse
from datetime import datetime
from jose import jwt
from ..auth.security import require_auth, SECRET_KEY, ALGORITHM
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
    FileListResponse,
)
from ..services.container import container_manager
from ..services.tools import tool_executor
from ..services.log_manager import log_manager
from ..services.terminal_sandbox_service import terminal_sandbox_service
from ..services.terminal_lock import terminal_lock
from ..services.file_watcher import file_watcher
from ..services.container import container_manager as cm
from ..config import TRANSFER_CONFIG

router = APIRouter(prefix="/sandbox", tags=["sandbox"])


# ============ Multi-Terminal Sandbox Endpoints ============


@router.post("/terminals", response_model=TerminalInfo, dependencies=[Depends(require_auth)])
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


@router.get("/terminals", response_model=TerminalListResponse, dependencies=[Depends(require_auth)])
async def list_terminals():
    """列出所有运行中的终端

    Returns:
        TerminalListResponse: 终端列表
    """
    terminals = await asyncio.to_thread(terminal_sandbox_service.list_terminals)
    return TerminalListResponse(terminals=terminals, count=len(terminals))


@router.get("/terminals/{tag}", response_model=TerminalInfo, dependencies=[Depends(require_auth)])
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


@router.delete("/terminals/{tag}", dependencies=[Depends(require_auth)])
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


@router.post("/terminals/{tag}/tool", response_model=ToolResult, dependencies=[Depends(require_auth)])
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


# ============ File Management Endpoints ============


@router.get("/terminals/{tag}/files", response_model=FileListResponse, dependencies=[Depends(require_auth)])
async def list_files(
    tag: str,
    path: str = Query("/workspace", description="目录路径"),
    recursive: bool = Query(False, description="是否递归列出"),
):
    """获取终端文件列表（结构化）

    使用 find -printf 命令获取文件信息，正确处理含空格/中文的文件名。
    """
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        raise HTTPException(status_code=404, detail=f"终端 '{tag}' 不存在")
    if info.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail=f"终端 '{tag}' 未运行")

    try:
        result = await tool_executor.list_dir_structured(
            session_id=info.session_id,
            path=path,
            recursive=recursive
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/terminals/{tag}/files", dependencies=[Depends(require_auth)])
async def upload_file(
    tag: str,
    file: UploadFile = File(...),
    path: str = Form("/workspace"),
    x_source: Optional[str] = Header(None, alias="X-Source"),
):
    """上传文件到终端容器

    支持任意文件类型，自动处理二进制内容。
    X-Source header 用于区分上传来源（UI/API）。
    """
    # 验证终端存在
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        raise HTTPException(status_code=404, detail=f"终端 '{tag}' 不存在")
    if info.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail=f"终端 '{tag}' 未运行")

    # 路径安全检查 — sanitize both upload dir and filename
    import posixpath
    sanitized_dir = posixpath.normpath(path)
    sanitized_name = posixpath.basename(file.filename or "upload")
    if not sanitized_name or sanitized_name in (".", ".."):
        raise HTTPException(status_code=400, detail="无效的文件名")

    full_path = f"{sanitized_dir.rstrip('/')}/{sanitized_name}"

    # Validate resolved path stays within allowed directories
    resolved = posixpath.normpath(full_path)
    allowed = any(resolved == base or resolved.startswith(base + "/") for base in TRANSFER_CONFIG['allowed_paths'])
    if not allowed:
        raise HTTPException(
            status_code=400,
            detail=f"路径必须位于 {TRANSFER_CONFIG['allowed_paths']} 之内"
        )

    # 检查文件大小
    content = await file.read()
    if len(content) > TRANSFER_CONFIG['max_file_size']:
        raise HTTPException(
            status_code=413,
            detail=f"文件过大，最大允许 {TRANSFER_CONFIG['max_file_size'] // (1024*1024)}MB"
        )

    try:
        await asyncio.to_thread(
            container_manager.copy_file_to_container,
            info.session_id,
            full_path,
            content
        )

        return {
            "success": True,
            "path": full_path,
            "size": len(content),
            "source": x_source or "api",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/terminals/{tag}/files/download", dependencies=[Depends(require_auth)])
async def download_file(
    tag: str,
    path: str = Query(..., description="文件路径"),
):
    """下载文件/目录

    单文件直接返回，目录返回 tar 归档。
    """
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        raise HTTPException(status_code=404, detail=f"终端 '{tag}' 不存在")
    if info.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail=f"终端 '{tag}' 未运行")

    # 路径安全检查
    import posixpath
    resolved = posixpath.normpath(path)
    allowed = any(resolved == base or resolved.startswith(base + "/") for base in TRANSFER_CONFIG['allowed_paths'])
    if not allowed:
        raise HTTPException(status_code=400, detail="路径不在允许范围内")

    try:
        tar_data, stat = await asyncio.to_thread(
            container_manager.get_archive,
            info.session_id,
            path
        )

        filename = path.split('/')[-1]

        # 检测是否是目录
        # Docker SDK 返回的 stat['mode'] 是整数 (十进制)
        # S_IFDIR = 0o040000 = 16384
        # 目录的 mode 格式: 0o40xxx (如 0o40755 = 16877)
        mode = stat.get('mode', 0)
        if isinstance(mode, str):
            # 兼容可能的字符串格式
            mode = int(mode, 8) if mode.startswith('0') or mode.isdigit() else 0
        is_dir = (mode & 0o170000) == 0o040000  # S_IFDIR

        # 备选检测：通过 tar 内容判断
        if not is_dir:
            tar_io = io.BytesIO(tar_data)
            with tarfile.open(fileobj=tar_io, mode='r') as tar:
                members = tar.getmembers()
                # 如果 tar 包含多个成员，或者第一个成员是目录，则认为是目录下载
                if len(members) > 1 or (members and members[0].isdir()):
                    is_dir = True
            tar_io.seek(0)

        if is_dir:
            # 目录返回 tar
            encoded_filename = quote(f"{filename}.tar")
            return StreamingResponse(
                io.BytesIO(tar_data),
                media_type="application/x-tar",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                    "Content-Length": str(len(tar_data))
                }
            )
        else:
            # 单文件：从 tar 中提取
            tar_io = io.BytesIO(tar_data)
            with tarfile.open(fileobj=tar_io, mode='r') as tar:
                member = tar.getmembers()[0]
                f = tar.extractfile(member)
                file_content = f.read() if f else b''

            encoded_filename = quote(filename)
            return StreamingResponse(
                io.BytesIO(file_content),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
                    "Content-Length": str(len(file_content))
                }
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Terminal Lock Endpoints ============


@router.post("/terminals/{tag}/lock", dependencies=[Depends(require_auth)])
async def acquire_lock(
    tag: str,
    request: Request,
    user_id: str = Body(..., embed=True),
):
    """获取终端独占锁

    Args:
        tag: 终端标识
        user_id: 用户标识（前端生成的 UUID）

    Returns:
        {"success": bool, "holder": str|None, "holder_ip": str|None, "message": str}
    """
    # 验证终端存在
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        raise HTTPException(status_code=404, detail=f"终端 '{tag}' 不存在")

    # 获取客户端 IP（支持多层代理转发）
    client_ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.headers.get("X-Real-IP", "").strip()
        or (request.client.host if request.client else None)
    )
    # 去除 IPv6 前缀
    if client_ip and client_ip.startswith("::ffff:"):
        client_ip = client_ip[7:]

    result = await asyncio.to_thread(terminal_lock.acquire, tag, user_id, client_ip)
    return result


@router.delete("/terminals/{tag}/lock", dependencies=[Depends(require_auth)])
async def release_lock(
    tag: str,
    user_id: str = Query(..., description="用户标识"),
):
    """释放终端独占锁

    Args:
        tag: 终端标识
        user_id: 用户标识
    """
    result = await asyncio.to_thread(terminal_lock.release, tag, user_id)
    return result


@router.post("/terminals/{tag}/lock/heartbeat", dependencies=[Depends(require_auth)])
async def lock_heartbeat(
    tag: str,
    user_id: str = Body(..., embed=True),
):
    """锁心跳续期

    前端应每 30 秒调用一次以保持锁有效
    """
    result = await asyncio.to_thread(terminal_lock.heartbeat, tag, user_id)
    return result


@router.get("/terminals/{tag}/lock", dependencies=[Depends(require_auth)])
async def get_lock_status(tag: str, request: Request):
    """获取锁状态

    Returns:
        {"locked": bool, "holder": str|None, "acquired_at": str|None, "expired": bool, "is_same_ip": bool}
    """
    result = await asyncio.to_thread(terminal_lock.get_status, tag)

    # 获取请求者 IP，判断是否同 IP
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.client.host if request.client else None

    holder_ip = result.get("holder_ip")
    result["is_same_ip"] = bool(client_ip and holder_ip and client_ip == holder_ip)

    return result


# ============ Deleted Terminals Management ============


@router.get("/deleted-terminals", response_model=DeletedTerminalsResponse, dependencies=[Depends(require_auth)])
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


@router.delete("/deleted-terminals/{name}", response_model=CleanupResult, dependencies=[Depends(require_auth)])
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


@router.delete("/deleted-terminals", response_model=CleanupResult, dependencies=[Depends(require_auth)])
async def cleanup_all_deleted_terminals(
    confirm: bool = Query(False, description="确认清理所有已删除终端"),
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


@router.post("/tool", response_model=ToolResult, dependencies=[Depends(require_auth)])
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
async def websocket_logs(websocket: WebSocket, session_id: str, token: str = Query(None)):
    """WebSocket endpoint for real-time logs."""
    if not token:
        await websocket.close(code=4001, reason="Auth required")
        return
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
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


# ============ File Watcher WebSocket ============


@router.websocket("/terminals/{tag}/watch")
async def websocket_file_watch(websocket: WebSocket, tag: str, path: str = "/workspace", token: str = Query(None)):
    """WebSocket endpoint for file change monitoring.

    前端连接后会启动 inotifywait 监控指定目录，
    文件变化会通过 WebSocket 推送。

    Args:
        tag: 终端标识
        path: 监控路径 (默认 /workspace)
    """
    if not token:
        await websocket.close(code=4001, reason="Auth required")
        return
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    # 验证终端存在
    info = await asyncio.to_thread(terminal_sandbox_service.get_terminal, tag)
    if info is None:
        await websocket.close(code=4004, reason=f"终端 '{tag}' 不存在")
        return
    if info.status != ContainerStatus.RUNNING:
        await websocket.close(code=4000, reason=f"终端 '{tag}' 未运行")
        return

    await websocket.accept()

    # 事件队列
    event_queue = asyncio.Queue()

    def on_event(event: dict):
        """事件回调"""
        try:
            event_queue.put_nowait(event)
        except asyncio.QueueFull:
            pass  # 丢弃溢出事件

    # 启动监控
    try:
        await file_watcher.start_watching(
            tag=tag,
            session_id=info.session_id,
            path=path,
            callback=on_event,
            container_manager=cm,
        )

        # 发送初始消息
        await websocket.send_text(json.dumps({
            "type": "watching",
            "path": path,
            "timestamp": datetime.now().isoformat(),
        }))

        # 转发事件
        while True:
            try:
                event = await asyncio.wait_for(event_queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(event))
            except asyncio.TimeoutError:
                # 发送心跳
                await websocket.send_text(json.dumps({"type": "heartbeat"}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": str(e),
            }))
        except Exception:
            pass
    finally:
        await file_watcher.stop_watching(tag)
