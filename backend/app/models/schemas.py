from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from enum import Enum


class ContainerType(str, Enum):
    """容器类型"""
    FILE_PARSER = "file-parser"
    TERMINAL = "terminal"
    RAG_SERVER = "rag-server"
    MCP_SERVER = "mcp-server"


class TerminalImage(str, Enum):
    """终端沙箱镜像"""
    PYTHON = "terminal-python:3.11"
    UBUNTU = "terminal-ubuntu:22.04"
    NODE = "terminal-node:20"


# 内存限制配置
MEMORY_LIMITS = {
    ContainerType.FILE_PARSER: "1g",
    ContainerType.TERMINAL: "2g",
    ContainerType.RAG_SERVER: "2g",
    ContainerType.MCP_SERVER: "2g",
}


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
    image: TerminalImage = TerminalImage.PYTHON  # 改用 TerminalImage
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


# ============ Saved Test Cases (v1.0.0 Schema) ============
# 完整的测试用例状态描述格式，支持 F1-F5 所有能力层级

# --- Enums ---

class TestMode(str, Enum):
    """测试模式"""
    MOCK = "mock"
    REAL = "real"


class DialogMode(str, Enum):
    """对话模式"""
    SINGLE = "single"
    MULTI = "multi"


class CapabilityLevel(str, Enum):
    """能力层级"""
    F1_CONVERSATION = "F1-conversation"
    F2_FILE_INJECTION = "F2-file-injection"
    F3_TOOL_USE = "F3-tool-use"
    F4_RAG = "F4-rag"
    F5_MCP = "F5-mcp"


class AttackType(str, Enum):
    """攻击类型"""
    INTEGRITY = "integrity"
    CONFIDENTIALITY = "confidentiality"
    AVAILABILITY = "availability"
    JAILBREAK = "jailbreak"


class RiskLevel(str, Enum):
    """风险等级"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"


class CaseLogType(str, Enum):
    """日志类型（扩展版）"""
    QUERY = "query"
    RULE = "rule"
    TOOL = "tool"
    DATA = "data"
    ALERT = "alert"
    CONTAINER = "container"
    INFO = "info"
    ERROR = "error"
    MODEL = "model"
    TIMING = "timing"
    JUDGE = "judge"
    SUCCESS = "success"
    FAILURE = "failure"
    THINKING = "thinking"
    ROUND = "round"


class CaseLogStatus(str, Enum):
    """日志状态（扩展版）"""
    NORMAL = "normal"
    WARNING = "warning"
    BYPASSED = "bypassed"
    DANGER = "danger"
    SUCCESS = "success"


class SandboxStatus(str, Enum):
    """沙箱状态"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    RUNNING = "running"
    ERROR = "error"


class RagMode(str, Enum):
    """RAG 模式"""
    MOCK = "mock"
    REAL = "real"


class ToolCategory(str, Enum):
    """工具分类"""
    SAFE = "safe"
    RISKY = "risky"
    DANGEROUS = "dangerous"


class ResultStatus(str, Enum):
    """结果状态"""
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


# --- Meta Models ---

class CaseMeta(BaseModel):
    """元数据"""
    schemaVersion: str = "1.0.0"
    caseId: str
    createdAt: str
    updatedAt: Optional[str] = None
    mode: TestMode = TestMode.REAL
    dialogMode: DialogMode = DialogMode.SINGLE
    name: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None
    checksum: Optional[str] = None


# --- Source Models ---

class AttackSnapshot(BaseModel):
    """攻击定义快照"""
    id: str
    name: str
    type: Optional[AttackType] = None
    level: Optional[RiskLevel] = None
    description: Optional[str] = None
    testPayload: Optional[str] = None
    realTestPayload: Optional[str] = None
    documentFile: Optional[str] = None
    documentFileName: Optional[str] = None
    documentReadme: Optional[str] = None
    riskExplanation: Optional[str] = None
    hidingTechniques: Optional[List[str]] = None
    requiredTools: Optional[List[str]] = None
    toolSetup: Optional[Dict[str, Any]] = None
    realVsFake: Optional[Dict[str, Any]] = None
    missedRisks: Optional[List[str]] = None
    violations: Optional[List[str]] = None
    realTestConfig: Optional[Dict[str, Any]] = None


class CaseSource(BaseModel):
    """来源信息"""
    capabilityLevel: Optional[CapabilityLevel] = None
    scenarioKey: Optional[str] = None
    scenarioName: Optional[str] = None
    scenarioIcon: Optional[str] = None
    attackId: Optional[str] = None
    attackIndex: Optional[int] = None
    attack: Optional[AttackSnapshot] = None


