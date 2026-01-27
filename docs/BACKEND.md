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
from .routers import sandbox, mcp, rag, cases, datasets, test_results, report_templates, file_parser
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
app.include_router(file_parser.router)
app.include_router(rag.router)
app.include_router(cases.router)
app.include_router(datasets.router)
app.include_router(test_results.router)
app.include_router(report_templates.router)
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

独立的文件解析服务。详见本文档"子系统 4: 文件解析"一节。

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

### Report Templates 路由 (`/report-templates`)

报告模板管理。从 `backend/data/report-templates/templates.json` 加载模板配置，提供模板列表和内容读取。

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/report-templates` | 列出所有报告模板 |
| GET | `/report-templates/{template_id}` | 获取模板内容 |

---

## 服务层详解

### ContainerManager (container.py)

Docker 容器生命周期管理。容器运行在隔离网络 `poc-sandbox-isolated`（10.200.0.0/16）中，配合宿主机 iptables 规则阻止访问内网私有 IP 段。

```python
class ContainerManager:
    CONTAINER_PREFIX = "poc-sandbox-"
    WORK_DIR = "/workspace"
    ISOLATED_NETWORK_NAME = "poc-sandbox-isolated"
    ISOLATED_NETWORK_SUBNET = "10.200.0.0/16"

    def __init__(self):
        self.client = docker.from_env()
        self._sessions: Dict[str, str] = {}        # session_id -> container_id
        self._session_images: Dict[str, str] = {}  # session_id -> image
        self._session_created: Dict[str, str] = {} # session_id -> created_at
        self._network = self._ensure_isolated_network()

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
            network=self.ISOLATED_NETWORK_NAME,
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

工具执行器，支持 6 种工具。

```python
class ToolExecutor:
    def __init__(self):
        self._tools = {
            ToolType.READ_FILE: self._read_file,
            ToolType.WRITE_FILE: self._write_file,
            ToolType.RUN_COMMAND: self._run_command,
            ToolType.HTTP_REQUEST: self._http_request,
            ToolType.LIST_DIR: self._list_dir,
            ToolType.PARSE_FILE: self._parse_file,
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
| `parse_file` | HTTP 调用 | file-parser 服务 | 解析文件（PDF/DOCX/XLSX/Image） |

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

## 数据持久化

### 问题

部署版本重新构建后，用户导入的数据集、批量测试结果、保存的案例全部丢失。

### 原因分析

运行时数据存储路径由 `backend/app/config.py` 配置：

```python
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_ROOT = Path(os.environ.get('POC_DATA_ROOT', str(PROJECT_ROOT.parent / 'poc-data')))

DATA_PATHS = {
    'datasets': DATA_ROOT / 'datasets',
    'saved_cases': DATA_ROOT / 'saved-cases',
    'test_results': DATA_ROOT / 'test-results',
}
```

| 环境 | `DATA_ROOT` 解析结果 |
|------|---------------------|
| 开发版 | `poc-demo/../poc-data`（与项目目录同级） |
| 部署版（容器内） | `/poc-data` |

如果不挂载 volume，容器内的 `/poc-data` 数据会随容器重建丢失。

### 技术选型：Named Volume vs Bind Mount

| 特性 | Named Volume | Bind Mount |
|------|--------------|------------|
| **语法** | `volume-name:/path` | `./host-path:/path` |
| **存储位置** | Docker 管理 (`/var/lib/docker/volumes/`) | 指定的宿主机目录 |
| **可见性** | 需要 `docker volume` 命令查看 | 直接在宿主机目录查看 |
| **备份** | `docker cp` 或 `docker run --volumes-from` | 直接 `cp`/`rsync` |
| **权限** | Docker 自动处理 | 可能有 uid/gid 不匹配问题 |
| **性能 (Linux)** | 相同 | 相同 |
| **性能 (Mac/Win)** | 更快 | 较慢（跨文件系统） |
| **移植性** | 更好（不依赖宿主机目录结构） | 需确保目录存在 |
| **Git 追踪** | 不涉及 | 需要 `.gitignore` |
| **生命周期** | 独立于容器，`docker-compose down` 不删除 | 与宿主机目录相同 |

**选择：Named Volume**

理由：
1. 部署环境下数据与代码完全隔离，更干净
2. 不需要预先创建目录，Docker 自动管理
3. `docker-compose down` 不会删除数据（需 `-v` 显式删除）
4. 跨平台性能一致

### 解决方案

`docker-compose.yml` 配置：

```yaml
services:
  backend:
    volumes:
      - poc-demo-data:/poc-data  # 持久化运行时数据

volumes:
  poc-demo-data:
    name: poc-demo-data
```

### 数据管理命令

```bash
# 查看 volume 详情
docker volume inspect poc-demo-data

# 备份数据
docker run --rm -v poc-demo-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/poc-data-backup.tar.gz -C /data .

# 恢复数据
docker run --rm -v poc-demo-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/poc-data-backup.tar.gz -C /data

