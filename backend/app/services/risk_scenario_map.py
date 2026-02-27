"""Benchmark → poc-demo scenario mapping for risk case reproduction."""

from typing import Any, Dict, List, Optional

# Static mapping: eval-poc benchmark/task → poc-demo capability level + scenarios
BENCHMARK_SCENARIO_MAP = {
    # F1 — Conversation attacks
    "strong_reject": {
        "capability_level": "F1-conversation",
        "scenarios": ["loan", "service"],
        "description": "Direct refusal bypass attacks",
    },
    "cyse2_prompt_injection": {
        "capability_level": "F1-conversation",
        "scenarios": ["promptLeakage"],
        "description": "Prompt injection attacks",
    },
    "raccoon": {
        "capability_level": "F1-conversation",
        "scenarios": ["promptLeakage"],
        "description": "Prompt extraction / leakage attacks",
    },
    "truthfulqa": {
        "capability_level": "F1-conversation",
        "scenarios": ["loan", "service"],
        "description": "Factuality and truthfulness evaluation",
    },
    "coconot": {
        "capability_level": "F1-conversation",
        "scenarios": ["service"],
        "description": "Context-based refusal evaluation",
    },
    "personalized_safety": {
        "capability_level": "F1-conversation",
        "scenarios": ["loan", "service"],
        "description": "Personalized high-risk scenario safety",
    },
    "personalized_safety_context_free": {
        "capability_level": "F1-conversation",
        "scenarios": ["loan", "service"],
        "description": "Context-free personalized safety",
    },
    "personalized_safety_context_rich": {
        "capability_level": "F1-conversation",
        "scenarios": ["loan", "service"],
        "description": "Context-rich personalized safety",
    },

    # F2 — File injection
    "b3": {
        "capability_level": "F2-file-injection",
        "scenarios": ["indirectInjection"],
        "description": "File-based indirect injection",
    },

    # F3 — Tool use
    "cyse2_interpreter_abuse": {
        "capability_level": "F3-tool-use",
        "scenarios": ["sandbox"],
        "description": "Code interpreter abuse via tool calling",
    },
    "agentharm": {
        "capability_level": "F3-tool-use",
        "scenarios": ["sandbox", "finbot"],
        "description": "Agent tool misuse evaluation",
    },
    "agentharm_benign": {
        "capability_level": "F3-tool-use",
        "scenarios": ["sandbox"],
        "description": "Agent benign tool use baseline",
    },
    "cve_bench": {
        "capability_level": "F3-tool-use",
        "scenarios": ["sandbox"],
        "description": "CVE exploitation via tools",
    },

    # F4 — RAG
    "saferag": {
        "capability_level": "F4-rag",
        "scenarios": ["rag"],
        "description": "RAG retrieval poisoning",
    },
    "clash_eval": {
        "capability_level": "F4-rag",
        "scenarios": ["rag"],
        "description": "Context conflict in RAG",
    },

    # F5 — MCP
    "agentdojo": {
        "capability_level": "F5-mcp",
        "scenarios": ["mcp"],
        "description": "MCP-based agent security",
    },

    # F6 — Messaging agent
    "overthink": {
        "capability_level": "F1-conversation",
        "scenarios": ["service"],
        "description": "Reasoning model slowdown attacks",
    },
}


def get_reproduction_config(
    task: str,
    samples_data: Dict[str, Any],
    sample_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build reproduction config for jumping to poc-demo Run tab.

    Args:
        task: The eval task name
        samples_data: Per-sample results from eval-poc
        sample_id: Specific sample to reproduce (optional)

    Returns:
        Config dict with capability_level, scenarios, and pre_config
    """
    mapping = BENCHMARK_SCENARIO_MAP.get(task, {})
    capability_level = mapping.get("capability_level", "F1-conversation")
    scenarios = mapping.get("scenarios", [])

    # Extract sample data for pre-config
    samples = samples_data.get("samples", [])
    target_sample = None
    if sample_id:
        target_sample = next((s for s in samples if str(s.get("sample_id")) == str(sample_id)), None)
    if not target_sample and samples:
        # Pick the highest-risk sample
        risk_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "MINIMAL": 4, "UNKNOWN": 5}
        target_sample = min(samples, key=lambda s: risk_order.get(s.get("risk_level", "UNKNOWN"), 5))

    pre_config = {}
    if target_sample:
        pre_config = {
            "payload": target_sample.get("input", ""),
            "system_prompt": "",  # Agent's system prompt would come from AgentConfig
            "tools_enabled": "tool" in capability_level.lower(),
            "rag_enabled": "rag" in capability_level.lower(),
            "mcp_enabled": "mcp" in capability_level.lower(),
        }

    return {
        "task": task,
        "capability_level": capability_level,
        "scenarios": scenarios,
        "description": mapping.get("description", ""),
        "pre_config": pre_config,
        "sample": target_sample,
    }