# --- Environment Models ---

class ThinkingConfig(BaseModel):
    """思考配置"""
    enabled: bool = False
    budgetTokens: int = 10000


class LLMConfig(BaseModel):
    """LLM 配置"""
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    temperature: float = 0.7
    maxTokens: int = 2048
    topP: float = 0.9
    thinking: ThinkingConfig = ThinkingConfig()


class ToolsConfig(BaseModel):
    """工具配置"""
    enabled: bool = False
    maxCalls: int = 100
    enabledTools: Dict[str, bool] = {}
    toolDefinitions: List[Dict[str, Any]] = []


class ContainerInfoSnapshot(BaseModel):
    """容器信息快照"""
    sessionId: Optional[str] = None
    containerId: Optional[str] = None
    createdAt: Optional[str] = None


class SandboxFileInfo(BaseModel):
    """沙箱文件信息"""
    name: str
    path: Optional[str] = None
    size: Optional[int] = None


class SandboxConfig(BaseModel):
    """沙箱配置"""
    enabled: bool = False
    status: SandboxStatus = SandboxStatus.DISCONNECTED
    image: Optional[str] = None
    containerInfo: Optional[ContainerInfoSnapshot] = None
    presetFiles: Dict[str, str] = {}
    uploadedFiles: List[SandboxFileInfo] = []


class RagDocumentInfo(BaseModel):
    """RAG 文档信息"""
    id: str
    filename: str
    size: Optional[int] = None
    uploadedAt: Optional[str] = None
    isMalicious: bool = False


class RagConfig(BaseModel):
    """RAG 配置"""
    enabled: bool = False
    mode: RagMode = RagMode.MOCK
    mockKnowledge: Optional[str] = None
    documents: List[RagDocumentInfo] = []
    injectedContext: Optional[str] = None


class McpConfig(BaseModel):
    """MCP 配置"""
    parserEnabled: bool = False
    selectedParsers: Dict[str, List[str]] = {}
    serverEnabled: bool = False
    selectedServer: Optional[str] = None
    serverConfig: Optional[Dict[str, Any]] = None
    serverStatus: str = "disconnected"


class PayloadFileInfo(BaseModel):
    """Payload 文件信息"""
    name: str
    size: Optional[int] = None
    type: Optional[str] = None
    parsedWith: Optional[str] = None
    parsedContent: Optional[str] = None
    parseError: Optional[str] = None
    runLocation: Optional[str] = None


class CaseEnvironment(BaseModel):
    """环境配置"""
    llm: LLMConfig = LLMConfig()
    systemPrompt: Optional[str] = None
    originalSystemPrompt: Optional[str] = None
    tools: ToolsConfig = ToolsConfig()
    sandbox: SandboxConfig = SandboxConfig()
    rag: RagConfig = RagConfig()
    mcp: McpConfig = McpConfig()
    payloadFiles: List[PayloadFileInfo] = []


# --- Execution Models ---

class PayloadInfo(BaseModel):
    """Payload 信息"""
    display: Optional[str] = None
    actual: Optional[str] = None
    characterCount: int = 0
    isCustomized: bool = False
    injectionSource: Optional[str] = None


class UIMessage(BaseModel):
    """UI 消息"""
    role: str
    content: str
    isInjection: bool = False
    injectionSource: Optional[str] = None
    isDangerous: bool = False
    isToolThinking: bool = False
    timestamp: Optional[str] = None


class APIMessage(BaseModel):
    """API 消息历史"""
    role: str
    content: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_call_id: Optional[str] = None


