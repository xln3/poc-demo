"""Report Editor CRUD + LLM streaming router."""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import get_current_user
from ..db.engine import get_db
from ..db.tables import Report, ReportHistory, User
from ..services.report_llm import build_data_context, stream_report_html, stream_section_regen

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/report-editor", tags=["report-editor"])


# ---- Schemas ----

class ReportCreate(BaseModel):
    title: str
    scenario_type: str = "single_agent"
    system_prompt: Optional[str] = None
    source_data: dict = Field(default_factory=dict)
    metadata_json: dict = Field(default_factory=dict)

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
            "status": r.status,
            "created_at": _ts(r.created_at),
            "updated_at": _ts(r.updated_at),
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
        ),
        media_type="text/event-stream",
    )
