# Phase 1 当前状态

**更新时间**: 2026-01-21 23:30

---

## ✅ 已完成镜像 (5/6)

| 镜像 | 大小 | 状态 | 说明 |
|------|------|------|------|
| file-parser | 462MB | ✅ 已验证 | 文件解析（F2场景），无状态 |
| terminal-python | 458MB | ✅ 已验证 | Python终端沙箱 |
| terminal-ubuntu | 472MB | ✅ 已验证 | 完整Linux环境 |
| terminal-node | 521MB | ✅ 已验证 | Node.js终端沙箱 |
| mcp-server | 350MB | ✅ 已验证 | MCP协议和数据库操作 |
| **rag-server** | - | ⏳ **构建中** | **完整RAG服务（含文件解析）** |

---

## 🔍 关键理解：file-parser vs rag-server

### file-parser 容器

**用途**: F2-file-parsing 场景
**流程**: 接收文件 → 解析 → 返回文本 → **完成**
**特点**:
- ✅ 无状态，解析后删除文件
- ✅ 不存储任何数据
- ✅ 专注于文件格式转换

**包含组件**:
- Tesseract OCR
- PyMuPDF, pdfplumber, pdf2image, pytesseract
- python-docx, mammoth, openpyxl
- Pillow

**不包含**: ChromaDB, 嵌入模型

---

### rag-server 容器

**用途**: F4-rag 场景
**流程**: 接收文件 → **内部解析** → 向量化 → 存储 → 提供检索
**特点**:
- ✅ 有状态，文档持久化存储
- ✅ 提供HTTP查询接口（端口8080）
- ✅ 完整的RAG服务栈

**包含组件**:
- **文件解析器**（与file-parser相同的组件）
  - Tesseract OCR
  - PyMuPDF, pdfplumber, pdf2image, pytesseract
  - python-docx, mammoth, openpyxl
  - Pillow
- **RAG核心组件**
  - ChromaDB（向量数据库）
  - sentence-transformers（嵌入模型）
  - Flask（HTTP服务）

---

## 📐 架构理解修正

### 最初的错误理解

❌ **错误**：rag-server不包含文件解析器，需要依赖外部file-parser容器
```
用户上传PDF → file-parser解析 → 返回文本 → rag-server向量化
```

### 正确的架构

✅ **正确**：rag-server内部包含完整的文件解析能力
```
用户上传PDF → rag-server接收 → 内部解析 → 向量化 → 存储 → 检索
```

**关键点**：
1. rag-server **自己能解析文件**，不依赖外部容器
2. file-parser 和 rag-server **不混用**，各自独立
3. file-parser用于F2场景（只解析），rag-server用于F4场景（完整RAG）

---

## 🏗️ rag-server 构建状态

**当前状态**: 正在后台构建（任务ID: b73ec52）

**构建步骤**（预计耗时5-10分钟）:
1. ✅ 安装系统依赖（Tesseract, poppler, build-essential）- 进行中
2. ⏳ 安装Python依赖（文件解析库）
3. ⏳ 安装ChromaDB（需要编译）
4. ⏳ 下载嵌入模型（sentence-transformers，约150MB）
5. ⏳ 验证安装

**预计镜像大小**: 1.0 - 1.2 GB
- 文件解析器组件: ~300MB
- ChromaDB + 依赖: ~200MB
- 嵌入模型: ~150MB
- 系统依赖: ~300MB

---

## 📋 构建完成后的验证

### 验证命令

```bash
# 1. 检查镜像是否存在
docker images | grep rag-server

# 2. 验证文件解析能力
docker run --rm rag-server:latest python3 -c '
import fitz
import pdfplumber
import pytesseract
print("✓ File parsers OK")
'

# 3. 验证RAG组件
docker run --rm rag-server:latest python3 -c '
import chromadb
from sentence_transformers import SentenceTransformer
print("✓ RAG components OK")
'

# 4. 验证完整性
docker run --rm rag-server:latest python3 -c '
import fitz
import chromadb
from sentence_transformers import SentenceTransformer
print("✓ Full RAG server ready")
'
```

---

## 🎯 完成后的下一步

### Phase 1 收尾

- [ ] 验证 rag-server 镜像功能完整
- [ ] 更新 `PHASE1-COMPLETE.md` 最终报告
- [ ] 添加 rag-server 到 `build-all-images.sh` 测试清单

### Phase 2 准备

需要修改的后端服务：
1. `backend/app/services/container_rag.py`
   - 切换到 rag-server 镜像
   - session_id 从 "parser" 改为 "rag-server"
   - 确保文件上传到容器后，RAG服务内部解析

2. `backend/app/services/rag_server.py`
   - 添加文件上传和解析接口
   - 集成 file_parsers.py 模块
   - HTTP端点设计：
     - `POST /parse-and-add` - 接收文件，解析并添加到知识库
     - `POST /add` - 接收已解析的文本（保持兼容）
     - `POST /query` - 检索查询
     - `GET /documents` - 列出文档

---

## 📊 总体进度

| 阶段 | 任务 | 状态 | 完成度 |
|------|------|------|--------|
| Phase 1 | Docker镜像重构 | ⏳ 进行中 | 83% (5/6) |
| | - file-parser | ✅ 完成 | 100% |
| | - terminal系列 | ✅ 完成 | 100% |
| | - mcp-server | ✅ 完成 | 100% |
| | - **rag-server** | ⏳ **构建中** | **80%** |
| Phase 2 | 后端服务重构 | ⏸️ 待开始 | 0% |
| Phase 3 | 前端重构 | ⏸️ 待开始 | 0% |
| Phase 4 | 文档更新 | ⏸️ 待开始 | 0% |
| Phase 5 | 测试验证 | ⏸️ 待开始 | 0% |

---

## 📝 重要变更记录

### 2026-01-21 23:30 - 修正rag-server设计

**变更原因**: 用户指出理解错误

**修正前**:
- rag-server 不包含文件解析器
- 依赖外部 file-parser 容器解析文件

**修正后**:
- rag-server **包含完整的文件解析能力**
- 内部处理文件解析，不依赖外部容器
- 与 file-parser 不混用，各自独立服务不同场景

**影响**:
- ✅ Dockerfile.rag-server 已更新（添加文件解析器依赖）
- ✅ 构建脚本无需修改
- ✅ 文档已更新（CONTAINER-REFACTOR-PLAN.md, BREAKING-CHANGES.md）
- ⏳ 正在重新构建镜像

---

*报告生成: 2026-01-21 23:30*
*下次更新: rag-server 构建完成后*