class ExecutionLog(BaseModel):
    """执行日志"""
    type: str
    content: str
    status: str = "normal"
    expandable: bool = False
    fullContent: Optional[str] = None
    timestamp: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ToolCallResult(BaseModel):
    """工具调用结果"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    executionTimeMs: Optional[int] = None


class ToolCallRecord(BaseModel):
    """工具调用记录"""
    id: Optional[str] = None
    name: str
    args: Dict[str, Any] = {}
    rawArgs: Optional[str] = None
    result: Optional[ToolCallResult] = None
    category: ToolCategory = ToolCategory.SAFE
    roundNumber: int = 1


class RagQueryResult(BaseModel):
    """RAG 检索结果"""
    documentId: Optional[str] = None
    documentName: Optional[str] = None
    content: str
    similarity: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class ExecutionTiming(BaseModel):
    """执行计时"""
    totalApiTimeMs: int = 0
    firstResponseMs: Optional[int] = None
    toolCallCount: int = 0
    ragQueryTimeMs: Optional[int] = None
    judgeTimeMs: Optional[int] = None


class CaseExecution(BaseModel):
    """执行数据"""
    payload: PayloadInfo = PayloadInfo()
    messages: List[UIMessage] = []
    conversationHistory: List[APIMessage] = []
    logs: List[ExecutionLog] = []
    toolCalls: List[ToolCallRecord] = []
    ragQueryResults: Optional[List[RagQueryResult]] = None
    timing: ExecutionTiming = ExecutionTiming()


# --- Result Models ---

class JudgmentResult(BaseModel):
    """评判结果"""
    judgeModel: Optional[str] = None
    success: Optional[bool] = None  # True=攻击成功, False=防御成功, None=不确定
    reason: Optional[str] = None
    rawResponse: Optional[str] = None


class CaseResult(BaseModel):
    """测试结果"""
    status: Optional[ResultStatus] = None
    response: Optional[str] = None
    thinking: Optional[str] = None
    error: Optional[str] = None
    judgment: JudgmentResult = JudgmentResult()


# --- Complete Test Case Model ---

class TestCaseV1(BaseModel):
    """完整测试用例（v1.0.0 Schema）"""
    meta: CaseMeta
    source: CaseSource
    environment: CaseEnvironment = CaseEnvironment()
    execution: CaseExecution = CaseExecution()
    result: CaseResult = CaseResult()


# ============ API Request/Response Models (v1 only) ============

class SaveCaseRequest(BaseModel):
    """Request model for saving a test case (v1 format only)."""
    meta: CaseMeta
    source: CaseSource
    environment: CaseEnvironment = CaseEnvironment()
    execution: CaseExecution = CaseExecution()
    result: CaseResult = CaseResult()


class UpdateCaseRequest(BaseModel):
    """Request model for updating a test case."""
    name: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class SavedCaseSummary(BaseModel):
    """Summary of a saved case for list display."""
    id: str
    savedAt: str
    schemaVersion: str = "1.0.0"
    name: Optional[str] = None
    capabilityLevel: Optional[str] = None
    scenarioName: Optional[str] = None
    attackName: Optional[str] = None
    attackType: Optional[str] = None
    riskLevel: Optional[str] = None
    modelId: Optional[str] = None
    judgmentSuccess: Optional[bool] = None
    judgmentReason: Optional[str] = None


class SavedCaseDetail(BaseModel):
    """Full detail of a saved case (v1 format)."""
    id: str
    savedAt: str
    meta: CaseMeta
    source: CaseSource
    environment: CaseEnvironment = CaseEnvironment()
    execution: CaseExecution = CaseExecution()
    result: CaseResult = CaseResult()


# ============ MCP Server Models ============

class McpServerType(str, Enum):
    """Available MCP server types."""
    FILESYSTEM = "filesystem"
    EMAIL = "email"
    PAYMENT = "payment"
    # 新增 MCP 服务
    NOTION = "notion"
    GITHUB = "github"
    DATABASE = "database"
    HTTP = "http"
    SLACK = "slack"
    CALENDAR = "calendar"
    STORAGE = "storage"
    MEMORY = "memory"


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


# ============ Test Case Schema v2.0.0 ============
# 新的三层架构：TestInput, State, PlaybackSequence

class ExecutionPhase(str, Enum):
    """执行阶段"""
    IDLE = "idle"
    PREPARING = "preparing"
    CALLING_LLM = "calling_llm"
    TOOL_CALLING = "tool_calling"
    JUDGING = "judging"
    COMPLETED = "completed"
    FAILED = "failed"


class ApiStatusEnum(str, Enum):
    """API 状态"""
    IDLE = "idle"
    LOADING = "loading"
    SUCCESS = "success"
    ERROR = "error"


# --- v2 TestInput Models ---

class TestInputMeta(BaseModel):
    """TestInput 元数据"""
    schemaVersion: str = "2.0.0"
    inputId: str
    createdAt: str
    name: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None


class PredefinedPayload(BaseModel):
    """预定义 Payload"""
    display: Optional[str] = None
    actual: Optional[str] = None


class AttackDefinition(BaseModel):
    """攻击定义"""
    capabilityLevel: Optional[str] = None
    scenarioKey: Optional[str] = None
    scenarioName: Optional[str] = None
    scenarioIcon: Optional[str] = None
    attackId: Optional[str] = None
    attackIndex: Optional[int] = None
    attackName: Optional[str] = None
    attackType: Optional[str] = None
    riskLevel: Optional[str] = None
    description: Optional[str] = None
    predefinedPayload: PredefinedPayload = PredefinedPayload()


class LLMConfigV2(BaseModel):
    """LLM 配置 v2"""
    modelId: Optional[str] = None
    modelName: Optional[str] = None
    temperature: float = 0.7
    maxTokens: int = 2048
    topP: float = 0.9
    thinking: ThinkingConfig = ThinkingConfig()


class SystemPromptConfig(BaseModel):
    """系统提示词配置"""
    original: Optional[str] = None
    custom: Optional[str] = None
    active: Optional[str] = None


class PayloadFileV2(BaseModel):
    """Payload 文件信息 v2"""
    name: Optional[str] = None
    size: Optional[int] = None
    parsedWith: Optional[str] = None
    parsedContent: Optional[str] = None


class PayloadConfig(BaseModel):
    """Payload 配置"""
    source: str = "predefined"  # 'predefined' | 'custom_text' | 'custom_file'
    displayText: Optional[str] = None
    actualText: Optional[str] = None
    characterCount: int = 0
    file: Optional[PayloadFileV2] = None


class ToolCallingCapability(BaseModel):
    """工具调用能力配置"""
    enabled: bool = False
    maxCalls: int = 100
    enabledTools: Dict[str, bool] = {}
    toolDefinitions: List[Dict[str, Any]] = []


class SandboxCapability(BaseModel):
    """沙箱能力配置"""
    enabled: bool = False
    image: str = "python:3.11-slim"
    presetFiles: Dict[str, str] = {}


class RagDocumentV2(BaseModel):
    """RAG 文档 v2"""
    filename: str
    isMalicious: bool = False


class RagCapability(BaseModel):
    """RAG 能力配置"""
    enabled: bool = False
    mode: str = "mock"
    mockKnowledge: Optional[str] = None
    documents: List[RagDocumentV2] = []


class McpCapability(BaseModel):
    """MCP 能力配置"""
    parserEnabled: bool = False
    selectedParsers: Dict[str, List[str]] = {}
    serverEnabled: bool = False
    selectedServer: Optional[str] = None
    serverConfig: Optional[Dict[str, Any]] = None


class Capabilities(BaseModel):
    """能力配置集合"""
    toolCalling: Optional[ToolCallingCapability] = None
    sandbox: Optional[SandboxCapability] = None
    rag: Optional[RagCapability] = None
    mcp: Optional[McpCapability] = None


class TestInputV2(BaseModel):
    """测试输入 v2.0.0"""
    meta: TestInputMeta
    attack: AttackDefinition = AttackDefinition()
    llmConfig: LLMConfigV2 = LLMConfigV2()
    systemPrompt: SystemPromptConfig = SystemPromptConfig()
    payload: PayloadConfig = PayloadConfig()
    capabilities: Capabilities = Capabilities()


# --- v2 State Models ---

class UIMessage(BaseModel):
    """UI 消息"""
    role: str
    content: str
    isInjection: bool = False
    injectionSource: Optional[str] = None
    isDangerous: bool = False
    isToolThinking: bool = False
    timestamp: Optional[str] = None


class UILog(BaseModel):
    """UI 日志"""
    type: str
    content: str
    status: str = "normal"
    expandable: bool = False
    fullContent: Optional[str] = None
    timestamp: Optional[str] = None


class TypingMessage(BaseModel):
    """打字动画消息"""
    role: str
    content: str
    cursor: Optional[int] = None


class UIState(BaseModel):
    """UI 状态"""
    messages: List[UIMessage] = []
    logs: List[UILog] = []
    typingMsg: Optional[TypingMessage] = None
    isPlaying: bool = False
    apiStatus: str = "idle"
    apiError: Optional[str] = None


class ConversationState(BaseModel):
    """对话状态"""
    history: List[Dict[str, Any]] = []
    currentRound: int = 0
    pendingToolCalls: List[Dict[str, Any]] = []


class ToolCallResultV2(BaseModel):
    """工具调用结果 v2"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    timeMs: Optional[int] = None


