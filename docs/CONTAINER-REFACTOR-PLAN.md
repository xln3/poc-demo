# 容器架构重构计划

## 一、背景和目标

### 当前问题

1. **镜像职责混乱**
   - `file-parser:latest` 同时用于文件解析和RAG服务
   - 基础镜像 (python/ubuntu/node) 混用于多种场景
   - 没有专门的MCP服务容器

2. **容器管理混乱**
   - `container_parser.py` 和 `container_rag.py` 复用同一个容器 (session_id="parser")
   - 前端可以随意启动多个容器，无限制
   - 容器生命周期管理不清晰

3. **资源配置不合理**
   - 所有容器统一512MB内存限制
   - 未根据实际用途调整资源

### 重构目标

将容器体系分离成**四类专用容器**，每类有明确的职责边界和资源配置：

| 类型 | 镜像名 | 职责 | 内存限制 | 生命周期 |
|------|--------|------|----------|----------|
| 文件解析 | `file-parser:latest` | 解析文件返回文本 | 1GB | 自动管理，复用 |
| 终端运行 | `terminal-{image}:latest` | 提供终端沙箱 | 2GB | 手动管理，单例 |
| RAG检索 | `rag-server:latest` | 向量存储和检索 | 2GB | 自动管理，复用 |
| MCP工具 | `mcp-server:latest` | MCP环境依赖 | 2GB | 自动管理，复用 |

---

## 二、四类镜像设计

### 2.1 文件解析容器 (file-parser)

**职责**：
- 解析不同格式文件（PDF, DOCX, XLSX, 图片等）
- 返回文本内容后删除文件
- 支持OCR (Tesseract)
- 可能调用外部API进行解析

**Dockerfile 组成**：
```dockerfile
FROM python:3.11-slim

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    tesseract-ocr-eng \
    poppler-utils \
    libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

# 安装Python解析库
RUN pip install --no-cache-dir \
    PyMuPDF>=1.24.0 \
    pdfplumber>=0.10.0 \
    pdf2image>=1.16.0 \
    pytesseract>=0.3.10 \
    python-docx>=1.1.0 \
    mammoth>=1.6.0 \
    openpyxl>=3.1.0 \
    Pillow>=10.0.0

# 复制解析器模块
COPY app/services/file_parsers.py /app/file_parsers.py
COPY app/services/file_parser_cli.py /app/file_parser_cli.py

WORKDIR /app
VOLUME /tmp/upload

CMD ["/bin/bash"]
```

**资源限制**：
- 内存：1GB（考虑单文件512MB上传限制 + 解析器开销）
- CPU：50% quota
- 网络：bridge（可能需要调用外部API）

**生命周期**：
- 自动创建和复用，使用固定 `session_id="file-parser"`
- 前端显示状态：disconnected / initializing / running / error
- 解析完成后自动删除 `/tmp/upload/` 下的文件

**关键特性**：
- ✅ 不包含 ChromaDB（移除向量存储功能）
- ✅ 不包含数据库（PostgreSQL/MySQL）
- ✅ 轻量级，专注解析

---

### 2.2 终端运行容器 (terminal-sandbox)

**职责**：
- 为智能体提供隔离的终端执行环境
- 支持上传文件/目录、下载文件
- 支持运行代码、执行命令
- 提供完整的Linux工具链

**镜像系列**：
- `terminal-python:3.11` (基于 python:3.11-slim)
- `terminal-ubuntu:22.04` (基于 ubuntu:22.04)
- `terminal-node:20` (基于 node:20-slim)

**Dockerfile 示例** (terminal-python):
```dockerfile
FROM python:3.11-slim

# 安装基础工具（无OCR、无数据库）
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    zip \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 安装常用Python库
RUN pip install --no-cache-dir \
    requests \
    beautifulsoup4 \
    pandas \
    numpy

WORKDIR /workspace
VOLUME /workspace

CMD ["tail", "-f", "/dev/null"]
```

**资源限制**：
- 内存：2GB（支持更复杂的代码执行）
- CPU：50% quota
- 网络：bridge

**生命周期**：
- **单例模式**：同一时刻只允许一个终端容器运行
- 用户启动时需要输入 `tag` 标识（如 "python-test-1"）
- 前端显示运行中的容器tag，并提供"关闭容器"按钮（docker stop + rm）
- 如果尝试启动第二个，提示：
  - "已有运行中的容器 [tag]，请先关闭或选择复用"

