# RAG 实现架构说明

## 概述

本项目实现了一个完整的 RAG（Retrieval-Augmented Generation，检索增强生成）系统，用于演示 LLM Agent 的安全攻击场景。

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         RAG 系统架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐              ┌─────────────────────────┐      │
│  │  前端 React  │   HTTP/WS    │     后端 FastAPI        │      │
│  ├──────────────┤   ────────→  ├─────────────────────────┤      │
│  │ src/rag.js   │   ←────────  │ routers/rag.py (API)    │      │
│  │ src/App.jsx  │              │ services/container_rag  │      │
│  │ Vite 代理    │              │ services/rag_service    │      │
│  └──────────────┘              └───────────┬─────────────┘      │
│                                            │                     │
│                                            ↓                     │
│                                 ┌─────────────────────┐         │
│                                 │   Docker 容器       │         │
│                                 ├─────────────────────┤         │
│                                 │ rag_cli.py          │         │
│                                 │ ChromaDB 向量库     │         │
│                                 │ 文件解析器          │         │
│                                 │ /data/chromadb      │         │
│                                 └─────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + Vite | UI 交互 |
| 后端 | FastAPI + Pydantic | API 服务 |
| 向量存储 | ChromaDB | 向量数据库 |
| 嵌入模型 | all-MiniLM-L6-v2 | 文本向量化 |
| 文件解析 | PyMuPDF, python-docx, openpyxl, pytesseract | 多格式支持 |
| 容器化 | Docker (file-parser:latest) | 隔离执行 |

## 核心文件

```
backend/
├── app/
│   ├── routers/
│   │   └── rag.py                 # API 路由 (8 个端点)
│   ├── services/
│   │   ├── rag_service.py         # 本地 RAG 服务
│   │   ├── container_rag.py       # 容器化 RAG 服务
│   │   ├── rag_cli.py             # 容器内 CLI
│   │   └── container_parser.py    # 文件解析服务
│   └── models/
│       └── rag_schemas.py         # 数据模型
└── docker/
    └── preset-data/               # 预置知识库

src/
├── rag.js                         # 前端 RAG 客户端
└── scenarios/F4-rag/              # RAG 攻击场景
```

## API 端点

| 方法 | 端点 | 功能 |
|------|------|------|
| GET | `/rag/health` | 健康检查 |
| POST | `/rag/init` | 初始化并导入预置数据 |
| POST | `/rag/reset` | 重置为预置数据 |
| POST | `/rag/upload` | 上传文件 |
| POST | `/rag/ingest` | 直接输入文本 |
| POST | `/rag/query` | 向量查询 |
| GET | `/rag/documents` | 列出所有文档 |
| DELETE | `/rag/documents/{id}` | 删除文档 |

## 数据流

### 文档上传流程

```
1. 用户选择文件 (前端)
   │
   ↓
2. ragClient.upload(file)
   │
   ↓
3. POST /rag/upload (后端 API)
   │
   ├── 解析文件内容 (PDF/DOCX/XLSX/Image → 文本)
   │
   ↓
4. 文本分块 (容器内 rag_cli.py)
   │
   ├── 块大小: 500 字符
   ├── 重叠: 50 字符
   └── 在句子边界智能分割 (。！？.!?\n)
   │
   ↓
5. 向量化存储 (ChromaDB)
   │
   ├── 嵌入模型: all-MiniLM-L6-v2
   ├── 生成文档 ID: UUID[:8]
   └── 存储: chunk_ids, documents, metadatas
```

### 查询流程

```
1. ragClient.query(queryText, topK=3)
   │
   ↓
2. POST /rag/query (后端 API)
   │
   ↓
3. ChromaDB 向量检索 (容器内)
   │
   ├── queryText 向量化
   ├── 余弦相似度匹配
   └── 返回 top_k 结果
   │
   ↓
4. 返回结果
   {
     "results": [
       {
         "chunk_id": "doc_id_chunk_0",
         "content": "文档片段",
         "score": 0.95,           # 相似度 (0-1)
         "source_name": "来源",
         "chunk_index": 0
       }
     ]
   }
```

## ChromaDB 存储结构

```
Collection: "rag_documents"
├── Metadata: {"hnsw:space": "cosine"}
└── Items:
    ├── IDs: "{document_id}_chunk_{index}"
    ├── Documents: 文本块内容
    └── Metadatas:
        ├── document_id: 文档唯一标识
        ├── source_name: 来源名称
        ├── document_type: 类型 (text/pdf/docx/xlsx/image)
        ├── chunk_index: 分块索引
        ├── total_chunks: 总分块数
        └── created_at: 创建时间
```

## 前端集成示例

```javascript
import { ragClient, formatRAGContext } from './rag.js';

// 1. 检查服务状态
const health = await ragClient.healthCheck();

// 2. 上传文档
const uploadResult = await ragClient.upload(file);

// 3. 查询知识库
const queryResult = await ragClient.query('用户问题', 3);

// 4. 格式化为 LLM 上下文
const context = formatRAGContext(queryResult.results, 2000);
// 输出: "[检索到的上下文]\n[来源: xxx] 内容..."

// 5. 融入 LLM 调用
const response = await callLLM({
  messages: [{
    role: 'user',
    content: userQuery + '\n' + context
  }]
});
```

## 设计特点

### 1. 容器隔离
- RAG 服务运行在独立 Docker 容器内
- 解决主机依赖问题 (tesseract, poppler 等)
- 数据隔离和安全

### 2. 智能分块
- 固定大小分割 (500 字符)
- 块间重叠 (50 字符) 保持上下文连贯
- 句子边界智能分割

### 3. 双模式架构
- `rag_service.py` - 本地开发模式
- `container_rag.py` - 生产容器模式

### 4. 元数据追踪
- 文档来源、类型、创建时间
- 分块索引和总数
- 支持自定义元数据

## 安全攻击演示

项目包含 8 个 RAG 安全测试场景 (`src/scenarios/F4-rag/`):

| ID | 攻击名称 | 类型 | 风险 |
|----|---------|------|------|
| R1 | 恶意文档注入 | Integrity | CRITICAL |
| R2 | 知识库投毒 | Integrity | HIGH |
| R3 | 检索操控攻击 | Integrity | HIGH |
| R4 | 查询式数据提取 | Confidentiality | HIGH |
| R5 | 上下文泄露 | Confidentiality | MEDIUM |
| R6 | 检索过载攻击 | Availability | MEDIUM |
| R7 | 文档越狱 | Jailbreak | CRITICAL |
| R8 | 上下文覆盖攻击 | Jailbreak | HIGH |

预置测试数据位于 `backend/docker/preset-data/`:
- `normal-policy.txt` - 正常政策文档
- `poisoned-policy.txt` - 投毒文档（隐藏指令）
- `sensitive-data.txt` - 敏感数据
- `jailbreak-doc.txt` - 越狱文档

## 启动方式

```bash
# 1. 启动后端 (包含 RAG 服务)
cd backend && ./run.sh

# 2. 启动前端
npm run dev

# 3. 在 UI 中切换到 "真实测试" 模式
# 4. 启用 RAG 功能，选择 "Real" 模式
```
