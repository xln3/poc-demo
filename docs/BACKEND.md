# 后端详解

本文档详细说明后端服务的架构、路由、服务层和 Docker 容器管理。

## 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── routers/             # API 路由层
│   │   ├── sandbox.py       # 沙箱管理 (/sandbox)
│   │   ├── rag.py           # RAG 服务 (/rag)
│   │   ├── mcp.py           # MCP Server 工具 (/mcp)
│   │   ├── file_parser.py   # 文件解析 (/file-parser)
│   │   ├── cases.py         # 用例存储 (/cases)
│   │   ├── datasets.py      # 数据集管理 (/datasets)
│   │   ├── test_results.py  # 测试结果 (/test-results)
│   │   └── report_templates.py # 报告模板 (/report-templates)
│   ├── services/            # 业务逻辑层
│   │   ├── container.py     # Docker 容器管理
│   │   ├── tools.py         # 工具执行器
│   │   ├── log_manager.py   # WebSocket 日志
│   │   ├── rag_service.py   # RAG 业务逻辑
│   │   ├── container_rag.py # 容器化 RAG
│   │   ├── container_parser.py # 容器化文件解析
│   │   ├── file_parsers.py  # 文件解析器定义
│   │   ├── file_parser_cli.py # 文件解析 CLI
│   │   ├── mcp.py           # MCP Server 核心
│   │   ├── mcp_service.py   # MCP 服务封装
│   │   ├── mcp_notion.py    # Notion MCP Server
│   │   ├── mcp_github.py    # GitHub MCP Server
│   │   ├── mcp_database.py  # Database MCP Server
│   │   ├── mcp_http.py      # HTTP MCP Server
│   │   ├── mcp_slack.py     # Slack MCP Server
│   │   ├── mcp_calendar.py  # Calendar MCP Server
│   │   ├── mcp_storage.py   # Storage MCP Server
│   │   ├── mcp_memory.py    # Memory MCP Server
│   │   ├── case_storage.py  # 用例持久化
│   │   ├── dataset_storage.py # 数据集持久化
│   │   ├── test_results_storage.py # 测试结果持久化
│   │   ├── terminal_sandbox_service.py # 终端沙箱服务
│   │   ├── terminal_lock.py # 终端锁管理
│   │   └── file_watcher.py  # 文件监控
│   └── models/              # 数据模型
│       ├── schemas.py       # Pydantic 模型
│       └── rag_schemas.py   # RAG 专用模型
├── requirements.txt         # Python 依赖
└── run.sh                   # 启动脚本
```

---

## 应用入口 (main.py)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import sandbox, mcp, rag, cases
from .services.container import container_manager

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # 应用关闭时清理所有容器
    container_manager.cleanup_all()

app = FastAPI(
    title="POC Demo Sandbox API",
    description="Sandbox execution environment for LLM Agent security demonstrations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(sandbox.router)
app.include_router(mcp.router)
app.include_router(rag.router)
app.include_router(cases.router)
```

---

## 路由层详解

### Sandbox 路由 (`/sandbox`)

沙箱容器和工具管理。

| 方法 | 端点 | 功能 |
|------|------|------|
| POST | `/sandbox/container` | 创建或获取容器 |
| GET | `/sandbox/container/{session_id}` | 获取容器状态 |
| DELETE | `/sandbox/container/{session_id}` | 销毁容器 |
| GET | `/sandbox/sessions` | 列出所有会话 |
| POST | `/sandbox/tool` | 执行工具 |
| WS | `/sandbox/logs/{session_id}` | 实时日志流 |

```python
@router.post("/container", response_model=ContainerInfo)
async def create_or_get_container(request: CreateContainerRequest):
    info = container_manager.get_or_create_container(
        image=request.image,
        session_id=request.session_id
    )
    await log_manager.emit_container_log(
        info.session_id,
        f"Container started: {info.container_id} ({info.image})",
        LogStatus.SUCCESS
    )
    return info

@router.post("/tool", response_model=ToolResult)
async def execute_tool(request: ToolCallRequest):
    # 检查容器状态
    info = container_manager.get_container_status(request.session_id)
    if info.status != ContainerStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Container not running")

    # 执行工具
    result = await tool_executor.execute(
        session_id=request.session_id,
        tool=request.tool,
        params=request.params
    )
    return result
```