class ToolCallRecordV2(BaseModel):
    """工具调用记录 v2"""
    id: Optional[str] = None
    name: str
    args: Dict[str, Any] = {}
    result: Optional[ToolCallResultV2] = None
    category: str = "safe"
    roundNumber: int = 1


class CurrentToolCall(BaseModel):
    """当前执行的工具调用"""
    id: str
    name: str
    args: Dict[str, Any] = {}
    startedAt: str


class ToolCallsState(BaseModel):
    """工具调用状态"""
    history: List[ToolCallRecordV2] = []
    current: Optional[CurrentToolCall] = None
    totalCount: int = 0


class SandboxEnvState(BaseModel):
    """沙箱环境状态"""
    status: str = "disconnected"
    relevantFiles: Dict[str, Any] = {}


class RagQueryResultV2(BaseModel):
    """RAG 查询结果 v2"""
    documentId: Optional[str] = None
    filename: Optional[str] = None
    chunk: Optional[str] = None
    score: Optional[float] = None
    isMalicious: bool = False


class RagEnvState(BaseModel):
    """RAG 环境状态"""
    status: str = "idle"
    queryResults: List[RagQueryResultV2] = []


class McpToolResultV2(BaseModel):
    """MCP 工具结果 v2"""
    tool: str
    args: Dict[str, Any] = {}
    result: Any = None


