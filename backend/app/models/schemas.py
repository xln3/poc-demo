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


# ============ Saved Test Cases ============

class SourceScenario(BaseModel):
    """Information about the source scenario for a saved case."""
    name: str  # e.g., "车贷审核智能体"
    attackId: str  # e.g., "1.1"
    attackName: str  # e.g., "提示注入绕过风控"


class TestConfig(BaseModel):
    """Test configuration when the case was saved."""
    model: str  # e.g., "glm-4.7"


class Judgment(BaseModel):
    """Attack success judgment result."""
    success: Optional[bool] = None  # True=attack succeeded, False=failed, None=uncertain
    reason: str = ""


class SaveCaseRequest(BaseModel):
    """Request model for saving a test case."""
    name: Optional[str] = None  # Custom name, defaults to attack name
    sourceScenario: SourceScenario
    testConfig: TestConfig
    payload: str  # The attack payload used
    response: str  # LLM response
    judgment: Judgment
    conversations: List[Dict[str, Any]] = []  # Chat messages
    logs: List[Dict[str, Any]] = []  # System logs
    toolCalls: Optional[List[Dict[str, Any]]] = None  # Tool calls if any
    systemPrompt: Optional[str] = None  # System prompt used


class UpdateCaseRequest(BaseModel):
    """Request model for updating a test case."""
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class SavedCaseSummary(BaseModel):
    """Summary of a saved case for list display."""
    id: str
    savedAt: str
    name: Optional[str] = None
    sourceScenario: Optional[SourceScenario] = None
    testConfig: Optional[TestConfig] = None
    judgment: Optional[Judgment] = None


class SavedCaseDetail(BaseModel):
    """Full detail of a saved case."""
    id: str
    savedAt: str
    name: Optional[str] = None
    sourceScenario: Optional[SourceScenario] = None
    testConfig: Optional[TestConfig] = None
    payload: Optional[str] = None
    response: Optional[str] = None
    judgment: Optional[Judgment] = None
    conversations: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    toolCalls: Optional[List[Dict[str, Any]]] = None
    systemPrompt: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    updatedAt: Optional[str] = None


# ============ MCP Server Models ============

class McpServerType(str, Enum):
    """Available MCP server types."""
    FILESYSTEM = "filesystem"
    EMAIL = "email"
    PAYMENT = "payment"


class McpTestConnectionRequest(BaseModel):
    """Request model for testing MCP server connection."""
    server_id: McpServerType
    config: Dict[str, Any]


class McpTestConnectionResponse(BaseModel):
    """Response model for MCP connection test."""
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None


class McpToolRequest(BaseModel):
    """Request model for executing MCP tool."""
    server_id: McpServerType
    tool_name: str
    params: Dict[str, Any]
    config: Dict[str, Any]


class McpToolResult(BaseModel):
    """Response model for MCP tool execution."""
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None


class McpServerStatus(BaseModel):
    """Status of an MCP server."""
    status: str  # 'connected', 'disconnected', 'error'
    message: Optional[str] = None
    tools: Optional[List[str]] = None
