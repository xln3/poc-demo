# 破坏性变更日志 (Breaking Changes Log)

本文档记录容器架构重构中的所有破坏性变更，方便团队成员接续工作和理解变更影响。

---

## 📅 2026-01-21: 容器架构重构

### 变更概述

将混用的容器体系重构为四类专用容器，每类有明确的职责边界和独立的生命周期管理。

**参考文档**: `docs/CONTAINER-REFACTOR-PLAN.md`

---

## 🔴 破坏性变更列表

### 1. Docker 镜像重命名和拆分

#### 1.1 file-parser 镜像变更

**旧行为**:
- 镜像名: `file-parser:latest`
- 职责: 文件解析 + RAG向量存储（包含ChromaDB）
- 内存限制: 512MB
- session_id: `"parser"` (被解析和RAG服务共用)

**新行为**:
- 镜像名: `file-parser:latest` (保持不变)
- 职责: **仅文件解析**（移除ChromaDB）
- 内存限制: 1GB
- session_id: `"file-parser"` (独占)

**移除的依赖**:
```dockerfile
- chromadb>=0.4.0  # 已移除
- build-essential  # 已移除（不再需要编译chromadb）
```

**影响**:
- `container_rag.py` 不能再使用此容器
- 需要单独的 `rag-server:latest` 镜像

---

#### 1.2 新增 RAG 专用镜像

**镜像名**: `rag-server:latest`

**职责**:
- 接收文件（PDF、DOCX、XLSX、图片等）
- **内部解析文件**提取文本（包含完整的文件解析器和OCR）
- 向量化文本内容
- 存储到向量数据库（ChromaDB）
- 提供检索查询服务（HTTP接口，端口8080）

**完整功能**:
- ✅ 文件解析器（PyMuPDF, pdfplumber, python-docx, openpyxl）
- ✅ OCR文本识别（Tesseract）
- ✅ 向量数据库（ChromaDB）
- ✅ 嵌入模型（sentence-transformers）
- ✅ HTTP服务（Flask）

**与 file-parser 的区别**:
- `file-parser`: 解析文件 → 返回文本 → 完成（用于F2场景）
- `rag-server`: 接收文件 → 解析 → 向量化 → 存储 → 提供检索（用于F4场景）

**内存限制**: 2GB

**session_id**: `"rag-server"` (独占)

**影响**:
- `container_rag.py` 需要切换到此镜像
- RAG服务改为HTTP调用，不再每次exec命令
- RAG服务内部包含文件解析能力，不依赖外部file-parser容器

---

#### 1.3 新增终端沙箱镜像系列

**镜像名**:
- `terminal-python:3.11`
- `terminal-ubuntu:22.04`
- `terminal-node:20`

**职责**:
- 为智能体提供终端执行环境
- 支持文件上传/下载、代码执行

**内存限制**: 2GB

**生命周期**: **单例模式**（同一时刻只允许一个终端容器）

**session_id**: 由用户提供的 `tag` 生成 (如 `"terminal-python-test1"`)

**影响**:
- 替换原有的 `python:3.11-slim`, `ubuntu:22.04`, `node:20-slim`
- 前端需要实现单例检查逻辑
- 需要手动管理容器生命周期（启动/停止）

---

#### 1.4 新增 MCP 专用镜像

**镜像名**: `mcp-server:latest`

**职责**:
- 提供MCP协议环境
- 包含数据库客户端 (PostgreSQL/MySQL)
- 用于SQL注入等攻击场景演示

**内存限制**: 2GB

**session_id**: `"mcp-server"` (独占)

**影响**:
- 后端需要新建 `mcp_service.py` 管理此容器

---

### 2. 后端 API 变更

#### 2.1 schemas.py 枚举重构

**旧枚举**:
```python
class ImageType(str, Enum):
    PYTHON = "python:3.11-slim"
    UBUNTU = "ubuntu:22.04"
    NODE = "node:20-slim"
    FILE_PARSER = "file-parser:latest"
```

**新枚举**:
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
    INITIALIZING = "initializing"   # 新增状态
    RUNNING = "running"
    ERROR = "error"
    STOPPING = "stopping"            # 新增状态
