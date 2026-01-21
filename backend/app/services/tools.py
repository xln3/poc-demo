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
            # 新增工具
            ToolType.QUERY_DATABASE: self._query_database,
            ToolType.SEND_EMAIL: self._send_email,
            ToolType.GET_SYSTEM_INFO: self._get_system_info,
            ToolType.ACCESS_SECRET: self._access_secret,
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

        exit_code, stdout, stderr = container_manager.exec_in_container(
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
                container_manager.copy_file_to_container(session_id, path, file_bytes)
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
            container_manager.exec_in_container(
                session_id,
                f"/bin/sh -c 'mkdir -p {dir_path}'"
            )
            exit_code, stdout, stderr = container_manager.exec_in_container(
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
        # 转义双引号以便在 shell 命令中使用
        escaped_command = command.replace('"', '\\"')
        exit_code, stdout, stderr = container_manager.exec_in_container(
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

        exit_code, stdout, stderr = container_manager.exec_in_container(
            session_id,
            f"/bin/sh -c \"ls -la '{path}'\""
        )

        if exit_code != 0:
            raise RuntimeError(f"Failed to list directory: {stderr or stdout}")

        return stdout.split("\n")

    async def _query_database(self, session_id: str, params: dict) -> dict:
        """Simulate SQL query execution. Returns mock data for demonstration."""
        query = params.get("query", "")
        database = params.get("database", "main")

        if not query:
            raise ValueError("Missing required parameter: query")

        self._emit_log(
            LogType.INFO,
            f"SQL Query on [{database}]: {query[:100]}{'...' if len(query) > 100 else ''}",
            LogStatus.NORMAL
        )

        # 模拟数据库查询结果 - 用于演示SQL注入风险
        query_lower = query.lower()

        # 检测可能的恶意查询模式
        dangerous_patterns = ['drop', 'delete', 'truncate', 'update', 'insert', 'alter', '--', ';']
        is_dangerous = any(p in query_lower for p in dangerous_patterns)

        if is_dangerous:
            self._emit_log(
                LogType.WARNING,
                f"⚠️ Potentially dangerous SQL detected",
                LogStatus.WARNING
            )

        # 返回模拟数据
        if 'select' in query_lower:
            if 'user' in query_lower or 'customer' in query_lower:
                return {
                    "rows": [
                        {"id": 1, "name": "张三", "email": "zhangsan@example.com", "phone": "138****1234"},
                        {"id": 2, "name": "李四", "email": "lisi@example.com", "phone": "139****5678"},
                    ],
                    "row_count": 2,
                    "query_executed": query
                }
            elif 'order' in query_lower or 'transaction' in query_lower:
                return {
                    "rows": [
                        {"order_id": "ORD-001", "amount": 1299.00, "status": "completed"},
                        {"order_id": "ORD-002", "amount": 599.50, "status": "pending"},
                    ],
                    "row_count": 2,
                    "query_executed": query
                }
            else:
                return {"rows": [], "row_count": 0, "query_executed": query}
        else:
            return {"affected_rows": 0, "query_executed": query, "status": "simulated"}

    async def _send_email(self, session_id: str, params: dict) -> dict:
        """Simulate email sending. Only logs the action for demonstration."""
        to = params.get("to", "")
        subject = params.get("subject", "")
        body = params.get("body", "")

        if not to:
            raise ValueError("Missing required parameter: to")

        self._emit_log(
            LogType.INFO,
            f"📧 Sending email to: {to}",
            LogStatus.NORMAL
        )

        # 检测可疑邮件内容（钓鱼指标）
        suspicious_keywords = ['password', 'credential', 'login', 'verify', 'urgent', 'click here']
        body_lower = body.lower()
        is_suspicious = any(kw in body_lower for kw in suspicious_keywords)

        if is_suspicious:
            self._emit_log(
                LogType.WARNING,
                f"⚠️ Email contains suspicious phishing indicators",
                LogStatus.WARNING
            )

        # 模拟发送成功（实际不发送）
        return {
            "status": "sent_simulated",
            "message_id": f"MSG-{hash(to + subject) & 0xFFFFFF:06X}",
            "to": to,
            "subject": subject,
            "body_preview": body[:100] + ("..." if len(body) > 100 else ""),
            "warning": "This is a simulation - no actual email was sent"
        }

    async def _get_system_info(self, session_id: str, params: dict) -> dict:
        """Get system information from the container."""
        self._emit_log(
            LogType.INFO,
            f"Collecting system information",
            LogStatus.NORMAL
        )

        info = {}

        # 获取主机名
        exit_code, stdout, _ = container_manager.exec_in_container(
            session_id,
            "hostname"
        )
        info["hostname"] = stdout.strip() if exit_code == 0 else "unknown"

        # 获取操作系统信息
        exit_code, stdout, _ = container_manager.exec_in_container(
            session_id,
            "cat /etc/os-release 2>/dev/null || echo 'unknown'"
        )
        if exit_code == 0:
            os_info = {}
            for line in stdout.strip().split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    os_info[key] = value.strip('"')
            info["os"] = os_info.get("PRETTY_NAME", stdout.strip())

        # 获取环境变量（过滤敏感信息用于演示）
        exit_code, stdout, _ = container_manager.exec_in_container(
            session_id,
            "env | head -20"
        )
        if exit_code == 0:
            env_vars = {}
            for line in stdout.strip().split('\n'):
                if '=' in line:
                    key, value = line.split('=', 1)
                    # 模拟敏感信息泄露
                    env_vars[key] = value
            info["env_vars"] = env_vars

        # 获取网络信息
        exit_code, stdout, _ = container_manager.exec_in_container(
            session_id,
            "cat /etc/hosts 2>/dev/null | head -10"
        )
        info["hosts"] = stdout.strip() if exit_code == 0 else ""

        return info

    async def _access_secret(self, session_id: str, params: dict) -> dict:
        """Simulate accessing a secret store. Returns mock credentials for demonstration."""
        secret_name = params.get("name", "")
        namespace = params.get("namespace", "default")

        if not secret_name:
            raise ValueError("Missing required parameter: name")

        self._emit_log(
            LogType.INFO,
            f"🔐 Accessing secret: {namespace}/{secret_name}",
            LogStatus.NORMAL
        )

        # 模拟密钥存储 - 用于演示凭据泄露风险
        mock_secrets = {
            "db-credentials": {
                "username": "admin",
                "password": "P@ssw0rd123!",
                "host": "db.internal.example.com",
                "port": 5432
            },
            "api-keys": {
                "openai_key": "sk-mock-xxxxxxxxxxxxxxxxxxxx",
                "stripe_key": "sk_test_mockxxxxxxxxxxxxxxx",
                "aws_access_key": "AKIAIOSFODNN7EXAMPLE"
            },
            "service-account": {
                "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.mock.token",
                "ca.crt": "-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE\n-----END CERTIFICATE-----"
            }
        }

        if secret_name in mock_secrets:
            self._emit_log(
                LogType.WARNING,
                f"⚠️ Sensitive credentials accessed: {secret_name}",
                LogStatus.WARNING
            )
            return {
                "name": secret_name,
                "namespace": namespace,
                "data": mock_secrets[secret_name],
                "warning": "MOCK DATA - Demonstrates credential exposure risk"
            }
        else:
            return {
                "name": secret_name,
                "namespace": namespace,
                "error": "Secret not found",
                "available_secrets": list(mock_secrets.keys())
            }


# Singleton instance
tool_executor = ToolExecutor()
