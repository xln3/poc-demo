"""API endpoints for batch test results."""
from __future__ import annotations
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.test_results_storage import test_results_storage


router = APIRouter(prefix="/test-results", tags=["test-results"])


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


@router.get("", response_model=List[TestResultSummary])
async def list_test_results():
    """List all saved test results."""
    return test_results_storage.list_results()


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
