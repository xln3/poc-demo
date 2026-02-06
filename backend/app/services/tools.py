from __future__ import annotations
import json
import time
import base64
import asyncio
import posixpath
import httpx
from typing import Any, Callable, Dict, List
from datetime import datetime
from ..models.schemas import ToolType, ToolResult, LogEntry, LogType, LogStatus, FileEntry, FileType
from .container import container_manager
from .ssrf_guard import check_ssrf


# Allowed base directories for file operations inside containers
_ALLOWED_BASES = ("/workspace", "/tmp")


async def _resolve_and_validate_path(session_id: str, path: str) -> str:
    """Resolve a path inside the container and validate it stays within allowed directories.

    Uses readlink -f inside the container to resolve symlinks and ../ sequences,
    then checks the resolved path is under an allowed base.

    Raises ValueError if path escapes allowed directories.
    """
    # Normalize on the host side first (catches obvious ../  without a round-trip)
    if not path.startswith("/"):
        path = f"/workspace/{path}"

    # Resolve inside the container to handle symlinks
    exit_code, resolved, _ = await asyncio.to_thread(
        container_manager.exec_in_container,
        session_id,
        ["/usr/bin/readlink", "-f", path]
    )
    if exit_code != 0 or not resolved:
        # readlink -f failed — fall back to pure posixpath normalization
        resolved = posixpath.normpath(path)
    else:
        resolved = resolved.strip()

    if not any(resolved == base or resolved.startswith(base + "/") for base in _ALLOWED_BASES):
        raise ValueError(
            f"Path escapes allowed directories: {path!r} resolves to {resolved!r}"
        )
    return resolved


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


_HTTP_HELPER_PY = r'''
import sys, json, base64
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

params = json.loads(base64.b64decode(sys.argv[1]).decode())
req = Request(params["url"], method=params.get("method", "GET"))
for k, v in params.get("headers", {}).items():
    req.add_header(k, v)
body = params.get("body")
data = body.encode() if body else None
try:
    resp = urlopen(req, data=data, timeout=30)
    out = {"status_code": resp.status,
           "headers": dict(resp.headers),
           "body": resp.read().decode(errors="replace")[:10000]}
except HTTPError as e:
    out = {"status_code": e.code,
           "headers": dict(e.headers),
           "body": e.read().decode(errors="replace")[:10000]}
except URLError as e:
    out = {"error": str(e.reason)}
print(json.dumps(out))
'''

_HTTP_HELPER_JS = r'''
const params = JSON.parse(Buffer.from(process.argv[2], "base64").toString());
(async () => {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 30000);
    const opts = {method: params.method || "GET", headers: params.headers || {}, signal: ctrl.signal};
    if (params.body) opts.body = params.body;
    const r = await fetch(params.url, opts);
    clearTimeout(tid);
    const hdrs = {};
    r.headers.forEach((v, k) => { hdrs[k] = v; });
    const text = await r.text();
    console.log(JSON.stringify({status_code: r.status, headers: hdrs, body: text.slice(0, 10000)}));
  } catch(e) {
    console.log(JSON.stringify({error: e.message}));
  }
})();
'''


