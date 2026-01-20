from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from enum import Enum


class ImageType(str, Enum):
    PYTHON = "python:3.11-slim"
    UBUNTU = "ubuntu:22.04"
    NODE = "node:20-slim"
    MCP_TOOLS = "mcp-tools:latest"  # MCP文件解析工具镜像


class ContainerStatus(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    NOT_FOUND = "not_found"


class ToolType(str, Enum):
    READ_FILE = "read_file"
    WRITE_FILE = "write_file"
    RUN_COMMAND = "run_command"
    HTTP_REQUEST = "http_request"
    LIST_DIR = "list_dir"
    # 新增工具 - 用于演示工具调用攻击场景
    QUERY_DATABASE = "query_database"     # SQL查询（模拟）
    SEND_EMAIL = "send_email"             # 发送邮件（仅日志）
    GET_SYSTEM_INFO = "get_system_info"   # 获取系统信息
    ACCESS_SECRET = "access_secret"       # 访问密钥存储


class LogType(str, Enum):
    CONTAINER = "container"
    TOOL = "tool"
    ERROR = "error"
    INFO = "info"
    WARNING = "warning"


class LogStatus(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    DANGER = "danger"
    SUCCESS = "success"


# Request models
class CreateContainerRequest(BaseModel):
    image: ImageType = ImageType.PYTHON
    session_id: Optional[str] = None


class ToolCallRequest(BaseModel):
    session_id: str
    tool: ToolType
    params: Dict[str, Any]


class HttpRequestParams(BaseModel):
    method: str = "GET"
    url: str
    headers: Optional[Dict[str, str]] = None
    body: Optional[str] = None


# Response models
class ContainerInfo(BaseModel):
    session_id: str
    container_id: str
    image: str
    status: ContainerStatus
    created_at: str


class ToolResult(BaseModel):
    success: bool
    tool: ToolType
    result: Any
    error: Optional[str] = None
    execution_time_ms: int


class LogEntry(BaseModel):
    type: LogType
    content: str
    status: LogStatus
    timestamp: str
    details: Optional[Dict[str, Any]] = None


# PDF Injection models
class InjectionLocation(str, Enum):
    """Location options for text injection in PDF."""
    END = "end"           # Append at end of document
    FOOTER = "footer"     # Add as footer on each page
    HEADER = "header"     # Add as header on each page
    METADATA = "metadata" # Inject into PDF metadata only


class InjectionVisibility(str, Enum):
    """Visibility options for injected text."""
    VISIBLE = "visible"           # Normal visible text
    HIDDEN_WHITE = "hidden_white" # White on white background
    HIDDEN_SMALL = "hidden_small" # Very small font (5-6pt)
    HIDDEN_ZERO = "hidden_zero"   # Zero font size
    HIDDEN_NEAR_WHITE = "hidden_near_white" # Light gray text


class PDFInjectionRequest(BaseModel):
    """Request model for PDF text injection."""
    text: str  # Text to inject (min/max enforced in router)
    location: InjectionLocation = InjectionLocation.END
    visibility: InjectionVisibility = InjectionVisibility.HIDDEN_WHITE
    page: Optional[int] = None  # For future: specific page targeting


class PDFInjectionResponse(BaseModel):
    """Response model for PDF text injection."""
    success: bool
    message: str
    file_name: str
    injection_summary: Dict[str, Any]  # Shows where text was injected
