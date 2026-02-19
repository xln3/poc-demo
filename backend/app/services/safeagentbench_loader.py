"""
SafeAgentBench dataset loader.

Loads JSONL files from SAFEAGENTBENCH_DATA_DIR, normalizes risk categories,
assigns IDs, and provides lazy-loaded cached access.
"""

import json
import os
import re
from functools import lru_cache
from typing import Optional

SAFEAGENTBENCH_DATA_DIR = os.environ.get(
    "SAFEAGENTBENCH_DATA_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "SafeAgentBench", "dataset"),
)

DATASETS = {
    "unsafe_detailed": "unsafe_detailed_1009.jsonl",
    "safe_detailed": "safe_detailed_1009.jsonl",
    "abstract": "abstract_1009.jsonl",
    "long_horizon": "long_horizon_1009.jsonl",
}

# Normalize 50+ risk_category variants into ~10 canonical categories
_NORMALIZE_MAP = {
    "fire": "Fire Hazard",
    "electrical": "Electrical Hazard",
    "explosion": "Explosion Hazard",
    "break": "Breakage",
    "dropping": "Breakage",
    "liquid": "Liquid Damage",
    "spill": "Liquid Damage",
    "water damage": "Liquid Damage",
    "staining": "Liquid Damage",
    "plumbing": "Liquid Damage",
    "cut": "Physical Harm",
    "sharp": "Physical Harm",
    "impact": "Physical Harm",
    "injury": "Physical Harm",
    "harm to humans": "Physical Harm",
    "physical harm": "Physical Harm",
    "physical damage": "Property Damage",
    "property damage": "Property Damage",
    "damage to propert": "Property Damage",
    "furniture": "Property Damage",
    "damage to small": "Property Damage",
    "poison": "Poisoning",
    "ingestion": "Poisoning",
    "slip": "Slip Hazard",
    "waste": "Waste Hazard",
    "inaccessib": "Accessibility Hazard",
    "misuse": "Appliance Misuse",
    "electrical appliance": "Appliance Misuse",
    "loss of item": "Property Damage",
}


def normalize_risk_category(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    lower = raw.lower().strip()
    # Strip "Risk Category: " or "Risk: " prefixes
    lower = re.sub(r"^risk\s*(category)?\s*:\s*", "", lower)
    for keyword, canonical in _NORMALIZE_MAP.items():
        if keyword in lower:
            return canonical
    return raw.strip()


def _load_dataset(name: str) -> list[dict]:
    filename = DATASETS.get(name)
    if not filename:
        return []
    filepath = os.path.join(SAFEAGENTBENCH_DATA_DIR, filename)
    if not os.path.exists(filepath):
        return []
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            record["id"] = f"{name}_{idx}"
            record["dataset"] = name
            if "risk_category" in record:
                record["risk_category"] = normalize_risk_category(record["risk_category"])
            records.append(record)
    return records


@lru_cache(maxsize=1)
def _load_all() -> dict[str, list[dict]]:
    return {name: _load_dataset(name) for name in DATASETS}


def get_all_datasets() -> dict[str, list[dict]]:
    return _load_all()


def get_meta() -> dict:
    all_data = get_all_datasets()
    risk_cats = set()
    datasets_info = {}
    for name, records in all_data.items():
        datasets_info[name] = {"count": len(records)}
        for r in records:
            cat = r.get("risk_category")
            if cat:
                risk_cats.add(cat)
    return {
        "datasets": datasets_info,
        "risk_categories": sorted(risk_cats),
        "total": sum(len(v) for v in all_data.values()),
    }


def get_cases(
    dataset: str,
    risk_category: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
) -> dict:
    all_data = get_all_datasets()
    records = all_data.get(dataset, [])
    if risk_category:
        records = [r for r in records if r.get("risk_category") == risk_category]
    total = len(records)
    page = records[offset : offset + limit]
    return {"cases": page, "total": total, "offset": offset, "limit": limit}


def get_case(case_id: str) -> Optional[dict]:
    parts = case_id.rsplit("_", 1)
    if len(parts) != 2:
        return None
    dataset_name, idx_str = parts
    try:
        idx = int(idx_str)
    except ValueError:
        return None
    all_data = get_all_datasets()
    records = all_data.get(dataset_name, [])
    if 0 <= idx < len(records):
        return records[idx]
    return None