### RAG 路由 (`/rag`)

向量知识库管理。

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/rag/health` | 健康检查 |
| POST | `/rag/init` | 初始化知识库 |
| POST | `/rag/reset` | 重置为预置数据 |
| POST | `/rag/upload` | 上传文件 |
| POST | `/rag/ingest` | 摄入文本 |
| POST | `/rag/query` | 查询知识库 |
| GET | `/rag/documents` | 列出文档 |
| DELETE | `/rag/documents/{id}` | 删除文档 |
| DELETE | `/rag/clear` | 清空所有 |

```python
@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    source_name: Optional[str] = Form(None)
):
    file_bytes = await file.read()
    text, doc_type = parse_file_for_rag(file_bytes, file.filename)

    rag_service = get_container_rag_service()
    document_id, chunk_count = rag_service.add_document(
        content=text,
        source_name=source_name or file.filename,
        document_type=doc_type
    )
    return UploadResponse(
        success=True,
        document_id=document_id,
        chunk_count=chunk_count
    )

@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    rag_service = get_container_rag_service()
    results = rag_service.query(
        query_text=request.query,
        top_k=request.top_k,
        score_threshold=request.score_threshold
    )
    return QueryResponse(success=True, results=results)
```

### File Parser 路由 (`/file-parser`)

独立的文件解析服务。详见 [FILE-PARSER.md](./FILE-PARSER.md)。

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/file-parser/health` | 健康检查 |
| GET | `/file-parser/parsers` | 获取可用解析器 |
| POST | `/file-parser/parse` | 解析文件 |
| POST | `/file-parser/parse/text` | 解析为纯文本 |

### MCP 路由 (`/mcp`)

MCP Server 工具调用服务。

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/mcp/health` | 健康检查 |
| GET | `/mcp/servers` | 列出 MCP Server |
| POST | `/mcp/test` | 测试 Server 连接 |
| POST | `/mcp/tool` | 执行 MCP 工具 |
| GET | `/mcp/status/{server_id}` | 获取 Server 状态 |

```python
@router.post("/tool", response_model=McpToolResult)
async def execute_mcp_tool(request: McpToolRequest):
    if request.server_id == McpServerType.FILESYSTEM:
        result = await mcp_service.execute_filesystem_tool(
            request.tool_name, request.params, request.config
        )
    elif request.server_id == McpServerType.EMAIL:
        result = await mcp_service.execute_email_tool(...)
    elif request.server_id == McpServerType.PAYMENT:
        result = await mcp_service.execute_payment_tool(...)

    return McpToolResult(success=result.get("success"), result=result.get("result"))
```

### Cases 路由 (`/cases`)

测试用例存储。

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/cases` | 列出所有用例 |
| POST | `/cases` | 保存用例 |
| GET | `/cases/{id}` | 获取用例详情 |
| PUT | `/cases/{id}` | 更新用例 |
| DELETE | `/cases/{id}` | 删除用例 |

---

## 服务层详解

### ContainerManager (container.py)

Docker 容器生命周期管理。

