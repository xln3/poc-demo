"""Bridge service for communicating with the eval-poc backend."""

import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

EVAL_BACKEND_URL = os.environ.get("EVAL_BACKEND_URL", "http://127.0.0.1:8001")

# Shared async client (created lazily)
_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=EVAL_BACKEND_URL,
            timeout=httpx.Timeout(connect=10, read=3600, write=30, pool=10),
        )
    return _client


async def close_client():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# ---- Benchmarks ----

async def list_eval_benchmarks() -> List[Dict[str, Any]]:
    resp = await _get_client().get("/api/benchmarks")
    resp.raise_for_status()
    return resp.json()


async def get_task_meta() -> Dict[str, Any]:
    resp = await _get_client().get("/api/benchmarks/task-meta")
    resp.raise_for_status()
    return resp.json()


async def get_benchmark_meta() -> Dict[str, Any]:
    resp = await _get_client().get("/api/benchmarks/benchmark-meta")
    resp.raise_for_status()
    return resp.json()


# ---- Models ----

async def list_eval_models() -> List[Dict[str, Any]]:
    resp = await _get_client().get("/api/models")
    resp.raise_for_status()
    return resp.json()


async def register_eval_agent(config: Dict[str, Any]) -> Dict[str, Any]:
    resp = await _get_client().post("/api/models", json=config)
    resp.raise_for_status()
    return resp.json()


async def delete_eval_model(model_id: str) -> Dict[str, Any]:
    resp = await _get_client().delete(f"/api/models/{model_id}")
    resp.raise_for_status()
    return resp.json()


# ---- Evaluations ----

async def start_evaluation(payload: Dict[str, Any]) -> Dict[str, Any]:
    resp = await _get_client().post("/api/evaluations", json=payload)
    resp.raise_for_status()
    return resp.json()


async def list_evaluations() -> List[Dict[str, Any]]:
    resp = await _get_client().get("/api/evaluations")
    resp.raise_for_status()
    return resp.json()


async def get_evaluation_status(job_id: str) -> Dict[str, Any]:
    resp = await _get_client().get(f"/api/evaluations/{job_id}")
    resp.raise_for_status()
    return resp.json()


async def cancel_evaluation(job_id: str) -> Dict[str, Any]:
    resp = await _get_client().delete(f"/api/evaluations/{job_id}")
    resp.raise_for_status()
    return resp.json()


# ---- Results ----

async def list_eval_results() -> List[Dict[str, Any]]:
    resp = await _get_client().get("/api/results")
    resp.raise_for_status()
    return resp.json()


async def get_eval_result_detail(model: str) -> Dict[str, Any]:
    resp = await _get_client().get(f"/api/results/{model}")
    resp.raise_for_status()
    return resp.json()


async def get_eval_result_samples(
    model: str, task: str, risk_level: Optional[str] = None
) -> Dict[str, Any]:
    params = {}
    if risk_level:
        params["risk_level"] = risk_level
    resp = await _get_client().get(
        f"/api/results/{model}/tasks/{task}/samples", params=params
    )
    resp.raise_for_status()
    return resp.json()


async def get_result_by_job(job_id: str) -> Dict[str, Any]:
    """Get run-scoped results for a specific evaluation job."""
    resp = await _get_client().get(f"/api/results/by-job/{job_id}")
    resp.raise_for_status()
    return resp.json()


async def get_job_task_samples(
    job_id: str, task: str, risk_level: Optional[str] = None
) -> Dict[str, Any]:
    """Get samples for a specific task within a specific job."""
    params = {}
    if risk_level:
        params["risk_level"] = risk_level
    resp = await _get_client().get(
        f"/api/results/by-job/{job_id}/tasks/{task}/samples", params=params
    )
    resp.raise_for_status()
    return resp.json()


# ---- Reports ----

async def generate_eval_report(model: str) -> Dict[str, Any]:
    resp = await _get_client().post("/api/reports/generate", json={"model": model})
    resp.raise_for_status()
    return resp.json()
