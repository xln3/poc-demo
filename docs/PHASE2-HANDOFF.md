# Phase 2 交接文档

**交接时间**: 2026-01-22 01:20
**交接人**: Claude Code (Phase 1)
**接手人**: 后端开发者 (Phase 2)
**任务**: 后端容器管理服务重构

---

## ⚠️ 重要提醒

### Phase 1 改动尚未提交到 Git

**当前状态**: 所有 Phase 1 的改动都在工作区，需要先提交才能开始 Phase 2。

**需要提交的 Phase 1 文件清单**:

#### 新增文件 (必须 git add)
```bash
# Dockerfiles (6个)
backend/dockerfiles/Dockerfile.file-parser
backend/dockerfiles/Dockerfile.terminal-python
backend/dockerfiles/Dockerfile.terminal-ubuntu
backend/dockerfiles/Dockerfile.terminal-node
backend/dockerfiles/Dockerfile.mcp-server
backend/dockerfiles/Dockerfile.rag-server

# 构建脚本 (2个)
backend/dockerfiles/build-all-images.sh
backend/dockerfiles/build-file-parser.sh

# RAG服务脚本 (1个)
backend/app/services/rag_server.py

# 文件解析器 (2个)
backend/app/services/file_parsers.py
backend/app/services/file_parser_cli.py

# MCP服务模块 (8个)
backend/app/services/mcp_calendar.py
backend/app/services/mcp_database.py
backend/app/services/mcp_github.py
backend/app/services/mcp_http.py
backend/app/services/mcp_memory.py
backend/app/services/mcp_notion.py
backend/app/services/mcp_slack.py
backend/app/services/mcp_storage.py

# 文档 (6个)
docs/BREAKING-CHANGES.md
docs/CONTAINER-REFACTOR-PLAN.md
docs/PHASE1-COMPLETE.md
docs/PHASE1-STATUS.md
docs/PHASE1-SUMMARY.md
docs/PHASE2-HANDOFF.md  # 本文件
FILE-PARSER.md
```

#### 提交命令（示例）
```bash
cd /mnt/data1/workspace/xln/2026Jan/poc-demo

# 添加所有 Phase 1 文件
git add backend/dockerfiles/Dockerfile.* \
        backend/dockerfiles/build-*.sh \
        backend/app/services/rag_server.py \
        backend/app/services/file_parser*.py \
        backend/app/services/mcp_*.py \
        docs/BREAKING-CHANGES.md \
        docs/CONTAINER-REFACTOR-PLAN.md \
        docs/PHASE1-*.md \
        docs/PHASE2-HANDOFF.md \
        FILE-PARSER.md

# 查看暂存状态
git status

# 提交
git commit -m "Phase 1 完成: Docker镜像重构 (6个专用镜像)

- 新增 6 个 Dockerfile（file-parser, terminal系列, mcp-server, rag-server）
- rag-server 新增 /upload 文件上传解析接口
- 使用多阶段构建预下载嵌入模型
- 完整文档（设计、变更、完成报告）

总镜像大小: 11.0GB (6个)
file-parser 优化: -62% (从 1.21GB → 462MB)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## 📋 必读文档（按优先级）

### 1. 核心设计文档 ⭐⭐⭐ (必读)

**文件**: `docs/CONTAINER-REFACTOR-PLAN.md`

**阅读重点**:
- **第 2 节**: 4 类容器完整定义（职责、内存限制、生命周期）
- **第 5.1 节**: Phase 2 需要修改的所有文件清单
- **第 5.2 节**: API 端点重组方案
- **第 3 节**: 资源分配策略（内存限制配置）

**关键表格**:
| 容器类型 | 镜像 | 内存限制 | 生命周期 | 场景 |
|---------|------|---------|---------|------|
| 文件解析 | file-parser:latest | 1GB | 自动管理，按需创建销毁 | F2 |
| 终端沙箱 | terminal-python:3.11<br>terminal-ubuntu:22.04<br>terminal-node:20 | 2GB | **单例，手动管理** | F3 |
| RAG服务 | rag-server:latest | 2GB | 自动管理，session_id="rag-server" | F4 |
| MCP服务 | mcp-server:latest | 2GB | 自动管理，按需创建销毁 | F5 |

**⚠️ 关键点**: 只有 terminal 容器是单例且手动管理！

### 2. 破坏性变更日志 ⭐⭐⭐ (必读)

**文件**: `docs/BREAKING-CHANGES.md`

**阅读重点**:
- **第 1 节**: Docker 镜像重命名映射表
- **第 2 节**: schemas.py 新增的枚举定义
  - `ContainerType` 枚举: `FILE_PARSER`, `TERMINAL`, `RAG_SERVER`, `MCP_SERVER`
  - `TerminalImage` 枚举: `PYTHON`, `UBUNTU`, `NODE`
- **第 3 节**: API 端点重组方案
- **第 4 节**: 前端常量更新（Phase 3 才需要）

**关键示例代码**:
```python
# schemas.py 新增内容
class ContainerType(str, Enum):
    FILE_PARSER = "file-parser"
    TERMINAL = "terminal"
    RAG_SERVER = "rag-server"
    MCP_SERVER = "mcp-server"

