"""Eval proxy router — all eval-poc access goes through poc-demo JWT auth."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List

from ..auth.security import require_user
from ..db.tables import User
from ..services import eval_bridge

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/eval", tags=["eval"])


# ---- Request/Response models ----

class EvalStartRequest(BaseModel):
    model_id: str
    benchmarks: List[str]
    limit: Optional[int] = None
    judge_model: Optional[str] = None
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None


class RegisterModelRequest(BaseModel):
    name: str
    provider: str = ""
    api_base: str = ""
    api_key: str = ""
    model_id: str = ""
    description: str = ""
    is_agent: bool = False


class ReproduceRequest(BaseModel):
    sample_id: Optional[str] = None


# ---- Risk hierarchy ----

@router.get("/risk-hierarchy")
async def get_risk_hierarchy(user: User = Depends(require_user)):
    """Get merged 4-level risk hierarchy (static taxonomy + live catalog)."""
    from ..services.risk_hierarchy import build_merged_hierarchy
    try:
        benchmarks = await eval_bridge.list_eval_benchmarks()
        task_meta = await eval_bridge.get_task_meta()
        benchmark_meta = await eval_bridge.get_benchmark_meta()
        return build_merged_hierarchy(benchmarks, task_meta, benchmark_meta)
    except Exception as e:
        logger.error("Failed to build risk hierarchy: %s", e)
        # Return hierarchy with everything marked unavailable
        from ..services.risk_hierarchy import build_merged_hierarchy as merge
        return merge([], {})


# ---- Dataset description ----

@router.get("/dataset-description")
async def get_dataset_description(
    benchmarks: str = "",
    lang: str = "zh",
    user: User = Depends(require_user),
):
    """Generate anonymized dataset description from eval-poc benchmark docs."""
    import json
    from pathlib import Path

    DOCS_DIR = Path("/home/xln/agent-safety-platform/eval-poc/benchmarks/docs")
    if not DOCS_DIR.exists():
        return {"report": "", "samples": [], "error": "Docs directory not found"}

    # If no benchmarks specified, auto-discover all available
    if not benchmarks.strip():
        bm_list = sorted([
            d.name for d in DOCS_DIR.iterdir()
            if d.is_dir() and (d / f"{d.name}_3.json").exists()
        ])
    else:
        bm_list = [b.strip() for b in benchmarks.split(",") if b.strip()]

    # Load docs
    docs = []
    for name in bm_list:
        json_path = DOCS_DIR / name / f"{name}_3.json"
        if not json_path.exists():
            continue
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                docs.append(json.load(f))
        except Exception:
            continue

    # Build anonymized samples (no benchmark names)
    samples = []
    for doc in docs:
        risk_cat = doc.get("risk_category", "")
        risk_point = doc.get("risk_point_zh" if lang == "zh" else "risk_point_en", "")
        for s in doc.get("samples", []):
            samples.append({
                "risk_category": risk_cat,
                "risk_point": risk_point,
                "input": s.get("input", ""),
                "expected_behavior": s.get("expected_behavior", ""),
                "risk_description": s.get(
                    f"risk_description_{lang}",
                    s.get("risk_description_zh", s.get("risk_description_en", ""))
                ),
            })

    # Build summary stats
    from collections import OrderedDict
    groups = OrderedDict()
    for doc in docs:
        cat = doc.get("risk_category", "")
        if cat not in groups:
            groups[cat] = []
        groups[cat].append({
            "risk_point": doc.get("risk_point_zh" if lang == "zh" else "risk_point_en", ""),
            "sample_count": doc.get("sample_count", len(doc.get("samples", []))),
        })

    return {
        "total_benchmarks": len(docs),
        "total_samples": len(samples),
        "total_categories": len(groups),
        "categories": [
            {"name": cat, "items": items}
            for cat, items in groups.items()
        ],
        "samples": samples,
    }


# ---- Benchmark endpoints ----

@router.get("/benchmarks")
async def list_benchmarks(user: User = Depends(require_user)):
    """List all eval benchmarks with Chinese metadata."""
    try:
        return await eval_bridge.list_eval_benchmarks()
    except Exception as e:
        logger.error("Failed to list benchmarks: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/benchmarks/task-meta")
async def get_task_meta(user: User = Depends(require_user)):
    """Get task Chinese metadata."""
    try:
        return await eval_bridge.get_task_meta()
    except Exception as e:
        logger.error("Failed to get task meta: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


# ---- Model endpoints ----

@router.get("/models")
async def list_models(user: User = Depends(require_user)):
    """List all eval-poc models."""
    try:
        return await eval_bridge.list_eval_models()
    except Exception as e:
        logger.error("Failed to list eval models: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.post("/models")
async def register_model(req: RegisterModelRequest, user: User = Depends(require_user)):
    """Register agent/model to eval-poc."""
    try:
        return await eval_bridge.register_eval_agent(req.model_dump())
    except Exception as e:
        logger.error("Failed to register model: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.delete("/models/{model_id}")
async def delete_model(model_id: str, user: User = Depends(require_user)):
    """Delete a model from eval-poc."""
    try:
        return await eval_bridge.delete_eval_model(model_id)
    except Exception as e:
        logger.error("Failed to delete eval model: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


# ---- Evaluation endpoints ----

@router.post("/evaluations")
async def start_evaluation(req: EvalStartRequest, user: User = Depends(require_user)):
    """Start a new evaluation run."""
    try:
        return await eval_bridge.start_evaluation(req.model_dump())
    except Exception as e:
        logger.error("Failed to start evaluation: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/evaluations")
async def list_evaluations(user: User = Depends(require_user)):
    """List all evaluation jobs."""
    try:
        return await eval_bridge.list_evaluations()
    except Exception as e:
        logger.error("Failed to list evaluations: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/evaluations/{job_id}")
async def get_evaluation(job_id: str, user: User = Depends(require_user)):
    """Poll evaluation progress."""
    try:
        return await eval_bridge.get_evaluation_status(job_id)
    except Exception as e:
        logger.error("Failed to get evaluation %s: %s", job_id, e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


# ---- Result endpoints ----

@router.get("/results")
async def list_results(user: User = Depends(require_user)):
    """All model results overview."""
    try:
        return await eval_bridge.list_eval_results()
    except Exception as e:
        logger.error("Failed to list results: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/results/{model}")
async def get_result_detail(model: str, user: User = Depends(require_user)):
    """Single model detailed results."""
    try:
        return await eval_bridge.get_eval_result_detail(model)
    except Exception as e:
        logger.error("Failed to get results for %s: %s", model, e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/results/by-job/{job_id}")
async def get_result_by_job(job_id: str, user: User = Depends(require_user)):
    """Get run-scoped results for a specific evaluation job."""
    try:
        return await eval_bridge.get_result_by_job(job_id)
    except Exception as e:
        logger.error("Failed to get job results for %s: %s", job_id, e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/results/by-job/{job_id}/tasks/{task}/samples")
async def get_job_task_samples(
    job_id: str, task: str, risk_level: Optional[str] = None,
    user: User = Depends(require_user),
):
    """Get samples for a specific task within a specific job."""
    try:
        return await eval_bridge.get_job_task_samples(job_id, task, risk_level)
    except Exception as e:
        logger.error("Failed to get job samples: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


@router.get("/results/{model}/tasks/{task}/samples")
async def get_result_samples(
    model: str, task: str, risk_level: Optional[str] = None,
    user: User = Depends(require_user),
):
    """Per-sample results for a specific task (for reports and reproduction)."""
    try:
        return await eval_bridge.get_eval_result_samples(model, task, risk_level)
    except Exception as e:
        logger.error("Failed to get samples: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


# ---- Report endpoints ----

@router.post("/reports/generate")
async def generate_report(model: str, user: User = Depends(require_user)):
    """Generate evaluation report for a model."""
    try:
        return await eval_bridge.generate_eval_report(model)
    except Exception as e:
        logger.error("Failed to generate report: %s", e)
        raise HTTPException(status_code=502, detail=f"Eval backend error: {e}")


# ---- Reproduce endpoint ----

@router.post("/reproduce/{model}/tasks/{task}")
async def reproduce_risk_case(
    model: str,
    task: str,
    req: ReproduceRequest = ReproduceRequest(),
    user: User = Depends(require_user),
):
    """Get pre-config for reproducing a high-risk case in poc-demo."""
    from ..services.risk_scenario_map import get_reproduction_config
    try:
        # Try to fetch per-sample data; gracefully fall back if unavailable
        samples = {"samples": []}
        try:
            samples = await eval_bridge.get_eval_result_samples(model, task, "HIGH")
        except Exception as sample_err:
            logger.warning("Per-sample data unavailable for %s/%s: %s", model, task, sample_err)
            # Try without risk filter
            try:
                samples = await eval_bridge.get_eval_result_samples(model, task)
            except Exception:
                pass
        config = get_reproduction_config(task, samples, req.sample_id)
        return config
    except Exception as e:
        logger.error("Failed to get reproduction config: %s", e)
        raise HTTPException(status_code=502, detail=f"Error: {e}")