**关键特性**：
- ✅ 支持上传目录（不只是单文件）
- ✅ 不走解析，直接原文件上传到 `/workspace/`
- ✅ 不包含OCR工具（移除Tesseract）
- ✅ 不包含ChromaDB

---

### 2.3 RAG检索容器 (rag-server)

**职责**：
- 接收文件（PDF、DOCX、XLSX、图片等）
- **内部解析文件**提取文本（完整的文件解析能力）
- 向量化文本内容
- 存储到向量数据库（ChromaDB）
- 提供检索查询服务（HTTP接口）

**Dockerfile**：
```dockerfile
FROM python:3.11-slim

# 安装系统依赖（文件解析 + ChromaDB编译）
RUN apt-get update && apt-get install -y \
    # 文件解析依赖
    tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng \
    poppler-utils libimage-exiftool-perl \
    # ChromaDB编译依赖
    build-essential gcc g++ \
    curl wget \
    && rm -rf /var/lib/apt/lists/*

# 安装Python依赖（完整RAG栈）
RUN pip install --no-cache-dir \
    # 文件解析库
    PyMuPDF pdfplumber pdf2image pytesseract \
    python-docx mammoth openpyxl Pillow \
    # RAG核心组件
    chromadb sentence-transformers \
    # HTTP服务
    flask \
    python-dotenv

# 复制文件解析器模块和RAG服务脚本
COPY app/services/file_parsers.py /app/
COPY app/services/rag_server.py /app/
COPY app/services/rag_cli.py /app/

WORKDIR /app
VOLUME /data/chromadb /tmp/upload

EXPOSE 8080

CMD ["/bin/bash"]
```

**资源限制**：
- 内存：2GB（嵌入模型 ~200MB + 文档数据 + 解析缓存）
- CPU：50% quota
- 网络：bridge

**生命周期**：
- 自动创建和复用，使用固定 `session_id="rag-server"`
- 容器内运行HTTP服务（端口8080），保持嵌入模型常驻内存
- 前端显示RAG服务状态：disconnected / starting / ready / error

**关键特性**：
- ✅ **包含完整的文件解析能力**（与file-parser相同的组件）
- ✅ 内部处理：接收文件 → 解析 → 向量化 → 存储 → 检索
- ✅ 不依赖外部file-parser容器
- ✅ 可扩展：后续支持切换不同RAG服务（Milvus, Pinecone等）

**与 file-parser 的区别**：
- `file-parser`: 解析文件 → 返回文本 → 完成（用于F2场景，无状态）
- `rag-server`: 接收文件 → 解析 → 向量化 → 存储 → 提供检索（用于F4场景，有状态）

---

### 2.4 MCP工具容器 (mcp-server)

**职责**：
- 提供MCP协议的环境依赖
- 支持传统数据库（PostgreSQL/MySQL，用于SQL注入演示）
- 提供Mock服务（Notion, GitHub, Slack等）

**Dockerfile**：
```dockerfile
FROM python:3.11-slim

# 安装数据库客户端和工具
RUN apt-get update && apt-get install -y \
    postgresql-client \
    mysql-client \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 安装Python MCP库
RUN pip install --no-cache-dir \
    psycopg2-binary \
    pymysql \
    requests \
    python-dotenv

# 复制MCP服务模块
COPY app/services/mcp_*.py /app/

WORKDIR /app
VOLUME /data/mcp

CMD ["/bin/bash"]
```

**资源限制**：
- 内存：2GB（支持数据库操作）
- CPU：50% quota
- 网络：bridge（需要访问外部MCP服务或数据库）

**生命周期**：
- 自动创建和复用，使用固定 `session_id="mcp-server"`
- 前端显示MCP服务状态：disconnected / connecting / ready / error

**关键特性**：
- ✅ 不包含OCR工具
- ✅ 不包含ChromaDB
- ✅ 专注MCP环境和数据库操作

---

## 三、容器管理架构

### 3.1 后端服务拆分

**现状**：
- `container.py` - 通用容器管理
- `container_parser.py` - 文件解析容器（session_id="parser"）
- `container_rag.py` - RAG容器（复用parser容器）