class TerminalImage(str, Enum):
    PYTHON = "terminal-python:3.11"
    UBUNTU = "terminal-ubuntu:22.04"
    NODE = "terminal-node:20"

MEMORY_LIMITS = {
    ContainerType.FILE_PARSER: "1g",
    ContainerType.TERMINAL: "2g",
    ContainerType.RAG_SERVER: "2g",
    ContainerType.MCP_SERVER: "2g",
}
```

### 3. Phase 1 完成报告 ⭐⭐ (推荐阅读)

**文件**: `docs/PHASE1-SUMMARY.md` (简洁版) 或 `docs/PHASE1-COMPLETE.md` (详细版)

**内容**:
- 6 个镜像的验证命令
- rag-server 新增的 `/upload` 接口说明
- 已知问题和技术决策

---

## 🔍 需要理解的现有代码

### 当前容器管理（需重构）

**文件**: `backend/app/services/container.py`

**当前问题**:
- 混合了多种容器类型的逻辑
- 没有区分生命周期管理策略
- 没有内存限制配置

**重构目标**: 改名为 `container_manager.py`，支持 4 种容器类型的专用管理

### 数据模型（需扩展）

**文件**: `backend/app/models/schemas.py`

**需要添加**:
- `ContainerType` 枚举
- `TerminalImage` 枚举
- `MEMORY_LIMITS` 字典
- 废弃 `ImageType.MCP_TOOLS`（已改为 `FILE_PARSER`）

### RAG 服务参考

**文件**:
- `backend/app/services/rag_server.py` - 容器内的 HTTP 服务（Flask，新增 /upload 接口）
- `backend/app/services/container_rag.py` - 后端的 RAG 容器管理服务

**关键改动**:
- rag_server.py 新增 `/upload` 接口支持文件上传并自动解析
- 需要切换到 rag-server 镜像（之前用的是 file-parser 镜像）

---

## 📝 Phase 2 任务清单

### 核心任务概述

将单一容器管理改造为 4 类专用容器管理，支持：
- 不同的内存限制
- 不同的生命周期策略（自动 vs 手动）
- 终端容器的单例逻辑

### 必须修改的文件 (6个)

#### 1. `backend/app/models/schemas.py` ⭐ (优先)

**任务**: 添加新枚举

**代码**:
```python
class ContainerType(str, Enum):
    FILE_PARSER = "file-parser"
    TERMINAL = "terminal"
    RAG_SERVER = "rag-server"
    MCP_SERVER = "mcp-server"

class TerminalImage(str, Enum):
    PYTHON = "terminal-python:3.11"
    UBUNTU = "terminal-ubuntu:22.04"
    NODE = "terminal-node:20"

MEMORY_LIMITS = {
    ContainerType.FILE_PARSER: "1g",
    ContainerType.TERMINAL: "2g",
    ContainerType.RAG_SERVER: "2g",
    ContainerType.MCP_SERVER: "2g",
}

# 废弃旧枚举（保留兼容性）
class ImageType(str, Enum):
    PYTHON = "python:3.11-slim"
    UBUNTU = "ubuntu:22.04"
    NODE = "node:20-slim"
    FILE_PARSER = "file-parser:latest"  # 原 MCP_TOOLS
