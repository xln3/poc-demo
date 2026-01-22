"""Case storage service - JSON file based storage for saved test cases.

Only supports v1.0.0 Schema format.
"""
from __future__ import annotations
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

# Storage directory path
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "saved-cases"


def extract_summary(case_data: dict) -> dict:
    """Extract summary from v1 format case."""
    meta = case_data.get("meta", {})
    source = case_data.get("source", {})
    attack = source.get("attack", {})
    environment = case_data.get("environment", {})
    llm = environment.get("llm", {})
    result = case_data.get("result", {})
    judgment = result.get("judgment", {})

    return {
        "id": meta.get("caseId"),
        "savedAt": meta.get("createdAt"),
        "schemaVersion": meta.get("schemaVersion", "1.0.0"),
        "name": meta.get("name") or attack.get("name"),
        "capabilityLevel": source.get("capabilityLevel"),
        "scenarioName": source.get("scenarioName"),
        "attackName": attack.get("name") if attack else None,
        "attackType": attack.get("type") if attack else None,
        "riskLevel": attack.get("level") if attack else None,
        "modelId": llm.get("modelId"),
        "judgmentSuccess": judgment.get("success"),
        "judgmentReason": judgment.get("reason"),
    }


class CaseStorage:
    """Manages JSON file storage for saved test cases."""

    def __init__(self):
        """Initialize storage, create directory if needed."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _get_case_path(self, case_id: str) -> Path:
        """Get the file path for a case."""
        return DATA_DIR / f"{case_id}.json"

    def generate_id(self) -> str:
        """Generate a unique case ID."""
        return str(uuid.uuid4())

    def save_case(self, case_data: dict) -> dict:
        """Save a new case or update existing one.

        Args:
            case_data: Case data (v1 format)

        Returns:
            The saved case with id and savedAt fields
        """
        now = datetime.now().isoformat()

        meta = case_data.get("meta", {})
        if not meta.get("caseId"):
            meta["caseId"] = self.generate_id()
        if not meta.get("createdAt"):
            meta["createdAt"] = now
        case_data["meta"] = meta
        case_id = meta["caseId"]

        # Also set top-level id and savedAt for API response
        case_data["id"] = case_id
        case_data["savedAt"] = meta["createdAt"]

        # Write to file
        case_path = self._get_case_path(case_id)
        with open(case_path, "w", encoding="utf-8") as f:
            json.dump(case_data, f, ensure_ascii=False, indent=2)

        return case_data

    def get_case(self, case_id: str) -> Optional[dict]:
        """Get a case by ID.

        Returns:
            Case data or None if not found
        """
        case_path = self._get_case_path(case_id)
        if not case_path.exists():
            return None

        with open(case_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_cases(self) -> List[Dict]:
        """List all saved cases.

        Returns:
            List of case summaries
        """
        cases = []
        for case_file in DATA_DIR.glob("*.json"):
            try:
                with open(case_file, "r", encoding="utf-8") as f:
                    case_data = json.load(f)
                    summary = extract_summary(case_data)
                    cases.append(summary)
            except (json.JSONDecodeError, IOError):
                continue

        # Sort by savedAt descending (newest first)
        cases.sort(key=lambda x: x.get("savedAt", ""), reverse=True)
        return cases

    def update_case(self, case_id: str, updates: dict) -> Optional[dict]:
        """Update an existing case (name, tags, notes).

        Args:
            case_id: ID of the case to update
            updates: Fields to update (name, tags, notes)

        Returns:
            Updated case data or None if not found
        """
        case_data = self.get_case(case_id)
        if case_data is None:
            return None

        now = datetime.now().isoformat()

        # Update in meta
        meta = case_data.get("meta", {})
        if "name" in updates:
            meta["name"] = updates["name"]
        if "tags" in updates:
            meta["tags"] = updates["tags"]
        if "notes" in updates:
            meta["notes"] = updates["notes"]
        meta["updatedAt"] = now
        case_data["meta"] = meta

        # Write back
        case_path = self._get_case_path(case_id)
        with open(case_path, "w", encoding="utf-8") as f:
            json.dump(case_data, f, ensure_ascii=False, indent=2)

        return case_data

    def delete_case(self, case_id: str) -> bool:
        """Delete a case by ID.

        Returns:
            True if deleted, False if not found
        """
        case_path = self._get_case_path(case_id)
        if not case_path.exists():
            return False

        case_path.unlink()
        return True


# Singleton instance
case_storage = CaseStorage()