**重构后**：
```
backend/app/services/
├── container_manager.py         # 基础容器管理（重构自container.py）
├── file_parser_service.py       # 文件解析容器管理
├── terminal_sandbox_service.py  # 终端沙箱容器管理（新增）
├── rag_service.py               # RAG容器管理（重构自container_rag.py）
└── mcp_service.py               # MCP容器管理（新增）
```

### 3.2 后端schemas更新

```python
class ContainerType(str, Enum):
    """容器类型"""
    FILE_PARSER = "file-parser"
    TERMINAL = "terminal"
    RAG = "rag-server"
    MCP = "mcp-server"

class TerminalImage(str, Enum):
    """终端沙箱镜像"""
    PYTHON = "terminal-python:3.11"
    UBUNTU = "terminal-ubuntu:22.04"
    NODE = "terminal-node:20"

class ContainerStatus(str, Enum):
    DISCONNECTED = "disconnected"
    INITIALIZING = "initializing"
    RUNNING = "running"
    ERROR = "error"
    STOPPING = "stopping"
```

### 3.3 API端点设计

#### 文件解析
```
POST /file-parser/parse
  - 上传文件，自动管理容器
  - 返回解析结果，容器内自动删除文件

GET /file-parser/status
  - 返回容器状态
```

#### 终端沙箱
```
POST /terminal/create
  Body: { image: "terminal-python:3.11", tag: "my-test" }
  - 创建终端容器（检查是否已有运行中的容器）

GET /terminal/status
  - 返回当前运行的终端容器信息

DELETE /terminal/destroy
  - 手动关闭终端容器

POST /terminal/upload
  - 上传文件/目录到 /workspace/

POST /terminal/execute
  - 执行命令
```

#### RAG服务
```
POST /rag/init
  - 初始化RAG容器和服务

POST /rag/add-document
  - 添加文档（接收已解析的文本）

POST /rag/query
  - 检索查询

GET /rag/status
  - RAG服务状态
```

#### MCP服务
```
GET /mcp/status
  - MCP容器状态

POST /mcp/tool/{server_type}/{tool_name}
  - 执行MCP工具
```

---

## 四、前端UI改进

### 4.1 容器状态显示

**文件解析容器**：
```
┌─────────────────────────────┐
│ 📄 文件解析服务              │
│ 状态: ● 运行中               │
│ 内存: 245MB / 1GB            │
└─────────────────────────────┘
```

**终端沙箱**：
```
┌─────────────────────────────────────┐
│ 💻 终端沙箱                          │
│ 镜像: terminal-python:3.11          │
│ Tag: python-test-1                  │
│ 状态: ● 运行中                       │
│ [关闭容器] [复用容器]                │
└─────────────────────────────────────┘

提示：同一时刻只能运行一个终端容器
```

### 4.2 文件上传改进

**现状问题**：
- 按钮显示英文 "Upload File"
- 多轮对话中上传功能无法真正上传

**改进后**：
```jsx
// 终端沙箱上传
<button onClick={handleUploadToTerminal}>
  📁 上传文件/目录
</button>

// 文件解析上传
<button onClick={handleUploadToParse}>
  📄 上传文件进行解析
</button>
```

支持：
- 单文件上传（所有容器）
- 目录上传（仅终端沙箱）
- 拖拽上传

### 4.3 术语更新

| 旧术语 | 新术语 | 说明 |
|--------|--------|------|
| 文件注入 | 文件解析 | F2 能力层级 |
| 工具调用 | 终端运行 | F3 能力层级 |
| MCP工具 | MCP工具 | F5 保持不变 |

---

## 五、实施步骤

### Phase 1: Docker镜像重构
1. [ ] 编写 `Dockerfile.file-parser` (移除ChromaDB)
2. [ ] 编写 `Dockerfile.terminal-python`
3. [ ] 编写 `Dockerfile.terminal-ubuntu`
4. [ ] 编写 `Dockerfile.terminal-node`
5. [ ] 编写 `Dockerfile.rag-server`
6. [ ] 编写 `Dockerfile.mcp-server`
7. [ ] 编写构建脚本 `build-all-images.sh`
8. [ ] 构建并测试所有镜像