```

**详见**: `BREAKING-CHANGES.md` 第 2 节

#### 2. `backend/app/services/container.py` → `container_manager.py` ⭐

**任务**: 重构为通用容器管理器

**关键改动**:
- 支持动态内存限制（从 `MEMORY_LIMITS` 字典获取）
- 支持不同容器类型的创建
- 重命名文件

**参考**: `CONTAINER-REFACTOR-PLAN.md` 第 5.1.1 节

#### 3. `backend/app/services/file_parser_service.py`

**任务**: 切换到 file-parser 镜像

**改动**:
```python
# 旧代码
session_id = "parser"
image = "mcp-tools:latest"

# 新代码
session_id = "file-parser"
image = "file-parser:latest"
```

**详见**: `BREAKING-CHANGES.md` 第 2.2 节

#### 4. 🆕 `backend/app/services/terminal_sandbox_service.py` (新建) ⭐⭐⭐

**任务**: 实现终端容器的单例管理

**关键需求**:
- **单例**: 同一时间只能有一个 terminal 容器运行
- **手动管理**: 用户显式启动/停止
- **用户 tag**: 用户提供标识（如 "my-python-env"）
- **3种镜像**: 支持选择 PYTHON / UBUNTU / NODE

**伪代码**:
```python
class TerminalSandboxService:
    _current_container: Optional[str] = None  # 当前运行的容器 session_id
    _current_tag: Optional[str] = None

    @classmethod
    def create_terminal(cls, image: TerminalImage, tag: str) -> dict:
        """创建终端容器（单例）"""
        if cls._current_container is not None:
            raise ConflictError(f"已有终端容器运行: {cls._current_tag}")

        # 创建容器
        session_id = f"terminal-{tag}"
        container = container_manager.create(
            image=image.value,
            session_id=session_id,
            mem_limit="2g"
        )

        cls._current_container = session_id
        cls._current_tag = tag
        return container

    @classmethod
    def destroy_terminal(cls) -> dict:
        """销毁当前终端容器"""
        if cls._current_container is None:
            raise NotFoundError("没有运行中的终端容器")

        container_manager.destroy(cls._current_container)
        cls._current_container = None
        cls._current_tag = None
        return {"status": "destroyed"}

    @classmethod
    def get_current(cls) -> Optional[dict]:
        """获取当前终端容器信息"""
        if cls._current_container is None:
            return None
        return container_manager.get_status(cls._current_container)
```

**详见**: `CONTAINER-REFACTOR-PLAN.md` 第 5.1.3 节

#### 5. `backend/app/services/rag_service.py`

**任务**: 切换到 rag-server 镜像并使用新的 /upload 接口

**改动**:
```python
# 旧代码
session_id = "parser"
image = "file-parser:latest"  # 或 mcp-tools:latest
# 分两步：上传到 file-parser 解析，再调用 RAG add 接口

# 新代码
session_id = "rag-server"
image = "rag-server:latest"
# 直接调用 /upload 接口（内部自动解析并添加到知识库）
```

**新 API 流程**:
```python
# 上传文件到 rag-server 的 /upload 接口
response = requests.post(
    f"http://localhost:{port}/upload",
    files={"file": file_content},
    data={"filename": filename}
)
# 返回: {
#   "success": True,
#   "document_id": "abc123",
#   "chunk_count": 5,
#   "parsers_used": ["pymupdf"]
# }
```

**参考**: `PHASE1-COMPLETE.md` 第 6 节（rag-server HTTP API 端点）

#### 6. 🆕 `backend/app/services/mcp_service.py` (新建)

**任务**: 管理 mcp-server 容器

**类似**: file_parser_service.py 的结构

**代码框架**:
```python
class MCPService:
    SESSION_ID = "mcp-server"
    IMAGE = "mcp-server:latest"

    def __init__(self):
        self.container_manager = ContainerManager()

    def ensure_container(self):
        """确保容器运行"""
        # 类似 file_parser_service

    def execute_tool(self, tool_name: str, params: dict):
        """执行 MCP 工具"""
        # 调用容器内的 Python 脚本
```

**详见**: `CONTAINER-REFACTOR-PLAN.md` 第 5.1.5 节

---

## 🔌 API 端点重组 (需更新路由)

### 当前端点 (旧)

```
POST   /sandbox/container           # 创建容器（混合）
GET    /sandbox/container/{id}      # 获取容器状态
DELETE /sandbox/container/{id}      # 销毁容器
POST   /sandbox/tool                # 执行工具
```

### 新端点结构

参考 `BREAKING-CHANGES.md` 第 3 节：

```
# 文件解析容器
POST   /containers/file-parser              # 创建（自动管理）
DELETE /containers/file-parser/{session_id} # 销毁

