"""API endpoints for saved test cases."""
from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException

from ..auth.security import require_auth

from ..models.schemas import (
    SaveCaseRequest,
    UpdateCaseRequest,
    SavedCaseSummary,
    SavedCaseDetail,
)
from ..services.case_storage import case_storage

router = APIRouter(prefix="/cases", tags=["cases"], dependencies=[Depends(require_auth)])


@router.get("", response_model=List[SavedCaseSummary])
async def list_cases():
    """List all saved test cases."""
    return case_storage.list_cases()


@router.post("", response_model=SavedCaseDetail)
async def save_case(request: SaveCaseRequest):
    """Save a new test case."""
    case_data = request.model_dump()
    saved = case_storage.save_case(case_data)
    return saved


@router.get("/{case_id}", response_model=SavedCaseDetail)
async def get_case(case_id: str):
    """Get a single test case by ID."""
    case_data = case_storage.get_case(case_id)
    if case_data is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_data


@router.put("/{case_id}", response_model=SavedCaseDetail)
async def update_case(case_id: str, request: UpdateCaseRequest):
    """Update a test case (name, tags, notes)."""
    updates = request.model_dump(exclude_unset=True)
    updated = case_storage.update_case(case_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return updated


@router.delete("/{case_id}")
async def delete_case(case_id: str):
    """Delete a test case."""
    success = case_storage.delete_case(case_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"success": True, "message": f"Case {case_id} deleted"}
