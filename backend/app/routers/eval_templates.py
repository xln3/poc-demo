"""Eval template CRUD + run router."""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import require_user
from ..db.engine import get_db
from ..db.tables import EvalTemplate, AgentConfig, User
from ..services import eval_bridge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/eval-templates", tags=["eval-templates"])


# ---- Request/Response schemas ----

class TemplateCreateRequest(BaseModel):
    name: str
    description: str = ""
    config_json: dict = {}


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    config_json: Optional[dict] = None


class TemplateRunRequest(BaseModel):
    agent_id: str
    limit: Optional[int] = None
    judge_model: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    config_json: dict = {}
    created_at: str = ""
    updated_at: str = ""

    class Config:
        from_attributes = True


def _normalize_config(config: dict) -> dict:
    """Normalize config_json to ensure consistent field naming.

    Canonical schema:
        selected_tasks: [{benchmark: str, task: str}, ...]
        selected_benchmarks: [str, ...]  (derived from selected_tasks)
        risk_categories: [str, ...]

    Legacy/alternate field names are accepted on input and converted:
        - "benchmarks" (flat list) → selected_benchmarks
        - "tasks" → selected_tasks
    """
    if not config:
        return {}

    out = dict(config)

    # Accept legacy "tasks" key as alias for "selected_tasks"
    if "tasks" in out and "selected_tasks" not in out:
        out["selected_tasks"] = out.pop("tasks")
    elif "tasks" in out:
        out.pop("tasks")

    # Accept bare "benchmarks" key as alias for "selected_benchmarks"
    if "benchmarks" in out and "selected_benchmarks" not in out:
        out["selected_benchmarks"] = out.pop("benchmarks")
    elif "benchmarks" in out:
        out.pop("benchmarks")

    selected_tasks = out.get("selected_tasks", [])

    # Ensure selected_benchmarks is always derived from selected_tasks
    if selected_tasks:
        out["selected_benchmarks"] = list(
            {t["benchmark"] for t in selected_tasks if isinstance(t, dict) and "benchmark" in t}
        )
    elif "selected_benchmarks" not in out:
        out["selected_benchmarks"] = []

    # Ensure all expected keys exist
    out.setdefault("selected_tasks", [])
    out.setdefault("risk_categories", [])

    return out


def _template_to_response(tpl: EvalTemplate) -> dict:
    return {
        "id": tpl.id,
        "name": tpl.name,
        "description": tpl.description or "",
        "config_json": _normalize_config(tpl.config_json or {}),
        "created_at": tpl.created_at.isoformat() if tpl.created_at else "",
        "updated_at": tpl.updated_at.isoformat() if tpl.updated_at else "",
    }


# ---- CRUD endpoints ----

@router.get("")
async def list_templates(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """List all eval templates for the current user."""
    result = await db.execute(
        select(EvalTemplate)
        .where(EvalTemplate.created_by == user.id)
        .order_by(EvalTemplate.created_at.desc())
    )
    templates = result.scalars().all()
    return [_template_to_response(t) for t in templates]


@router.post("")
async def create_template(
    req: TemplateCreateRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new eval template."""
    tpl = EvalTemplate(
        name=req.name,
        description=req.description,
        config_json=_normalize_config(req.config_json),
        created_by=user.id,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return _template_to_response(tpl)


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific eval template."""
    result = await db.execute(
        select(EvalTemplate).where(
            EvalTemplate.id == template_id,
            EvalTemplate.created_by == user.id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return _template_to_response(tpl)


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    req: TemplateUpdateRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an eval template."""
    result = await db.execute(
        select(EvalTemplate).where(
            EvalTemplate.id == template_id,
            EvalTemplate.created_by == user.id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    update_data = req.model_dump(exclude_none=True)
    if "config_json" in update_data:
        update_data["config_json"] = _normalize_config(update_data["config_json"])
    for key, value in update_data.items():
        setattr(tpl, key, value)
    tpl.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tpl)
    return _template_to_response(tpl)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an eval template."""
    result = await db.execute(
        select(EvalTemplate).where(
            EvalTemplate.id == template_id,
            EvalTemplate.created_by == user.id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(tpl)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{template_id}/copy")
async def copy_template(
    template_id: str,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate an eval template."""
    result = await db.execute(
        select(EvalTemplate).where(
            EvalTemplate.id == template_id,
            EvalTemplate.created_by == user.id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    copy = EvalTemplate(
        name=f"{tpl.name} (Copy)",
        description=tpl.description,
        config_json=tpl.config_json,
        created_by=user.id,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return _template_to_response(copy)


@router.post("/{template_id}/run")
async def run_template(
    template_id: str,
    req: TemplateRunRequest,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
):
    """Run an eval template against an agent."""
    # Fetch template
    result = await db.execute(
        select(EvalTemplate).where(
            EvalTemplate.id == template_id,
            EvalTemplate.created_by == user.id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    # Fetch agent
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.id == req.agent_id,
            AgentConfig.created_by == user.id,
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Ensure agent is registered in eval-poc
    from .agents import _build_capability_summary, _build_generate_config
    from ..services.encryption import decrypt_api_key
    gen_config = _build_generate_config(agent.features or {})
    if not agent.eval_model_id:
        try:
            plain_key = decrypt_api_key(agent.api_key_encrypted) if agent.api_key_encrypted else ""
            eval_config = {
                "name": agent.name,
                "api_base": agent.api_base,
                "api_key": plain_key,
                "model_id": agent.model_id,
                "provider": "Custom Agent",
                "is_agent": True,
                "description": _build_capability_summary(agent),
                "system_prompt": agent.system_prompt or None,
                "generate_config": gen_config,
            }
            eval_resp = await eval_bridge.register_eval_agent(eval_config)
            agent.eval_model_id = eval_resp.get("id")
            await db.commit()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to register agent: {e}")

    # Extract benchmarks from normalized template config
    config = _normalize_config(tpl.config_json or {})
    benchmarks = config.get("selected_benchmarks", [])

    if not benchmarks:
        raise HTTPException(status_code=400, detail="No benchmarks selected in template")

    # Start evaluation
    try:
        eval_payload = {
            "model_id": agent.model_id,
            "model_config_id": agent.eval_model_id,
            "benchmarks": benchmarks,
            "limit": req.limit,
            "judge_model": req.judge_model,
            "agent_id": str(agent.id),
            "agent_name": agent.name,
            "system_prompt": agent.system_prompt or None,
            "generate_config": gen_config,
        }
        eval_job = await eval_bridge.start_evaluation(eval_payload)
        return eval_job
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to start evaluation: {e}")