```

**影响**:
- 所有引用 `ImageType` 的代码需要更新
- 前端的 `ImageType` 常量需要同步修改

---

#### 2.2 ContainerManager 内存限制变更

**旧行为**:
```python
# container.py line 88
mem_limit="512m",  # 所有容器统一512MB
```

**新行为**:
```python
# container_manager.py
def get_or_create_container(
    self,
    container_type: ContainerType,
    image: str,
    session_id: str,
    mem_limit: str = "1g",  # 根据容器类型动态设置
    ...
)
```

**内存分配表**:
| 容器类型 | 内存限制 |
|---------|---------|
| file-parser | 1GB |
| terminal | 2GB |
| rag-server | 2GB |
| mcp-server | 2GB |

**影响**:
- `container.py` 重命名为 `container_manager.py`
- 构造函数签名变更

---

#### 2.3 API 端点重组

##### 文件解析服务

**旧端点**:
```
POST /mcp/parse  (实际执行文件解析)
```

**新端点**:
```
POST /file-parser/parse
  Body: { file: <binary>, filename: "doc.pdf", parsers: ["pdf2image_ocr"] }
  Response: { success: true, results: [...] }

GET /file-parser/status
  Response: { status: "running", container_id: "abc123", memory_usage: "245MB" }
```

**影响**:
- 前端所有调用 `/mcp/parse` 的代码需要改为 `/file-parser/parse`

---

##### 终端沙箱服务

**旧端点**:
```
POST /sandbox/container
  Body: { image: "python:3.11-slim", session_id: "xxx" }
```

**新端点**:
```
POST /terminal/create
  Body: { image: "terminal-python:3.11", tag: "my-test-1" }
  Response: { session_id: "terminal-my-test-1", container_id: "...", status: "running" }
  Error: { error: "已有运行中的容器 [other-tag]" }

GET /terminal/status
  Response: { running: true, tag: "my-test-1", image: "terminal-python:3.11", ... }

DELETE /terminal/destroy
  Body: { session_id: "terminal-my-test-1" }

POST /terminal/upload
  Body: { session_id: "...", path: "/workspace/file.txt", content: "..." }

POST /terminal/execute
  Body: { session_id: "...", command: "python script.py" }
```

**影响**:
- 前端需要实现"输入tag"的UI
- 需要检查是否已有运行中的容器（单例逻辑）
- `/sandbox/container` 端点废弃

---

##### RAG 服务

**旧端点**:
```
POST /rag/init
POST /rag/query
POST /rag/add-document
```

**新行为**:
- 端点路径不变
- 内部实现改为调用容器内HTTP服务 (http://127.0.0.1:8080)
- 使用独立的 `rag-server:latest` 镜像（不再复用file-parser）

**影响**:
- `container_rag.py` 需要重构
- session_id 从 `"parser"` 改为 `"rag-server"`

---

##### MCP 服务

**新端点**:
```
GET /mcp/status
  Response: { status: "running", container_id: "...", available_tools: [...] }

POST /mcp/tool/{server_type}/{tool_name}
  Body: { params: {...}, config: {...} }
  Response: { success: true, result: {...} }
```

**影响**:
- 需要新建 `backend/app/services/mcp_service.py`
- 需要新建 `backend/app/routers/mcp_tools.py` (区别于现有的 `mcp.py`)

---

### 3. 前端变更

#### 3.1 ImageType 常量重构

**旧代码** (`src/sandbox.js`):
```javascript
export const ImageType = {
  PYTHON: 'python:3.11-slim',
  UBUNTU: 'ubuntu:22.04',
  NODE: 'node:20-slim',
  FILE_PARSER: 'file-parser:latest',
};
```

**新代码**:
```javascript
export const ContainerType = {
  FILE_PARSER: 'file-parser',
  TERMINAL: 'terminal',
  RAG: 'rag-server',
  MCP: 'mcp-server',
};

export const TerminalImage = {
  PYTHON: 'terminal-python:3.11',
  UBUNTU: 'terminal-ubuntu:22.04',
  NODE: 'terminal-node:20',
};
```

**影响**:
- 所有引用 `ImageType.PYTHON` 的代码需要改为 `TerminalImage.PYTHON`
- 所有引用 `ImageType.FILE_PARSER` 的代码需要改为 `ContainerType.FILE_PARSER`

---

#### 3.2 容器管理逻辑拆分

**旧行为**:
- 单一的 `useSandbox` hook 管理所有容器
- 可以同时启动多个容器，无限制

**新行为**:
- `useSandbox` 拆分为多个专用hook：
  - `useFileParser()` - 文件解析容器
  - `useTerminal()` - 终端沙箱容器（单例）
  - `useRAG()` - RAG服务容器
  - `useMCP()` - MCP服务容器

**终端沙箱单例逻辑**:
```javascript
// useTerminal.js
const [runningTerminal, setRunningTerminal] = useState(null);

const createTerminal = async (image, tag) => {
  if (runningTerminal) {
    throw new Error(`已有运行中的容器 [${runningTerminal.tag}]，请先关闭或选择复用`);
  }

  const response = await fetch('/terminal/create', {
    method: 'POST',
    body: JSON.stringify({ image, tag })
  });

  const info = await response.json();
  setRunningTerminal({ ...info, tag });
  return info;
};

