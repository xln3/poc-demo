"""API endpoints for batch test results."""
from __future__ import annotations
from typing import List, Optional, Any, Dict, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth.security import require_auth

from ..services.test_results_storage import test_results_storage


router = APIRouter(prefix="/test-results", tags=["test-results"], dependencies=[Depends(require_auth)])


class TestResultMeta(BaseModel):
    """Test result metadata."""
    schemaVersion: str = "1.0.0"
    type: str = "BatchTestReport"
    exportedAt: Optional[str] = None
    testModel: Optional[str] = None
    judgeModel: Optional[str] = None
    statistics: Dict[str, Any] = {}


class TestResultCase(BaseModel):
    """Single test case result."""
    index: int
    caseId: Optional[str] = None
    caseName: str = ""
    attackType: Optional[str] = None
    attackDescription: Optional[str] = None
    input: Dict[str, Any] = {}
    execution: Dict[str, Any] = {}
    judgment: Dict[str, Any] = {}


class SaveTestResultRequest(BaseModel):
    """Request to save a test result."""
    name: str = "未命名测试"
    meta: TestResultMeta = TestResultMeta()
    results: List[Dict[str, Any]] = []


class TestResultSummary(BaseModel):
    """Test result summary for listing."""
    id: str
    name: str
    savedAt: Optional[str] = None
    meta: Dict[str, Any] = {}


class UpdateCaseReview(BaseModel):
    """Request to update a case review."""
    type: Literal['llm', 'human'] = 'human'
    riskLevel: str  # high/medium/low/safe/pending
    reason: str
    notes: Optional[str] = None
    reviewer: Optional[str] = None


class UpdateReport(BaseModel):
    """Request to update the text report."""
    content: str
    editedBy: Literal['llm', 'human'] = 'human'


class GenerateRequest(BaseModel):
    """Request for LLM generation."""
    prompt: str
    model: Optional[str] = None


@router.get("")
async def list_test_results(offset: int = Query(default=0, ge=0), limit: Optional[int] = Query(default=None, ge=1, le=500)):
    """List all saved test results with optional pagination."""
    return test_results_storage.list_results(offset=offset, limit=limit)


@router.get("/{result_id}")
async def get_test_result(result_id: str):
    """Get a specific test result."""
    result = test_results_storage.get_result(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return result


@router.post("", response_model=TestResultSummary)
async def save_test_result(request: SaveTestResultRequest):
    """Save a new test result."""
    data = {
        "name": request.name,
        "meta": request.meta.model_dump(),
        "results": request.results,
    }
    return test_results_storage.save_result(data)


@router.delete("/{result_id}")
async def delete_test_result(result_id: str):
    """Delete a test result."""
    success = test_results_storage.delete_result(result_id)
    if not success:
        raise HTTPException(status_code=404, detail="Test result not found")
    return {"success": True}


@router.delete("/{result_id}/cases/{case_index}")
async def delete_test_case(result_id: str, case_index: int):
    """Delete a single case from a test result."""
    result = test_results_storage.delete_case(result_id, case_index)
    if not result:
        raise HTTPException(status_code=404, detail="Test result or case not found")
    return {"success": True, "data": result}


@router.patch("/{result_id}/cases/{case_index}/review")
async def update_case_review(result_id: str, case_index: int, request: UpdateCaseReview):
    """Update the review for a single case."""
    result = test_results_storage.update_case_review(
        result_id,
        case_index,
        request.model_dump()
    )
    if not result:
        raise HTTPException(status_code=404, detail="Test result or case not found")
    return {"success": True, "data": result}


@router.patch("/{result_id}/report")
async def update_report(result_id: str, request: UpdateReport):
    """Update the text report for a test result."""
    result = test_results_storage.update_report(
        result_id,
        request.content,
        request.editedBy
    )
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return {"success": True, "data": result}


@router.post("/{result_id}/report/generate")
async def generate_report(result_id: str, request: GenerateRequest):
    """Prepare data for LLM-based report generation.

    By design, this endpoint does NOT call the LLM itself. It returns
    the test result data so the frontend can call the LLM via its own
    provider configuration (which includes the user's API key).
    """
    result = test_results_storage.get_result(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")

    return {
        "success": True,
        "prompt": request.prompt,
        "model": request.model,
        "resultData": result
    }


@router.post("/{result_id}/cases/{case_index}/review/generate")
async def generate_case_review(result_id: str, case_index: int, request: GenerateRequest):
    """Generate a review for a single case using LLM."""
    result = test_results_storage.get_result(result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")

    # Find the case
    case_data = None
    for case in result.get("results", []):
        if case.get("index") == case_index:
            case_data = case
            break

    if not case_data:
        raise HTTPException(status_code=404, detail="Case not found")

    # Return data for frontend to call LLM
    return {
        "success": True,
        "prompt": request.prompt,
        "model": request.model,
        "caseData": case_data
    }
