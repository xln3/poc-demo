"""API endpoints for dataset management."""
from __future__ import annotations
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.dataset_storage import dataset_storage


# ============ Request/Response Models ============

class DatasetSource(BaseModel):
    """Dataset source information."""
    type: str = "manual"  # 'paper' | 'business' | 'manual' | 'generated'
    reference: Optional[str] = None
    url: Optional[str] = None


class DatasetMeta(BaseModel):
    """Dataset metadata."""
    schemaVersion: str = "2.0.0"
    type: str = "Dataset"
    datasetId: Optional[str] = None
    name: str
    description: str = ""
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    caseCount: int = 0
    totalSize: int = 0
    capabilities: List[str] = []
    source: DatasetSource = DatasetSource()
    tags: List[str] = []


class TestCriteria(BaseModel):
    """Test case evaluation criteria."""
    expectedBehavior: str = ""
    successCondition: str = ""
    failureCondition: str = ""


class DatasetCase(BaseModel):
    """Test case within a dataset."""
    id: Optional[str] = None
    name: str = ""
    capability: Optional[str] = None
    input: Dict[str, Any] = {}
    criteria: TestCriteria = TestCriteria()
    recording: Optional[Dict[str, Any]] = None


class SaveDatasetRequest(BaseModel):
    """Request model for saving a dataset."""
    meta: DatasetMeta
    cases: List[DatasetCase] = []


class UpdateDatasetRequest(BaseModel):
    """Request model for updating a dataset."""
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    capabilities: Optional[List[str]] = None
    source: Optional[DatasetSource] = None


class DatasetSummary(BaseModel):
    """Summary of a dataset for list display."""
    id: str
    savedAt: str
    schemaVersion: str = "2.0.0"
    name: str
    description: str = ""
    caseCount: int = 0
    totalSize: int = 0
    capabilities: List[str] = []
    source: Dict[str, Any] = {}
    tags: List[str] = []


class DatasetDetail(BaseModel):
    """Full detail of a dataset."""
    id: str
    savedAt: str
    meta: DatasetMeta
    cases: List[DatasetCase] = []


class AddCaseRequest(BaseModel):
    """Request model for adding a case to a dataset."""
    id: Optional[str] = None
    name: str = ""
    capability: Optional[str] = None
    input: Dict[str, Any] = {}
    criteria: TestCriteria = TestCriteria()
    recording: Optional[Dict[str, Any]] = None


# ============ Router ============

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("", response_model=List[DatasetSummary])
async def list_datasets():
    """List all saved datasets."""
    return dataset_storage.list_datasets()


@router.post("")
async def save_dataset(request: SaveDatasetRequest):
    """Save a new dataset."""
    dataset_data = request.model_dump()
    saved = dataset_storage.save_dataset(dataset_data)
    return saved


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str):
    """Get a single dataset by ID."""
    dataset_data = dataset_storage.get_dataset(dataset_id)
    if dataset_data is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset_data


@router.put("/{dataset_id}")
async def update_dataset(dataset_id: str, request: UpdateDatasetRequest):
    """Update a dataset (name, description, tags, capabilities, source)."""
    updates = request.model_dump(exclude_unset=True)
    updated = dataset_storage.update_dataset(dataset_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return updated


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Delete a dataset."""
    success = dataset_storage.delete_dataset(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"success": True, "message": f"Dataset {dataset_id} deleted"}


# ============ Case Management ============

@router.get("/{dataset_id}/cases")
async def list_cases_in_dataset(dataset_id: str):
    """List all cases in a dataset."""
    dataset_data = dataset_storage.get_dataset(dataset_id)
    if dataset_data is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset_data.get("cases", [])


@router.post("/{dataset_id}/cases")
async def add_case_to_dataset(dataset_id: str, request: AddCaseRequest):
    """Add a test case to a dataset."""
    case_data = request.model_dump()
    updated = dataset_storage.add_case_to_dataset(dataset_id, case_data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"success": True, "caseId": case_data.get("id"), "caseCount": updated["meta"]["caseCount"]}


@router.get("/{dataset_id}/cases/{case_id}")
async def get_case_from_dataset(dataset_id: str, case_id: str):
    """Get a specific test case from a dataset."""
    case_data = dataset_storage.get_case_from_dataset(dataset_id, case_id)
    if case_data is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_data


@router.delete("/{dataset_id}/cases/{case_id}")
async def remove_case_from_dataset(dataset_id: str, case_id: str):
    """Remove a test case from a dataset."""
    updated = dataset_storage.remove_case_from_dataset(dataset_id, case_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dataset or case not found")
    return {"success": True, "caseCount": updated["meta"]["caseCount"]}
