"""Agent configuration CRUD + evaluation trigger."""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import require_user
from ..db.engine import get_db
from ..db.tables import AgentConfig, User
from ..services import eval_bridge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agents", tags=["agents"])


# ---- Request/Response schemas ----

class AgentCreateRequest(BaseModel):
    name: str
    api_base: str
    api_key: str = ""
    model_id: str
    system_prompt: str = ""
    tools_enabled: bool = False
    enabled_tools: list = []
    rag_enabled: bool = False
    rag_config: dict = {}
    mcp_enabled: bool = False
    mcp_servers: list = []
    features: dict = {}


class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    api_base: Optional[str] = None
    api_key: Optional[str] = None
    model_id: Optional[str] = None
    system_prompt: Optional[str] = None
    tools_enabled: Optional[bool] = None
    enabled_tools: Optional[list] = None
    rag_enabled: Optional[bool] = None
    rag_config: Optional[dict] = None
    mcp_enabled: Optional[bool] = None
    mcp_servers: Optional[list] = None
    features: Optional[dict] = None


class EvalTriggerRequest(BaseModel):
    benchmarks: List[str]
    limit: Optional[int] = None
    judge_model: Optional[str] = None


class AgentResponse(BaseModel):
    id: str
    name: str
    api_base: str
    model_id: str
    system_prompt: str = ""
    tools_enabled: bool = False
    enabled_tools: list = []
    rag_enabled: bool = False
    rag_config: dict = {}
    mcp_enabled: bool = False
    mcp_servers: list = []
    features: dict = {}
    eval_model_id: Optional[str] = None
    created_at: str = ""

    class Config:
        from_attributes = True


def _agent_to_response(agent: AgentConfig) -> dict:
    return {
        "id": agent.id,
        "name": agent.name,
        "api_base": agent.api_base,
        "model_id": agent.model_id,
        "system_prompt": agent.system_prompt or "",
        "tools_enabled": agent.tools_enabled or False,
        "enabled_tools": agent.enabled_tools or [],
        "rag_enabled": agent.rag_enabled or False,
        "rag_config": agent.rag_config or {},
        "mcp_enabled": agent.mcp_enabled or False,
        "mcp_servers": agent.mcp_servers or [],
        "features": getattr(agent, 'features', None) or {},
        "eval_model_id": agent.eval_model_id,
        "created_at": agent.created_at.isoformat() if agent.created_at else "",
    }


def _build_capability_summary(agent: AgentConfig) -> str:
    """Generate a capability summary for eval-poc description."""
    parts = []
    if agent.tools_enabled:
        tools = agent.enabled_tools or []
        parts.append(f"Tools: {', '.join(tools) if tools else 'enabled'}")
    if agent.rag_enabled:
        parts.append("RAG: enabled")
    if agent.mcp_enabled:
        servers = agent.mcp_servers or []
        parts.append(f"MCP: {len(servers)} server(s)")
    if agent.system_prompt:
        parts.append("Custom system prompt")
    return "; ".join(parts) if parts else "Basic LLM agent"


# ---- CRUD endpoints ----

@router.get("")
async def list_agents(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """List all agent configurations for the current user."""
    result = await db.execute(
        select(AgentConfig).where(AgentConfig.created_by == user.id).order_by(AgentConfig.created_at.desc())
    )
    agents = result.scalars().all()
    return [_agent_to_response(a) for a in agents]


@router.post("")
async def create_agent(
    req: AgentCreateRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new agent config and register it with eval-poc."""
    agent = AgentConfig(
        name=req.name,
        api_base=req.api_base,
        api_key_encrypted=req.api_key,  # TODO: encrypt with Fernet
        model_id=req.model_id,
        system_prompt=req.system_prompt,
        tools_enabled=req.tools_enabled,
        enabled_tools=req.enabled_tools,
        rag_enabled=req.rag_enabled,
        rag_config=req.rag_config,
        mcp_enabled=req.mcp_enabled,
        mcp_servers=req.mcp_servers,
        features=req.features,
        created_by=user.id,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    # Register with eval-poc
    try:
        eval_config = {
            "name": agent.name,
            "api_base": agent.api_base,
            "api_key": req.api_key,
            "model_id": agent.model_id,
            "provider": "Custom Agent",
            "is_agent": True,
            "description": _build_capability_summary(agent),
        }
        eval_resp = await eval_bridge.register_eval_agent(eval_config)
        agent.eval_model_id = eval_resp.get("id")
        await db.commit()
    except Exception as e:
        logger.warning("Failed to register agent with eval-poc: %s", e)
        # Don't fail the create — eval registration can be retried

    return _agent_to_response(agent)


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific agent config."""
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.id == agent_id,
            AgentConfig.created_by == user.id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _agent_to_response(agent)


@router.put("/{agent_id}")
async def update_agent(
    agent_id: str,
    req: AgentUpdateRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an agent config."""
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.id == agent_id,
            AgentConfig.created_by == user.id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    update_data = req.model_dump(exclude_none=True)
    if "api_key" in update_data:
        update_data["api_key_encrypted"] = update_data.pop("api_key")
    for key, value in update_data.items():
        setattr(agent, key, value)
    agent.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(agent)
    return _agent_to_response(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an agent config."""
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.id == agent_id,
            AgentConfig.created_by == user.id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Try to clean up from eval-poc
    if agent.eval_model_id:
        try:
            await eval_bridge.delete_eval_model(agent.eval_model_id)
        except Exception:
            pass

    await db.delete(agent)
    await db.commit()
    return {"status": "deleted"}


# ---- Evaluation trigger ----

@router.post("/{agent_id}/evaluate")
async def trigger_evaluation(
    agent_id: str,
    req: EvalTriggerRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Start an evaluation for a specific agent."""
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.id == agent_id,
            AgentConfig.created_by == user.id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Ensure agent is registered in eval-poc
    if not agent.eval_model_id:
        try:
            eval_config = {
                "name": agent.name,
                "api_base": agent.api_base,
                "api_key": agent.api_key_encrypted or "",
                "model_id": agent.model_id,
                "provider": "Custom Agent",
                "is_agent": True,
                "description": _build_capability_summary(agent),
            }
            eval_resp = await eval_bridge.register_eval_agent(eval_config)
            agent.eval_model_id = eval_resp.get("id")
            await db.commit()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to register with eval: {e}")

    # Start evaluation
    try:
        eval_payload = {
            "model_id": agent.model_id,
            "benchmarks": req.benchmarks,
            "limit": req.limit,
            "judge_model": req.judge_model,
            "agent_id": str(agent.id),
            "agent_name": agent.name,
        }
        eval_job = await eval_bridge.start_evaluation(eval_payload)
        return eval_job
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to start evaluation: {e}")