# 终端容器（单例）
POST   /containers/terminal                 # 创建（需 image + tag）
GET    /containers/terminal                 # 获取当前容器状态
DELETE /containers/terminal                 # 销毁当前容器
POST   /containers/terminal/command         # 执行命令

# RAG容器
POST   /containers/rag-server               # 创建（自动管理）
POST   /rag/upload                          # 上传文件（新增）
POST   /rag/query                           # 查询

# MCP容器
POST   /containers/mcp-server               # 创建（自动管理）
POST   /mcp/tool                            # 执行工具
```

### 需要更新的路由文件

1. ✅ `backend/app/routers/sandbox.py` - 拆分为 terminal 专用路由
2. ✅ `backend/app/routers/rag.py` - 添加 /upload 端点
3. ✅ `backend/app/routers/mcp.py` - 切换到 mcp-server 镜像
4. 🆕 `backend/app/routers/terminal.py` - 新建终端路由
5. 🆕 `backend/app/routers/containers.py` - 新建容器管理路由（可选）

---

## 💡 关键技术决策（必须理解）

### 1. rag-server 架构理解 ⚠️⚠️⚠️

**容易误解**: rag-server 依赖外部 file-parser 解析文件

**✅ 正确理解**:
- rag-server **内部包含完整的文件解析能力**（Tesseract、PyMuPDF、pdfplumber 等）
- file-parser 和 rag-server **不混用**，各自独立服务不同场景
- file-parser: F2 场景，无状态（解析 → 返回文本 → 完成）
- rag-server: F4 场景，有状态（接收文件 → 内部解析 → 向量化 → 存储 → 提供检索）

**证据**:
- 查看 `backend/dockerfiles/Dockerfile.rag-server:79-81` - 复制了 file_parsers.py
- 查看 `backend/app/services/rag_server.py:282-361` - parse_uploaded_file 函数

**Phase 2 实现**: 直接调用 rag-server 的 `/upload` 接口，不需要先调用 file-parser

### 2. terminal 容器单例逻辑 ⚠️

**需求解释**:
- **为什么单例**: 终端环境是用户的交互式工作空间，多个实例会造成混乱
- **手动管理**: 用户主动创建，明确销毁（类似 Docker Desktop 的容器管理）
- **用户 tag**: 让用户自己命名（如 "dev-env", "test-env"）

**实现要点**:
```python
# 使用类变量维护单例状态
class TerminalSandboxService:
    _current_container: Optional[str] = None

    # 创建时检查
    if _current_container is not None:
        raise ConflictError("已有终端容器运行")

    # 销毁时清理
    _current_container = None
```

**错误处理**:
- 创建时如有容器运行 → 返回 409 Conflict
- 销毁时如无容器运行 → 返回 404 Not Found

### 3. 内存限制策略

**配置**:
```python
MEMORY_LIMITS = {
    ContainerType.FILE_PARSER: "1g",   # 解析文件不需要太多内存
    ContainerType.TERMINAL: "2g",      # 用户代码执行可能需要更多
    ContainerType.RAG_SERVER: "2g",    # ChromaDB + 嵌入模型需要内存
    ContainerType.MCP_SERVER: "2g",    # 数据库操作可能需要缓存
}
```

**使用**:
```python
mem_limit = MEMORY_LIMITS[container_type]
container_manager.create(..., mem_limit=mem_limit)
```

---

## 🧪 验证环境

开始 Phase 2 前，先验证所有镜像可用：

```bash
# 1. 检查镜像存在（应该有 6 个）
docker images | grep -E "(file-parser|terminal|mcp-server|rag-server)"

# 2. 快速功能验证
docker run --rm file-parser:latest python3 -c 'import fitz; print("✓ file-parser OK")'
docker run --rm terminal-python:3.11 python --version
docker run --rm terminal-ubuntu:22.04 uname -a
docker run --rm terminal-node:20 node --version
docker run --rm mcp-server:latest psql --version
docker run --rm rag-server:latest python3 -c 'import chromadb; from sentence_transformers import SentenceTransformer; model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2"); print("✓ rag-server OK")'
```

**预期结果**: 所有命令都成功，无错误

**如果缺少镜像**:
```bash
cd backend
bash dockerfiles/build-all-images.sh  # 重新构建全部
```

---

## 📚 可选参考文档

```bash
# 现有架构（了解背景）
docs/ARCHITECTURE.md
docs/BACKEND.md

