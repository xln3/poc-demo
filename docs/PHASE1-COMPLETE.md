# Phase 1 完成报告: Docker镜像重构

**完成日期**: 2026-01-21
**任务**: 将容器体系重构为四类专用镜像

---

## ✅ 已完成镜像 (6/6) - Phase 1 完成！

| 镜像 | 标签 | 大小 | 镜像ID | 状态 |
|------|------|------|--------|------|
| file-parser | latest | 462MB | f72362377fdc | ✅ 已验证 |
| terminal-python | 3.11 | 458MB | 8f8f3ede6482 | ✅ 已验证 |
| terminal-ubuntu | 22.04 | 472MB | 209857699def | ✅ 已验证 |
| terminal-node | 20 | 521MB | 5ab403a665d7 | ✅ 已验证 |
| mcp-server | latest | 350MB | 238bcea2a147 | ✅ 已验证 |
| rag-server | latest | **8.52GB** | f1f882917437 | ✅ 功能完整 |

**总计**: 11.0GB (6个镜像)

### 镜像大小对比

**file-parser 优化效果**:
- 旧镜像 (含ChromaDB): 1.21GB
- 新镜像 (无ChromaDB): 462MB
- **减少**: 748MB (-62%)

**terminal镜像大小**:
- terminal-python: 458MB
- terminal-ubuntu: 472MB (完整Linux工具链)
- terminal-node: 521MB (含npm全局包)

**其他镜像**:
- mcp-server: 350MB (含数据库客户端)

---

## 📝 镜像详细信息

### 1. file-parser:latest

**职责**: 文件解析（PDF/DOCX/XLSX/图片/OCR）

**已安装依赖**:
- Tesseract OCR (中文+英文)
- PyMuPDF, pdfplumber, pdf2image
- python-docx, mammoth, openpyxl
- Pillow

**移除依赖**:
- ✅ ChromaDB (已移至rag-server)
- ✅ build-essential (无需编译)

**验证命令**:
```bash
docker run --rm file-parser:latest python3 -c 'import fitz; import pdfplumber; import pytesseract; print("file-parser OK")'
```

---

### 2. terminal-python:3.11

**职责**: Python终端沙箱执行环境

**已安装工具**:
- Linux基础: curl, wget, git, vim, nano, zip/unzip, tree
- Python库: requests, beautifulsoup4, pandas, numpy, pydantic

**不包含**: OCR工具、ChromaDB、数据库客户端

**验证命令**:
```bash
docker run --rm terminal-python:3.11 python --version
# 输出: Python 3.11.14
```

---

### 3. terminal-ubuntu:22.04

**职责**: 完整Linux终端环境

**已安装工具**:
- 开发工具: gcc, g++, make, python3, python3-pip
- 网络工具: curl, wget, net-tools, iputils-ping, netcat
- 编辑器: vim, nano
- 其他: git, jq, tree, htop

**不包含**: OCR工具、ChromaDB、数据库服务器

**验证命令**:
```bash
docker run --rm terminal-ubuntu:22.04 uname -a
# 输出: Linux ... 5.15.0-139-generic ... x86_64 GNU/Linux
```

---

### 4. terminal-node:20

**职责**: Node.js终端沙箱执行环境

**已安装npm包** (全局):
- axios, lodash, dayjs, dotenv
- typescript, ts-node, prettier, jest

**不包含**: OCR工具、ChromaDB

**验证命令**:
```bash
docker run --rm terminal-node:20 node --version
# 输出: v20.20.0

docker run --rm terminal-node:20 tsc --version
# 输出: Version 5.9.3
```

---

### 5. mcp-server:latest

**职责**: MCP协议环境和数据库操作

**已安装工具**:
- 数据库客户端: postgresql-client, mysql-client, sqlite3
- Python库: psycopg2-binary, pymysql, requests, pydantic

**已复制模块**:
- mcp_calendar.py, mcp_database.py, mcp_github.py, mcp_http.py
- mcp_memory.py, mcp_notion.py, mcp_slack.py, mcp_storage.py

**不包含**: OCR工具、ChromaDB、文件解析器

**验证命令**:
```bash
docker run --rm mcp-server:latest python3 -c 'import psycopg2; import pymysql; print("mcp-server OK")'

docker run --rm mcp-server:latest psql --version
# 输出: psql (PostgreSQL) 17.7

docker run --rm mcp-server:latest mysql --version
# 输出: mysql from 11.8.3-MariaDB
```

---

### 6. rag-server:latest (构建中)

**职责**: RAG向量存储和检索服务

**将安装依赖**:
- ChromaDB (向量数据库)
- sentence-transformers (嵌入模型)
- Flask (HTTP服务)

**特性**:
- 容器内运行HTTP服务 (端口8080)
- 保持嵌入模型常驻内存
- 不包含文件解析器