```python
class ContainerManager:
    CONTAINER_PREFIX = "poc-sandbox-"
    WORK_DIR = "/workspace"

    def __init__(self):
        self.client = docker.from_env()
        self._sessions: Dict[str, str] = {}        # session_id -> container_id
        self._session_images: Dict[str, str] = {}  # session_id -> image
        self._session_created: Dict[str, str] = {} # session_id -> created_at

    def get_or_create_container(self, image: ImageType, session_id: str = None):
        """获取现有容器或创建新容器"""
        # 1. 检查现有会话
        if session_id in self._sessions:
            container = self.client.containers.get(self._sessions[session_id])
            if container.status == "running":
                return existing_info
            container.start()
            return existing_info

        # 2. 创建新容器
        container = self.client.containers.run(
            image=image.value,
            name=f"{self.CONTAINER_PREFIX}{session_id}",
            detach=True,
            tty=True,
            working_dir=self.WORK_DIR,
            mem_limit="512m",       # 内存限制
            cpu_period=100000,
            cpu_quota=50000,        # 50% CPU
            network_mode="bridge",
            command="tail -f /dev/null"
        )

        # 3. 初始化工作目录
        container.exec_run(f"mkdir -p {self.WORK_DIR}")

        return ContainerInfo(...)

    def exec_in_container(self, session_id: str, command: str) -> Tuple[int, str]:
        """在容器中执行命令"""
        container = self.client.containers.get(self._sessions[session_id])
        result = container.exec_run(command, workdir=self.WORK_DIR, demux=True)
        stdout = result.output[0].decode() if result.output[0] else ""
        stderr = result.output[1].decode() if result.output[1] else ""
        return result.exit_code, (stdout + stderr).strip()

    def copy_file_to_container(self, session_id: str, path: str, content: bytes):
        """复制文件到容器（支持二进制）"""
        # 使用 tar 归档通过 Docker API 复制
        ...

    def destroy_container(self, session_id: str) -> bool:
        """销毁容器并清理会话"""
        container.remove(force=True)
        del self._sessions[session_id]
        return True

    def cleanup_all(self):
        """清理所有容器（应用关闭时调用）"""
        for session_id in list(self._sessions.keys()):
            self.destroy_container(session_id)

# 单例
container_manager = ContainerManager()
```

### ToolExecutor (tools.py)

工具执行器，支持 9 种工具。

```python
class ToolExecutor:
    def __init__(self):
        self._tools = {
            ToolType.READ_FILE: self._read_file,
            ToolType.WRITE_FILE: self._write_file,
            ToolType.RUN_COMMAND: self._run_command,
            ToolType.HTTP_REQUEST: self._http_request,
            ToolType.LIST_DIR: self._list_dir,
            ToolType.QUERY_DATABASE: self._query_database,
            ToolType.SEND_EMAIL: self._send_email,
            ToolType.GET_SYSTEM_INFO: self._get_system_info,
            ToolType.ACCESS_SECRET: self._access_secret,
        }

    async def execute(self, session_id, tool, params) -> ToolResult:
        """执行工具并返回结果"""
        start_time = time.time()
        try:
            result = await self._tools[tool](session_id, params)
            return ToolResult(success=True, result=result, ...)
        except Exception as e:
            return ToolResult(success=False, error=str(e), ...)
```

#### 工具实现详解

| 工具 | 类型 | 实现方式 | 说明 |
|------|------|----------|------|
| `read_file` | 容器执行 | `cat` 命令 | 读取文件内容 |
| `write_file` | 容器执行 | base64 + echo | 写入文件，支持二进制 |
| `run_command` | 容器执行 | shell 执行 | 执行任意命令 |
| `http_request` | 直接执行 | httpx 库 | 发起 HTTP 请求 |
| `list_dir` | 容器执行 | `ls -la` | 列出目录内容 |
| `query_database` | 模拟 | Mock 数据 | 返回模拟 SQL 结果 |
| `send_email` | 模拟 | 仅日志 | 模拟邮件发送 |
| `get_system_info` | 容器执行 | 多命令组合 | 收集系统信息 |
| `access_secret` | 模拟 | Mock 数据 | 返回模拟密钥 |

```python
async def _read_file(self, session_id: str, params: dict) -> str:
    path = params.get("path")
    if ".." in path:
        raise ValueError("Path traversal not allowed")

    if not path.startswith('/'):
        path = f"/workspace/{path}"

    exit_code, output = container_manager.exec_in_container(
        session_id,
        f"/bin/sh -c \"cat '{path}'\""
    )
    if exit_code != 0:
        raise RuntimeError(f"Failed to read file: {output}")
    return output

async def _query_database(self, session_id: str, params: dict) -> dict:
    query = params.get("query", "")

    # 检测危险 SQL
    dangerous_patterns = ['drop', 'delete', 'truncate', 'update', 'insert']
    if any(p in query.lower() for p in dangerous_patterns):
        self._emit_log(LogType.WARNING, "⚠️ Dangerous SQL detected", LogStatus.WARNING)

    # 返回模拟数据
    return {
        "rows": [...],
        "row_count": 2,
        "query_executed": query
    }
```

