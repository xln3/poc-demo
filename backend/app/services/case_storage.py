"""Case storage service - JSON file based storage for saved test cases."""
from __future__ import annotations
import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

# Storage directory path
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "saved-cases"


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
            case_data: Case data including optional 'id' field

        Returns:
            The saved case with id and savedAt fields
        """
        # Generate ID if not provided
        if "id" not in case_data or not case_data["id"]:
            case_data["id"] = self.generate_id()

        # Add/update timestamp
        case_data["savedAt"] = datetime.now().isoformat()

        # Write to file
        case_path = self._get_case_path(case_data["id"])
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
            List of case summaries (id, name, savedAt, sourceScenario, judgment)
        """
        cases = []
        for case_file in DATA_DIR.glob("*.json"):
            try:
                with open(case_file, "r", encoding="utf-8") as f:
                    case_data = json.load(f)
                    # Return summary only (not full conversations/logs)
                    cases.append({
                        "id": case_data.get("id"),
                        "savedAt": case_data.get("savedAt"),
                        "name": case_data.get("name"),
                        "sourceScenario": case_data.get("sourceScenario"),
                        "testConfig": case_data.get("testConfig"),
                        "judgment": case_data.get("judgment"),
                    })
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

        # Only allow updating certain fields
        allowed_fields = {"name", "tags", "notes"}
        for key, value in updates.items():
            if key in allowed_fields:
                case_data[key] = value

        # Update timestamp
        case_data["updatedAt"] = datetime.now().isoformat()

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
