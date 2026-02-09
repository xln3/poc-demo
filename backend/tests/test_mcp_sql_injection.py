"""Tests for SQL injection protection in MCP database _execute() method."""

import asyncio
import pytest
from app.services.mcp_database import DatabaseService


def _run(coro):
    """Run async coroutine synchronously."""
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture
def db_service():
    return DatabaseService()


class TestExecuteBlocklist:
    """Verify that _execute() blocks dangerous SQL operations."""

    def test_blocks_drop_table(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "DROP TABLE users"}, {"path": ":memory:"}))
        assert result["success"] is False
        assert "not allowed" in result["error"]

    def test_blocks_drop_database(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "DROP DATABASE mydb"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_create_function(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "CREATE FUNCTION evil() RETURNS void AS $$ $$ LANGUAGE sql"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_grant(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "GRANT ALL ON users TO public"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_alter_role(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "ALTER ROLE postgres WITH SUPERUSER"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_copy(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "COPY users TO '/tmp/dump.csv'"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_pg_read_file(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "SELECT PG_READ_FILE('/etc/passwd')"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_lo_import(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "SELECT LO_IMPORT('/etc/passwd')"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_revoke(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "REVOKE ALL ON users FROM public"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_truncate(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "TRUNCATE TABLE users"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_multi_statement(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "INSERT INTO t VALUES(1); DROP TABLE t"}, {"path": ":memory:"}))
        assert result["success"] is False
        assert "Multiple statements" in result["error"]

    def test_blocks_create_trigger(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "CREATE TRIGGER evil AFTER INSERT ON users EXECUTE evil()"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_allows_insert(self, db_service):
        """INSERT should pass pattern check (may fail at execution due to missing table)."""
        result = _run(db_service._execute("sqlite", {"query": "INSERT INTO users VALUES(1, 'test')"}, {"path": ":memory:"}))
        # Error should be execution failure, not a blocklist rejection
        assert "not allowed" not in result.get("error", "")

    def test_allows_update(self, db_service):
        """UPDATE should pass pattern check."""
        result = _run(db_service._execute("sqlite", {"query": "UPDATE users SET name='test' WHERE id=1"}, {"path": ":memory:"}))
        assert "not allowed" not in result.get("error", "")

    def test_allows_delete(self, db_service):
        """DELETE should pass pattern check."""
        result = _run(db_service._execute("sqlite", {"query": "DELETE FROM users WHERE id=1"}, {"path": ":memory:"}))
        assert "not allowed" not in result.get("error", "")

    def test_blocks_select_in_execute(self, db_service):
        """SELECT should be redirected to db_query."""
        result = _run(db_service._execute("sqlite", {"query": "SELECT * FROM users"}, {"path": ":memory:"}))
        assert result["success"] is False
        assert "db_query" in result["error"]

    def test_blocks_case_insensitive(self, db_service):
        """Blocklist should work regardless of case."""
        result = _run(db_service._execute("sqlite", {"query": "drop table users"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_create_extension(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "CREATE EXTENSION pgcrypto"}, {"path": ":memory:"}))
        assert result["success"] is False

    def test_blocks_pg_ls_dir(self, db_service):
        result = _run(db_service._execute("sqlite", {"query": "SELECT PG_LS_DIR('/tmp')"}, {"path": ":memory:"}))
        assert result["success"] is False