class ToolExecutor:
    """Executes tools in sandbox containers."""

    def __init__(self):
        self._tools: Dict[ToolType, Callable] = {
            ToolType.READ_FILE: self._read_file,
            ToolType.WRITE_FILE: self._write_file,
            ToolType.RUN_COMMAND: self._run_command,
            ToolType.HTTP_REQUEST: self._http_request,
            ToolType.LIST_DIR: self._list_dir,
            ToolType.PARSE_FILE: self._parse_file,
        }
        self._log_callbacks: List[Callable[[LogEntry], None]] = []
        # File-Parser 服务地址（内部 HTTP 调用）
        self._file_parser_url = "http://127.0.0.1:8000/file-parser/parse/base64"
        # Track which sessions already have the HTTP helper script installed
        self._http_helper_ready: set[str] = set()

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

        path = await _resolve_and_validate_path(session_id, path)

        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            ["/bin/cat", path]
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to read file: {stderr or stdout}")

        return stdout

    async def _write_file(self, session_id: str, params: dict) -> str:
        """Write file in container.

        Content can be:
        - Plain text (is_base64=False, default for backwards compat)
        - Base64 encoded binary (is_base64=True)

        Both paths use Docker's put_archive API to avoid shell interpretation.
        """
        path = params.get("path")
        content = params.get("content", "")
        is_base64 = params.get("is_base64", False)

        if not path:
            raise ValueError("Missing required parameter: path")

        path = await _resolve_and_validate_path(session_id, path)

        if is_base64:
            file_bytes = base64.b64decode(content)
        else:
            file_bytes = content.encode()

        # Ensure parent directory exists (list form, no shell)
        dir_path = posixpath.dirname(path)
        await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            ["/bin/mkdir", "-p", dir_path]
        )

        # Use Docker put_archive API — no shell involved
        try:
            await asyncio.to_thread(
                container_manager.copy_file_to_container, session_id, path, file_bytes
            )
            return f"File written: {path} ({len(file_bytes)} bytes)"
        except Exception as e:
            raise RuntimeError(f"Failed to write file: {e}")

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

        # Pass command to a single shell invocation via list form,
        # avoiding double-shell expansion from string concatenation.
        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            ["/bin/sh", "-c", command]
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

    async def _ensure_http_helper(self, session_id: str) -> str:
        """Write the HTTP helper script into the container (once per session).

        Returns the command prefix to invoke the helper, e.g.
        "python3 /tmp/_http_helper.py" or "node /tmp/_http_helper.js".
        """
        if session_id in self._http_helper_ready:
            image = container_manager._session_images.get(session_id, "")
            if "node" in image:
                return "node /tmp/_http_helper.js"
            return "python3 /tmp/_http_helper.py"

        image = container_manager._session_images.get(session_id, "")
        if "node" in image:
            script = _HTTP_HELPER_JS
            path = "/tmp/_http_helper.js"
            cmd_prefix = "node /tmp/_http_helper.js"
        else:
            script = _HTTP_HELPER_PY
            path = "/tmp/_http_helper.py"
            cmd_prefix = "python3 /tmp/_http_helper.py"

        # Use Docker put_archive API to write the helper script (no shell)
        try:
            await asyncio.to_thread(
                container_manager.copy_file_to_container,
                session_id,
                path,
                script.encode()
            )
        except Exception as e:
            raise RuntimeError(f"Failed to install HTTP helper: {e}")

        self._http_helper_ready.add(session_id)
        return cmd_prefix

    async def _http_request(self, session_id: str, params: dict) -> dict:
        """Make HTTP request inside the sandbox container.

        SSRF pre-check runs on the host as defense-in-depth; the actual
        request is executed inside the Docker container so network isolation
        applies even if the check is bypassed.
        """
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

        # Defense-in-depth: SSRF pre-check on host
        ssrf_result = check_ssrf(url)
        if not ssrf_result.get("allowed"):
            raise ValueError(f"Request blocked: {ssrf_result.get('reason')}")

        # Prepare params for the in-container helper script
        helper_params = {"method": method, "url": url}
        if headers:
            helper_params["headers"] = headers
        if body:
            helper_params["body"] = body

        b64_params = base64.b64encode(json.dumps(helper_params).encode()).decode()

        cmd_prefix = await self._ensure_http_helper(session_id)
        # cmd_prefix is e.g. "python3 /tmp/_http_helper.py" — split and append param
        cmd_parts = cmd_prefix.split() + [b64_params]
        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            cmd_parts
        )

        if exit_code != 0:
            raise RuntimeError(f"HTTP request failed: {stderr or stdout}")

        try:
            result = json.loads(stdout)
        except json.JSONDecodeError:
            raise RuntimeError(f"Invalid response from container: {stdout[:500]}")

        if "error" in result:
            raise RuntimeError(f"HTTP request error: {result['error']}")

        return result

    async def _list_dir(self, session_id: str, params: dict) -> List[str]:
        """List directory contents in container."""
        path = params.get("path", ".")

        if path == ".":
            path = "/workspace"

        path = await _resolve_and_validate_path(session_id, path)

        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            ["/bin/ls", "-la", path]
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
        if path == ".":
            path = "/workspace"
        path = await _resolve_and_validate_path(session_id, path)

        # 构建 find 命令 — 列表形式直接执行，避免 shell 解释
        find_cmd = ["/usr/bin/find", path]
        if not recursive:
            find_cmd += ["-maxdepth", "1"]
        find_cmd += ["-printf", "%p\\0%y\\0%s\\0%TY-%Tm-%Td %TH:%TM:%TS\\0%m\\0"]
        cmd = find_cmd

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

    async def _parse_file(self, session_id: str, params: dict) -> dict:
        """Parse file in container using file-parser service.

        通过 HTTP 调用独立的 file-parser 服务解析文件内容。
        松耦合设计：file-parser 代码不变，sandbox 通过 API 调用。

        Args:
            session_id: 会话 ID
            params: {
                "path": 容器内文件路径,
                "parsers": 解析器 ID 列表（可选，如 ["pymupdf", "pdfplumber"]）
            }

        Returns:
            dict: {
                "filename": 文件名,
                "file_type": 文件类型,
                "text": 解析后的文本,
                "extracts_hidden": 是否提取隐藏内容
            }
        """
        path = params.get("path")
        if not path:
            raise ValueError("Missing required parameter: path")

        path = await _resolve_and_validate_path(session_id, path)

        parsers = params.get("parsers", [])

        # 提取文件名
        filename = posixpath.basename(path)

        self._emit_log(
            LogType.INFO,
            f"Parsing file: {filename}",
            LogStatus.NORMAL
        )

        # 1. 从容器读取文件（Base64 编码，列表形式避免 shell）
        exit_code, stdout, stderr = await asyncio.to_thread(
            container_manager.exec_in_container,
            session_id,
            ["/usr/bin/base64", path]
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to read file for parsing: {stderr or stdout}")

        # 移除换行符，得到干净的 base64 字符串
        file_base64 = stdout.replace('\n', '').replace('\r', '')

        # 2. 调用 file-parser 服务
        request_body = {
            "filename": filename,
            "content_base64": file_base64,
        }
        if parsers:
            request_body["parsers"] = parsers

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self._file_parser_url,
                json=request_body
            )

            if response.status_code != 200:
                error_detail = response.text[:500]
                raise RuntimeError(f"File-parser service error ({response.status_code}): {error_detail}")

            result = response.json()

        self._emit_log(
            LogType.INFO,
            f"File parsed: {filename} ({len(result.get('text', ''))} chars)",
            LogStatus.SUCCESS
        )

        return {
            "filename": result.get("filename", filename),
            "file_type": result.get("file_type"),
            "text": result.get("text", ""),
            "extracts_hidden": result.get("extracts_hidden", False),
        }


# Singleton instance
tool_executor = ToolExecutor()