### 终端沙箱调用文件解析流程

终端沙箱通过 `parse_file` 工具调用独立的 file-parser 服务解析文件。设计原则：**file-parser 服务代码完全不变，sandbox 通过 HTTP API 松耦合调用**。

#### 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. LLM 调用 parse_file 工具                                            │
│     参数: { path: "/workspace/report.pdf" }                             │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. 前端自动注入解析器配置                                               │
│     从 mcpParsers[fileType] 获取用户配置的解析器列表                      │
│     → { path: "...", parsers: ["pymupdf"] }                             │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. tools.py: _parse_file(session_id, params)                           │
│     a. 从容器读取文件: exec `base64 '/workspace/report.pdf'`            │
│     b. 得到文件的 base64 编码字符串                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. HTTP POST http://127.0.0.1:8000/file-parser/parse/base64            │
│     请求体: {                                                            │
│       "filename": "report.pdf",                                          │
│       "content_base64": "JVBERi0xLjQK...",                               │
│       "parsers": ["pymupdf"]                                             │
│     }                                                                    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. file-parser 服务（独立，代码不变）                                    │
│     解析 PDF/DOCX/XLSX 等，返回:                                         │
│     { filename, file_type, text, extracts_hidden }                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. 返回给 LLM 的结果                                                    │
│     {                                                                    │
│       "filename": "report.pdf",                                          │
│       "file_type": "pdf",                                                │
│       "text": "解析出的文本内容...",                                      │
│       "extracts_hidden": true                                            │
│     }                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

#### parse_file 工具实现

```python
# backend/app/services/tools.py

async def _parse_file(self, session_id: str, params: dict) -> dict:
    """Parse file in container using file-parser service."""
    path = params.get("path")
    parsers = params.get("parsers", [])

    # 1. 从容器读取文件（Base64 编码）
    exit_code, stdout, stderr = await asyncio.to_thread(
        container_manager.exec_in_container,
        session_id,
        f"/bin/sh -c \"base64 '{path}'\""
    )
    file_base64 = stdout.replace('\n', '')

    # 2. 调用 file-parser 服务
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "http://127.0.0.1:8000/file-parser/parse/base64",
            json={
                "filename": path.split('/')[-1],
                "content_base64": file_base64,
                "parsers": parsers
            }
        )
        result = response.json()

    return {
        "filename": result.get("filename"),
        "file_type": result.get("file_type"),
        "text": result.get("text", ""),
        "extracts_hidden": result.get("extracts_hidden", False),
    }
```

#### 前端解析器自动注入

前端在调用 `parse_file` 工具时，自动从 MCP 解析器配置中获取用户选择的解析器：

```javascript
// src/App.jsx - 工具执行逻辑

if (toolName === 'parse_file' && toolArgs.path) {
  // 根据文件扩展名获取文件类型
  const fileType = getFileTypeForMcp(toolArgs.path);

  // 从用户配置的 mcpParsers 获取解析器列表
  if (fileType && mcpParsers[fileType]?.length > 0) {
    finalToolArgs = { ...toolArgs, parsers: mcpParsers[fileType] };
  }
}

result = await sandboxClient.executeTool(toolName, finalToolArgs);
```

#### 邮件附件处理流程

MCP 邮件服务下载附件时，会自动写入沙箱容器，返回文件路径供后续解析：

```
1. LLM 调用 email_download_attachment(id, filename)
   → 前端传递 sandboxClient.sessionId 给后端

2. MCP 服务下载附件 → 写入容器 /workspace/xxx.pdf
   → 返回 { path: "/workspace/xxx.pdf", ... }

3. LLM 调用 parse_file(path="/workspace/xxx.pdf")
   → 返回解析后的文本内容
```

