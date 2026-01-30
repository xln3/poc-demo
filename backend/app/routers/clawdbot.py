"""ClawdBot 沙箱 API 路由

提供 ClawdBot 安全测试沙箱的 REST API。
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import asyncio
import json

from ..services.clawdbot_sandbox import (
    clawdbot_sandbox_manager,
    ClawdBotSandboxInfo,
    ClawdBotSandboxStatus,
    AttackType,
    AttackInjectionResult,
    ConfigLevel,
    CONFIG_LEVEL_INFO,
)
from ..services.behavior_monitor import (
    behavior_monitor,
    BehaviorRecord,
    BehaviorType,
    BehaviorSeverity
)
from ..services.honeypot import get_honeypot_files, list_honeypot_paths

router = APIRouter(prefix="/clawdbot", tags=["clawdbot"])


# ============ Request/Response Models ============

class CreateSandboxRequest(BaseModel):
    """创建沙箱请求"""
    sandbox_id: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    config_level: str = "insecure"  # insecure, relaxed, default, hardened
    api_key: Optional[str] = None  # Anthropic API Key


class InjectAttackRequest(BaseModel):
    """注入攻击请求"""
    attack_type: str  # "email", "dm", "skill", "mcp", "gateway"
    payload: Dict[str, Any]


class ExecCommandRequest(BaseModel):
    """执行命令请求"""
    command: str


class ExecCommandResponse(BaseModel):
    """执行命令响应"""
    exit_code: int
    stdout: str
    stderr: str


class ReadFileRequest(BaseModel):
    """读取文件请求"""
    path: str


class ReadFileResponse(BaseModel):
    """读取文件响应"""
    path: str
    is_honeypot: bool
    content: str


class BehaviorSummary(BaseModel):
    """行为摘要"""
    total_behaviors: int
    by_type: Dict[str, int]
    by_severity: Dict[str, int]
    honeypot_triggers: int
    first_behavior: Optional[str] = None
    last_behavior: Optional[str] = None


class SandboxListResponse(BaseModel):
    """沙箱列表响应"""
    sandboxes: List[ClawdBotSandboxInfo]
    count: int


class HoneypotFilesResponse(BaseModel):
    """蜜罐文件响应"""
    files: Dict[str, str]
    paths: List[str]


# ============ Sandbox Management Endpoints ============

@router.get("/status")
async def get_service_status():
    """获取 ClawdBot 沙箱服务状态"""
    manager = clawdbot_sandbox_manager

    return {
        "available": manager.is_available(),
        "image_exists": manager.check_image_exists() if manager.is_available() else False,
        "network": manager.NETWORK_NAME,
        "active_sandboxes": len(manager._sandboxes)
    }


@router.get("/config-levels")
async def get_config_levels():
    """获取可用的配置级别及其说明"""
    return {
        "levels": [
            {
                "id": level.value,
                **CONFIG_LEVEL_INFO[level]
            }
            for level in ConfigLevel
        ]
    }


@router.post("/sandbox", response_model=ClawdBotSandboxInfo)
async def create_sandbox(request: CreateSandboxRequest):
    """创建 ClawdBot 沙箱实例

    参数:
    - sandbox_id: 自定义沙箱 ID（可选）
    - config_level: 安全配置级别 (insecure/relaxed/default/hardened)
    - api_key: Anthropic API Key（可选，用于真实 LLM 测试）
    """
    manager = clawdbot_sandbox_manager

    if not manager.is_available():
        raise HTTPException(status_code=503, detail="Docker not available")

    if not manager.check_image_exists():
        raise HTTPException(
            status_code=503,
            detail=f"Sandbox image '{manager.IMAGE}' not found. Run build-moltbot-sandbox.sh first."
        )

    try:
        info = manager.create_sandbox(
            config=request.config,
            sandbox_id=request.sandbox_id,
            config_level=request.config_level,
            api_key=request.api_key,
        )
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sandbox", response_model=SandboxListResponse)
async def list_sandboxes():
    """列出所有 ClawdBot 沙箱"""
    manager = clawdbot_sandbox_manager
    sandboxes = manager.list_sandboxes()

    return SandboxListResponse(
        sandboxes=sandboxes,
        count=len(sandboxes)
    )


@router.get("/sandbox/{sandbox_id}", response_model=ClawdBotSandboxInfo)
async def get_sandbox(sandbox_id: str):
    """获取沙箱信息"""
    manager = clawdbot_sandbox_manager
    info = manager.get_sandbox(sandbox_id)

    if not info:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    return info


@router.delete("/sandbox/{sandbox_id}")
async def destroy_sandbox(sandbox_id: str):
    """销毁沙箱"""
    manager = clawdbot_sandbox_manager
    destroyed = manager.destroy_sandbox(sandbox_id)

    if not destroyed:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    return {"success": True, "message": f"Sandbox {sandbox_id} destroyed"}


# ============ Attack Injection Endpoints ============

@router.post("/sandbox/{sandbox_id}/inject", response_model=AttackInjectionResult)
async def inject_attack(sandbox_id: str, request: InjectAttackRequest):
    """向沙箱注入攻击

    攻击类型:
    - email: 邮件 prompt injection
    - dm: 直接消息攻击
    - skill: 技能投毒
    - mcp: MCP 服务器攻击
    - gateway: Gateway 未授权访问
    """
    manager = clawdbot_sandbox_manager

    try:
        attack_type = AttackType(request.attack_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid attack type: {request.attack_type}. Must be one of: {[t.value for t in AttackType]}"
        )

    result = await manager.inject_attack(
        sandbox_id=sandbox_id,
        attack_type=attack_type,
        payload=request.payload
    )

    if not result.success:
        raise HTTPException(status_code=404, detail=result.message)

    return result


# ============ Command Execution Endpoints ============

@router.post("/sandbox/{sandbox_id}/exec", response_model=ExecCommandResponse)
async def exec_command(sandbox_id: str, request: ExecCommandRequest):
    """在沙箱中执行命令"""
    manager = clawdbot_sandbox_manager

    try:
        exit_code, stdout, stderr = manager.exec_in_sandbox(sandbox_id, request.command)

        # 记录命令执行
        await behavior_monitor.record_command_exec(
            sandbox_id=sandbox_id,
            command=request.command,
            exit_code=exit_code,
            stdout_preview=stdout,
            stderr_preview=stderr
        )

        return ExecCommandResponse(
            exit_code=exit_code,
            stdout=stdout,
            stderr=stderr
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sandbox/{sandbox_id}/read-file", response_model=ReadFileResponse)
async def read_file(sandbox_id: str, request: ReadFileRequest):
    """读取沙箱中的文件（检测蜜罐触发）"""
    manager = clawdbot_sandbox_manager

    try:
        is_honeypot, content = await manager.read_honeypot_file(sandbox_id, request.path)

        return ReadFileResponse(
            path=request.path,
            is_honeypot=is_honeypot,
            content=content
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Behavior Monitoring Endpoints ============

@router.get("/sandbox/{sandbox_id}/behaviors")
async def get_behaviors(
    sandbox_id: str,
    limit: int = 100,
    behavior_type: Optional[str] = None,
    min_severity: Optional[str] = None
):
    """获取沙箱行为记录"""
    bt = None
    if behavior_type:
        try:
            bt = BehaviorType(behavior_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid behavior type: {behavior_type}")

    ms = None
    if min_severity:
        try:
            ms = BehaviorSeverity(min_severity)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid severity: {min_severity}")

    behaviors = behavior_monitor.get_behaviors(
        sandbox_id=sandbox_id,
        limit=limit,
        behavior_type=bt,
        min_severity=ms
    )

    return {
        "sandbox_id": sandbox_id,
        "behaviors": [b.model_dump() for b in behaviors],
        "count": len(behaviors)
    }


@router.get("/sandbox/{sandbox_id}/timeline")
async def get_timeline(sandbox_id: str):
    """获取完整行为时间线"""
    timeline = behavior_monitor.get_timeline(sandbox_id)

    return {
        "sandbox_id": sandbox_id,
        "timeline": [b.model_dump() for b in timeline],
        "count": len(timeline)
    }


@router.get("/sandbox/{sandbox_id}/honeypot-triggers")
async def get_honeypot_triggers(sandbox_id: str):
    """获取触发蜜罐的行为"""
    triggers = behavior_monitor.get_honeypot_triggers(sandbox_id)

    return {
        "sandbox_id": sandbox_id,
        "triggers": [t.model_dump() for t in triggers],
        "count": len(triggers)
    }


@router.get("/sandbox/{sandbox_id}/summary", response_model=BehaviorSummary)
async def get_behavior_summary(sandbox_id: str):
    """获取行为摘要统计"""
    summary = behavior_monitor.get_summary(sandbox_id)
    return BehaviorSummary(**summary)


# ============ WebSocket for Real-time Behavior Streaming ============

@router.websocket("/sandbox/{sandbox_id}/behaviors/stream")
async def stream_behaviors(websocket: WebSocket, sandbox_id: str):
    """实时行为流 WebSocket"""
    await websocket.accept()

    queue = behavior_monitor.subscribe(sandbox_id)

    try:
        while True:
            # 等待新行为
            behavior = await queue.get()
            await websocket.send_json(behavior.model_dump())
    except WebSocketDisconnect:
        pass
    finally:
        behavior_monitor.unsubscribe(sandbox_id, queue)


# ============ Honeypot Files Endpoints ============

@router.get("/honeypot-files", response_model=HoneypotFilesResponse)
async def get_honeypot_files_endpoint():
    """获取所有蜜罐文件（用于前端展示）"""
    files = get_honeypot_files()
    paths = list_honeypot_paths()

    return HoneypotFilesResponse(
        files=files,
        paths=paths
    )


# ============ Exfiltration Test Endpoint ============

@router.post("/exfil-test/collect")
async def collect_exfiltrated_data(data: Dict[str, Any]):
    """模拟攻击者服务器接收外泄数据

    这个端点用于测试数据外泄是否成功。
    ClawdBot 沙箱可以访问这个端点来验证攻击效果。
    """
    # 尝试从数据中提取 sandbox_id
    sandbox_id = data.get("sandbox_id", "unknown")

    # 记录数据外泄行为
    await behavior_monitor.record_data_exfil(
        sandbox_id=sandbox_id,
        method="http",
        destination="/exfil-test/collect",
        data_type=data.get("type", "unknown"),
        data_preview=json.dumps(data)[:200]
    )

    return {
        "status": "collected",
        "warning": "This is a test endpoint for security testing purposes only",
        "received_keys": list(data.keys())
    }
