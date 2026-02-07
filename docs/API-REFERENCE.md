# API 接口文档

本文档详细说明后端 API 接口的请求和响应格式。

**基础 URL**: `http://localhost:port`

**API 文档（Swagger）**: `http://localhost:port/docs`

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "detail": "错误信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如 tag 已被使用） |
| 413 | 请求体过大（如文件超出大小限制） |
| 401 | 未认证（缺少或无效的 JWT token） |
| 403 | 权限不足（需要更高角色） |
| 500 | 服务器内部错误 |

---

## 认证

除 health 端点和 `/auth/*` 外，所有 API 端点均需要 JWT Bearer Token 认证。

### 请求头

```
Authorization: Bearer <token>
```

### 获取 Token

**POST** `/auth/login`

**请求体**:
```json
{
  "username": "user",
  "password": "password"
}
```

**响应**:
```json
{
  "access_token": "eyJhbGciOiJI...",
  "token_type": "bearer"
}
```

### 认证失败

未提供 token 或 token 无效时返回：

```json
HTTP 401
{
  "detail": "Authentication required"
}
```

### 免认证端点

| 端点 | 说明 |
|------|------|
| `GET /` | 根路径 |
| `GET /health` | 全局健康检查 |
| `GET /sandbox/health` | 沙箱健康检查 |
| `GET /rag/health` | RAG 健康检查 |
| `GET /mcp/health` | MCP 健康检查 |
| `GET /file-parser/health` | 文件解析健康检查 |
| `POST /auth/login` | 登录 |
| `POST /auth/register` | 注册 |

### WebSocket 认证

WebSocket 端点通过 URL query parameter 传递 token：

```
ws://host/sandbox/logs/{session_id}?token=<jwt_token>
```

---

## Sandbox API — 需认证

多终端沙箱管理 API。每个终端对应一个独立的 Docker 容器，通过 `tag` 标识。

### 终端管理

#### 创建终端

**POST** `/sandbox/terminals`

创建一个新的终端容器。