```python
# backend/app/services/mcp_email_receive.py

async def _download_attachment(self, params, config, sandbox_session_id=None):
    # ... 下载附件 ...

    if sandbox_session_id:
        # 写入容器
        file_path = f"/workspace/{target_filename}"
        container_manager.copy_file_to_container(
            sandbox_session_id, file_path, attachment_data
        )
        return {
            "success": True,
            "result": {
                "filename": target_filename,
                "path": file_path,  # 返回路径而非 base64
                "size": len(attachment_data)
            }
        }
```

#### 关键设计点

| 设计点 | 说明 |
|--------|------|
| 松耦合 | file-parser 服务代码完全不变，sandbox 通过 HTTP API 调用 |
| 配置继承 | 解析器列表从前端 MCP 配置自动注入，用户无需手动指定 |
| 文件传递 | 邮件附件直接写入容器 `/workspace/`，避免 base64 中转 |
| 统一入口 | `parse_file` 是沙箱内解析文件的唯一工具 |

### LogManager (log_manager.py)

WebSocket 日志管理。

```python
class LogManager:
    def __init__(self):
        self._queues: Dict[str, List[asyncio.Queue]] = {}

    def create_queue(self, session_id: str) -> asyncio.Queue:
        """为新的 WebSocket 连接创建队列"""
        queue = asyncio.Queue()
        if session_id not in self._queues:
            self._queues[session_id] = []
        self._queues[session_id].append(queue)
        return queue

    async def emit_log(self, session_id: str, log: LogEntry):
        """向所有订阅者发送日志"""
        if session_id in self._queues:
            for queue in self._queues[session_id]:
                await queue.put(log)

    async def emit_container_log(self, session_id, content, status, details=None):
        await self.emit_log(session_id, LogEntry(
            type=LogType.CONTAINER,
            content=content,
            status=status,
            timestamp=datetime.now().isoformat(),
            details=details
        ))

log_manager = LogManager()
```

### RAG Service (container_rag.py)

容器化 RAG 服务，使用 ChromaDB。

```python
class ContainerRAGService:
    def __init__(self):
        self._container_id = None
        self._chroma_client = None

    def add_document(self, content, source_name, document_type, metadata=None):
        """添加文档到知识库"""
        # 1. 分块
        chunks = self._chunk_text(content)

        # 2. 生成嵌入
        embeddings = self._get_embeddings(chunks)

        # 3. 存储到 ChromaDB
        collection.add(
            documents=chunks,
            embeddings=embeddings,
            metadatas=[...],
            ids=[...]
        )

        return document_id, len(chunks)

    def query(self, query_text, top_k=3, score_threshold=None):
        """查询知识库"""
        query_embedding = self._get_embeddings([query_text])[0]

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )

        return [
            {
                "content": doc,
                "source_name": meta.get("source_name"),
                "score": 1 - distance,  # 转换为相似度
            }
            for doc, meta, distance in zip(...)
        ]

    def init(self):
        """初始化知识库，导入预置数据"""
        ...

    def reset(self):
        """重置为预置数据"""
        self.clear()
        return self.init()
```

### MCP Service (mcp.py)

MCP Server 实现，支持 Filesystem/Email/Payment。

```python
class MCPService:
    # Filesystem Server
    async def test_filesystem_connection(self, config: dict):
        base_path = config.get("basePath")
        if not os.path.exists(base_path):
            return {"success": False, "error": "Path not found"}
        return {"success": True, "message": "Connected"}

    async def execute_filesystem_tool(self, tool_name, params, config):
        base_path = config.get("basePath")
        allow_write = config.get("allowWrite", False)

        if tool_name == "fs_read_file":
            path = os.path.join(base_path, params["path"])
            content = open(path).read()
            return {"success": True, "result": content}

        elif tool_name == "fs_write_file":
            if not allow_write:
                return {"success": False, "error": "Write not allowed"}
            ...

    # Email Server (模拟)
    async def execute_email_tool(self, tool_name, params, config):
        if tool_name == "email_send":
            return {
                "success": True,
                "result": {
                    "status": "sent_simulated",
                    "message_id": f"MSG-{uuid.uuid4().hex[:8]}"
                }
            }

    # Payment Server (模拟)
    async def execute_payment_tool(self, tool_name, params, config):
        if tool_name == "payment_create_order":
            return {
                "success": True,
                "result": {
                    "order_id": f"ORD-{uuid.uuid4().hex[:8]}",
                    "status": "created",
                    "mode": "test" if "sk_test" in config.get("apiKey", "") else "live"
                }
            }

mcp_service = MCPService()
```

