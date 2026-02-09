"""
Database MCP Service
Provides tools for database operations: query, execute, list tables, describe table.
Supports PostgreSQL and SQLite.
"""

import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    import asyncpg
    ASYNCPG_AVAILABLE = True
except ImportError:
    ASYNCPG_AVAILABLE = False
    asyncpg = None

try:
    import aiosqlite
    AIOSQLITE_AVAILABLE = True
except ImportError:
    AIOSQLITE_AVAILABLE = False
    aiosqlite = None


class DatabaseService:
    """Service for database operations."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test database connection."""
        db_type = config.get("type", "postgres")

        if db_type == "postgres":
            return await self._test_postgres(config)
        elif db_type == "sqlite":
            return await self._test_sqlite(config)
        else:
            return {"success": False, "error": f"Unsupported database type: {db_type}"}

    async def _test_postgres(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test PostgreSQL connection."""
        if not ASYNCPG_AVAILABLE:
            return {"success": False, "error": "asyncpg not installed. Run: pip install asyncpg"}

        host = config.get("host", "localhost")
        port = config.get("port", 5432)
        user = config.get("user")
        password = config.get("password")
        database = config.get("database")

        if not all([user, password, database]):
            return {"success": False, "error": "Missing required config: user, password, database"}

        try:
            conn = await asyncpg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                timeout=10,
            )
            version = await conn.fetchval("SELECT version()")
            await conn.close()
            return {
                "success": True,
                "message": f"Connected to PostgreSQL at {host}:{port}/{database}",
                "details": {"version": version[:50] if version else "Unknown"},
            }
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def _test_sqlite(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test SQLite connection."""
        if not AIOSQLITE_AVAILABLE:
            return {"success": False, "error": "aiosqlite not installed. Run: pip install aiosqlite"}

        db_path = config.get("path")
        if not db_path:
            return {"success": False, "error": "Missing 'path' configuration"}

        try:
            async with aiosqlite.connect(db_path) as db:
                cursor = await db.execute("SELECT sqlite_version()")
                version = await cursor.fetchone()
                return {
                    "success": True,
                    "message": f"Connected to SQLite: {db_path}",
                    "details": {"version": version[0] if version else "Unknown"},
                }
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a database tool."""
        db_type = config.get("type", "postgres")

        tool_handlers = {
            "db_query": self._query,
            "db_execute": self._execute,
            "db_list_tables": self._list_tables,
            "db_describe_table": self._describe_table,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(db_type, params, config)

    async def _get_postgres_conn(self, config: Dict[str, Any]):
        """Get PostgreSQL connection."""
        if not ASYNCPG_AVAILABLE:
            raise RuntimeError("asyncpg not installed")

        return await asyncpg.connect(
            host=config.get("host", "localhost"),
            port=config.get("port", 5432),
            user=config.get("user"),
            password=config.get("password"),
            database=config.get("database"),
            timeout=10,
        )

    # Dangerous SQL patterns that can bypass SELECT-only check
    _DANGEROUS_PATTERNS = [
        "INTO",          # SELECT ... INTO
        "FOR UPDATE",    # Row locking
        "FOR SHARE",
        "PG_CATALOG",    # System catalog access
        "PG_SHADOW",     # Password hashes
        "PG_AUTHID",     # Auth info
        "INFORMATION_SCHEMA.USER_PRIVILEGES",
        "DBLINK",        # Cross-database queries
        "COPY",          # File I/O
        "LO_IMPORT",     # Large object import
        "LO_EXPORT",
    ]

    async def _query(
        self, db_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a SELECT query and return results."""
        query = params.get("query", "")
        limit = params.get("limit", 100)

        if not query:
            return {"success": False, "error": "Missing 'query' parameter"}

        # Security check: only allow simple SELECT queries
        query_upper = query.strip().upper()
        if not query_upper.startswith("SELECT"):
            return {"success": False, "error": "Only SELECT queries are allowed in db_query"}

        # Block dangerous patterns (CTE abuse, system catalog access, etc.)
        for pattern in self._DANGEROUS_PATTERNS:
            if pattern in query_upper:
                return {"success": False, "error": f"Query contains disallowed pattern: {pattern}"}

        # Block semicolons to prevent multi-statement injection
        if ";" in query.rstrip().rstrip(";"):
            return {"success": False, "error": "Multiple statements are not allowed"}

        # Add LIMIT if not present
        if "LIMIT" not in query_upper:
            query = f"{query.rstrip().rstrip(';')} LIMIT {limit}"

        try:
            if db_type == "postgres":
                return await self._query_postgres(query, config)
            elif db_type == "sqlite":
                return await self._query_sqlite(query, config)
            else:
                return {"success": False, "error": f"Unsupported database type: {db_type}"}
        except Exception as e:
            return {"success": False, "error": f"Query failed: {str(e)}"}

    async def _query_postgres(self, query: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Execute query on PostgreSQL."""
        conn = await self._get_postgres_conn(config)
        try:
            rows = await conn.fetch(query)
            if rows:
                columns = list(rows[0].keys())
                data = [dict(row) for row in rows]
                # Convert non-JSON-serializable types
                for row in data:
                    for key, value in row.items():
                        if not isinstance(value, (str, int, float, bool, type(None), list, dict)):
                            row[key] = str(value)
                return {
                    "success": True,
                    "result": {"columns": columns, "rows": data, "count": len(data)},
                }
            return {"success": True, "result": {"columns": [], "rows": [], "count": 0}}
        finally:
            await conn.close()

    async def _query_sqlite(self, query: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Execute query on SQLite."""
        async with aiosqlite.connect(config.get("path")) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(query)
            rows = await cursor.fetchall()
            if rows:
                columns = [desc[0] for desc in cursor.description]
                data = [dict(row) for row in rows]
                return {
                    "success": True,
                    "result": {"columns": columns, "rows": data, "count": len(data)},
                }
            return {"success": True, "result": {"columns": [], "rows": [], "count": 0}}

    async def _execute(
        self, db_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute INSERT/UPDATE/DELETE statements."""
        query = params.get("query", "")

        if not query:
            return {"success": False, "error": "Missing 'query' parameter"}

        # Security check: disallow SELECT in execute
        query_upper = query.strip().upper()
        if query_upper.startswith("SELECT"):
            return {"success": False, "error": "Use db_query for SELECT statements"}

        # Block multi-statement injection via semicolons
        if ";" in query.rstrip().rstrip(";"):
            return {"success": False, "error": "Multiple statements are not allowed in db_execute"}

        # Disallow dangerous operations — comprehensive blocklist
        _EXECUTE_BLOCKED = [
            # DDL that destroys data
            "DROP DATABASE", "DROP SCHEMA", "DROP TABLE", "DROP INDEX",
            "DROP VIEW", "DROP FUNCTION", "DROP PROCEDURE", "DROP TRIGGER",
            "DROP ROLE", "DROP USER", "DROP SEQUENCE", "DROP TYPE",
            "TRUNCATE",
            # DDL that modifies structure beyond DML intent
            "CREATE FUNCTION", "CREATE PROCEDURE", "CREATE TRIGGER",
            "CREATE ROLE", "CREATE USER", "CREATE EXTENSION",
            # Privilege escalation
            "GRANT", "REVOKE",
            "ALTER ROLE", "ALTER USER",
            # Filesystem access (PostgreSQL)
            "COPY ", "PG_READ_FILE", "PG_WRITE_FILE", "PG_LS_DIR",
            "PG_STAT_FILE", "LO_IMPORT", "LO_EXPORT",
            # Dynamic SQL execution
            "EXECUTE ", "EXEC ",
            # System catalog modification
            "PG_CATALOG", "PG_SHADOW", "PG_AUTHID",
        ]
        for pattern in _EXECUTE_BLOCKED:
            if pattern in query_upper:
                return {"success": False, "error": f"Operation not allowed: {pattern}"}

        try:
            if db_type == "postgres":
                return await self._execute_postgres(query, config)
            elif db_type == "sqlite":
                return await self._execute_sqlite(query, config)
            else:
                return {"success": False, "error": f"Unsupported database type: {db_type}"}
        except Exception as e:
            return {"success": False, "error": f"Execute failed: {str(e)}"}

    async def _execute_postgres(self, query: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Execute statement on PostgreSQL."""
        conn = await self._get_postgres_conn(config)
        try:
            result = await conn.execute(query)
            # Parse result string like "DELETE 5" or "UPDATE 3"
            parts = result.split()
            affected = int(parts[-1]) if parts and parts[-1].isdigit() else 0
            return {
                "success": True,
                "result": {"affected_rows": affected, "status": result},
            }
        finally:
            await conn.close()

    async def _execute_sqlite(self, query: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Execute statement on SQLite."""
        async with aiosqlite.connect(config.get("path")) as db:
            cursor = await db.execute(query)
            await db.commit()
            return {
                "success": True,
                "result": {"affected_rows": cursor.rowcount},
            }

    @staticmethod
    def _validate_identifier(name: str) -> str:
        """Validate a SQL identifier (table/schema name) to prevent injection."""
        import re
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', name):
            raise ValueError(f"Invalid SQL identifier: {name!r}")
        return name

    async def _list_tables(
        self, db_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List all tables in the database."""
        try:
            schema = self._validate_identifier(params.get("schema", "public"))
        except ValueError as e:
            return {"success": False, "error": str(e)}

        try:
            if db_type == "postgres":
                query = f"""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = '{schema}'
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """
                result = await self._query_postgres(query, config)
            elif db_type == "sqlite":
                query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
                result = await self._query_sqlite(query, config)
            else:
                return {"success": False, "error": f"Unsupported database type: {db_type}"}

            if result.get("success"):
                tables = [row.get("table_name") or row.get("name") for row in result["result"]["rows"]]
                return {"success": True, "result": {"tables": tables, "count": len(tables)}}
            return result
        except Exception as e:
            return {"success": False, "error": f"List tables failed: {str(e)}"}

    async def _describe_table(
        self, db_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Describe table structure."""
        table_name = params.get("table")
        schema = params.get("schema", "public")

        if not table_name:
            return {"success": False, "error": "Missing 'table' parameter"}

        try:
            table_name = self._validate_identifier(table_name)
            schema = self._validate_identifier(schema)
        except ValueError as e:
            return {"success": False, "error": str(e)}

        try:
            if db_type == "postgres":
                query = f"""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = '{schema}' AND table_name = '{table_name}'
                    ORDER BY ordinal_position
                """
                result = await self._query_postgres(query, config)
            elif db_type == "sqlite":
                query = f"PRAGMA table_info({table_name})"
                async with aiosqlite.connect(config.get("path")) as db:
                    cursor = await db.execute(query)
                    rows = await cursor.fetchall()
                    columns = [
                        {
                            "column_name": row[1],
                            "data_type": row[2],
                            "is_nullable": "YES" if not row[3] else "NO",
                            "column_default": row[4],
                        }
                        for row in rows
                    ]
                    return {"success": True, "result": {"table": table_name, "columns": columns}}
            else:
                return {"success": False, "error": f"Unsupported database type: {db_type}"}

            if result.get("success"):
                return {
                    "success": True,
                    "result": {"table": table_name, "columns": result["result"]["rows"]},
                }
            return result
        except Exception as e:
            return {"success": False, "error": f"Describe table failed: {str(e)}"}


# Global service instance
database_service = DatabaseService()
