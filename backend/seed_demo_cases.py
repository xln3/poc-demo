"""Seed the database with demo risk demonstration cases.

Usage (from poc-demo/ directory with .env sourced):
    python3 -m backend.seed_demo_cases

Or via run.sh context (from backend/ directory):
    python3 -c "from seed_demo_cases import main; main()"

Or trigger via API (requires auth):
    POST /cases/seed-demos
"""
from __future__ import annotations

import asyncio
import os
import sys


async def seed_to_db():
    """Insert demo cases into the database (skipping duplicates by name)."""

    # Ensure we can import the backend modules from either cwd
    here = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(here)  # poc-demo/
    for p in (project_root, here):
        if p not in sys.path:
            sys.path.insert(0, p)

    # Try both import paths (poc-demo/backend vs backend/ as cwd)
    try:
        from app.services.demo_cases import build_demo_cases
        from app.db.engine import AsyncSessionLocal
        from app.services.db_case_storage import db_case_storage
        from app.db.tables import TestCase
    except ImportError:
        from backend.app.services.demo_cases import build_demo_cases
        from backend.app.db.engine import AsyncSessionLocal
        from backend.app.services.db_case_storage import db_case_storage
        from backend.app.db.tables import TestCase

    from sqlalchemy import select

    cases = build_demo_cases()
    inserted = 0
    skipped = 0

    async with AsyncSessionLocal() as db:
        for case_data in cases:
            name = case_data["meta"]["name"]
            existing = await db.execute(
                select(TestCase).where(TestCase.name == name).limit(1)
            )
            if existing.scalar_one_or_none() is not None:
                print(f"  SKIP: '{name}' already exists")
                skipped += 1
                continue

            await db_case_storage.save_case(db, case_data)
            print(f"  OK:   '{name}' inserted ({case_data['meta']['case_id']})")
            inserted += 1

    print(f"\nDone: {inserted} inserted, {skipped} skipped (already exist)")
    return inserted, skipped


def main():
    print("Seeding demo risk demonstration cases...")
    asyncio.run(seed_to_db())


if __name__ == "__main__":
    main()