---

## Docker 镜像

### 可用镜像

| 镜像 | 说明 | 用途 |
|------|------|------|
| `python:3.11-slim` | Python 3.11 精简版 | 默认环境 |
| `ubuntu:22.04` | Ubuntu 完整版 | 需要系统工具时 |
| `node:20-slim` | Node.js 20 精简版 | JavaScript 环境 |
| `file-parser:latest` | 自定义解析工具镜像 | 文件解析 |

### file-parser 镜像构建

```dockerfile
FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    libmagic1 \
    exiftool

# 安装 Python 依赖
RUN pip install \
    pymupdf \
    pdfplumber \
    python-docx \
    mammoth \
    openpyxl \
    pytesseract \
    pillow

WORKDIR /workspace
```

### 资源限制

```python
# 容器创建时的资源限制
container = client.containers.run(
    mem_limit="512m",      # 最大内存 512MB
    cpu_period=100000,
    cpu_quota=50000,       # 50% CPU（1个核心的50%）
    network_mode="bridge", # 允许网络访问
)
```

---

## 安全考虑

### 路径遍历防护

```python
def _read_file(self, session_id, params):
    path = params.get("path")

    # 禁止路径遍历
    if ".." in path:
        raise ValueError("Path traversal not allowed")

    # 强制工作目录
    if not path.startswith('/'):
        path = f"/workspace/{path}"
```

### 输入验证

```python
class ToolCallRequest(BaseModel):
    session_id: str
    tool: ToolType  # 枚举限制工具类型
    params: Dict[str, Any]
```

### 模拟工具

数据库、邮件、密钥等敏感操作仅返回模拟数据：

```python
async def _query_database(self, session_id, params):
    # 不执行真实 SQL，返回 Mock 数据
    return {
        "rows": [...],
        "warning": "MOCK DATA - No real database connection"
    }

async def _access_secret(self, session_id, params):
    # 返回模拟密钥
    return {
        "data": mock_secrets[secret_name],
        "warning": "MOCK DATA - Demonstrates credential exposure risk"
    }
```

### CORS 限制

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 数据模型 (schemas.py)

### 枚举类型

```python
class ImageType(str, Enum):
    PYTHON = "python:3.11-slim"
    UBUNTU = "ubuntu:22.04"
    NODE = "node:20-slim"
    FILE_PARSER = "file-parser:latest"

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
    QUERY_DATABASE = "query_database"
    SEND_EMAIL = "send_email"
    GET_SYSTEM_INFO = "get_system_info"
    ACCESS_SECRET = "access_secret"

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

class McpServerType(str, Enum):
    FILESYSTEM = "filesystem"
    EMAIL = "email"
    PAYMENT = "payment"
```

### 请求/响应模型

```python
class CreateContainerRequest(BaseModel):
    image: ImageType = ImageType.PYTHON
    session_id: Optional[str] = None

class ToolCallRequest(BaseModel):
    session_id: str
    tool: ToolType
    params: Dict[str, Any]

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
```

---

## 启动方式

### 开发模式

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 生产模式

```bash
cd backend
./run.sh
```

### Docker 前置要求

```bash
# 确保 Docker 服务运行
sudo systemctl start docker

# 构建 file-parser 镜像（如需要）
docker build -t file-parser:latest -f Dockerfile.file-parser .
```

---

*相关文档: [ARCHITECTURE.md](./ARCHITECTURE.md) | [API-REFERENCE.md](./API-REFERENCE.md) | [CONFIG.md](./CONFIG.md)*
