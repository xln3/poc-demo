"""Async DB storage for datasets (replaces JSON file storage)."""
from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from ..db.tables import Dataset


class DBDatasetStorage:
    """Async PostgreSQL/SQLite storage for datasets using document-in-column pattern."""

    @staticmethod
    def _generate_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def _extract_summary(data: dict) -> dict:
        """Extract summary from v2 format dataset (same logic as DatasetStorage)."""
        meta = data.get("meta", {})
        cases = data.get("cases", [])

        capabilities = meta.get("capabilities", [])
        if not capabilities and cases:
            caps = set()
            for case in cases:
                if case.get("capability"):
                    caps.add(case["capability"])
                if case.get("input", {}).get("attack", {}).get("capabilityLevel"):
                    caps.add(case["input"]["attack"]["capabilityLevel"])
            capabilities = list(caps)

        return {
            "id": meta.get("datasetId"),
            "savedAt": meta.get("createdAt"),
            "schemaVersion": meta.get("schemaVersion", "2.1.0"),
            "name": meta.get("name", ""),
            "description": meta.get("description", ""),
            "caseCount": meta.get("caseCount", len(cases)),
            "totalSize": meta.get("totalSize", 0),
            "capabilities": capabilities,
            "source": meta.get("source", {}),
            "tags": meta.get("tags", []),
        }

    async def save_dataset(self, db: AsyncSession, dataset_data: dict) -> dict:
        """Save a new dataset."""
        now = datetime.now().isoformat()

        meta = dataset_data.get("meta", {})
        if not meta.get("datasetId"):
            meta["datasetId"] = self._generate_id()
        if not meta.get("createdAt"):
            meta["createdAt"] = now
        meta["updatedAt"] = now
        meta["type"] = "Dataset"
        meta["schemaVersion"] = "2.1.0"

        cases = dataset_data.get("cases", [])
        meta["caseCount"] = len(cases)
        meta["totalSize"] = len(json.dumps(dataset_data))

        dataset_data["meta"] = meta
        dataset_id = meta["datasetId"]
        dataset_data["id"] = dataset_id
        dataset_data["savedAt"] = meta["createdAt"]

        row = Dataset(
            id=dataset_id,
            name=meta.get("name", ""),
            description=meta.get("description"),
            capability_level=meta.get("capabilities", [None])[0] if meta.get("capabilities") else None,
            case_count=meta["caseCount"],
            total_size=meta["totalSize"],
            data_json=dataset_data,
            created_at=datetime.fromisoformat(meta["createdAt"]) if meta.get("createdAt") else datetime.utcnow(),
        )
        db.add(row)
        await db.commit()
        return dataset_data

    async def get_dataset(self, db: AsyncSession, dataset_id: str) -> Optional[dict]:
        """Get a dataset by ID, returning the full document."""
        row = await db.get(Dataset, dataset_id)
        if row is None:
            return None
        return row.data_json

    async def list_datasets(self, db: AsyncSession, *, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        """List all saved datasets with pagination."""
        limit = min(limit, 500) if limit else 500

        count_q = select(func.count()).select_from(Dataset)
        total = (await db.execute(count_q)).scalar() or 0

        q = (
            select(Dataset)
            .order_by(Dataset.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()

        items = [self._extract_summary(row.data_json) for row in rows]
        return {"items": items, "total": total, "offset": offset, "limit": limit}

    async def update_dataset(self, db: AsyncSession, dataset_id: str, updates: dict) -> Optional[dict]:
        """Update an existing dataset (name, description, tags, capabilities, source)."""
        row = await db.get(Dataset, dataset_id, with_for_update=True)
        if row is None:
            return None

        dataset_data = copy.deepcopy(row.data_json)
        now = datetime.now().isoformat()
        meta = dataset_data.get("meta", {})

        if "name" in updates:
            meta["name"] = updates["name"]
            row.name = updates["name"]
        if "description" in updates:
            meta["description"] = updates["description"]
            row.description = updates["description"]
        if "tags" in updates:
            meta["tags"] = updates["tags"]
        if "capabilities" in updates:
            meta["capabilities"] = updates["capabilities"]
        if "source" in updates:
            meta["source"] = updates["source"]
        meta["updatedAt"] = now
        dataset_data["meta"] = meta

        row.data_json = dataset_data
        row.updated_at = datetime.utcnow()
        flag_modified(row, "data_json")
        await db.commit()
        return dataset_data

    async def delete_dataset(self, db: AsyncSession, dataset_id: str) -> bool:
        """Delete a dataset by ID."""
        result = await db.execute(delete(Dataset).where(Dataset.id == dataset_id))
        await db.commit()
        return result.rowcount > 0

    async def add_case_to_dataset(self, db: AsyncSession, dataset_id: str, case_data: dict) -> Optional[dict]:
        """Add a test case to a dataset."""
        row = await db.get(Dataset, dataset_id, with_for_update=True)
        if row is None:
            return None

        if not case_data.get("id"):
            case_data["id"] = str(uuid.uuid4())

        dataset_data = copy.deepcopy(row.data_json)
        cases = dataset_data.get("cases", [])
        cases.append(case_data)
        dataset_data["cases"] = cases

        meta = dataset_data.get("meta", {})
        meta["caseCount"] = len(cases)
        meta["updatedAt"] = datetime.now().isoformat()
        meta["totalSize"] = len(json.dumps(dataset_data))

        if case_data.get("capability"):
            caps = set(meta.get("capabilities", []))
            caps.add(case_data["capability"])
            meta["capabilities"] = list(caps)

        dataset_data["meta"] = meta

        row.data_json = dataset_data
        row.case_count = len(cases)
        row.total_size = meta["totalSize"]
        row.updated_at = datetime.utcnow()
        await db.commit()
        return dataset_data

    async def remove_case_from_dataset(self, db: AsyncSession, dataset_id: str, case_id: str) -> Optional[dict]:
        """Remove a test case from a dataset."""
        row = await db.get(Dataset, dataset_id, with_for_update=True)
        if row is None:
            return None

        dataset_data = copy.deepcopy(row.data_json)
        cases = dataset_data.get("cases", [])
        new_cases = [c for c in cases if c.get("id") != case_id]

        if len(new_cases) == len(cases):
            return None  # case not found

        dataset_data["cases"] = new_cases
        meta = dataset_data.get("meta", {})
        meta["caseCount"] = len(new_cases)
        meta["updatedAt"] = datetime.now().isoformat()
        meta["totalSize"] = len(json.dumps(dataset_data))
        dataset_data["meta"] = meta

        row.data_json = dataset_data
        row.case_count = len(new_cases)
        row.total_size = meta["totalSize"]
        row.updated_at = datetime.utcnow()
        await db.commit()
        return dataset_data

    async def get_case_from_dataset(self, db: AsyncSession, dataset_id: str, case_id: str) -> Optional[dict]:
        """Get a specific test case from a dataset."""
        row = await db.get(Dataset, dataset_id)
        if row is None:
            return None

        for case in row.data_json.get("cases", []):
            if case.get("id") == case_id:
                return case
        return None


db_dataset_storage = DBDatasetStorage()
