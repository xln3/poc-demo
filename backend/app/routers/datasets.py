"""API endpoints for dataset management."""
from __future__ import annotations
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.security import require_auth
from ..db.engine import get_db
from ..services.db_dataset_storage import db_dataset_storage


# ============ Request/Response Models ============

class DatasetSource(BaseModel):
    """Dataset source information."""
    type: str = "manual"  # 'paper' | 'business' | 'manual' | 'generated'
    reference: Optional[str] = None
    url: Optional[str] = None


class DatasetMeta(BaseModel):
    """Dataset metadata."""
    schemaVersion: str = "2.2.0"
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


class RiskLevelConditions(BaseModel):
    """Risk level judgment conditions (five-level)."""
    high: str = ""      # 高风险判定条件
    medium: str = ""    # 中风险判定条件
    low: str = ""       # 低风险判定条件
    safe: str = ""      # 安全判定条件


class ReferenceCodeModel(BaseModel):
    """Reference code (v2.2.0)."""
    language: Optional[str] = None
    filename: Optional[str] = None
    content: Optional[str] = None
    description: Optional[str] = None


class TestCriteria(BaseModel):
    """Test case evaluation criteria (five-level risk)."""
    expectedBehavior: str = ""
    riskLevelConditions: RiskLevelConditions = RiskLevelConditions()
    # v2.2.0: 参考答案和代码
    referenceAnswer: Optional[str] = None
    answerFormat: Optional[str] = None  # 'exact_match' | 'regex' | etc.
    referenceCode: Optional[ReferenceCodeModel] = None


class BenchmarkSourceModel(BaseModel):
    """Benchmark data source (v2.2.0)."""
    evalId: Optional[str] = None
    runId: Optional[str] = None
    taskName: Optional[str] = None
    taskVersion: Optional[str] = None
    sampleId: Optional[str] = None
    datasetName: Optional[str] = None


class BenchmarkMetaModel(BaseModel):
    """Benchmark metadata (v2.2.0)."""
    benchmarkName: Optional[str] = None
    benchmarkVersion: Optional[str] = None
    source: Optional[BenchmarkSourceModel] = None
    customFields: Optional[Dict[str, Any]] = None


class DatasetCase(BaseModel):
    """Test case within a dataset."""
    id: Optional[str] = None
    name: str = ""
    capability: Optional[str] = None
    input: Dict[str, Any] = {}
    criteria: TestCriteria = TestCriteria()
    recording: Optional[Dict[str, Any]] = None
    # v2.2.0: Benchmark 溯源信息
    benchmarkMeta: Optional[BenchmarkMetaModel] = None


MAX_CASES_PER_DATASET = 10000


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
    schemaVersion: str = "2.2.0"
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

router = APIRouter(prefix="/datasets", tags=["datasets"], dependencies=[Depends(require_auth)])


@router.get("")
async def list_datasets(
    db: AsyncSession = Depends(get_db),
    offset: int = Query(default=0, ge=0),
    limit: Optional[int] = Query(default=None, ge=1, le=500),
):
    """List all saved datasets with optional pagination."""
    return await db_dataset_storage.list_datasets(db, offset=offset, limit=limit)


@router.post("")
async def save_dataset(request: SaveDatasetRequest, db: AsyncSession = Depends(get_db)):
    """Save a new dataset."""
    if len(request.cases) > MAX_CASES_PER_DATASET:
        raise HTTPException(
            status_code=413,
            detail=f"Too many cases ({len(request.cases)}), max {MAX_CASES_PER_DATASET}",
        )
    dataset_data = request.model_dump()
    saved = await db_dataset_storage.save_dataset(db, dataset_data)
    return saved


@router.get("/{dataset_id}")
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single dataset by ID."""
    dataset_data = await db_dataset_storage.get_dataset(db, dataset_id)
    if dataset_data is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset_data


@router.put("/{dataset_id}")
async def update_dataset(dataset_id: str, request: UpdateDatasetRequest, db: AsyncSession = Depends(get_db)):
    """Update a dataset (name, description, tags, capabilities, source)."""
    updates = request.model_dump(exclude_unset=True)
    updated = await db_dataset_storage.update_dataset(db, dataset_id, updates)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return updated


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a dataset."""
    success = await db_dataset_storage.delete_dataset(db, dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"success": True, "message": f"Dataset {dataset_id} deleted"}


# ============ Case Management ============

@router.get("/{dataset_id}/cases")
async def list_cases_in_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """List all cases in a dataset."""
    dataset_data = await db_dataset_storage.get_dataset(db, dataset_id)
    if dataset_data is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset_data.get("cases", [])


@router.post("/{dataset_id}/cases")
async def add_case_to_dataset(dataset_id: str, request: AddCaseRequest, db: AsyncSession = Depends(get_db)):
    """Add a test case to a dataset."""
    case_data = request.model_dump()
    updated = await db_dataset_storage.add_case_to_dataset(db, dataset_id, case_data)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"success": True, "caseId": case_data.get("id"), "caseCount": updated["meta"]["caseCount"]}


@router.get("/{dataset_id}/cases/{case_id}")
async def get_case_from_dataset(dataset_id: str, case_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific test case from a dataset."""
    case_data = await db_dataset_storage.get_case_from_dataset(db, dataset_id, case_id)
    if case_data is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case_data


@router.delete("/{dataset_id}/cases/{case_id}")
async def remove_case_from_dataset(dataset_id: str, case_id: str, db: AsyncSession = Depends(get_db)):
    """Remove a test case from a dataset."""
    updated = await db_dataset_storage.remove_case_from_dataset(db, dataset_id, case_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Dataset or case not found")
    return {"success": True, "caseCount": updated["meta"]["caseCount"]}
