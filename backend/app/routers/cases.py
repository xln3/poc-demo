"""API endpoints for saved test cases (supports v1, v3, and v4 formats)."""
from __future__ import annotations
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import require_auth
from ..db.engine import get_db
from ..db.tables import TestCase
from ..services.db_case_storage import db_case_storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cases", tags=["cases"], dependencies=[Depends(require_auth)])


@router.get("")
async def list_cases(
    db: AsyncSession = Depends(get_db),
    offset: int = Query(default=0, ge=0),
    limit: Optional[int] = Query(default=None, ge=1, le=500),
):
    """List all saved test cases with optional pagination."""
    return await db_case_storage.list_cases(db, offset=offset, limit=limit)


@router.post("")
async def save_case(request: Request, db: AsyncSession = Depends(get_db)):
    """Save a new test case (accepts v1 or v3 format as JSON)."""
    case_data = await request.json()
    saved = await db_case_storage.save_case(db, case_data)
    return saved


@router.post("/seed-demos")
async def seed_demo_cases(db: AsyncSession = Depends(get_db)):
    """Seed the database with demo risk demonstration cases.

    Inserts 8 pre-built demo cases covering different attack categories
    (prompt injection, jailbreak, RAG poisoning, sandbox escape, MCP abuse,
    file injection, privacy leakage, multi-language confusion).

    Skips cases whose name already exists in the database.
    """
    from backend.seed_demo_cases import build_demo_cases

    cases = build_demo_cases()
    inserted = 0
    skipped = 0
    inserted_ids = []

    for case_data in cases:
        name = case_data["meta"]["name"]
        # Check if a case with the same name already exists
        existing = await db.execute(
            select(TestCase).where(TestCase.name == name).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            logger.info("seed-demos: SKIP '%s' (already exists)", name)
            skipped += 1
            continue

        saved = await db_case_storage.save_case(db, case_data)
        case_id = saved.get("meta", {}).get("case_id") or saved.get("id")
        inserted_ids.append({"case_id": case_id, "name": name})
        logger.info("seed-demos: inserted '%s' (%s)", name, case_id)
        inserted += 1

    return {
        "success": True,
        "inserted": inserted,
        "skipped": skipped,
        "total_demos": len(cases),
        "cases": inserted_ids,
    }


@router.get("/{case_id}")
async def get_case(case_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single test case by ID."""
    case_data = await db_case_storage.get_case(db, case_id)
    if case_data is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_data


@router.put("/{case_id}")
async def update_case(case_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Update a test case (v1 partial or v3 full document)."""
    updates = await request.json()
    updated = await db_case_storage.update_case(db, case_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return updated


@router.delete("/{case_id}")
async def delete_case(case_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a test case."""
    success = await db_case_storage.delete_case(db, case_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"success": True, "message": f"Case {case_id} deleted"}
