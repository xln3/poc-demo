"""
Parser for inspect-ai .eval files (ZIP format).

An .eval file is a ZIP archive containing:
  - header.json: eval metadata, config, results summary (scores/metrics)
  - summaries.json: per-sample summary (scores, model_usage, timing)
  - samples/*.json: per-sample detail (messages, events) — only loaded on demand
  - _journal/: internal logging data
  - reductions.json: epoch reduction data
"""

import io
import json
import zipfile
from datetime import datetime
from typing import Any


def parse_eval_zip(file_bytes: bytes) -> dict:
    """
    Parse a .eval ZIP file and extract structured data.

    Returns:
        {
            "meta": {
                "task": str,
                "model": str,
                "created_at": str,
                "dataset_name": str,
                "dataset_samples": int,
                "solver_type": str | None,
                "status": str,
                "scores": [ { "name": str, "metrics": { metric_name: value } } ],
                "total_samples": int,
                "completed_samples": int,
                "task_args": dict,
            },
            "samples": [
                {
                    "id": str,
                    "scores": dict,
                    "model_usage": dict,
                    "total_time": float,
                    "metadata": dict,
                }
            ]
        }
    """
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        header = _read_json_from_zip(zf, "header.json")
        summaries = _read_json_from_zip(zf, "summaries.json")

    if not header:
        raise ValueError("Missing header.json in .eval file")

    eval_info = header.get("eval", {})
    plan = header.get("plan", {})
    results = header.get("results", {})

    # Extract solver type from plan steps
    solver_type = None
    if plan.get("steps"):
        solver_type = plan["steps"][-1].get("solver")

    # Extract score summaries
    score_summaries = []
    for score_block in results.get("scores", []):
        metrics = {}
        for metric_name, metric_data in score_block.get("metrics", {}).items():
            metrics[metric_name] = metric_data.get("value")
        score_summaries.append({
            "name": score_block.get("name", "unknown"),
            "scorer": score_block.get("scorer"),
            "metrics": metrics,
        })

    dataset_info = eval_info.get("dataset", {})

    meta = {
        "task": eval_info.get("task", "unknown"),
        "task_display_name": eval_info.get("task_display_name", eval_info.get("task", "unknown")),
        "model": eval_info.get("model", "unknown"),
        "created_at": eval_info.get("created", datetime.utcnow().isoformat()),
        "dataset_name": dataset_info.get("name", ""),
        "dataset_samples": dataset_info.get("samples", 0),
        "solver_type": solver_type,
        "status": header.get("status", "unknown"),
        "scores": score_summaries,
        "total_samples": results.get("total_samples", 0),
        "completed_samples": results.get("completed_samples", 0),
        "task_args": eval_info.get("task_args", {}),
    }

    # Parse summaries
    samples = []
    if isinstance(summaries, list):
        for s in summaries:
            samples.append({
                "id": s.get("id", ""),
                "scores": s.get("scores", {}),
                "model_usage": s.get("model_usage", {}),
                "total_time": s.get("total_time", 0),
                "metadata": s.get("metadata", {}),
            })

    return {"meta": meta, "samples": samples}


def eval_to_test_result(parsed: dict) -> dict:
    """
    Convert parsed eval data to test_results_storage compatible format.

    Returns a dict matching the SaveTestResultRequest schema.
    """
    meta = parsed["meta"]
    samples = parsed["samples"]

    # Build statistics from scores
    statistics = _build_statistics(meta, samples)

    # Convert samples to test result cases
    results = []
    for i, sample in enumerate(samples):
        judgment = _sample_to_judgment(sample)
        results.append({
            "index": i,
            "caseId": sample["id"],
            "caseName": sample["id"],
            "attackType": None,
            "attackDescription": sample.get("metadata", {}).get("task_instruction", ""),
            "input": {
                "metadata": sample.get("metadata", {}),
            },
            "execution": {
                "scores": sample.get("scores", {}),
                "model_usage": sample.get("model_usage", {}),
                "total_time": sample.get("total_time", 0),
            },
            "judgment": judgment,
            "riskLevel": judgment.get("riskLevel", "pending"),
        })

    task_display = meta.get("task_display_name", meta["task"])
    model_short = meta["model"].split("/")[-1] if "/" in meta["model"] else meta["model"]

    return {
        "name": f"[eval] {task_display} — {model_short}",
        "meta": {
            "schemaVersion": "1.0.0",
            "type": "EvalImport",
            "testModel": meta["model"],
            "judgeModel": None,
            "evalTask": meta["task"],
            "evalCreatedAt": meta["created_at"],
            "evalStatus": meta["status"],
            "evalScores": meta["scores"],
            "statistics": statistics,
        },
        "results": results,
    }


def _read_json_from_zip(zf: zipfile.ZipFile, name: str) -> Any:
    """Read and parse a JSON file from a ZipFile, returning None if not found."""
    try:
        with zf.open(name) as f:
            return json.loads(f.read())
    except (KeyError, json.JSONDecodeError):
        return None


def _build_statistics(meta: dict, samples: list) -> dict:
    """Build statistics dict compatible with the test results format."""
    total = len(samples)
    stats = {"total": total, "high": 0, "medium": 0, "low": 0, "safe": 0, "pending": 0}

    for sample in samples:
        judgment = _sample_to_judgment(sample)
        level = judgment.get("riskLevel", "pending")
        if level in stats:
            stats[level] += 1
        else:
            stats["pending"] += 1

    return stats


def _sample_to_judgment(sample: dict) -> dict:
    """Convert eval sample scores to a riskLevel judgment."""
    scores = sample.get("scores", {})
    if not scores:
        return {"riskLevel": "pending", "reason": "No scores"}

    # Iterate through scorers to find risk signals
    for scorer_name, score_data in scores.items():
        value = score_data.get("value", {})
        explanation = score_data.get("explanation", "")

        # Handle dict-type values (e.g. safeagentbench_scorer)
        if isinstance(value, dict):
            rejected = value.get("rejected", 0)
            risk_rate = value.get("risk_rate", None)
            plan_success = value.get("plan_success", 0)
            exec_success = value.get("exec_success", None)

            # If explicitly rejected, it's safe
            if rejected == 1:
                return {"riskLevel": "safe", "reason": f"[{scorer_name}] Rejected by model"}

            # Check for explicit risk indicators
            if risk_rate is not None and risk_rate > 0:
                return {"riskLevel": "high", "reason": f"[{scorer_name}] Risk detected: {explanation}"}

            # Plan succeeded on a potentially risky task
            if plan_success == 1:
                return {"riskLevel": "low", "reason": f"[{scorer_name}] Plan succeeded: {explanation}"}

            # exec_success from execution_scorer
            if exec_success is not None:
                if exec_success == 1:
                    return {"riskLevel": "safe", "reason": f"[{scorer_name}] Execution succeeded: {explanation}"}
                else:
                    return {"riskLevel": "low", "reason": f"[{scorer_name}] Execution failed: {explanation}"}

        # Handle simple string/numeric values (C/I, True/False, 0/1)
        elif isinstance(value, (str, int, float, bool)):
            if value in ("C", "CORRECT", "correct", True, 1):
                return {"riskLevel": "safe", "reason": f"[{scorer_name}] Correct: {explanation}"}
            elif value in ("I", "INCORRECT", "incorrect", False, 0):
                return {"riskLevel": "medium", "reason": f"[{scorer_name}] Incorrect: {explanation}"}

    return {"riskLevel": "pending", "reason": "Could not determine from scores"}
