"""
Parser for inspect-ai .eval files.

An .eval file is JSON with structure:
{
  "eval": { "task": "...", "model": "...", ... },
  "plan": { "steps": [{ "solver": "..." }, ...] },
  "samples": [
    {
      "id": ...,
      "input": "...",
      "messages": [{ "role": "...", "content": "...", "tool_calls": [...] }],
      "scores": { "judge_name": { "value": "C"|"I", "answer": "...", "explanation": "..." } },
      ...
    }
  ],
  "results": { ... }
}
"""

from datetime import datetime
from typing import Any


def parse_eval_file(data: dict) -> dict:
    """
    Parse a .eval JSON structure and extract structured test data.

    Returns:
        {
            "meta": { "task", "model", "solver_type", "created_at" },
            "samples": [
                {
                    "id": ...,
                    "input": "...",
                    "events": [...],  # InteractionEvent-compatible
                    "scores": { ... },
                    "judgment": { "passed": bool, "reason": str },
                }
            ]
        }
    """
    eval_info = data.get("eval", {})
    plan = data.get("plan", {})
    raw_samples = data.get("samples", [])

    solver_type = None
    if plan.get("steps"):
        solver_type = plan["steps"][-1].get("solver", None)

    meta = {
        "task": eval_info.get("task", "unknown"),
        "model": eval_info.get("model", "unknown"),
        "solver_type": solver_type,
        "created_at": eval_info.get("created", datetime.utcnow().isoformat()),
    }

    samples = []
    for sample in raw_samples:
        events = _messages_to_events(sample.get("messages", []))
        scores = sample.get("scores", {})
        judgment = _scores_to_judgment(scores)

        samples.append({
            "id": sample.get("id"),
            "input": sample.get("input", ""),
            "events": events,
            "scores": scores,
            "judgment": judgment,
        })

    return {"meta": meta, "samples": samples}


def _messages_to_events(messages: list[dict]) -> list[dict]:
    """Convert .eval messages to InteractionEvent format."""
    events = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")

        # Handle tool_calls in assistant messages
        tool_calls = msg.get("tool_calls", [])
        if tool_calls:
            for tc in tool_calls:
                events.append({
                    "type": "tool_call",
                    "timestamp": msg.get("timestamp", datetime.utcnow().isoformat()),
                    "data": {
                        "toolName": tc.get("function", {}).get("name", "unknown"),
                        "args": tc.get("function", {}).get("arguments", ""),
                        "result": None,
                        "status": "pending",
                    },
                })

        # Standard message event
        if content:
            events.append({
                "type": "message",
                "timestamp": msg.get("timestamp", datetime.utcnow().isoformat()),
                "data": {
                    "role": role,
                    "content": content if isinstance(content, str) else str(content),
                },
            })

    return events


def _scores_to_judgment(scores: dict[str, Any]) -> dict:
    """Convert .eval scores to a unified judgment."""
    if not scores:
        return {"passed": None, "reason": "No scores available"}

    for judge_name, score_data in scores.items():
        value = score_data.get("value", "")
        explanation = score_data.get("explanation", "")
        answer = score_data.get("answer", "")

        passed = None
        if value in ("C", "CORRECT", "correct", True, 1):
            passed = True
        elif value in ("I", "INCORRECT", "incorrect", False, 0):
            passed = False

        return {
            "passed": passed,
            "judge": judge_name,
            "value": value,
            "answer": answer,
            "reason": explanation,
        }

    return {"passed": None, "reason": "Unknown score format"}