# 删除数据（谨慎）
docker volume rm poc-demo-data
```

### 注意事项

| 操作 | 数据是否保留 |
|------|-------------|
| `docker-compose up --build` | ✅ 保留 |
| `docker-compose down` | ✅ 保留 |
| `docker-compose down -v` | ❌ 删除 |
| `docker volume rm poc-demo-data` | ❌ 删除 |

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
    PARSE_FILE = "parse_file"

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

## 子系统

以下四个子系统是后端的核心服务模块，各自独立运行，通过 HTTP API 或 Docker 容器交互。

---

### 子系统 1: 终端沙箱

多终端架构：每个终端对应一个独立的 Docker 容器，以 `tag` 作为唯一标识。容器工作目录挂载到宿主机 `poc-data/sandbox/active/{tag}/`，销毁时存档到 `poc-data/sandbox/deleted/{tag}-{timestamp}/`。

#### 容器镜像

| 镜像 | 标识 | 用途 |
|------|------|------|
| `python:3.11-slim` | PYTHON | Python 环境（默认） |
| `ubuntu:22.04` | UBUNTU | 通用 Linux 环境 |
| `node:20-slim` | NODE | Node.js 环境 |
| `file-parser:latest` | FILE_PARSER | 文件解析专用镜像 |

#### 资源限制

| 资源 | 限制 |
|------|------|
| 内存 | 2GB (`mem_limit: "2g"`) |
| CPU | 50% (`cpu_quota: 50000`) |
| 网络 | bridge 模式（允许外网） |
| 存储 | 宿主机目录挂载，无硬限制 |

#### 可用工具

| 工具 | 参数 | 说明 |
|------|------|------|
| `read_file` | `path` | 读取容器内文件内容 |
| `write_file` | `path`, `content`, `is_base64?` | 写入/创建文件 |
| `run_command` | `command` | 执行 shell 命令 |
| `list_dir` | `path` | 列出目录内容 |
| `http_request` | `method`, `url`, `headers?`, `body?` | 发送 HTTP 请求 |
| `parse_file` | `path`, `parsers?` | 调用 file-parser 服务解析文件 |

#### 终端锁机制

防止多用户同时操作同一终端。同 IP 允许抢夺锁（同一用户多标签页），不同 IP 互斥访问。心跳续期 30 秒间隔，5 分钟超时。锁文件持久化存储于 `poc-data/terminals/.locks/`。

#### 关键路由

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/sandbox/terminals` | 创建终端 `{tag, image}` |
| GET | `/sandbox/terminals` | 列出所有终端 |
| GET | `/sandbox/terminals/{tag}` | 获取终端状态 |
| DELETE | `/sandbox/terminals/{tag}` | 销毁终端 |
| POST | `/sandbox/terminals/{tag}/tool` | 执行工具 `{tool, params}` |
| POST | `/sandbox/terminals/{tag}/lock` | 获取锁 |
| DELETE | `/sandbox/terminals/{tag}/lock` | 释放锁 |
| POST | `/sandbox/terminals/{tag}/lock/heartbeat` | 心跳续期 |
| GET | `/sandbox/terminals/{tag}/files` | 列出文件 |
| POST | `/sandbox/terminals/{tag}/files` | 上传文件 |
| GET | `/sandbox/terminals/{tag}/files/download` | 下载文件 |
| WS | `/sandbox/logs/{session_id}` | 实时日志流 |
| WS | `/sandbox/terminals/{tag}/watch` | 文件变化监控 |

---

### 子系统 2: RAG 检索

基于 ChromaDB 的向量检索增强生成系统，用于演示知识库投毒、检索操控等安全攻击。

#### 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 向量存储 | ChromaDB | 持久化向量数据库 |
| 嵌入模型 | all-MiniLM-L6-v2 (sentence-transformers) | 文本向量化 |
| 文件解析 | PyMuPDF, python-docx, openpyxl, pytesseract | 多格式文档支持 |
| 容器化 | Docker (file-parser:latest) | 隔离执行环境 |

#### 数据流

**上传流程**: 文件 -> 文本提取 -> 分块（500字符，50字符重叠，句子边界智能分割） -> 向量化 -> 存入 ChromaDB

**查询流程**: 问题文本 -> 向量化 -> 余弦相似度匹配 -> 返回 top_k 结果（含分数和来源元数据）

#### ChromaDB 存储结构

```
Collection: "rag_documents"
├── Metadata: {"hnsw:space": "cosine"}
└── Items:
    ├── IDs: "{document_id}_chunk_{index}"
    ├── Documents: 文本块内容
    └── Metadatas: document_id, source_name, document_type, chunk_index, total_chunks, created_at
```

