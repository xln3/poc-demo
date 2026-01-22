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
| 500 | 服务器内部错误 |

---

## Sandbox API

### 创建/获取容器

**POST** `/sandbox/container`

创建新容器或获取现有容器。

**请求体**:
```json
{
  "image": "python:3.11-slim",
  "session_id": "optional-session-id"
}
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `image` | `string` | 否 | 容器镜像，默认 `python:3.11-slim` |
| `session_id` | `string` | 否 | 会话ID，不提供则自动生成 |

**可选镜像**:
- `python:3.11-slim`
- `ubuntu:22.04`
- `node:20-slim`
- `file-parser:latest`

**响应**:
```json
{
  "session_id": "abc12345",
  "container_id": "d4e5f6g7h8i9",
  "image": "python:3.11-slim",
  "status": "running",
  "created_at": "2024-01-21T10:30:00.000Z"
}
```

---

### 获取容器状态

**GET** `/sandbox/container/{session_id}`

**响应**:
```json
{
  "session_id": "abc12345",
  "container_id": "d4e5f6g7h8i9",
  "image": "python:3.11-slim",
  "status": "running",
  "created_at": "2024-01-21T10:30:00.000Z"
}
```

**status 可选值**:
- `running` - 运行中
- `stopped` - 已停止
- `not_found` - 不存在

---

### 销毁容器

**DELETE** `/sandbox/container/{session_id}`

**响应**:
```json
{
  "success": true,
  "message": "Session abc12345 destroyed"
}
```

---

### 列出所有会话

**GET** `/sandbox/sessions`

**响应**:
```json
[
  {
    "session_id": "abc12345",
    "container_id": "d4e5f6g7h8i9",
    "image": "python:3.11-slim",
    "status": "running",
    "created_at": "2024-01-21T10:30:00.000Z"
  }
]
```

---

### 执行工具

**POST** `/sandbox/tool`

在沙箱中执行工具。

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

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `session_id` | `string` | 是 | 会话ID |
| `tool` | `string` | 是 | 工具名称 |
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

---

### WebSocket 日志流

**WS** `/sandbox/logs/{session_id}`

实时接收沙箱日志。

**消息格式**:
```json
{
  "type": "tool",
  "content": "Executing: ls -la",
  "status": "normal",
  "timestamp": "2024-01-21T10:30:00.000Z",
  "details": {}
}
```

**心跳消息**:
```json
{"type": "heartbeat"}
```

---

## RAG API

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
      "created_at": "2024-01-21T10:30:00.000Z"
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

## MCP API

### 获取可用解析器

**GET** `/mcp/parsers`

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

**POST** `/mcp/parse`

**请求**: `multipart/form-data`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file` | `file` | 是 | 要解析的文件 |
| `parsers` | `string` | 是 | JSON 格式的解析器 ID 列表 |

**示例**:
```
parsers=["pymupdf", "pdfplumber"]
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
      "pages": [
        {"page": 1, "text": "第一页内容..."}
      ],
      "extracts_hidden": true
    }
  ]
}
```

---

### 解析为纯文本

**POST** `/mcp/parse/text`

与 `/mcp/parse` 相同，但返回合并的纯文本。

**响应**:
```json
{
  "filename": "document.pdf",
  "file_type": "pdf",
  "parsers_used": ["pymupdf"],
  "text": "合并后的文本内容...",
  "extracts_hidden": true
}
```

---

### MCP 健康检查

**GET** `/mcp/health`

**响应**:
```json
{
  "status": "healthy",
  "mode": "container",
  "container_available": true,
  "parsers": {
    "pymupdf": true,
    "pdfplumber": true,
    "python-docx": true,
    "mammoth": true,
    "openpyxl": true,
    "pytesseract": true,
    "pillow": true,
    "exiftool": true
  }
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
  }
}
```

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

## Cases API

### 列出所有用例

**GET** `/cases`

**响应**:
```json
[
  {
    "id": "case_abc123",
    "savedAt": "2024-01-21T10:30:00.000Z",
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
  "savedAt": "2024-01-21T10:30:00.000Z",
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
  "updatedAt": "2024-01-21T11:00:00.000Z"
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
| 400 | 请求参数错误、不支持的文件类型、JSON 解析失败 |
| 404 | 会话/容器/文档/用例不存在 |
| 500 | 服务器内部错误、容器操作失败、解析失败 |

**错误响应格式**:
```json
{
  "detail": "具体错误信息"
}
```

---

*相关文档: [BACKEND.md](./BACKEND.md) | [FRONTEND.md](./FRONTEND.md) | [CONFIG.md](./CONFIG.md)*