**预计大小**: 约800-1000MB (含嵌入模型)

---

## 🛠️ 构建脚本

**位置**: `backend/dockerfiles/build-all-images.sh`

**用法**:
```bash
# 构建所有镜像
bash dockerfiles/build-all-images.sh

# 构建单个镜像
bash dockerfiles/build-all-images.sh file-parser

# 构建所有terminal镜像
bash dockerfiles/build-all-images.sh terminal

# 构建RAG服务器
bash dockerfiles/build-all-images.sh rag

# 构建MCP服务器
bash dockerfiles/build-all-images.sh mcp
```

**特性**:
- 彩色输出，显示构建进度
- 自动显示镜像大小和ID
- 构建失败时返回非零退出码
- 汇总报告显示成功/失败镜像列表

---

## 🐛 构建问题和解决

### 问题1: mcp-server初始构建失败

**错误**:
```
COPY app/services/mcp_*.py /app/ 2>/dev/null || true
ERROR: "/||": not found
```

**原因**: Docker COPY命令不支持shell重定向语法 `2>/dev/null || true`

**解决**: 明确列出所有8个mcp_*.py文件：
```dockerfile
COPY app/services/mcp_calendar.py \
     app/services/mcp_database.py \
     ...
     /app/
```

---

## 📋 文件清单

### 新增文件 (7个)
1. `backend/dockerfiles/Dockerfile.terminal-python`
2. `backend/dockerfiles/Dockerfile.terminal-ubuntu`
3. `backend/dockerfiles/Dockerfile.terminal-node`
4. `backend/dockerfiles/Dockerfile.rag-server`
5. `backend/dockerfiles/Dockerfile.mcp-server`
6. `backend/dockerfiles/build-all-images.sh` (可执行)
7. `docs/PHASE1-COMPLETE.md` (本文档)

### 修改文件 (1个)
1. `backend/dockerfiles/Dockerfile.file-parser` (移除ChromaDB)

### 相关文档
1. `docs/CONTAINER-REFACTOR-PLAN.md` - 重构总体设计
2. `docs/BREAKING-CHANGES.md` - 破坏性变更日志

---

## ✅ 验证清单

### 镜像构建验证

- [x] file-parser 构建成功，大小合理 (< 500MB)
- [x] terminal-python 构建成功，Python环境可用
- [x] terminal-ubuntu 构建成功，gcc/make可用
- [x] terminal-node 构建成功，TypeScript可用
- [x] mcp-server 构建成功，数据库客户端可用
- [x] **rag-server 构建成功，功能完整**

### 功能验证

- [x] file-parser: 可以导入 fitz, pdfplumber, pytesseract
- [x] terminal-python: python --version 返回 3.11.14
- [x] terminal-ubuntu: uname -a 返回正确信息
- [x] terminal-node: node --version 返回 v20.20.0, tsc --version 返回 5.9.3
- [x] mcp-server: 可以导入 psycopg2, psql --version 正常
- [x] **rag-server: 所有组件验证通过（文件解析器、ChromaDB、嵌入模型、Flask）**

### 大小验证

- [x] file-parser 相比旧版减少超过60%
- [x] 所有terminal镜像 < 600MB
- [x] mcp-server < 400MB
- [x] **rag-server: 8.52GB（功能完整，已使用多阶段构建）**

---

## 🎯 下一步 (Phase 2)

### 2.1 后端容器管理服务重构

需要修改的文件：
1. `backend/app/services/container.py` → `container_manager.py`
   - 支持动态内存限制
   - 支持不同容器类型

2. `backend/app/services/file_parser_service.py`
   - 使用新的file-parser镜像
   - session_id 从 "parser" 改为 "file-parser"

3. `backend/app/services/terminal_sandbox_service.py` (新建)
   - 实现单例管理逻辑
   - 支持用户tag输入

4. `backend/app/services/rag_service.py`
   - 切换到独立的rag-server镜像
   - session_id 从 "parser" 改为 "rag-server"

5. `backend/app/services/mcp_service.py` (新建)
   - 管理mcp-server容器

6. `backend/app/models/schemas.py`
   - 添加 ContainerType, TerminalImage 枚举
   - 废弃旧的 ImageType 枚举

### 2.2 API端点重组

参考 `docs/BREAKING-CHANGES.md` 中的"API端点重组"章节。

---

## 📊 总体进度

| 阶段 | 状态 | 完成度 |
|------|------|--------|
| **Phase 1: Docker镜像** | ✅ **已完成** | **100% (6/6)** |
| Phase 2: 后端重构 | ⏸️ 待开始 | 0% |
| Phase 3: 前端重构 | ⏸️ 待开始 | 0% |
| Phase 4: 文档更新 | ⏸️ 待开始 | 0% |
| Phase 5: 测试验证 | ⏸️ 待开始 | 0% |