**请求体**:
```json
{
  "tag": "my-terminal",
  "image": "terminal-python:3.11"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `tag` | `string` | 是 | 终端标识，用于后续操作 |
| `image` | `string` | 否 | 容器镜像，默认 `terminal-python:3.11` |

**可选镜像**:
- `terminal-python:3.11`
- `terminal-ubuntu:22.04`
- `terminal-node:20`

**响应**:
```json
{
  "tag": "my-terminal",
  "session_id": "abc12345",
  "container_id": "d4e5f6g7h8i9",
  "image": "terminal-python:3.11",
  "status": "running",
  "created_at": "2026-01-21T10:30:00.000Z",
  "mount_path": "/data/terminals/my-terminal",
  "size_bytes": null
}
```

**错误**:
- `400`: tag 格式无效
- `409`: tag 已被使用

---

#### 列出所有终端

**GET** `/sandbox/terminals`

**响应**:
```json
{
  "terminals": [
    {
      "tag": "my-terminal",
      "session_id": "abc12345",
      "container_id": "d4e5f6g7h8i9",
      "image": "terminal-python:3.11",
      "status": "running",
      "created_at": "2026-01-21T10:30:00.000Z",
      "mount_path": "/data/terminals/my-terminal",
      "size_bytes": 102400
    }
  ],
  "count": 1
}
```

---

#### 获取终端状态

**GET** `/sandbox/terminals/{tag}`

**响应**: 同创建终端的响应格式（`TerminalInfo`）。

**错误**:
- `404`: 终端不存在

---

#### 销毁终端

**DELETE** `/sandbox/terminals/{tag}`

**响应**:
```json
{
  "success": true,
  "message": "终端 'my-terminal' 已销毁"
}
```

**错误**:
- `404`: 终端不存在

---

### 工具执行

#### 在终端中执行工具

**POST** `/sandbox/terminals/{tag}/tool`

**请求体**:
```json
{
  "tool": "read_file",
  "params": {
    "path": "/workspace/test.txt"
  }
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `tool` | `string` | 是 | 工具名称（ToolType 枚举值） |
| `params` | `object` | 是 | 工具参数 |

**工具及参数**:

| 工具 | 参数 |
|------|------|
| `read_file` | `{path: string}` |
| `write_file` | `{path: string, content: string, is_base64?: boolean}` |
| `run_command` | `{command: string}` |
| `list_dir` | `{path?: string}` |
| `http_request` | `{url: string, method?: string, headers?: object, body?: string}` |
| `query_database` | `{query: string, database?: string}` |
| `send_email` | `{to: string, subject?: string, body?: string}` |
| `get_system_info` | `{}` |
| `access_secret` | `{name: string, namespace?: string}` |

**响应**:
```json
{
  "success": true,
  "tool": "read_file",
  "result": "文件内容...",
  "error": null,
  "execution_time_ms": 45
}
```

**错误**:
- `404`: 终端不存在
- `400`: 容器未运行

---

### 文件操作

#### 获取文件列表

**GET** `/sandbox/terminals/{tag}/files`

| 参数 | 类型 | 位置 | 默认 | 说明 |
|------|------|------|------|------|
| `path` | `string` | query | `/workspace` | 目录路径 |
| `recursive` | `boolean` | query | `false` | 是否递归列出 |

**响应**:
```json
{
  "path": "/workspace",
  "entries": [
    {
      "name": "test.txt",
      "type": "file",
      "size": 1024,
      "modified": "2026-01-21T10:30:00"
    }
  ],
  "total": 1
}
```

**错误**:
- `404`: 终端不存在
- `400`: 容器未运行

---

#### 上传文件

**POST** `/sandbox/terminals/{tag}/files`

**请求**: `multipart/form-data`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file` | `file` | 是 | 要上传的文件 |
| `path` | `string` | 否 | 目标目录路径，默认 `/workspace` |

**请求头** (可选):

| Header | 说明 |
|--------|------|
| `X-Source` | 上传来源标识（如 `ui`、`api`） |

**响应**:
```json
{
  "success": true,
  "path": "/workspace/test.txt",
  "size": 1024,
  "source": "api"
}
```

**错误**:
- `400`: 路径包含 `..` 或不在允许路径范围内
- `404`: 终端不存在
- `413`: 文件过大

---

#### 下载文件

**GET** `/sandbox/terminals/{tag}/files/download`

| 参数 | 类型 | 位置 | 必需 | 说明 |
|------|------|------|------|------|
| `path` | `string` | query | 是 | 文件或目录路径 |

单文件返回 `application/octet-stream`；目录返回 `application/x-tar` 归档。

**错误**:
- `400`: 路径包含 `..`
- `404`: 终端不存在

---

### 终端锁

提供终端独占锁机制，防止多用户同时操作同一终端。

#### 获取锁

**POST** `/sandbox/terminals/{tag}/lock`

**请求体**:
```json
{
  "user_id": "uuid-string"
}
```

**响应**:
```json
{
  "success": true,
  "holder": "uuid-string",
  "holder_ip": "192.168.1.1",
  "message": "锁获取成功"
}
```

**错误**:
- `404`: 终端不存在

---

#### 释放锁

**DELETE** `/sandbox/terminals/{tag}/lock`

| 参数 | 类型 | 位置 | 必需 | 说明 |
|------|------|------|------|------|
| `user_id` | `string` | query | 是 | 用户标识 |

**响应**:
```json
{
  "success": true,
  "message": "锁已释放"
}
```

---

#### 锁心跳续期

**POST** `/sandbox/terminals/{tag}/lock/heartbeat`

前端应每 30 秒调用一次以保持锁有效。

**请求体**:
```json
{
  "user_id": "uuid-string"
}
```

---

#### 查询锁状态

**GET** `/sandbox/terminals/{tag}/lock`

**响应**:
```json
{
  "locked": true,
  "holder": "uuid-string",
  "holder_ip": "192.168.1.1",
  "acquired_at": "2026-01-21T10:30:00.000Z",
  "expired": false,
  "is_same_ip": true
}
```

`is_same_ip` 字段通过比对请求者 IP 与持锁者 IP 自动计算。

---

### 已删除终端管理

#### 列出已删除终端

**GET** `/sandbox/deleted-terminals`

**响应**:
```json
{
  "terminals": [
    {
      "original_tag": "old-terminal",
      "deleted_at": "2026-01-21T10:30:00.000Z",
      "path": "/data/deleted/old-terminal-20260121",
      "size_bytes": 51200
    }
  ],
  "count": 1,
  "total_size_bytes": 51200
}
```

---

#### 清理单个已删除终端

**DELETE** `/sandbox/deleted-terminals/{name}`

`name` 为已删除终端的目录名（格式: `{tag}-{timestamp}`）。

**响应**:
```json
{
  "cleaned_count": 1,
  "freed_bytes": 51200,
  "errors": []
}
```

---

#### 清理所有已删除终端

**DELETE** `/sandbox/deleted-terminals`

| 参数 | 类型 | 位置 | 必需 | 说明 |
|------|------|------|------|------|
| `confirm` | `boolean` | query | 是 | 必须为 `true` 才会执行 |

**响应**:
```json
{
  "cleaned_count": 3,
  "freed_bytes": 153600,
  "errors": []
}
```

**错误**:
- `400`: 未传入 `confirm=true`

---

### WebSocket

#### 实时日志流

**WS** `/sandbox/logs/{session_id}`

实时接收沙箱日志。

**消息格式**:
```json
{
  "type": "tool",
  "content": "Executing: ls -la",
  "status": "normal",
  "timestamp": "2026-01-21T10:30:00.000Z",
  "details": {}
}
```

**心跳消息**（每 30 秒）:
```json
{"type": "heartbeat"}
```

---

#### 文件变更监控

**WS** `/sandbox/terminals/{tag}/watch`

| 参数 | 类型 | 位置 | 默认 | 说明 |
|------|------|------|------|------|
| `path` | `string` | query | `/workspace` | 监控路径 |

使用 `inotifywait` 监控文件变化，通过 WebSocket 推送事件。

**连接成功消息**:
```json
{
  "type": "watching",
  "path": "/workspace",
  "timestamp": "2026-01-21T10:30:00.000Z"
}
```

**文件变更事件**: 由 inotifywait 产生的事件数据。

**心跳消息**（每 30 秒）:
```json
{"type": "heartbeat"}
```

**关闭码**:
- `4004`: 终端不存在
- `4000`: 终端未运行

---

### 兼容旧接口

#### 执行工具（Legacy）

**POST** `/sandbox/tool`

通过 `session_id` 查找容器并执行工具。新代码应使用 `/sandbox/terminals/{tag}/tool`。

**请求体**:
```json
{
  "session_id": "abc12345",
  "tool": "read_file",
  "params": {
    "path": "/workspace/test.txt"
  }
}
```

**响应**: 同 `/sandbox/terminals/{tag}/tool`。

---

## Datasets API — 需认证

测试数据集管理 API。支持 Schema v2.2.0（Benchmark 数据）。

### 列出数据集

**GET** `/datasets`

**响应**:
```json
[
  {
    "id": "ds_abc123",
    "savedAt": "2026-01-21T10:30:00.000Z",
    "schemaVersion": "2.2.0",
    "name": "基础安全测试集",
    "description": "覆盖四大攻击类型的基础测试用例",
    "caseCount": 20,
    "totalSize": 10240,
    "capabilities": ["F1", "F2"],
    "source": {
      "type": "manual",
      "reference": null,
      "url": null
    },
    "tags": ["基础", "安全"]
  }
]
```

---

### 创建数据集

**POST** `/datasets`

**请求体**:
```json
{
  "meta": {
    "schemaVersion": "2.2.0",
    "name": "数据集名称",
    "description": "数据集描述",
    "caseCount": 0,
    "totalSize": 0,
    "capabilities": ["F1"],
    "source": {
      "type": "manual",
      "reference": null,
      "url": null
    },
    "tags": ["标签"]
  },
  "cases": [
    {
      "id": "case-001",
      "name": "测试用例",
      "capability": "F1",
      "input": { /* TestInput */ },
      "criteria": {
        "expectedBehavior": "...",
        "riskLevelConditions": { /* ... */ },
        "referenceAnswer": "标准答案（v2.2.0 新增）",
        "answerFormat": "exact_match",
        "referenceCode": {
          "language": "c",
          "filename": "test.c",
          "content": "...",
          "description": "..."
        }
      },
      "recording": null,
      "benchmarkMeta": {
        "benchmarkName": "CyberSecEval2",
        "benchmarkVersion": "1.0.0",
        "source": {
          "evalId": "...",
          "runId": "...",
          "taskName": "...",
          "taskVersion": "1.0.0",
          "sampleId": "1",
          "datasetName": "..."
        },
        "customFields": {}
      }
    }
  ]
}
```

**Schema v2.2.0 新增字段**（所有字段可选）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `criteria.referenceAnswer` | `string` | 标准答案（用于自动评分） |
| `criteria.answerFormat` | `string` | 答案格式：`exact_match`, `regex`, `semantic_similarity` |
| `criteria.referenceCode` | `object` | 目标代码（用于漏洞测试） |
| `benchmarkMeta` | `object` | Benchmark 溯源信息 |
| `input.capabilities.sandbox.buildCommands` | `array` | 编译命令 |
| `recording.result.tokenUsage` | `object` | Token 统计 |
| `recording.result.evaluation` | `object` | 评分详情 |

**响应**: 返回完整数据集（含生成的 `id` 和 `savedAt`）。

---

### 获取数据集详情

**GET** `/datasets/{dataset_id}`

**响应**:
```json
{
  "id": "ds_abc123",
  "savedAt": "2026-01-21T10:30:00.000Z",
  "meta": {
    "schemaVersion": "2.2.0",
    "name": "数据集名称",
    "description": "...",
    "caseCount": 5,
    "totalSize": 2048,
    "capabilities": ["F1"],
    "source": {...},
    "tags": [...]
  },
  "cases": [ /* 包含 v2.2.0 新增字段的 case 数组 */ ]
}
```

**错误**:
- `404`: 数据集不存在

---

### 更新数据集

**PUT** `/datasets/{dataset_id}`

**请求体**（所有字段可选）:
```json
{
  "name": "新名称",
  "description": "新描述",
  "tags": ["新标签"],
  "capabilities": ["F1", "F3"],
  "source": {
    "type": "paper",
    "reference": "论文引用",
    "url": "https://example.com"
  }
}
```

**响应**: 返回更新后的完整数据集。

**错误**:
- `404`: 数据集不存在

---

### 删除数据集

**DELETE** `/datasets/{dataset_id}`

**响应**:
```json
{
  "success": true,
  "message": "Dataset ds_abc123 deleted"
}
```

**错误**:
- `404`: 数据集不存在

---

### 数据集用例管理

#### 列出用例

**GET** `/datasets/{dataset_id}/cases`

**响应**: 返回用例数组。

**错误**:
- `404`: 数据集不存在

---

#### 添加用例

**POST** `/datasets/{dataset_id}/cases`

**请求体**:
```json
{
  "id": "case-001",
  "name": "用例名称",
  "capability": "F1",
  "input": {
    "systemPrompt": "...",
    "payload": "..."
  },
  "criteria": {
    "expectedBehavior": "期望行为",
    "riskLevelConditions": {
      "high": "高风险条件",
      "medium": "中风险条件",
      "low": "低风险条件",
      "safe": "安全条件"
    }
  }
}
```

**响应**:
```json
{
  "success": true,
  "caseId": "case-001",
  "caseCount": 6
}
```

**错误**:
- `404`: 数据集不存在

---

#### 获取单个用例

**GET** `/datasets/{dataset_id}/cases/{case_id}`

**响应**: 返回用例对象。

**错误**:
- `404`: 用例不存在

---

#### 删除用例

**DELETE** `/datasets/{dataset_id}/cases/{case_id}`

**响应**:
```json
{
  "success": true,
  "caseCount": 4
}
```

**错误**:
- `404`: 数据集或用例不存在

---

## Report Templates API — 需认证

报告模板管理 API。模板存储在 `backend/data/report-templates/` 目录。

### 列出模板

**GET** `/report-templates`

**响应**:
```json
[
  {
    "id": "default",
    "name": "默认报告模板",
    "default": true
  },
  {
    "id": "detailed",
    "name": "详细报告模板",
    "default": false
  }
]
```

---

### 获取模板内容

**GET** `/report-templates/{template_id}`

**响应**:
```json
{
  "id": "default",
  "name": "默认报告模板",
  "content": "# 测试报告\n\n## 概述\n...",
  "default": true
}
```

**错误**:
- `404`: 模板不存在或模板文件不存在

---

## RAG API — 需认证（health 除外）

### 健康检查

**GET** `/rag/health`

**响应**:
```json
{
  "status": "healthy",
  "embedding_model": "text-embedding-ada-002",
  "embedding_available": true,
  "parser_available": true,
  "document_count": 10,
  "chunk_count": 45
}
```

`status` 可选值: `healthy`、`degraded`、`unhealthy`

---

### 初始化知识库

**POST** `/rag/init`

清空并导入预置测试数据。

**响应**:
```json
{
  "success": true,
  "preset_documents_loaded": 5,
  "message": "初始化完成"
}
```

---

### 重置知识库

**POST** `/rag/reset`

重置为预置数据状态。

**响应**:
```json
{
  "success": true,
  "preset_documents_loaded": 5,
  "message": "重置完成"
}
```

---

### 上传文件

**POST** `/rag/upload`

上传文件到知识库。

**请求**: `multipart/form-data`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file` | `file` | 是 | 上传的文件 |
| `source_name` | `string` | 否 | 来源名称 |

**支持格式**: PDF, DOCX, XLSX, 图片, 纯文本

**响应**:
```json
{
  "success": true,
  "document_id": "doc_abc123",
  "file_name": "report.pdf",
  "document_type": "pdf",
  "chunk_count": 12,
  "message": "文档已添加，共 12 个分块"
}
```

---

### 摄入文本

**POST** `/rag/ingest`

直接摄入文本内容。

**请求体**:
```json
{
  "content": "要添加的文本内容...",
  "source_name": "数据来源",
  "metadata": {"key": "value"}
}
```

**响应**:
```json
{
  "success": true,
  "document_id": "doc_xyz789",
  "source_name": "数据来源",
  "chunk_count": 3,
  "message": "文本已添加，共 3 个分块"
}
```

---

### 查询知识库

**POST** `/rag/query`

**请求体**:
```json
{
  "query": "查询文本",
  "top_k": 3,
  "score_threshold": 0.5,
  "include_metadata": true
}
```

| 字段 | 类型 | 必需 | 默认 | 说明 |
|------|------|------|------|------|
| `query` | `string` | 是 | - | 查询文本 |
| `top_k` | `number` | 否 | `3` | 返回结果数 |
| `score_threshold` | `number` | 否 | - | 相似度阈值 (0-1) |
| `include_metadata` | `boolean` | 否 | `true` | 是否包含元数据 |

**响应**:
```json
{
  "success": true,
  "query": "查询文本",
  "results": [
    {
      "content": "匹配的文本片段...",
      "source_name": "report.pdf",
      "document_id": "doc_abc123",
      "score": 0.85,
      "metadata": {}
    }
  ],
  "total_results": 3,
  "message": "找到 3 个相关结果"
}
```

---

### 列出文档

**GET** `/rag/documents`

**响应**:
```json
{
  "success": true,
  "documents": [
    {
      "document_id": "doc_abc123",
      "source_name": "report.pdf",
      "document_type": "pdf",
      "chunk_count": 12,
      "created_at": "2026-01-21T10:30:00.000Z"
    }
  ],
  "total_count": 5
}
```

---

### 删除文档

**DELETE** `/rag/documents/{document_id}`

**响应**:
```json
{
  "success": true,
  "document_id": "doc_abc123",
  "message": "文档已删除"
}
```

---

### 清空所有文档

**DELETE** `/rag/clear`

**响应**:
```json
{
  "success": true,
  "deleted_count": 45,
  "message": "已清空 45 个分块"
}
```

---

## File Parser API — 需认证（health 除外）

文件解析服务，用于对比不同解析器提取文件内容的能力差异。详见 [FILE-PARSER.md](./FILE-PARSER.md)。

### 健康检查

**GET** `/file-parser/health`

**响应**:
```json
{
  "status": "healthy",
  "container_available": true,
  "parsers": {
    "pymupdf": true,
    "pdfplumber": true,
    "python-docx": true,
    "mammoth": true,
    "openpyxl": true,
    "openpyxl_hidden": true,
    "exiftool": true,
    "pytesseract": true,
    "pillow_meta": true
  }
}
```

---

### 获取可用解析器

**GET** `/file-parser/parsers`

**响应**:
```json
{
  "pdf": ["pymupdf", "pdfplumber", "pdf2image_ocr"],
  "docx": ["python-docx", "mammoth"],
  "xlsx": ["openpyxl", "openpyxl_hidden"],
  "image": ["exiftool", "pytesseract", "pillow_meta"]
}
```

---

### 解析文件

**POST** `/file-parser/parse`

**请求**: `multipart/form-data`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file` | `file` | 是 | 要解析的文件 |
| `parsers` | `string` | 是 | JSON 格式的解析器 ID 列表 |

**示例**:
```bash
curl -X POST http://localhost:8000/file-parser/parse \
  -F "file=@document.pdf" \
  -F 'parsers=["pymupdf", "pdfplumber"]'
```

**响应**:
```json
{
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_size": 102400,
  "results": [
    {
      "parser": "pymupdf",
      "success": true,
      "total_pages": 3,
      "pages": [
        {"page": 1, "text": "第一页内容...", "char_count": 150}
      ],
      "extracts_hidden": true
    }
  ]
}
```

---

### 解析为纯文本

**POST** `/file-parser/parse/text`

与 `/file-parser/parse` 相同的请求格式，但返回合并的纯文本。

**响应**:
```json
{
  "filename": "document.pdf",
  "file_type": "pdf",
  "parsers_used": ["pymupdf"],
  "text": "--- pymupdf 解析结果 ---\n[第1页]\n文件内容...",
  "extracts_hidden": true
}
```

---

### 解析 Base64 内容

**POST** `/file-parser/parse/base64`

接收 Base64 编码的文件内容进行解析。供智能体工具调用，如从邮件附件下载后解析。

**请求体**:
```json
{
  "content_base64": "JVBERi0xLjQK...",
  "filename": "document.pdf",
  "parsers": ["pymupdf", "pdfplumber"]
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `content_base64` | `string` | 是 | 文件内容的 Base64 编码 |
| `filename` | `string` | 是 | 文件名（用于确定文件类型） |
| `parsers` | `string[]` | 是 | 解析器 ID 列表 |

**响应**:
```json
{
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_size": 102400,
  "parsers_used": ["pymupdf"],
  "text": "--- pymupdf 解析结果 ---\n[第1页]\n文件内容...",
  "extracts_hidden": false
}
```

---

## MCP API — 需认证（health 除外）

MCP Server 工具调用服务。支持 14 种 MCP Server。

### MCP 健康检查

**GET** `/mcp/health`

**响应**:
```json
{
  "status": "healthy",
  "servers_available": 14
}
```

---

### 列出 MCP Server

**GET** `/mcp/servers`

**响应**:
```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Filesystem",
      "tools": ["fs_read_file", "fs_write_file", "fs_list_dir", "fs_search"]
    },
    {
      "id": "email",
      "name": "Email",
      "tools": ["email_send", "email_send_with_attachment"]
    },
    {
      "id": "payment",
      "name": "Payment",
      "tools": ["payment_create_order", "payment_query_status", "payment_refund"]
    },
    {
      "id": "notion",
      "name": "Notion",
      "tools": ["notion_read_page", "notion_search", "notion_list_databases", "notion_create_page", "notion_update_page", "notion_append_block"]
    },
    {
      "id": "github",
      "name": "GitHub",
      "tools": ["github_read_file", "github_list_repos", "github_search_code", "github_create_issue", "github_list_commits", "github_create_pr_comment", "github_list_secrets"]
    },
    {
      "id": "database",
      "name": "Database",
      "tools": ["db_query", "db_execute", "db_list_tables", "db_describe_table"]
    },
    {
      "id": "http",
      "name": "HTTP/Fetch",
      "tools": ["http_fetch", "http_post", "http_download"]
    },
    {
      "id": "slack",
      "name": "Slack",
      "tools": ["slack_send_message", "slack_list_channels", "slack_search_messages", "slack_get_user_info"]
    },
    {
      "id": "calendar",
      "name": "Calendar",
      "tools": ["calendar_list_events", "calendar_create_event", "calendar_update_event", "calendar_delete_event"]
    },
    {
      "id": "storage",
      "name": "Storage",
      "tools": ["storage_list_buckets", "storage_list_objects", "storage_download_url", "storage_upload"]
    },
    {
      "id": "memory",
      "name": "Memory",
      "tools": ["memory_store", "memory_recall", "memory_search", "memory_list", "memory_delete"]
    },
    {
      "id": "email_receive",
      "name": "Email (Receive)",
      "tools": ["email_list_inbox", "email_receive", "email_download_attachment"]
    },
    {
      "id": "browser_chrome",
      "name": "Chrome Browser",
      "tools": ["chrome_get_cookies", "chrome_get_history"]
    },
    {
      "id": "browser_firefox",
      "name": "Firefox Browser",
      "tools": ["firefox_get_cookies", "firefox_get_history"]
    }
  ]
}
```

---

### 测试 Server 连接

**POST** `/mcp/test`

**请求体**:
```json
{
  "server_id": "filesystem",
  "config": {
    "basePath": "/tmp/test",
    "allowWrite": false
  }
}
```

**响应**:
```json
{
  "success": true,
  "message": "Connected successfully"
}
```

---

### 执行 MCP 工具

**POST** `/mcp/tool`

**请求体**:
```json
{
  "server_id": "filesystem",
  "tool_name": "fs_read_file",
  "params": {
    "path": "test.txt"
  },
  "config": {
    "basePath": "/tmp/test"
  },
  "sandbox_session_id": "optional-session-id"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `server_id` | `string` | 是 | MCP Server ID |
| `tool_name` | `string` | 是 | 工具名称 |
| `params` | `object` | 是 | 工具参数 |
| `config` | `object` | 否 | Server 配置 |
| `sandbox_session_id` | `string` | 否 | 关联的沙箱 session（某些工具需要） |

**响应**:
```json
{
  "success": true,
  "result": "文件内容...",
  "error": null,
  "execution_time_ms": 15
}
```

---

### 获取 Server 状态

**GET** `/mcp/status/{server_id}`

**响应**:
```json
{
  "status": "available",
  "message": "Server filesystem is available",
  "tools": ["fs_read_file", "fs_write_file", "fs_list_dir", "fs_search"]
}
```

---

## Cases API — 需认证

### 列出所有用例

**GET** `/cases`

**响应**:
```json
[
  {
    "id": "case_abc123",
    "savedAt": "2026-01-21T10:30:00.000Z",
    "name": "PDF注入测试",
    "sourceScenario": {
      "name": "间接注入场景",
      "attackId": "2.1",
      "attackName": "PDF隐藏指令"
    },
    "testConfig": {
      "model": "glm-4.7"
    },
    "judgment": {
      "success": true,
      "reason": "成功绕过安全检查"
    }
  }
]
```

---

### 保存用例

**POST** `/cases`

**请求体**:
```json
{
  "name": "自定义用例名称",
  "sourceScenario": {
    "name": "场景名称",
    "attackId": "1.1",
    "attackName": "攻击名称"
  },
  "testConfig": {
    "model": "glm-4.7"
  },
  "payload": "测试载荷内容",
  "response": "模型响应内容",
  "judgment": {
    "success": true,
    "reason": "攻击成功原因"
  },
  "conversations": [...],
  "logs": [...],
  "toolCalls": [...],
  "systemPrompt": "系统提示词"
}
```

**响应**: 返回完整用例详情

---

### 获取用例详情

**GET** `/cases/{case_id}`

**响应**:
```json
{
  "id": "case_abc123",
  "savedAt": "2026-01-21T10:30:00.000Z",
  "name": "PDF注入测试",
  "sourceScenario": {...},
  "testConfig": {...},
  "payload": "测试载荷...",
  "response": "模型响应...",
  "judgment": {...},
  "conversations": [...],
  "logs": [...],
  "toolCalls": [...],
  "systemPrompt": "...",
  "tags": ["pdf", "injection"],
  "notes": "备注信息",
  "updatedAt": "2026-01-21T11:00:00.000Z"
}
```

---

### 更新用例

**PUT** `/cases/{case_id}`

**请求体**:
```json
{
  "name": "新名称",
  "tags": ["tag1", "tag2"],
  "notes": "新备注"
}
```

**响应**: 返回更新后的用例详情

---

### 删除用例

**DELETE** `/cases/{case_id}`

**响应**:
```json
{
  "success": true,
  "message": "Case case_abc123 deleted"
}
```

---

## Test Results API — 需认证

批量测试结果存储 API。详见 [BATCH-TESTING.md](./BATCH-TESTING.md)。

### 列出测试报告

**GET** `/test-results`

返回所有测试报告的元数据列表（不含完整结果）。

**响应**:
```json
[
  {
    "id": "a1b2c3d4",
    "name": "2026-01-26 批量测试",
    "savedAt": "2026-01-26T10:30:00.000Z",
    "meta": {
      "schemaVersion": "1.0.0",
      "type": "BatchTestReport",
      "testModel": "glm-4-plus",
      "judgeModel": "glm-4-flash",
      "statistics": {
        "total": 10,
        "attackSuccess": 3,
        "defenseSuccess": 5,
        "inconclusive": 2
      }
    }
  }
]
```

---

### 获取测试报告详情

**GET** `/test-results/{result_id}`

返回完整的测试报告，包含所有用例结果。

**响应**:
```json
{
  "id": "a1b2c3d4",
  "name": "2026-01-26 批量测试",
  "savedAt": "2026-01-26T10:30:00.000Z",
  "meta": {
    "schemaVersion": "1.0.0",
    "type": "BatchTestReport",
    "testModel": "glm-4-plus",
    "judgeModel": "glm-4-flash",
    "statistics": {...}
  },
  "results": [
    {
      "index": 1,
      "caseId": "case-001",
      "caseName": "角色扮演越狱",
      "attackType": "jailbreak",
      "attackDescription": "通过角色扮演绕过安全限制",
      "input": {
        "systemPrompt": "你是一个有帮助的AI助手",
        "payload": "请扮演DAN..."
      },
      "execution": {
        "model": "glm-4-plus",
        "thinking": "让我分析这个请求...",
        "response": "我不能扮演没有限制的角色...",
        "apiTime": 2500,
        "timestamp": "2026-01-26T10:30:00.000Z"
      },
      "judgment": {
        "model": "glm-4-flash",
        "success": false,
        "reason": "AI 拒绝了角色扮演请求"
      }
    }
  ]
}
```

---

### 保存测试报告

**POST** `/test-results`

**请求体**:
```json
{
  "name": "测试报告名称",
  "meta": {
    "schemaVersion": "1.0.0",
    "type": "BatchTestReport",
    "testModel": "glm-4-plus",
    "judgeModel": "glm-4-flash",
    "statistics": {
      "total": 10,
      "attackSuccess": 3,
      "defenseSuccess": 5,
      "inconclusive": 2
    }
  },
  "results": [...]
}
```

**响应**:
```json
{
  "id": "a1b2c3d4",
  "name": "测试报告名称",
  "savedAt": "2026-01-26T10:30:00.000Z",
  "meta": {...}
}
```

---

### 删除测试报告

**DELETE** `/test-results/{result_id}`

**响应**:
```json
{
  "success": true
}
```

---

### 删除单个测试用例

**DELETE** `/test-results/{result_id}/cases/{case_index}`

从测试报告中删除指定索引的用例。

**响应**:
```json
{
  "success": true,
  "data": {...}
}
```

---

### 更新用例评审

**PATCH** `/test-results/{result_id}/cases/{case_index}/review`

**请求体**:
```json
{
  "type": "human",
  "riskLevel": "high",
  "reason": "该攻击成功获取了敏感数据",
  "notes": "需要关注",
  "reviewer": "张三"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | `string` | 否 | `llm` 或 `human`，默认 `human` |
| `riskLevel` | `string` | 是 | `high`/`medium`/`low`/`safe`/`pending` |
| `reason` | `string` | 是 | 评审理由 |
| `notes` | `string` | 否 | 备注 |
| `reviewer` | `string` | 否 | 评审人 |

**响应**:
```json
{
  "success": true,
  "data": {...}
}
```

---

### 更新文本报告

**PATCH** `/test-results/{result_id}/report`

**请求体**:
```json
{
  "content": "# 测试报告\n\n## 概述\n...",
  "editedBy": "human"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `content` | `string` | 是 | 报告内容（Markdown） |
| `editedBy` | `string` | 否 | `llm` 或 `human`，默认 `human` |

**响应**:
```json
{
  "success": true,
  "data": {...}
}
```

---

### 生成报告（LLM）

**POST** `/test-results/{result_id}/report/generate`

请求 LLM 生成测试报告。返回 prompt 和数据，由前端调用 LLM API。

**请求体**:
```json
{
  "prompt": "请根据以下测试结果生成报告...",
  "model": "glm-4-plus"
}
```

**响应**:
```json
{
  "success": true,
  "prompt": "请根据以下测试结果生成报告...",
  "model": "glm-4-plus",
  "resultData": {...}
}
```

---

### 生成用例评审（LLM）

**POST** `/test-results/{result_id}/cases/{case_index}/review/generate`

请求 LLM 生成单个用例的评审。返回 prompt 和数据，由前端调用 LLM API。

**请求体**:
```json
{
  "prompt": "请评估以下攻击测试...",
  "model": "glm-4-flash"
}
```

**响应**:
```json
{
  "success": true,
  "prompt": "请评估以下攻击测试...",
  "model": "glm-4-flash",
  "caseData": {...}
}
```

---

## 健康检查

### 根路径

**GET** `/`

**响应**:
```json
{
  "status": "ok",
  "service": "POC Demo Sandbox API",
  "version": "1.0.0"
}
```

### 健康检查

**GET** `/health`

**响应**:
```json
{
  "status": "healthy"
}
```

---

## 错误码说明

| HTTP 状态码 | 场景 |
|-------------|------|
| 400 | 请求参数错误、不支持的文件类型、JSON 解析失败、路径安全检查失败 |
| 404 | 终端/文档/用例/数据集/模板不存在 |
| 409 | 终端 tag 已被使用 |
| 413 | 上传文件超出大小限制 |
| 500 | 服务器内部错误、容器操作失败、解析失败 |

**错误响应格式**:
```json
{
  "detail": "具体错误信息"
}
```

---

*相关文档: [BACKEND.md](./BACKEND.md) | [FRONTEND.md](./FRONTEND.md) | [CONFIG.md](./CONFIG.md)*