class McpEnvState(BaseModel):
    """MCP 环境状态"""
    serverStatus: str = "disconnected"
    toolResults: List[McpToolResultV2] = []


class EnvironmentState(BaseModel):
    """环境状态"""
    sandbox: SandboxEnvState = SandboxEnvState()
    rag: RagEnvState = RagEnvState()
    mcp: McpEnvState = McpEnvState()


class JudgmentResultV2(BaseModel):
    """评判结果 v2"""
    judgeModel: Optional[str] = None
    success: Optional[bool] = None
    reason: Optional[str] = None


class ResultState(BaseModel):
    """结果状态"""
    response: Optional[str] = None
    thinking: Optional[str] = None
    error: Optional[str] = None
    judgment: Optional[JudgmentResultV2] = None


class TimingState(BaseModel):
    """计时状态"""
    phaseStartedAt: str
    totalElapsedMs: int = 0
    llmRequestMs: Optional[int] = None
    toolCallMs: Optional[int] = None
    judgeMs: Optional[int] = None


class StateV2(BaseModel):
    """完整状态快照 v2.0.0"""
    sequenceIndex: int = 0
    timestamp: str
    phase: str = "idle"
    ui: UIState = UIState()
    conversation: ConversationState = ConversationState()
    toolCalls: ToolCallsState = ToolCallsState()
    environment: EnvironmentState = EnvironmentState()
    result: ResultState = ResultState()
    timing: TimingState


# --- v2 PlaybackSequence Models ---

class PlaybackMeta(BaseModel):
    """PlaybackSequence 元数据"""
    schemaVersion: str = "2.0.0"
    sequenceId: str
    createdAt: str
    duration: int = 0
    stateCount: int = 0
    checksum: Optional[str] = None


class PlaybackTimingResult(BaseModel):
    """回放计时结果"""
    totalApiTimeMs: int = 0
    firstResponseMs: Optional[int] = None
    toolCallCount: int = 0
    ragQueryTimeMs: Optional[int] = None
    judgeTimeMs: Optional[int] = None


class PlaybackResult(BaseModel):
    """回放结果"""
    status: Optional[str] = None
    finalResponse: Optional[str] = None
    thinking: Optional[str] = None
    error: Optional[str] = None
    judgment: Optional[JudgmentResultV2] = None
    timing: PlaybackTimingResult = PlaybackTimingResult()


class PlaybackMarker(BaseModel):
    """回放标记"""
    index: int
    label: str
    phase: str


class PlaybackControl(BaseModel):
    """回放控制"""
    markers: List[PlaybackMarker] = []
    suggestedSpeed: float = 1.0


class PlaybackSequenceV2(BaseModel):
    """回放序列 v2.0.0"""
    meta: PlaybackMeta
    input: TestInputV2
    states: List[StateV2] = []
    result: PlaybackResult = PlaybackResult()
    playback: PlaybackControl = PlaybackControl()


# --- v2 API Models ---

class SavePlaybackSequenceRequest(BaseModel):
    """保存 PlaybackSequence 请求"""
    meta: PlaybackMeta
    input: TestInputV2
    states: List[StateV2] = []
    result: PlaybackResult = PlaybackResult()
    playback: PlaybackControl = PlaybackControl()


class PlaybackSequenceSummary(BaseModel):
    """PlaybackSequence 摘要"""
    id: str
    savedAt: str
    schemaVersion: str = "2.0.0"
    name: Optional[str] = None
    capabilityLevel: Optional[str] = None
    scenarioName: Optional[str] = None
    attackName: Optional[str] = None
    attackType: Optional[str] = None
    riskLevel: Optional[str] = None
    modelId: Optional[str] = None
    judgmentSuccess: Optional[bool] = None
    stateCount: int = 0
    duration: int = 0
