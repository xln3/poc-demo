from __future__ import annotations
import time
import base64
import httpx
from typing import Any, Callable, Dict, List
from datetime import datetime
from ..models.schemas import ToolType, ToolResult, LogEntry, LogType, LogStatus
from .container import container_manager


class ToolExecutor:
    """Executes tools in sandbox containers."""

    def __init__(self):
        self._tools: Dict[ToolType, Callable] = {
            ToolType.READ_FILE: self._read_file,
            ToolType.WRITE_FILE: self._write_file,
            ToolType.RUN_COMMAND: self._run_command,
            ToolType.HTTP_REQUEST: self._http_request,
            ToolType.LIST_DIR: self._list_dir,
        }
        self._log_callbacks: List[Callable[[LogEntry], None]] = []

    def register_log_callback(self, callback: Callable[[LogEntry], None]):
        """Register callback to receive log entries."""
        self._log_callbacks.append(callback)

    def unregister_log_callback(self, callback: Callable[[LogEntry], None]):
        """Unregister a log callback."""
        if callback in self._log_callbacks:
            self._log_callbacks.remove(callback)

    def _emit_log(self, log_type: LogType, content: str, status: LogStatus, details: dict = None):
        """Emit a log entry to all registered callbacks."""
        entry = LogEntry(
            type=log_type,
            content=content,
            status=status,
            timestamp=datetime.now().isoformat(),
            details=details
        )
        for callback in self._log_callbacks:
            try:
                callback(entry)
            except Exception:
                pass

    def register_tool(self, tool_type: ToolType, handler: Callable):
        """Register a custom tool handler."""
        self._tools[tool_type] = handler

    async def execute(
        self,
        session_id: str,
        tool: ToolType,
        params: Dict[str, Any]
    ) -> ToolResult:
        """Execute a tool in the sandbox."""
        if tool not in self._tools:
            return ToolResult(
                success=False,
                tool=tool,
                result=None,
                error=f"Unknown tool: {tool}",
                execution_time_ms=0
            )

        # Log tool call start
        self._emit_log(
            LogType.TOOL,
            f"Calling tool: {tool.value}",
            LogStatus.NORMAL,
            {"tool": tool.value, "params": params}
        )

        start_time = time.time()
        try:
            result = await self._tools[tool](session_id, params)
            execution_time = int((time.time() - start_time) * 1000)

            # Log success
            self._emit_log(
                LogType.TOOL,
                f"Tool {tool.value} completed successfully",
                LogStatus.SUCCESS,
                {"tool": tool.value, "execution_time_ms": execution_time}
            )

            return ToolResult(
                success=True,
                tool=tool,
                result=result,
                error=None,
                execution_time_ms=execution_time
            )
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)

            # Log error
            self._emit_log(
                LogType.ERROR,
                f"Tool {tool.value} failed: {str(e)}",
                LogStatus.DANGER,
                {"tool": tool.value, "error": str(e)}
            )

            return ToolResult(
                success=False,
                tool=tool,
                result=None,
                error=str(e),
                execution_time_ms=execution_time
            )

    async def _read_file(self, session_id: str, params: dict) -> str:
        """Read file from container."""
        path = params.get("path")
        if not path:
            raise ValueError("Missing required parameter: path")

        # Sanitize path to prevent escape
        if ".." in path:
            raise ValueError("Path traversal not allowed")

        exit_code, output = container_manager.exec_in_container(
            session_id,
            f"cat '{path}'"
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to read file: {output}")

        return output

    async def _write_file(self, session_id: str, params: dict) -> str:
        """Write file in container.

        Content can be:
        - Plain text (is_base64=False, default for backwards compat)
        - Base64 encoded binary (is_base64=True)
        """
        path = params.get("path")
        content = params.get("content", "")
        is_base64 = params.get("is_base64", False)

        if not path:
            raise ValueError("Missing required parameter: path")

        if ".." in path:
            raise ValueError("Path traversal not allowed")

        if is_base64:
            # Content is base64 encoded binary - decode and use Docker API to copy
            try:
                file_bytes = base64.b64decode(content)
                container_manager.copy_file_to_container(session_id, path, file_bytes)
                return f"File written: {path} ({len(file_bytes)} bytes)"
            except Exception as e:
                raise RuntimeError(f"Failed to write binary file: {e}")
        else:
            # Plain text content - use shell command
            safe_path = path.replace("'", "'\\''")
            encoded = base64.b64encode(content.encode()).decode()
            exit_code, output = container_manager.exec_in_container(
                session_id,
                f"echo '{encoded}' | base64 -d > '{safe_path}'"
            )

            if exit_code != 0:
                raise RuntimeError(f"Failed to write file: {output}")

            return f"File written: {path}"

    async def _run_command(self, session_id: str, params: dict) -> str:
        """Run command in container."""
        command = params.get("command")
        if not command:
            raise ValueError("Missing required parameter: command")

        # Log the specific command being run
        self._emit_log(
            LogType.INFO,
            f"Executing: {command}",
            LogStatus.NORMAL
        )

        exit_code, output = container_manager.exec_in_container(
            session_id,
            command
        )

        result = {
            "exit_code": exit_code,
            "output": output
        }

        if exit_code != 0:
            self._emit_log(
                LogType.WARNING,
                f"Command exited with code {exit_code}",
                LogStatus.WARNING
            )

        return result

    async def _http_request(self, session_id: str, params: dict) -> dict:
        """Make HTTP request from container (or directly for simplicity)."""
        method = params.get("method", "GET").upper()
        url = params.get("url")
        headers = params.get("headers", {})
        body = params.get("body")

        if not url:
            raise ValueError("Missing required parameter: url")

        self._emit_log(
            LogType.INFO,
            f"HTTP {method} {url}",
            LogStatus.NORMAL
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                content=body
            )

            return {
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": response.text[:10000]  # Limit response size
            }

    async def _list_dir(self, session_id: str, params: dict) -> List[str]:
        """List directory contents in container."""
        path = params.get("path", ".")

        if ".." in path:
            raise ValueError("Path traversal not allowed")

        exit_code, output = container_manager.exec_in_container(
            session_id,
            f"ls -la '{path}'"
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to list directory: {output}")

        return output.split("\n")


# Singleton instance
tool_executor = ToolExecutor()