const destroyTerminal = async () => {
  await fetch('/terminal/destroy', { method: 'DELETE' });
  setRunningTerminal(null);
};
```

**影响**:
- `App.jsx` 需要使用多个hook
- 需要实现"输入tag"的UI对话框
- 需要显示"当前运行容器"状态栏

---

#### 3.3 术语更新

**场景目录重命名**:
```
src/scenarios/F2-file-injection/  →  src/scenarios/F2-file-parsing/
src/scenarios/F3-tool-use/        →  src/scenarios/F3-terminal/
```

**UI文本更新**:
| 旧文本 | 新文本 |
|--------|--------|
| 文件注入 | 文件解析 |
| 工具调用 | 终端运行 |
| Upload File | 📁 上传文件/目录 |
| MCP Tools | MCP工具 (保持不变) |

**影响**:
- 所有场景定义文件需要更新 `capabilityLevel`
- UI组件中的文本需要批量替换
- 文档需要同步更新术语

---

#### 3.4 文件上传功能增强

**旧行为**:
- 只能上传单文件
- 多轮对话中上传功能无效

**新行为**:
- **终端沙箱**: 支持上传单文件或整个目录
- **文件解析**: 仅支持单文件上传
- 修复多轮对话中的上传逻辑

**实现**:
```javascript
// 终端沙箱上传（支持目录）
<input
  type="file"
  webkitdirectory=""
  multiple
  onChange={handleUploadDirectory}
/>

// 文件解析上传（单文件）
<input
  type="file"
  onChange={handleUploadForParsing}
/>
```

**影响**:
- 需要区分两种上传场景的UI
- 后端需要支持目录上传（递归创建文件）

---

### 4. 文档变更

#### 4.1 新增文档

| 文档 | 说明 |
|------|------|
| `docs/CONTAINER-REFACTOR-PLAN.md` | 重构总体设计 |
| `docs/BREAKING-CHANGES.md` | 本文档 |
| `docs/CONTAINERS.md` | 四类容器详细文档 (替代 FILE-PARSER.md) |

#### 4.2 更新文档

| 文档 | 变更说明 |
|------|----------|
| `docs/ARCHITECTURE.md` | 更新容器架构图，增加四类容器说明 |
| `docs/BACKEND.md` | 更新服务列表，增加新的服务模块 |
| `docs/FRONTEND.md` | 更新hook列表，增加四个专用hook |
| `docs/API-REFERENCE.md` | 更新所有API端点 |
| `CLAUDE.md` | 更新项目概览，修改术语 |

#### 4.3 删除文档

| 文档 | 原因 |
|------|------|
| `FILE-PARSER.md` | 被 `CONTAINERS.md` 替代 |

---

## 🔧 迁移指南

### 对于接续工作的开发者

#### 如果你在修改后端代码

1. **不要再使用 `ImageType` 枚举**，改用：
   - `ContainerType` (for 容器类型)
   - `TerminalImage` (for 终端沙箱镜像)

2. **创建容器时传递内存限制**：
   ```python
   # 旧代码
   container_manager.get_or_create_container(ImageType.PYTHON)

   # 新代码
   container_manager.get_or_create_container(
       container_type=ContainerType.TERMINAL,
       image=TerminalImage.PYTHON,
       session_id="terminal-my-test",
       mem_limit="2g"
   )
   ```

3. **文件解析服务**: 使用 `file_parser_service.py` 而不是直接操作容器

4. **RAG服务**: 使用 `rag_service.py`，它内部管理 HTTP 调用

---

#### 如果你在修改前端代码

1. **导入新的常量**：
   ```javascript
   // 旧代码
   import { ImageType } from './sandbox.js';

   // 新代码
   import { ContainerType, TerminalImage } from './sandbox.js';
   ```

2. **使用专用hook**：
   ```javascript
   // 旧代码
   const { startContainer, sandboxStatus } = useSandbox();

   // 新代码
   const { createTerminal, terminalStatus } = useTerminal();
   const { initFileParser, parserStatus } = useFileParser();
   ```

3. **终端沙箱启动前检查单例**：
   ```javascript
   const handleStartTerminal = async () => {
     try {
       const tag = prompt("请输入容器标识 (tag):");
       await createTerminal(TerminalImage.PYTHON, tag);
     } catch (error) {
       alert(error.message);  // "已有运行中的容器..."
     }
   };
   ```

---

#### 如果你在添加新的攻击场景

1. **更新 `capabilityLevel`**：
   ```javascript
   // 旧代码
   capabilityLevel: 'F2-file-injection'

   // 新代码
   capabilityLevel: 'F2-file-parsing'
   ```

2. **文件解析场景**: 使用 `/file-parser/parse` API

3. **终端运行场景**: 确保容器类型是 `terminal-*`

---

## ⚠️ 常见陷阱

### 1. session_id 混淆

**错误做法**:
```python
# 不要再用固定的 "parser" session_id
container_manager.get_or_create_container(session_id="parser")
```

**正确做法**:
```python
# 每种容器有自己的固定session_id
FILE_PARSER_SESSION_ID = "file-parser"
RAG_SESSION_ID = "rag-server"
MCP_SESSION_ID = "mcp-server"
# 终端沙箱的session_id是动态的（基于用户tag）
```

---

### 2. 忘记单例检查（终端沙箱）

**错误做法**:
```javascript
// 前端直接调用创建，不检查是否已有容器
await fetch('/terminal/create', { ... });
```

**正确做法**:
```javascript
// 先检查
const statusRes = await fetch('/terminal/status');
const status = await statusRes.json();

