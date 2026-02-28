"""API endpoints for saved test cases (supports v1 and v3 formats)."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import require_auth
from ..db.engine import get_db
from ..services.db_case_storage import db_case_storage

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
