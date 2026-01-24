from __future__ import annotations
import time
import base64
import asyncio
import httpx
from typing import Any, Callable, Dict, List
from datetime import datetime
from ..models.schemas import ToolType, ToolResult, LogEntry, LogType, LogStatus, FileEntry, FileType
from .container import container_manager


def _octal_to_permissions(mode_str: str) -> str:
    """将八进制权限转换为 rwx 格式"""
    try:
        mode = int(mode_str, 8)
    except ValueError:
        return mode_str

    result = ""
    for shift in [6, 3, 0]:
        bits = (mode >> shift) & 7
        result += "r" if bits & 4 else "-"
        result += "w" if bits & 2 else "-"
        result += "x" if bits & 1 else "-"

    return result


def parse_find_output(output: bytes, base_path: str) -> List[FileEntry]:
    """解析 find -printf 的 NUL 分隔输出

    格式: path\0type\0size\0mtime\0mode\0
    """
    entries = []

    # 按 NUL 分割
    parts = output.split(b'\0')

    # 每 5 个字段为一组
    i = 0
    while i + 4 < len(parts):
        try:
            path = parts[i].decode('utf-8', errors='replace')
            file_type = parts[i + 1].decode('utf-8')
            size_str = parts[i + 2].decode('utf-8')
            mtime_str = parts[i + 3].decode('utf-8')
            mode_str = parts[i + 4].decode('utf-8')

            # 跳过根目录本身
            normalized_base = base_path.rstrip('/')
            if path == normalized_base or path == normalized_base + '/':
                i += 5
                continue

            # 提取文件名
            name = path.split('/')[-1]
            if not name:
                i += 5
                continue

            # 确定文件类型
            if file_type == 'd':
                entry_type = FileType.DIRECTORY
            elif file_type == 'l':
                entry_type = FileType.SYMLINK
            else:
                entry_type = FileType.FILE

            # 解析大小
            try:
                size = int(size_str)
            except ValueError:
                size = 0

            # 格式化修改时间 - 处理带毫秒的时间格式
            try:
                # find 的 %TS 会输出秒数（可能带小数），我们需要截断
                mtime_clean = mtime_str.split('.')[0] if '.' in mtime_str else mtime_str
                # 尝试多种格式
                for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']:
                    try:
                        mtime = datetime.strptime(mtime_clean, fmt).isoformat()
                        break
                    except ValueError:
                        continue
                else:
                    mtime = mtime_str
            except Exception:
                mtime = mtime_str

            # 权限转换 (数字 -> rwx 格式)
            permissions = _octal_to_permissions(mode_str)

            entries.append(FileEntry(
                name=name,
                path=path,
                type=entry_type,
                size=size,
                mtime=mtime,
                permissions=permissions,
            ))
        except Exception:
            pass

        i += 5

    return entries


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

        # 如果是相对路径，转换为 /workspace 下的绝对路径
        if not path.startswith('/'):
            path = f"/workspace/{path}"

        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            f"/bin/sh -c \"cat '{path}'\""
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to read file: {stderr or stdout}")

        return stdout

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
                await asyncio.to_thread(
                    container_manager.copy_file_to_container, session_id, path, file_bytes
                )
                return f"File written: {path} ({len(file_bytes)} bytes)"
            except Exception as e:
                raise RuntimeError(f"Failed to write binary file: {e}")
        else:
            # Plain text content - use shell command
            # 如果是相对路径，转换为 /workspace 下的绝对路径
            if not path.startswith('/'):
                path = f"/workspace/{path}"
            safe_path = path.replace("'", "'\\''")
            encoded = base64.b64encode(content.encode()).decode()
            # 确保父目录存在
            dir_path = '/'.join(safe_path.rsplit('/', 1)[:-1]) or '/'
            await asyncio.to_thread(
                container_manager.exec_in_container,
                session_id,
                f"/bin/sh -c 'mkdir -p {dir_path}'"
            )
            exit_code, stdout, stderr = await asyncio.to_thread(
                container_manager.exec_in_container,
                session_id,
                f"/bin/sh -c \"echo '{encoded}' | base64 -d > '{safe_path}'\""
            )

            if exit_code != 0:
                raise RuntimeError(f"Failed to write file: {stderr or stdout}")

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

        # 通过 shell 执行命令，确保管道、重定向等功能正常
        escaped_command = command.replace('"', '\\"')
        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            f'/bin/sh -c "{escaped_command}"'
        )

        # 合并 stdout 和 stderr 用于输出
        output = (stdout + "\n" + stderr).strip() if stderr else stdout
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

        # 如果是相对路径，转换为 /workspace 下的绝对路径
        if not path.startswith('/'):
            path = f"/workspace/{path}" if path != "." else "/workspace"

        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            f"/bin/sh -c \"ls -la '{path}'\""
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to list directory: {stderr or stdout}")

        return stdout.split("\n")

    async def list_dir_structured(self, session_id: str, path: str = "/workspace", recursive: bool = False) -> dict:
        """List directory contents with structured data.

        使用 find -printf 命令获取文件信息，正确处理含空格/中文的文件名。

        Args:
            session_id: 会话 ID
            path: 目录路径
            recursive: 是否递归列出

        Returns:
            dict: {"path": str, "entries": List[FileEntry], "total": int}
        """
        if ".." in path:
            raise ValueError("Path traversal not allowed")

        # 转换为绝对路径
        if not path.startswith('/'):
            path = f"/workspace/{path}" if path != "." else "/workspace"

        # 构建 find 命令
        # -printf 格式: 路径\0类型\0大小\0修改时间\0权限\0
        depth_arg = "" if recursive else "-maxdepth 1"
        # 对路径进行转义，处理特殊字符
        escaped_path = path.replace("'", "'\\''")
        cmd = f"/bin/sh -c \"find '{escaped_path}' {depth_arg} -printf '%p\\0%y\\0%s\\0%TY-%Tm-%Td %TH:%TM:%TS\\0%m\\0'\""

        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container_binary,
            session_id,
            cmd
        )

        if exit_code != 0:
            # 目录不存在时返回空列表（检查 stderr 中的错误信息）
            stderr_str = stderr.decode('utf-8', errors='replace').lower() if stderr else ''
            if b"No such file" in stderr or "no such file" in stderr_str or not stdout:
                return {"path": path, "entries": [], "total": 0}
            raise RuntimeError(f"Failed to list directory: {stderr.decode('utf-8', errors='replace')}")

        entries = parse_find_output(stdout, path)

        return {
            "path": path,
            "entries": [e.model_dump() for e in entries],
            "total": len(entries)
        }

# Singleton instance
tool_executor = ToolExecutor()