#### 关键路由

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/rag/health` | 健康检查 |
| POST | `/rag/init` | 初始化并导入预置数据 |
| POST | `/rag/reset` | 重置为预置数据 |
| POST | `/rag/upload` | 上传文件（自动解析、分块、向量化） |
| POST | `/rag/ingest` | 直接输入文本 |
| POST | `/rag/query` | 向量查询 `{query, top_k, score_threshold}` |
| GET | `/rag/documents` | 列出所有文档 |
| DELETE | `/rag/documents/{id}` | 删除文档 |

预置测试数据位于 `backend/docker/preset-data/`，包含正常政策文档、投毒文档、敏感数据和越狱文档。

---

### 子系统 3: MCP 服务

MCP (Model Context Protocol) 为 LLM Agent 提供外部工具调用能力，支持 14 个模拟/真实 Server。

#### MCP Server 列表

| Server ID | 名称 | 工具数 | 说明 |
|-----------|------|--------|------|
| `filesystem` | Filesystem | 4 | 本地文件系统读写 |
| `email` | Email | 2 | SMTP 邮件发送 |
| `email_receive` | Email (Receive) | 3 | IMAP 邮件接收 |
| `payment` | Payment | 3 | Stripe 支付网关 |
| `notion` | Notion | 4 | Notion 文档管理 |
| `github` | GitHub | 5 | GitHub 仓库操作 |
| `database` | Database | 3 | SQL 数据库查询 |
| `http` | HTTP | 2 | HTTP 请求代理 |
| `slack` | Slack | 3 | Slack 消息通知 |
| `calendar` | Calendar | 4 | 日历事件管理 |
| `storage` | Storage | 4 | 对象存储服务 |
| `memory` | Memory | 3 | 会话记忆存储 |
| `browser_chrome` | Chrome Browser | 2 | Chrome 浏览器数据读取 |
| `browser_firefox` | Firefox Browser | 2 | Firefox 浏览器数据读取 |

#### 扩展新 MCP Server

1. **前端**: `src/config.js` 中的 `mcpServers.available` 添加服务定义（id, name, fields, tools）
2. **后端枚举**: `backend/app/models/schemas.py` 的 `McpServerType` 添加枚举值
3. **后端服务**: `backend/app/services/` 下新建 `mcp_xxx.py` 实现工具逻辑
4. **路由分发**: `backend/app/routers/mcp.py` 的 `test_mcp_connection` 和 `execute_mcp_tool` 添加分支

#### 关键路由

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/mcp/health` | 健康检查 |
| GET | `/mcp/servers` | 列出所有可用 MCP Server |
| POST | `/mcp/test` | 测试 Server 连接 `{server_id, config}` |
| POST | `/mcp/tool` | 执行 MCP 工具 `{server_id, tool_name, params, config}` |
| GET | `/mcp/status/{server_id}` | 获取 Server 状态 |

---

### 子系统 4: 文件解析

独立的文件解析服务，用于对比不同解析器提取隐藏内容的能力差异。这是间接注入攻击演示的核心能力。

#### 解析器分类

**PDF 解析器**:

| 解析器 ID | 底层库 | 提取隐藏内容 | 说明 |
|-----------|--------|:------------:|------|
| `pymupdf` | PyMuPDF (fitz) | Yes | 提取所有文字层，包括白色/透明文字 |
| `pdfplumber` | pdfplumber | Yes | 结构化文本 + 表格提取 |
| `pdf2image_ocr` | pdf2image + pytesseract | No | 转图片后 OCR，仅识别可见内容 |

**DOCX 解析器**:

| 解析器 ID | 底层库 | 提取隐藏内容 | 说明 |
|-----------|--------|:------------:|------|
| `python-docx` | python-docx | Yes | 提取所有段落和表格，包括隐藏文本 |
| `mammoth` | mammoth | No | 转换为 HTML/纯文本，格式简化 |

**XLSX 解析器**:

| 解析器 ID | 底层库 | 提取隐藏内容 | 说明 |
|-----------|--------|:------------:|------|
| `openpyxl` | openpyxl | No | 仅读取可见工作表 |
| `openpyxl_hidden` | openpyxl | Yes | 读取所有工作表，包括 hidden/veryHidden |

**图片解析器**:

| 解析器 ID | 底层库 | 提取隐藏内容 | 说明 |
|-----------|--------|:------------:|------|
| `exiftool` | exiftool CLI | Yes | 提取 EXIF、XMP、IPTC 元数据 |
| `pytesseract` | pytesseract | No | OCR 文字识别，仅可见内容 |
| `pillow_meta` | Pillow | Yes | 提取图片注释、描述字段 |

#### 容器集成

解析服务运行在 `file-parser:latest` Docker 容器内，通过 CLI 调用：

1. `ContainerParser` 检查/创建容器
2. 将文件写入容器 `/workspace/`
3. 执行 `python /app/file_parser_cli.py <filename> <parser_ids>`
4. 解析 JSON 输出并返回

沙箱的 `parse_file` 工具通过 HTTP 调用 `/file-parser/parse/base64` 端点，实现松耦合。

#### 关键路由

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/file-parser/health` | 健康检查（含各解析器可用状态） |
| GET | `/file-parser/parsers` | 获取可用解析器（按文件类型分组） |
| POST | `/file-parser/parse` | 解析文件（multipart/form-data，返回结构化结果） |
| POST | `/file-parser/parse/text` | 解析文件（返回合并纯文本） |
| POST | `/file-parser/parse/base64` | 解析 base64 编码文件（供沙箱 parse_file 工具调用） |

---

*相关文档: [ARCHITECTURE.md](./ARCHITECTURE.md) | [API-REFERENCE.md](./API-REFERENCE.md) | [CONFIG.md](./CONFIG.md)*
