"""Report Editor CRUD + LLM streaming router (legacy + modular V2)."""

import json as _json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import get_current_user
from ..db.engine import get_db
from ..db.tables import Report, ReportHistory, ReportOutline, ReportModule, User
from ..services.report_llm import build_data_context, stream_report_html, stream_section_regen
from ..services.report_llm_v2 import (
    stream_outline_generation,
    stream_module_generation,
    orchestrate_module_generation,
    build_module_data_context,
    generate_chart_config,
    generate_image,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/report-editor", tags=["report-editor"])


# ---- Schemas ----

class ReportCreate(BaseModel):
    title: str
    scenario_type: str = "single_agent"
    system_prompt: Optional[str] = None
    source_data: dict = Field(default_factory=dict)
    metadata_json: dict = Field(default_factory=dict)
    generation_mode: str = "modular"  # legacy | modular (new reports default to modular)

class ReportUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    metadata_json: Optional[dict] = None
    change_summary: Optional[str] = None

class ReportSummary(BaseModel):
    id: str
    title: str
    scenario_type: str
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    generation_mode: str = "legacy"
    source_data: dict = Field(default_factory=dict)

class HistoryEntry(BaseModel):
    id: int
    version: int
    change_summary: Optional[str] = None
    created_at: Optional[str] = None


# ---- Helpers ----

def _ts(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


async def _get_next_version(db: AsyncSession, report_id: str) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(ReportHistory.version), 0))
        .where(ReportHistory.report_id == report_id)
    )
    return result.scalar() + 1


async def _create_snapshot(db: AsyncSession, report: Report, summary: str):
    version = await _get_next_version(db, report.id)
    snapshot = ReportHistory(
        report_id=report.id,
        version=version,
        content=report.content,
        change_summary=summary,
    )
    db.add(snapshot)


# ---- Endpoints ----