### Phase 2: 后端重构
1. [ ] 重构 `container_manager.py` (支持不同内存限制)
2. [ ] 重构 `file_parser_service.py` (使用新镜像)
3. [ ] 新建 `terminal_sandbox_service.py` (单例管理)
4. [ ] 重构 `rag_service.py` (使用独立镜像)
5. [ ] 新建 `mcp_service.py`
6. [ ] 更新 `schemas.py` (新增ContainerType枚举)
7. [ ] 更新API路由（拆分endpoint）

### Phase 3: 前端重构
1. [ ] 更新 `sandbox.js` (新增ContainerType常量)
2. [ ] 重构 `useSandbox.js` (区分四类容器)
3. [ ] 更新 `App.jsx` UI (容器状态显示)
4. [ ] 修复文件上传功能
5. [ ] 添加目录上传支持（终端沙箱）
6. [ ] 更新术语（文件注入→文件解析）

### Phase 4: 文档更新
1. [ ] 更新 `ARCHITECTURE.md`
2. [ ] 更新 `BACKEND.md`
3. [ ] 更新 `FRONTEND.md`
4. [ ] 更新 `FILE-PARSER.md` → `CONTAINERS.md`
5. [ ] 更新 `API-REFERENCE.md`
6. [ ] 更新 `CHANGELOG.md`

### Phase 5: 测试验证
1. [ ] 单元测试：每个容器服务
2. [ ] 集成测试：F1-F5场景
3. [ ] 性能测试：内存/CPU监控
4. [ ] 端到端测试：真实攻击场景

---

## 六、风险和注意事项

### 6.1 文件挂载路径问题

**用户关注**："文件挂载不应该经过服务器的根目录 /tmp"

**解释**：
- 当前：文件先上传到后端服务器的 `/tmp/`，再复制到容器的 `/tmp/upload/`
- 这是正常的临时存储流程，FastAPI的 `UploadFile` 会自动存储到系统临时目录
- 如果用户担心安全问题，可以：
  - 解析完成后立即删除服务器临时文件
  - 或者直接传递文件流到容器（性能较差）

**建议**：
- 保持现有机制，但增加自动清理逻辑
- 文档中说明文件处理流程和安全措施

### 6.2 破坏性变更

- ImageType枚举完全重构，前端代码需要大量修改
- session_id管理方式改变，可能影响现有测试用例
- API端点重组，需要更新所有调用方

### 6.3 兼容性考虑

- 保留向后兼容的API（标记为deprecated）
- 提供迁移脚本转换旧的测试用例
- 分阶段上线，先支持新架构，再逐步废弃旧API

---

## 七、验收标准

### 功能验收
- [ ] 四类容器可以独立启动和管理
- [ ] 终端沙箱严格单例，无法启动第二个
- [ ] 文件解析容器自动删除临时文件
- [ ] RAG服务HTTP接口正常工作
- [ ] MCP服务支持数据库操作

### 性能验收
- [ ] file-parser 内存峰值 < 1GB
- [ ] terminal 内存峰值 < 2GB
- [ ] rag-server 内存峰值 < 2GB
- [ ] mcp-server 内存峰值 < 2GB
- [ ] 容器启动时间 < 5秒

### 用户体验验收
- [ ] 容器状态实时显示
- [ ] 上传按钮显示中文
- [ ] 多轮对话中上传功能正常
- [ ] 目录上传功能可用（终端沙箱）
- [ ] 错误提示清晰（如尝试启动第二个终端容器）

---

## 八、时间估算

| 阶段 | 预计工作量 | 依赖 |
|------|-----------|------|
| Phase 1: Docker镜像 | 1天 | 无 |
| Phase 2: 后端重构 | 2-3天 | Phase 1 |
| Phase 3: 前端重构 | 2天 | Phase 2 |
| Phase 4: 文档更新 | 0.5天 | Phase 3 |
| Phase 5: 测试验证 | 1-2天 | Phase 4 |
| **总计** | **6.5-8.5天** | |

---

## 九、下一步行动

1. ✅ **审查设计**：Luna确认架构设计是否符合预期
2. ⏳ **执行Phase 1**：开始编写Dockerfile
3. ⏳ **逐步实施**：按阶段推进，每个阶段验证后再进行下一阶段

---

*文档版本: v1.0*
*创建日期: 2026-01-21*
*作者: Claude Code*