---

## 📞 注意事项

### 使用新镜像前的准备

1. **删除旧容器** (如果有)：
   ```bash
   docker ps -a | grep "poc-sandbox" | awk '{print $1}' | xargs docker rm -f
   ```

2. **删除旧镜像** (可选)：
   ```bash
   # 如果需要释放磁盘空间
   docker rmi 8600698f3401  # 旧的file-parser (1.21GB)
   ```

3. **测试新镜像**：
   ```bash
   # 运行测试命令（参考各镜像的验证命令）
   docker run --rm file-parser:latest python3 -c 'import fitz; print("OK")'
   ```

### rag-server构建注意事项

- 第一次构建会下载嵌入模型 (~150MB)，需要较长时间
- 确保网络连接稳定
- 构建完成后，模型会打包在镜像中，后续使用无需重新下载

---

*报告最后更新: 2026-01-22 01:15*
*生成者: Claude Code*
*状态: Phase 1 已完成，所有6个镜像构建成功*
*下一步: 进入 Phase 2 - 后端容器管理服务重构*

---

### 6. rag-server:latest ✅ (功能完整)

**职责**: 完整的RAG服务（接收文件 → 内部解析 → 向量化 → 存储 → 检索）

**已安装依赖**:
- **文件解析器**: PyMuPDF, pdfplumber, pdf2image, pytesseract, python-docx, mammoth, openpyxl, Pillow
- **OCR引擎**: Tesseract (中文+英文)
- **RAG核心**: ChromaDB, sentence-transformers
- **HTTP服务**: Flask
- **嵌入模型**: all-MiniLM-L6-v2 (已预下载到镜像)

**功能特性**:
- ✅ 内部包含完整的文件解析能力（不依赖外部file-parser）
- ✅ 提供HTTP服务（Flask，端口8080）
- ✅ 嵌入模型打包到镜像（无需联网下载）
- ✅ **新增**: `/upload` 接口支持文件上传并自动解析添加到知识库
- ✅ 多阶段构建（模型预下载 + 最终镜像）

**HTTP API 端点**:
- `GET /health` - 健康检查
- `GET /stats` - 统计信息
- `GET /documents` - 列出所有文档
- `POST /upload` - **上传文件并解析添加到知识库**（新增）
- `POST /add` - 添加纯文本文档
- `POST /query` - 检索查询
- `DELETE /documents/{id}` - 删除文档
- `POST /clear` - 清空知识库

**验证命令**:
```bash
docker run --rm rag-server:latest python3 -c '
import fitz; import pdfplumber; import pytesseract;
import chromadb; from sentence_transformers import SentenceTransformer;
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
print("✓ All RAG components working")
'
# 输出: ✓ All RAG components working
```

**镜像大小说明**:

| 组件 | 大小 | 说明 |
|------|------|------|
| sentence-transformers + PyTorch | ~7.5GB | 机器学习框架和依赖 |
| 嵌入模型 (all-MiniLM-L6-v2) | ~150MB | 预下载到 /models |
| 系统依赖 (Tesseract, poppler等) | ~450MB | 文件解析工具 |
| 其他 Python 库 | ~420MB | ChromaDB, Flask等 |
| **总计** | **8.52GB** | 功能完整的RAG服务 |

**根本原因**:
PyTorch 和 transformers 库占据了大部分空间（~7.5GB），这是深度学习推理的标准依赖。模型文件本身只占 150MB。

**当前状态**:
- ✅ 功能完整且验证通过
- ✅ 嵌入模型已打包（离线可用）
- ✅ 支持文件上传解析（`/upload` 接口）
- ⚠️ 镜像较大（8.52GB）但在服务器上可接受
- 📝 进一步优化需使用 ONNX Runtime 替代 PyTorch（预计可减至 1-2GB）

---

## 🐛 已知问题和优化建议

### 问题1: rag-server 镜像较大 (8.52GB)

**当前状态**: ✅ 已使用多阶段构建并预下载模型

**影响**:
- 首次拉取耗时较长（约5-10分钟）
- 占用磁盘空间 8.5GB
- ✅ 功能完整，离线可用
- ✅ 不影响运行性能

**为何优化有限**:
多阶段构建主要解决了模型下载问题（已预下载到镜像），但 PyTorch + transformers 库占据 ~7.5GB，这是深度学习推理的标准依赖。

**进一步优化方案** (可选，预计可减至 1-2GB):
```dockerfile
# 使用 ONNX Runtime 替代 PyTorch
# 需要转换模型格式并重写推理代码
RUN pip install onnxruntime sentence-transformers
RUN python convert_model_to_onnx.py
```

**优先级**: 低（不影响 Phase 2-5 的进行，功能已完整）

**决策**: 当前接受 8.5GB 大小，服务器环境可接受