if (status.running) {
  const confirm = window.confirm(
    `已有运行中的容器 [${status.tag}]，是否关闭它？`
  );
  if (confirm) {
    await fetch('/terminal/destroy', { method: 'DELETE' });
  } else {
    return;
  }
}

// 然后创建
await fetch('/terminal/create', { ... });
```

---

### 3. 内存限制不匹配

**错误做法**:
```python
# 给RAG服务分配512MB（不够）
container = client.containers.run(mem_limit="512m")
```

**正确做法**:
```python
# 根据容器类型设置
MEMORY_LIMITS = {
    ContainerType.FILE_PARSER: "1g",
    ContainerType.TERMINAL: "2g",
    ContainerType.RAG: "2g",
    ContainerType.MCP: "2g",
}
```

---

## 📊 变更统计

### 受影响的文件数量（预估）

| 类型 | 新增 | 修改 | 删除 | 重命名 |
|------|-----|------|------|--------|
| Dockerfile | 5 | 1 | 0 | 0 |
| 后端Python | 4 | 6 | 0 | 1 |
| 前端JS/JSX | 4 | 8 | 0 | 2 |
| 文档 | 2 | 6 | 1 | 0 |
| **总计** | **15** | **21** | **1** | **3** |

### 代码行数变化（预估）

- 新增: ~2000 行
- 删除: ~500 行
- 净增长: ~1500 行

---

## 📝 检查清单（用于接续工作）

### Phase 1 完成后检查

- [ ] 所有6个Dockerfile已创建
- [ ] 所有镜像构建成功（无错误）
- [ ] 镜像大小合理（file-parser < 500MB, terminal < 300MB, rag-server < 800MB, mcp-server < 400MB）
- [ ] 每个镜像的CMD可以正常运行

### Phase 2 完成后检查

- [ ] `container.py` 已重命名为 `container_manager.py`
- [ ] 新增了4个专用服务文件
- [ ] `schemas.py` 枚举已更新
- [ ] 所有API路由已重组
- [ ] Python代码通过 `mypy` 类型检查

### Phase 3 完成后检查

- [ ] 前端常量已更新（ContainerType, TerminalImage）
- [ ] 新增了4个专用hook
- [ ] 终端沙箱实现了单例逻辑
- [ ] 文件上传功能已修复
- [ ] UI文本已更新为中文
- [ ] 术语已统一更新

### Phase 4 完成后检查

- [ ] 所有文档已更新
- [ ] 架构图已重绘
- [ ] API文档与实际代码一致
- [ ] 示例代码已更新

### Phase 5 完成后检查

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] F1-F5场景全部可以运行
- [ ] 内存使用符合预期
- [ ] 无Docker容器泄漏

---

## 🆘 遇到问题？

### 构建镜像失败

1. 检查 `backend/dockerfiles/` 目录结构
2. 确保所有COPY路径正确（相对于 `backend/` 目录）
3. 检查依赖版本兼容性

### API调用失败

1. 检查端点路径是否更新（参考"API端点重组"章节）
2. 检查session_id是否使用新的命名规范
3. 查看后端日志: `docker logs <backend-container>`

### 前端容器状态显示错误

1. 检查是否使用了正确的hook
2. 检查API响应格式是否匹配新的schema
3. 打开浏览器控制台查看错误信息

---

## 📞 联系方式

如有疑问，请查阅：
- 设计文档: `docs/CONTAINER-REFACTOR-PLAN.md`
- 容器文档: `docs/CONTAINERS.md`
- 或在项目issue中提问

---

*文档版本: v1.0*
*最后更新: 2026-01-21*
*维护者: Claude Code*
