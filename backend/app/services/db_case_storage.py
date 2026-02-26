"""Async DB storage for saved test cases (replaces JSON file storage)."""
from __future__ import annotations

import copy
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from ..db.tables import TestCase


class DBCaseStorage:
    """Async PostgreSQL/SQLite storage for test cases using document-in-column pattern."""

    @staticmethod
    def _generate_id() -> str:
        return str(uuid.uuid4())

    @staticmethod
    def _extract_summary(data: dict) -> dict:
        """Extract summary from v1 format case (same logic as CaseStorage)."""
        meta = data.get("meta", {})
        source = data.get("source", {})
        attack = source.get("attack", {})
        environment = data.get("environment", {})
        llm = environment.get("llm", {})
        result = data.get("result", {})
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

    async def save_case(self, db: AsyncSession, case_data: dict) -> dict:
        """Save a new test case."""
        now = datetime.now().isoformat()

        meta = case_data.get("meta", {})
        if not meta.get("caseId"):
            meta["caseId"] = self._generate_id()
        if not meta.get("createdAt"):
            meta["createdAt"] = now
        case_data["meta"] = meta
        case_id = meta["caseId"]
        case_data["id"] = case_id
        case_data["savedAt"] = meta["createdAt"]

        source = case_data.get("source", {})
        attack = source.get("attack", {})

        row = TestCase(
            id=case_id,
            name=meta.get("name") or attack.get("name", ""),
            scenario_key=source.get("scenarioKey"),
            attack_id=attack.get("id"),
            attack_type=attack.get("type"),
            capability_level=source.get("capabilityLevel"),
            data_json=case_data,
            created_at=datetime.fromisoformat(meta["createdAt"]) if meta.get("createdAt") else datetime.utcnow(),
        )
        db.add(row)
        await db.commit()
        return case_data

    async def get_case(self, db: AsyncSession, case_id: str) -> Optional[dict]:
        """Get a case by ID, returning the full document."""
        row = await db.get(TestCase, case_id)
        if row is None:
            return None
        return row.data_json

    async def list_cases(self, db: AsyncSession, *, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        """List all saved cases with pagination."""
        limit = min(limit, 500) if limit else 500

        # Total count
        count_q = select(func.count()).select_from(TestCase)
        total = (await db.execute(count_q)).scalar() or 0

        # Fetch rows ordered by created_at desc
        q = (
            select(TestCase)
            .order_by(TestCase.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()

        items = [self._extract_summary(row.data_json) for row in rows]
        return {"items": items, "total": total, "offset": offset, "limit": limit}

    async def update_case(self, db: AsyncSession, case_id: str, updates: dict) -> Optional[dict]:
        """Update an existing case (name, tags, notes)."""
        row = await db.get(TestCase, case_id, with_for_update=True)
        if row is None:
            return None

        case_data = copy.deepcopy(row.data_json)
        now = datetime.now().isoformat()
        meta = case_data.get("meta", {})

        if "name" in updates:
            meta["name"] = updates["name"]
            row.name = updates["name"]
        if "tags" in updates:
            meta["tags"] = updates["tags"]
        if "notes" in updates:
            meta["notes"] = updates["notes"]
        meta["updatedAt"] = now
        case_data["meta"] = meta

        row.data_json = case_data
        row.updated_at = datetime.utcnow()
        flag_modified(row, "data_json")
        await db.commit()
        return case_data

    async def delete_case(self, db: AsyncSession, case_id: str) -> bool:
        """Delete a case by ID."""
        result = await db.execute(delete(TestCase).where(TestCase.id == case_id))
        await db.commit()
        return result.rowcount > 0


db_case_storage = DBCaseStorage()
