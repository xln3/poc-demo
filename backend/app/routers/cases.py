"""API endpoints for saved test cases."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import require_auth
from ..db.engine import get_db

from ..models.schemas import (
    SaveCaseRequest,
    UpdateCaseRequest,
    SavedCaseSummary,
    SavedCaseDetail,
)
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


@router.post("", response_model=SavedCaseDetail)
async def save_case(request: SaveCaseRequest, db: AsyncSession = Depends(get_db)):
    """Save a new test case."""
    case_data = request.model_dump()
    saved = await db_case_storage.save_case(db, case_data)
    return saved


@router.get("/{case_id}", response_model=SavedCaseDetail)
async def get_case(case_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single test case by ID."""
    case_data = await db_case_storage.get_case(db, case_id)
    if case_data is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_data


@router.put("/{case_id}", response_model=SavedCaseDetail)
async def update_case(case_id: str, request: UpdateCaseRequest, db: AsyncSession = Depends(get_db)):
    """Update a test case (name, tags, notes)."""
    updates = request.model_dump(exclude_unset=True)
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