@router.get("")
async def list_reports(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all reports (summary)."""
    result = await db.execute(
        select(Report).order_by(desc(Report.created_at))
    )
    reports = result.scalars().all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "scenario_type": r.scenario_type,
            "generation_mode": r.generation_mode,
            "status": r.status,
            "created_at": _ts(r.created_at),
            "updated_at": _ts(r.updated_at),
            "source_data": r.source_data or {},
        }
        for r in reports
    ]


@router.post("")
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new report."""
    report = Report(
        title=body.title,
        scenario_type=body.scenario_type,
        system_prompt=body.system_prompt,
        source_data=body.source_data,
        metadata_json=body.metadata_json,
        generation_mode=body.generation_mode,
        status="draft",
        created_by=user.id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {
        "id": report.id,
        "title": report.title,
        "scenario_type": report.scenario_type,
        "generation_mode": report.generation_mode,
        "status": report.status,
        "created_at": _ts(report.created_at),
    }


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get full report including HTML content."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id,
        "title": report.title,
        "content": report.content,
        "scenario_type": report.scenario_type,
        "generation_mode": report.generation_mode,
        "system_prompt": report.system_prompt,
        "source_data": report.source_data,
        "metadata_json": report.metadata_json,
        "status": report.status,
        "created_at": _ts(report.created_at),
        "updated_at": _ts(report.updated_at),
    }


@router.put("/{report_id}")
async def update_report(
    report_id: str,
    body: ReportUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update report. Auto-creates history snapshot if content changes."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Snapshot old content if content is changing
    if body.content is not None and report.content and body.content != report.content:
        await _create_snapshot(
            db, report,
            body.change_summary or "Manual edit",
        )

    if body.title is not None:
        report.title = body.title
    if body.content is not None:
        report.content = body.content
    if body.status is not None:
        report.status = body.status
    if body.metadata_json is not None:
        report.metadata_json = body.metadata_json
    report.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(report)
    return {"id": report.id, "status": report.status, "updated_at": _ts(report.updated_at)}


@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a report and all its history."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)
    await db.commit()
    return {"ok": True}


@router.get("/{report_id}/history")
async def list_history(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List version history for a report."""
    result = await db.execute(
        select(ReportHistory)
        .where(ReportHistory.report_id == report_id)
        .order_by(desc(ReportHistory.version))
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "version": e.version,
            "change_summary": e.change_summary,
            "created_at": _ts(e.created_at),
        }
        for e in entries
    ]


@router.get("/{report_id}/history/{version}")
async def get_history_content(
    report_id: str,
    version: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the HTML content of a specific history version."""
    result = await db.execute(
        select(ReportHistory)
        .where(ReportHistory.report_id == report_id, ReportHistory.version == version)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="History version not found")
    return {
        "version": entry.version,
        "content": entry.content,
        "change_summary": entry.change_summary,
        "created_at": _ts(entry.created_at),
    }


@router.put("/{report_id}/rollback/{version}")
async def rollback_report(
    report_id: str,
    version: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Rollback report to a previous version. Creates new snapshot of current content first."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    hist_result = await db.execute(
        select(ReportHistory)
        .where(ReportHistory.report_id == report_id, ReportHistory.version == version)
    )
    target = hist_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="History version not found")

    # Snapshot current before rollback
    if report.content:
        await _create_snapshot(db, report, f"Before rollback to v{version}")

    report.content = target.content
    report.updated_at = datetime.utcnow()
    await db.commit()

    # Snapshot the rollback
    await _create_snapshot(db, report, f"Rollback to v{version}")
    await db.commit()

    return {"id": report.id, "status": report.status, "updated_at": _ts(report.updated_at)}


# ---- DB context helper for background saves ----

from contextlib import asynccontextmanager
from ..db.engine import AsyncSessionLocal

@asynccontextmanager
async def get_db_context():
    """Get a DB session outside of FastAPI dependency injection."""
    async with AsyncSessionLocal() as session:
        yield session


# ---- LLM Streaming Endpoints ----

@router.post("/{report_id}/generate")
async def generate_report_stream(
    report_id: str,
    lang: str = Query("zh", description="Report language: zh or en"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream LLM-generated HTML report via SSE."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Snapshot existing content before regeneration
    if report.content:
        await _create_snapshot(db, report, "Before LLM generation")

    report.status = "generating"
    report.updated_at = datetime.utcnow()
    await db.commit()

    # Build data context from eval data
    data_context = await build_data_context(report.source_data)

    async def event_stream():
        import json as _json
        accumulated = []
        try:
            async for chunk in stream_report_html(
                system_prompt=report.system_prompt or "",
                data_context=data_context,
                scenario_type=report.scenario_type,
                lang=lang,
            ):
                # Extract content for accumulation
                if chunk.startswith("data: ") and "[DONE]" not in chunk:
                    try:
                        parsed = _json.loads(chunk[6:])
                        if "content" in parsed:
                            accumulated.append(parsed["content"])
                    except Exception:
                        pass
                yield chunk

            # Save accumulated content to DB
            final_html = "".join(accumulated)
            if final_html:
                async with get_db_context() as save_db:
                    res = await save_db.execute(select(Report).where(Report.id == report_id))
                    rpt = res.scalar_one_or_none()
                    if rpt:
                        rpt.content = final_html
                        rpt.status = "ready"
                        rpt.updated_at = datetime.utcnow()
                        await save_db.commit()
                        await _create_snapshot(save_db, rpt, "LLM generation")
                        await save_db.commit()
        except Exception as e:
            logger.error("Stream generation error: %s", e)
            yield f"data: {_json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class SectionRegenRequest(BaseModel):
    selected_html: str
    instruction: str


@router.post("/{report_id}/regenerate-section")
async def regenerate_section(
    report_id: str,
    body: SectionRegenRequest,
    lang: str = Query("zh", description="Report language: zh or en"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream AI regeneration of a selected HTML section."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    data_context = await build_data_context(report.source_data)

    return StreamingResponse(
        stream_section_regen(
            report_content=report.content or "",
            selected_html=body.selected_html,
            instruction=body.instruction,
            data_context=data_context,
            lang=lang,
        ),
        media_type="text/event-stream",
    )


# ======================================================================
# Modular V2 Endpoints — Outline, Modules, Charts, Images
# ======================================================================

# ---- Outline ----

@router.post("/{report_id}/generate-outline")
async def generate_outline_stream(
    report_id: str,
    lang: str = Query("zh", description="Report language: zh or en"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream outline generation for a modular report (SSE)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    data_context = await build_data_context(report.source_data)

    async def event_stream():
        outline_data = None
        async for event_str in stream_outline_generation(
            scenario_type=report.scenario_type,
            data_context=data_context,
            system_prompt=report.system_prompt,
            lang=lang,
        ):
            # Capture outline_complete for DB save
            if "outline_complete" in event_str:
                try:
                    data_line = event_str.strip().split("data: ", 1)[1]
                    parsed = _json.loads(data_line)
                    if parsed.get("type") == "outline_complete":
                        outline_data = parsed.get("outline")
                except Exception:
                    pass
            yield event_str

        # Save outline to DB
        if outline_data:
            async with get_db_context() as save_db:
                # Upsert outline
                res = await save_db.execute(
                    select(ReportOutline).where(ReportOutline.report_id == report_id)
                )
                existing = res.scalar_one_or_none()
                if existing:
                    existing.outline_json = outline_data
                    existing.status = "draft"
                    existing.updated_at = datetime.utcnow()
                else:
                    outline = ReportOutline(
                        report_id=report_id,
                        outline_json=outline_data,
                        status="draft",
                    )
                    save_db.add(outline)
                await save_db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{report_id}/outline")
async def get_outline(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get current outline for a report."""
    result = await db.execute(
        select(ReportOutline).where(ReportOutline.report_id == report_id)
    )
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    return {
        "id": outline.id,
        "report_id": outline.report_id,
        "outline_json": outline.outline_json,
        "status": outline.status,
        "created_at": _ts(outline.created_at),
        "updated_at": _ts(outline.updated_at),
    }


class OutlineUpdate(BaseModel):
    outline_json: Optional[dict] = None
    status: Optional[str] = None  # draft | approved | generating


@router.put("/{report_id}/outline")
async def update_outline(
    report_id: str,
    body: OutlineUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update or approve an outline."""
    result = await db.execute(
        select(ReportOutline).where(ReportOutline.report_id == report_id)
    )
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")

    if body.outline_json is not None:
        outline.outline_json = body.outline_json
    if body.status is not None:
        outline.status = body.status
    outline.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(outline)
    return {
        "id": outline.id,
        "status": outline.status,
        "updated_at": _ts(outline.updated_at),
    }


# ---- Modules ----

@router.post("/{report_id}/generate-modules")
async def generate_modules_stream(
    report_id: str,
    lang: str = Query("zh", description="Report language: zh or en"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Start parallel module generation from approved outline (SSE)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    outline_result = await db.execute(
        select(ReportOutline).where(ReportOutline.report_id == report_id)
    )
    outline = outline_result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found. Generate outline first.")

    modules_meta = outline.outline_json.get("modules", [])
    if not modules_meta:
        raise HTTPException(status_code=400, detail="Outline has no modules")

    # Set outline status to generating
    outline.status = "generating"
    report.status = "generating"
    report.updated_at = datetime.utcnow()

    # Create/reset module records
    # Delete existing modules for this report
    existing = await db.execute(
        select(ReportModule).where(ReportModule.report_id == report_id)
    )
    for m in existing.scalars().all():
        await db.delete(m)
    await db.flush()

    # Create fresh module records
    module_ids = []
    for i, meta in enumerate(modules_meta):
        mod = ReportModule(
            report_id=report_id,
            order_index=i,
            title=meta.get("title", f"Module {i + 1}"),
            description=meta.get("description", ""),
            status="pending",
            depends_on=meta.get("depends_on_indices", []),
            data_keys=meta.get("data_keys", []),
        )
        db.add(mod)
        module_ids.append(mod.id)
    await db.commit()

    data_context = await build_data_context(report.source_data)

    async def event_stream():
        module_contents = {}
        async for event_str in orchestrate_module_generation(
            modules_meta=modules_meta,
            full_data_context=data_context,
            system_prompt=report.system_prompt,
            lang=lang,
        ):
            # Save module content on completion
            if "module_complete" in event_str:
                try:
                    data_line = event_str.strip().split("data: ", 1)[1]
                    parsed = _json.loads(data_line)
                    if parsed.get("type") == "module_complete":
                        idx = parsed.get("module_index", -1)
                        content = parsed.get("content", "")
                        module_contents[idx] = content
                        # Save to DB
                        async with get_db_context() as save_db:
                            res = await save_db.execute(
                                select(ReportModule)
                                .where(
                                    ReportModule.report_id == report_id,
                                    ReportModule.order_index == idx,
                                )
                            )
                            mod = res.scalar_one_or_none()
                            if mod:
                                mod.content = content
                                mod.status = "ready"
                                mod.updated_at = datetime.utcnow()
                                await save_db.commit()
                except Exception as e:
                    logger.error("Failed to save module content: %s", e)

            elif "module_error" in event_str:
                try:
                    data_line = event_str.strip().split("data: ", 1)[1]
                    parsed = _json.loads(data_line)
                    if parsed.get("type") == "module_error":
                        idx = parsed.get("module_index", -1)
                        async with get_db_context() as save_db:
                            res = await save_db.execute(
                                select(ReportModule)
                                .where(
                                    ReportModule.report_id == report_id,
                                    ReportModule.order_index == idx,
                                )
                            )
                            mod = res.scalar_one_or_none()
                            if mod:
                                mod.status = "error"
                                mod.generation_meta = {"error": parsed.get("error", "")}
                                mod.updated_at = datetime.utcnow()
                                await save_db.commit()
                except Exception as e:
                    logger.error("Failed to save module error: %s", e)

            yield event_str

        # Assemble final report content and update status
        async with get_db_context() as save_db:
            res = await save_db.execute(select(Report).where(Report.id == report_id))
            rpt = res.scalar_one_or_none()
            if rpt:
                rpt.status = "ready"
                rpt.updated_at = datetime.utcnow()
                # Assemble content from all modules
                assembled = []
                mods_res = await save_db.execute(
                    select(ReportModule)
                    .where(ReportModule.report_id == report_id)
                    .order_by(ReportModule.order_index)
                )
                for mod in mods_res.scalars().all():
                    if mod.content:
                        assembled.append(mod.content)
                rpt.content = "\n\n".join(assembled)
                await save_db.commit()

            # Mark outline as approved (generation done)
            ol_res = await save_db.execute(
                select(ReportOutline).where(ReportOutline.report_id == report_id)
            )
            ol = ol_res.scalar_one_or_none()
            if ol:
                ol.status = "approved"
                ol.updated_at = datetime.utcnow()
                await save_db.commit()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{report_id}/modules")
async def list_modules(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all modules for a report."""
    result = await db.execute(
        select(ReportModule)
        .where(ReportModule.report_id == report_id)
        .order_by(ReportModule.order_index)
    )
    modules = result.scalars().all()
    return [
        {
            "id": m.id,
            "report_id": m.report_id,
            "order_index": m.order_index,
            "title": m.title,
            "description": m.description,
            "content": m.content,
            "status": m.status,
            "depends_on": m.depends_on,
            "data_keys": m.data_keys,
            "chart_configs": m.chart_configs,
            "created_at": _ts(m.created_at),
            "updated_at": _ts(m.updated_at),
        }
        for m in modules
    ]


@router.get("/{report_id}/modules/{module_id}")
async def get_module(
    report_id: str,
    module_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single module."""
    result = await db.execute(
        select(ReportModule)
        .where(ReportModule.id == module_id, ReportModule.report_id == report_id)
    )
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    return {
        "id": mod.id,
        "report_id": mod.report_id,
        "order_index": mod.order_index,
        "title": mod.title,
        "description": mod.description,
        "content": mod.content,
        "status": mod.status,
        "depends_on": mod.depends_on,
        "data_keys": mod.data_keys,
        "chart_configs": mod.chart_configs,
        "generation_meta": mod.generation_meta,
        "created_at": _ts(mod.created_at),
        "updated_at": _ts(mod.updated_at),
    }


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None
    chart_configs: Optional[list] = None


@router.put("/{report_id}/modules/{module_id}")
async def update_module(
    report_id: str,
    module_id: str,
    body: ModuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a module's content or metadata."""
    result = await db.execute(
        select(ReportModule)
        .where(ReportModule.id == module_id, ReportModule.report_id == report_id)
    )
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    if body.title is not None:
        mod.title = body.title
    if body.content is not None:
        mod.content = body.content
    if body.description is not None:
        mod.description = body.description
    if body.chart_configs is not None:
        mod.chart_configs = body.chart_configs
    mod.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(mod)
    return {"id": mod.id, "status": mod.status, "updated_at": _ts(mod.updated_at)}


@router.post("/{report_id}/modules/{module_id}/regenerate")
async def regenerate_module_stream(
    report_id: str,
    module_id: str,
    lang: str = Query("zh", description="Report language: zh or en"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Regenerate a single module (SSE)."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    mod_result = await db.execute(
        select(ReportModule)
        .where(ReportModule.id == module_id, ReportModule.report_id == report_id)
    )
    mod = mod_result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    mod.status = "generating"
    mod.updated_at = datetime.utcnow()
    await db.commit()

    data_context = await build_data_context(report.source_data)
    module_data_ctx = build_module_data_context(data_context, mod.data_keys or [])

    # Build preceding summaries from dependency modules
    preceding = None
    if mod.depends_on:
        dep_result = await db.execute(
            select(ReportModule)
            .where(
                ReportModule.report_id == report_id,
                ReportModule.order_index.in_(mod.depends_on),
            )
            .order_by(ReportModule.order_index)
        )
        deps = dep_result.scalars().all()
        summaries = []
        for dep in deps:
            if dep.content:
                summary = dep.content[:2000]
                if len(dep.content) > 2000:
                    summary += "..."
                summaries.append(f"### {dep.title}\n{summary}")
        preceding = "\n\n".join(summaries) if summaries else None

    async def event_stream():
        final_content = None
        async for event_str in stream_module_generation(
            module_index=mod.order_index,
            module_title=mod.title,
            module_description=mod.description or "",
            data_context=module_data_ctx,
            preceding_summaries=preceding,
            system_prompt=report.system_prompt,
            lang=lang,
        ):
            if "module_complete" in event_str:
                try:
                    data_line = event_str.strip().split("data: ", 1)[1]
                    parsed = _json.loads(data_line)
                    if parsed.get("type") == "module_complete":
                        final_content = parsed.get("content", "")
                except Exception:
                    pass
            yield event_str

        # Save to DB
        if final_content is not None:
            async with get_db_context() as save_db:
                res = await save_db.execute(
                    select(ReportModule).where(ReportModule.id == module_id)
                )
                m = res.scalar_one_or_none()
                if m:
                    m.content = final_content
                    m.status = "ready"
                    m.updated_at = datetime.utcnow()
                    await save_db.commit()

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class InsertModuleRequest(BaseModel):
    title: str
    description: str = ""
    position: str = "after"  # "before" | "after"
    reference_module_id: str  # insert before/after this module
    data_keys: list = Field(default_factory=list)


@router.post("/{report_id}/insert-module")
async def insert_module(
    report_id: str,
    body: InsertModuleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Insert a new module before or after an existing one."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    ref_result = await db.execute(
        select(ReportModule)
        .where(ReportModule.id == body.reference_module_id, ReportModule.report_id == report_id)
    )
    ref_mod = ref_result.scalar_one_or_none()
    if not ref_mod:
        raise HTTPException(status_code=404, detail="Reference module not found")

    new_index = ref_mod.order_index + (1 if body.position == "after" else 0)

    # Shift existing modules
    shift_result = await db.execute(
        select(ReportModule)
        .where(
            ReportModule.report_id == report_id,
            ReportModule.order_index >= new_index,
        )
        .order_by(desc(ReportModule.order_index))
    )
    for m in shift_result.scalars().all():
        m.order_index += 1

    new_mod = ReportModule(
        report_id=report_id,
        order_index=new_index,
        title=body.title,
        description=body.description,
        status="pending",
        data_keys=body.data_keys,
    )
    db.add(new_mod)
    await db.commit()
    await db.refresh(new_mod)

    return {
        "id": new_mod.id,
        "order_index": new_mod.order_index,
        "title": new_mod.title,
        "status": new_mod.status,
    }


# ---- Chart generation ----

class ChartGenRequest(BaseModel):
    instruction: str
    current_config: Optional[dict] = None
    data_context: Optional[str] = None


@router.post("/{report_id}/generate-chart")
async def generate_chart(
    report_id: str,
    body: ChartGenRequest,
    lang: str = Query("zh", description="Report language: zh or en"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate or modify an ECharts config from natural language."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Use provided data context or build from report
    data_ctx = body.data_context
    if not data_ctx:
        data_ctx = await build_data_context(report.source_data)

    try:
        chart_result = await generate_chart_config(
            instruction=body.instruction,
            data_context=data_ctx,
            current_config=body.current_config,
            lang=lang,
        )
    except Exception as e:
        logger.error("Chart generation failed: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    return chart_result


# ---- Image generation ----

class ImageGenRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"
    module_id: Optional[str] = None


@router.post("/{report_id}/generate-image")
async def generate_image_endpoint(
    report_id: str,
    body: ImageGenRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate an image from natural language description."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Report not found")

    image_result = await generate_image(
        prompt=body.prompt,
        size=body.size,
    )
    return image_result


# ---- Assembly ----

@router.post("/{report_id}/assemble")
async def assemble_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Assemble all modules into a single report.content HTML."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    mods_result = await db.execute(
        select(ReportModule)
        .where(ReportModule.report_id == report_id)
        .order_by(ReportModule.order_index)
    )
    modules = mods_result.scalars().all()

    assembled_parts = []
    for mod in modules:
        if mod.content:
            assembled_parts.append(mod.content)

    assembled_html = "\n\n".join(assembled_parts)

    # Snapshot before assembly if content exists
    if report.content:
        await _create_snapshot(db, report, "Before module assembly")

    report.content = assembled_html
    report.status = "ready"
    report.updated_at = datetime.utcnow()
    await db.commit()

    await _create_snapshot(db, report, "Module assembly")
    await db.commit()

    return {"id": report.id, "status": "ready", "updated_at": _ts(report.updated_at)}