# API 参考（实现时查阅）
docs/API-REFERENCE.md

# 前端对接（Phase 3 才需要）
docs/FRONTEND.md
```

---

## ⚡ 推荐工作流程

### Day 1: 理解 + 环境准备

1. **(30分钟)** 快速阅读：
   - `PHASE1-SUMMARY.md` - 了解完成了什么
   - `CONTAINER-REFACTOR-PLAN.md` 第 2、5.1 节 - 了解要做什么
   - `BREAKING-CHANGES.md` 第 1、2、3 节 - 了解怎么改

2. **(10分钟)** 验证环境：
   - 运行上面的镜像验证命令
   - 确认所有 6 个镜像都可用

3. **(20分钟)** 提交 Phase 1 改动：
   - 使用上面的 git add + commit 命令
   - 确保工作区干净

### Day 2: 核心重构

1. **(1小时)** 修改 schemas.py
   - 添加新枚举
   - 测试导入无错误

2. **(2小时)** 重构 container.py → container_manager.py
   - 支持动态内存限制
   - 支持多容器类型

3. **(2小时)** 实现 terminal_sandbox_service.py
   - 单例逻辑
   - 错误处理

### Day 3: 服务适配 + 测试

1. **(1小时)** 更新现有服务
   - file_parser_service.py
   - rag_service.py
   - mcp_service.py

2. **(2小时)** 重组 API 路由
   - 拆分 sandbox.py
   - 更新 rag.py, mcp.py
   - 新建 terminal.py

3. **(2小时)** 测试验证
   - 单元测试
   - 集成测试
   - 手动测试各个端点

---

## 🔗 关键文件速查

| 文件 | 用途 | Phase 2 需要修改 |
|------|------|-----------------|
| `CONTAINER-REFACTOR-PLAN.md` | 总体设计 | ❌ 只读 |
| `BREAKING-CHANGES.md` | API变更清单 | ❌ 只读 |
| `PHASE1-SUMMARY.md` | Phase 1 总结 | ❌ 只读 |
| `schemas.py` | 数据模型 | ✅ 添加枚举 |
| `container.py` | 容器管理 | ✅ 重构重命名 |
| `file_parser_service.py` | 文件解析服务 | ✅ 切换镜像 |
| `terminal_sandbox_service.py` | 终端服务 | ✅ 新建 |
| `rag_service.py` | RAG服务 | ✅ 切换镜像和接口 |
| `mcp_service.py` | MCP服务 | ✅ 新建 |
| `routers/sandbox.py` | 沙箱路由 | ✅ 拆分 |
| `routers/terminal.py` | 终端路由 | ✅ 新建 |
| `routers/rag.py` | RAG路由 | ✅ 添加 /upload |
| `routers/mcp.py` | MCP路由 | ✅ 更新 |

---

## 🆘 遇到问题时

1. **对 rag-server 架构有疑问**: 重读 `PHASE1-SUMMARY.md` "关键技术决策" 第 1 节
2. **不确定如何实现单例**: 参考本文档 "关键技术决策" 第 2 节的伪代码
3. **API 端点不确定**: 查 `BREAKING-CHANGES.md` 第 3 节对照表
4. **需要更详细的验证命令**: 查 `PHASE1-COMPLETE.md`

---

## ✅ Phase 2 完成标准

- [ ] 所有 6 个服务文件完成（2个新建，4个修改）
- [ ] schemas.py 新增枚举已添加
- [ ] 所有路由文件更新完成
- [ ] terminal 容器单例逻辑测试通过
- [ ] 4 类容器可以独立创建和销毁
- [ ] 内存限制正确应用
- [ ] API 端点符合新设计
- [ ] 单元测试覆盖核心逻辑
- [ ] 提交代码并更新 CHANGELOG

---

**交接完成时间**: 2026-01-22 01:20
**预计 Phase 2 工作量**: 2-3 天
**风险等级**: 中（破坏性变更，但当前无用户）
**下一里程碑**: Phase 3 - 前端重构
