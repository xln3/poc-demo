"""API usage tracking and cost summary endpoints."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.engine import get_db
from ..db.tables import User, ApiUsage
from ..auth.security import require_user

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("/summary")
async def usage_summary(
    period: str = Query("week", pattern="^(day|week|month)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Aggregate usage by model/provider for the given period."""
    now = datetime.utcnow()
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(weeks=1)
    else:
        since = now - timedelta(days=30)

    result = await db.execute(
        select(
            ApiUsage.model,
            func.count(ApiUsage.id).label("call_count"),
            func.sum(ApiUsage.prompt_tokens).label("total_prompt_tokens"),
            func.sum(ApiUsage.completion_tokens).label("total_completion_tokens"),
            func.sum(ApiUsage.cost).label("total_cost"),
        )
        .where(ApiUsage.user_id == user.id, ApiUsage.timestamp >= since)
        .group_by(ApiUsage.model)
    )

    rows = result.all()
    summary = []
    for row in rows:
        summary.append({
            "model": row.model,
            "call_count": row.call_count,
            "prompt_tokens": row.total_prompt_tokens or 0,
            "completion_tokens": row.total_completion_tokens or 0,
            "total_tokens": (row.total_prompt_tokens or 0) + (row.total_completion_tokens or 0),
            "cost": round(row.total_cost, 4) if row.total_cost else 0,
        })

    totals = {
        "call_count": sum(s["call_count"] for s in summary),
        "total_tokens": sum(s["total_tokens"] for s in summary),
        "cost": round(sum(s["cost"] for s in summary), 4),
    }

    return {"period": period, "since": since.isoformat(), "by_model": summary, "totals": totals}
