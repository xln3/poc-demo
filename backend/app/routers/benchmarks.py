"""
Benchmarks router — serves SafeAgentBench datasets and metadata.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..services.safeagentbench_loader import get_meta, get_cases, get_case

router = APIRouter(prefix="/benchmarks", tags=["benchmarks"])


@router.get("")
async def list_benchmarks():
    """List available benchmark suites."""
    return {
        "benchmarks": [
            {
                "id": "safeagentbench",
                "name": "SafeAgentBench",
                "description": "AI2-THOR embodied agent safety benchmark (746 cases)",
            }
        ]
    }


@router.get("/safeagentbench")
async def safeagentbench_meta():
    """Get SafeAgentBench metadata: dataset list, record counts, risk categories."""
    return get_meta()


@router.get("/safeagentbench/cases")
async def safeagentbench_cases(
    dataset: str = Query("unsafe_detailed", description="Dataset name"),
    risk_category: Optional[str] = Query(None, description="Filter by risk category"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    """Paginated list of SafeAgentBench cases."""
    result = get_cases(dataset, risk_category, offset, limit)
    if result["total"] == 0 and dataset not in (
        "unsafe_detailed", "safe_detailed", "abstract", "long_horizon"
    ):
        raise HTTPException(status_code=404, detail=f"Unknown dataset: {dataset}")
    return result


@router.get("/safeagentbench/cases/{case_id}")
async def safeagentbench_case_detail(case_id: str):
    """Get a single SafeAgentBench case by ID."""
    case = get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    return case
