# 配置参考

本文档详细说明所有配置项和环境变量。

## 配置文件位置

| 文件 | 说明 |
|------|------|
| `src/config.js` | 前端主配置 |
| `.env` | 环境变量（敏感配置） |
| `.env.example` | 环境变量模板 |
| `vite.config.js` | Vite 构建配置 |

---

## 环境变量

在项目根目录创建 `.env` 文件：

```bash
# LLM API 配置
VITE_API_BASE_URL=https://your-llm-api.com/v1/chat/completions
VITE_API_KEY=your-api-key-here
```

### 前端变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `VITE_API_BASE_URL` | 是 | LLM API 端点 URL |
| `VITE_API_KEY` | 是 | API 密钥 |

### 后端变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `POC_DATA_ROOT` | 否 | `../poc-data` | 运行时数据存储根目录 |

运行时数据目录结构：
```
poc-data/                    # POC_DATA_ROOT
├── sandbox/                 # 沙箱文件
├── terminals/               # 终端锁
├── datasets/                # 数据集
├── saved-cases/             # 已保存用例
└── test-results/            # 测试结果
```

> **注意**: Vite 项目中环境变量必须以 `VITE_` 前缀开头才能在前端代码中访问。

---

## CONFIG 对象详解

### 动画配置

```javascript
CONFIG = {
  typingSpeed: 18,   // 打字速度(ms/字符)
  logDelay: 350,     // 日志出现间隔(ms)
  stepDelay: 600,    // 步骤间隔(ms)
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `typingSpeed` | `number` | `18` | Mock 模式打字动画速度 |
| `logDelay` | `number` | `350` | 日志条目出现间隔 |
| `stepDelay` | `number` | `600` | 对话步骤间隔 |

### API 配置

```javascript
CONFIG.api = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://aihubmix.com/v1/chat/completions',
  apiKey: import.meta.env.VITE_API_KEY || '',
  model: 'mock',
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `baseUrl` | `string` | 环境变量 | LLM API 端点 |
| `apiKey` | `string` | 环境变量 | API 密钥 |
| `model` | `string` | `'mock'` | 默认模型（mock 表示模拟模式） |

### RAG API 配置

```javascript
CONFIG.ragApi = {
  baseUrl: '/rag',
  enabled: true,
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `baseUrl` | `string` | `'/rag'` | RAG 服务端点（相对路径，走 Vite 代理） |
| `enabled` | `boolean` | `true` | 是否启用 RAG 功能 |

### Sandbox 配置

```javascript
CONFIG.sandbox = {
  baseUrl: '',  // 空字符串，使用相对路径 /sandbox
  transfer: {
    maxFileSize: 100 * 1024 * 1024,  // 100MB
    chunkSize: 1024 * 1024,           // 1MB
    allowedPaths: ['/workspace/', '/tmp/'],
  },
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `baseUrl` | `string` | `''` | 沙箱后端端点（空字符串，使用相对路径 /sandbox） |
| `transfer.maxFileSize` | `number` | `104857600` | 文件传输最大大小（100MB） |
| `transfer.chunkSize` | `number` | `1048576` | 分块传输大小（1MB） |
| `transfer.allowedPaths` | `string[]` | `['/workspace/', '/tmp/']` | 允许的文件路径前缀 |

### 可用模型列表

```javascript
CONFIG.models = [
  { id: 'doubao-seed-1-8-251228', name: 'Doubao Seed 1.8' },
  { id: 'baidu-deepseek-v3.2', name: 'DeepSeek V3.2' },
]
```

添加新模型：

```javascript
CONFIG.models.push({
  id: 'model-id',      // API 模型标识
  name: 'Display Name' // UI 显示名称
});
```

### 评判模型

```javascript
CONFIG.judgeModel = 'zai-glm-4.7'
```

用于判断攻击是否成功的模型 ID。

### LLM 参数默认值

```javascript
CONFIG.llmParams = {
  temperature: 0.7,
  max_tokens: 8192,
  top_p: 0.9,
}
```

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `temperature` | `number` | `0.7` | 0-2 | 采样温度，越高越随机 |
| `max_tokens` | `number` | `8192` | 1-128000 | 最大生成 token 数 |
| `top_p` | `number` | `0.9` | 0-1 | 核采样概率阈值 |

---

## 工具配置

```javascript
CONFIG.tools = {
  enabled: false,     // 默认关闭
  maxCalls: 100,      // 单次测试最大调用次数
  autoExecute: true,  // 自动执行（否则需手动确认）

  categories: {
    safe: { label: '安全工具', color: 'green', description: '只读操作' },
    risky: { label: '风险工具', color: 'orange', description: '可能修改数据' },
    dangerous: { label: '危险工具', color: 'red', description: '可执行任意命令' }
  },

  available: { /* 工具定义 */ }
}
```

### 工具定义

每个工具定义包含：

```javascript
{
  name: 'tool_name',           // 工具标识
  label: '显示名称',            // UI 显示
  category: 'safe|risky|dangerous', // 安全分类
  description: '工具描述',      // 功能说明
  parameters: {                // OpenAI Function Calling 格式
    type: 'object',
    properties: { ... },
    required: [...]
  }
}
```

### 可用工具列表

| 工具 | 分类 | 参数 | 说明 |
|------|------|------|------|
| `read_file` | safe | `path` | 读取文件 |
| `write_file` | risky | `path`, `content` | 写入文件 |
| `run_command` | dangerous | `command` | 执行命令 |
| `list_dir` | safe | `path?` | 列目录 |
| `http_request` | risky | `url`, `method?`, `headers?`, `body?` | HTTP 请求 |
| `parse_file` | safe | `path`, `parsers?` | 解析文件（PDF/DOCX/XLSX/图片等） |

### MCP 邮件工具

标记 `mcpServer: 'email_receive'`，由 MCP email_receive 服务提供：

| 工具 | 分类 | 参数 | 说明 |
|------|------|------|------|
| `email_list_inbox` | safe | `limit?`, `unread_only?` | 列出收件箱邮件列表 |
| `email_receive` | safe | `id` | 读取邮件完整内容和附件列表 |
| `email_download_attachment` | risky | `id`, `filename` | 下载邮件附件（base64） |

### MCP 浏览器工具

| 工具 | 分类 | MCP Server | 参数 | 说明 |
|------|------|------------|------|------|
| `firefox_get_cookies` | dangerous | `browser_firefox` | `domain?`, `limit?` | 读取 Firefox cookies（明文） |
| `firefox_get_history` | dangerous | `browser_firefox` | `days?`, `limit?` | 读取 Firefox 浏览历史 |
| `chrome_get_cookies` | dangerous | `browser_chrome` | `domain?`, `limit?` | 读取 Chrome cookies（AES 加密密文） |
| `chrome_get_history` | dangerous | `browser_chrome` | `days?`, `limit?` | 读取 Chrome 浏览历史 |

---

## MCP 解析器配置

```javascript
CONFIG.mcp = {
  enabled: true,
  serverUrl: '',  // 使用相对路径，走 Vite 代理

  parsers: {
    pdf: {
      label: 'PDF 解析器',
      tools: [
        { id: 'pymupdf', name: 'PyMuPDF', desc: '提取所有文字层', hiddenExtract: true },
        { id: 'pdfplumber', name: 'pdfplumber', desc: '结构化提取', hiddenExtract: true },
        { id: 'pdf2image_ocr', name: 'pdf2image + OCR', desc: '仅可见内容', hiddenExtract: false, requiresDocker: true },
      ]
    },
    docx: {
      label: 'DOCX 解析器',
      tools: [
        { id: 'python-docx', name: 'python-docx', desc: '包含隐藏文本', hiddenExtract: true },
        { id: 'mammoth', name: 'mammoth', desc: '转换为文本', hiddenExtract: false },
      ]
    },
    xlsx: {
      label: 'XLSX 解析器',
      tools: [
        { id: 'openpyxl', name: 'openpyxl', desc: '默认不读 veryHidden', hiddenExtract: false },
        { id: 'openpyxl_hidden', name: 'openpyxl (含隐藏)', desc: '读取所有', hiddenExtract: true },
      ]
    },
    image: {
      label: '图片解析器',
      tools: [
        { id: 'exiftool', name: 'exiftool', desc: 'EXIF/元数据', hiddenExtract: true },
        { id: 'pytesseract', name: 'pytesseract (OCR)', desc: '文字识别', hiddenExtract: false },
        { id: 'pillow_meta', name: 'Pillow 元数据', desc: '图片注释', hiddenExtract: true },
      ]
    }
  }
}
```

### 解析器属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 解析器标识 |
| `name` | `string` | 显示名称 |
| `desc` | `string` | 功能描述 |
| `hiddenExtract` | `boolean` | 是否提取隐藏内容 |
| `requiresDocker` | `boolean` | 是否需要 Docker |

---

## MCP Server 配置

> **注意**：文件解析服务已独立为 `/file-parser/*` 路由。MCP Server 仅用于外部工具调用。

```javascript
CONFIG.mcpServers = {
  enabled: false,
  apiUrl: '/mcp',

  available: {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem',
      icon: '📁',
      description: '本地文件系统读写访问',
      fields: [
        { key: 'basePath', label: '根目录路径', type: 'text', required: true, placeholder: '/path/to/workspace' },
        { key: 'allowWrite', label: '允许写入', type: 'checkbox', required: false, default: false }
      ],
      tools: ['fs_read_file', 'fs_write_file', 'fs_list_dir', 'fs_search']
    },
    email: {
      id: 'email',
      name: 'Email',
      icon: '📧',
      description: 'SMTP 邮件发送服务',
      fields: [
        { key: 'smtpHost', label: 'SMTP 主机', type: 'text', required: true, placeholder: 'smtp.example.com' },
        { key: 'smtpPort', label: 'SMTP 端口', type: 'number', required: true, default: 587 },
        { key: 'username', label: '用户名', type: 'text', required: true },
        { key: 'password', label: '密码', type: 'password', required: true },
        { key: 'fromAddress', label: '发件人地址', type: 'text', required: true, placeholder: 'bot@example.com' }
      ],
      tools: ['email_send', 'email_send_with_attachment']
    },
    payment: {
      id: 'payment',
      name: 'Payment (Stripe)',
      icon: '💳',
      description: 'Stripe 支付网关集成（sk_test_ 为测试模式，sk_live_ 为生产模式）',
      fields: [
        { key: 'apiKey', label: 'Stripe Secret Key', type: 'password', required: true, placeholder: 'sk_test_xxx 或 sk_live_xxx' },
        { key: 'merchantId', label: '商户标识', type: 'text', required: true, placeholder: '用于订单备注' }
      ],
      tools: ['payment_create_order', 'payment_query_status', 'payment_refund']
    },
    notion: {
      id: 'notion',
      name: 'Notion',
      icon: '📝',
      description: 'Notion 知识库操作（读取/搜索/创建页面）',
      fields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'secret_xxx (Integration Token)' }
      ],
      tools: ['notion_read_page', 'notion_search', 'notion_list_databases', 'notion_create_page', 'notion_update_page', 'notion_append_block']
    },
    github: {
      id: 'github',
      name: 'GitHub',
      icon: '🐙',
      description: 'GitHub 代码仓库操作（读取文件/搜索代码/管理Issue）',
      fields: [
        { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_xxx 或 github_pat_xxx' }
      ],
      tools: ['github_read_file', 'github_list_repos', 'github_search_code', 'github_create_issue', 'github_list_commits', 'github_create_pr_comment', 'github_list_secrets']
    },
    database: {
      id: 'database',
      name: 'Database',
      icon: '🗄️',
      description: '数据库查询（支持 PostgreSQL 和 SQLite）',
      fields: [
        { key: 'type', label: '数据库类型', type: 'select', required: true, options: [{ value: 'postgres', label: 'PostgreSQL' }, { value: 'sqlite', label: 'SQLite' }], default: 'postgres' },
        { key: 'host', label: '主机地址', type: 'text', required: false, placeholder: 'localhost (PostgreSQL)' },
        { key: 'port', label: '端口', type: 'number', required: false, default: 5432 },
        { key: 'user', label: '用户名', type: 'text', required: false },
        { key: 'password', label: '密码', type: 'password', required: false },
        { key: 'database', label: '数据库名', type: 'text', required: false },
        { key: 'path', label: '文件路径', type: 'text', required: false, placeholder: '/path/to/db.sqlite (SQLite)' }
      ],
      tools: ['db_query', 'db_execute', 'db_list_tables', 'db_describe_table']
    },
    http: {
      id: 'http',
      name: 'HTTP/Fetch',
      icon: '🌐',
      description: 'HTTP 请求工具（含 SSRF 检测演示）',
      fields: [
        { key: 'allowPrivate', label: '允许访问内网地址', type: 'checkbox', required: false, default: false },
        { key: 'timeout', label: '超时时间（秒）', type: 'number', required: false, default: 30 },
        { key: 'maxBodySize', label: '最大响应体（字节）', type: 'number', required: false, default: 1048576 }
      ],
      tools: ['http_fetch', 'http_post', 'http_download']
    },
    slack: {
      id: 'slack',
      name: 'Slack',
      icon: '💬',
      description: 'Slack 工作区通信（发送消息/搜索/获取用户信息）',
      fields: [
        { key: 'token', label: 'Bot User OAuth Token', type: 'password', required: true, placeholder: 'xoxb-xxx' }
      ],
      tools: ['slack_send_message', 'slack_list_channels', 'slack_search_messages', 'slack_get_user_info']
    },
    calendar: {
      id: 'calendar',
      name: 'Calendar',
      icon: '📅',
      description: '日历管理（支持 Google Calendar 或 Mock 模式）',
      fields: [
        { key: 'type', label: '服务类型', type: 'select', required: true, options: [{ value: 'mock', label: 'Mock (本地演示)' }, { value: 'google', label: 'Google Calendar' }], default: 'mock' },
        { key: 'accessToken', label: 'OAuth Access Token', type: 'password', required: false, placeholder: 'Google OAuth Token (可选)' }
      ],
      tools: ['calendar_list_events', 'calendar_create_event', 'calendar_update_event', 'calendar_delete_event']
    },
    storage: {
      id: 'storage',
      name: 'Storage',
      icon: '☁️',
      description: '云存储操作（支持 AWS S3 和阿里云 OSS）',
      fields: [
        { key: 'type', label: '存储类型', type: 'select', required: true, options: [{ value: 's3', label: 'AWS S3' }, { value: 'oss', label: '阿里云 OSS' }], default: 's3' },
        { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
        { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
        { key: 'region', label: '区域', type: 'text', required: false, placeholder: 'us-east-1 (S3)' },
        { key: 'endpoint', label: 'Endpoint', type: 'text', required: false, placeholder: 'oss-cn-hangzhou.aliyuncs.com (OSS)' }
      ],
      tools: ['storage_list_buckets', 'storage_list_objects', 'storage_download_url', 'storage_upload']
    },
    memory: {
      id: 'memory',
      name: 'Memory',
      icon: '🧠',
      description: '持久化记忆存储（本地 JSON 文件）',
      fields: [
        { key: 'storagePath', label: '存储路径', type: 'text', required: false, placeholder: '/tmp/mcp_memory', default: '/tmp/mcp_memory' }
      ],
      tools: ['memory_store', 'memory_recall', 'memory_search', 'memory_list', 'memory_delete']
    },
    email_receive: {
      id: 'email_receive',
      name: 'Email (Receive)',
      icon: '📬',
      description: 'IMAP 邮件接收服务（支持163、QQ、Gmail等）',
      fields: [
        { key: 'imapHost', label: 'IMAP 主机', type: 'text', required: true, placeholder: 'imap.163.com', default: 'imap.163.com' },
        { key: 'imapPort', label: '端口', type: 'number', required: true, default: 993 },
        { key: 'username', label: '邮箱账号', type: 'text', required: true, placeholder: 'your@163.com' },
        { key: 'password', label: '授权码', type: 'password', required: true, placeholder: '163邮箱需在设置中开启IMAP并获取授权码' },
        { key: 'useSSL', label: 'SSL', type: 'checkbox', required: false, default: true }
      ],
      tools: ['email_list_inbox', 'email_receive', 'email_download_attachment']
    },
    browser_chrome: {
      id: 'browser_chrome',
      name: 'Chrome Browser',
      icon: '🔵',
      description: 'Chrome 浏览器数据读取（cookies 为 AES 加密密文）',
      fields: [
        { key: 'profilePath', label: '配置目录', type: 'text', required: false, placeholder: '~/.config/google-chrome/Default（留空自动检测）' }
      ],
      tools: ['chrome_get_cookies', 'chrome_get_history']
    },
    browser_firefox: {
      id: 'browser_firefox',
      name: 'Firefox Browser',
      icon: '🦊',
      description: 'Firefox 浏览器数据读取（cookies 为明文）',
      fields: [
        { key: 'profilePath', label: '配置目录', type: 'text', required: false, placeholder: '~/.mozilla/firefox/*.default*（留空自动检测）' }
      ],
      tools: ['firefox_get_cookies', 'firefox_get_history']
    }
  }
}
```

### Server 配置字段类型

| 类型 | 说明 |
|------|------|
| `text` | 文本输入 |
| `number` | 数字输入 |
| `password` | 密码输入 |
| `checkbox` | 复选框 |
| `select` | 下拉选择 |

---

## API 函数

### callModel()

调用 LLM API。

```javascript
async callModel(
  messages: Array<{role, content}>,
  systemPrompt: string = '',
  modelId: string | null = null,
  llmParams: object = {},
  thinkingConfig: object | null = null
): Promise<{content, thinking, timing}>
```

**返回值**:
- `content`: 模型响应内容
- `thinking`: 思考过程（如启用）
- `timing.totalTime`: 总耗时(ms)

### callModelWithTools()

调用 LLM API（支持工具调用）。

```javascript
async callModelWithTools(
  messages: Array<{role, content}>,
  systemPrompt: string = '',
  modelId: string | null = null,
  llmParams: object = {},
  toolDefinitions: Array = [],
  thinkingConfig: object | null = null
): Promise<{content, tool_calls, finish_reason, thinking, timing, raw}>
```

**返回值**:
- `content`: 模型响应内容
- `tool_calls`: 工具调用数组
- `finish_reason`: 结束原因
- `thinking`: 思考过程
- `timing.totalTime`: 总耗时
- `raw`: 原始消息对象

### judgeAttackSuccess()

使用评判模型判断攻击结果（五态风险等级）。

```javascript
async judgeAttackSuccess(
  attack: Attack,
  systemPrompt: string,
  modelResponse: string,
  actualPayload: string | null = null,
  customJudgePrompt: string | null = null,
  customJudgeModel: string | null = null
): Promise<{riskLevel: string, reason: string}>
```

**参数**:
- `attack`: 攻击对象
- `systemPrompt`: 智能体系统提示词
- `modelResponse`: 智能体响应
- `actualPayload`: 可选，实际 payload（覆盖 attack 中的 payload）
- `customJudgePrompt`: 可选，自定义评判提示词模板（支持 `{{attackName}}` 等占位符）
- `customJudgeModel`: 可选，自定义评判模型（覆盖 `CONFIG.judgeModel`）

**返回值**:
- `riskLevel`: `'high'`|`'medium'`|`'low'`|`'safe'`|`'pending'`
- `reason`: 判断理由

### callModelStream()

流式调用 LLM API。通过 `onDelta` 回调实现增量输出。

```javascript
async callModelStream(
  messages: Array<{role, content}>,
  systemPrompt: string = '',
  modelId: string | null = null,
  llmParams: object = {},
  thinkingConfig: object | null = null,
  onDelta: (deltaContent: string, deltaThinking: string) => void | null = null
): Promise<{content, thinking, timing, raw}>
```

**返回值**:
- `content`: 累积的模型响应内容
- `thinking`: 累积的思考过程（如启用）
- `timing.totalTime`: 总耗时(ms)
- `raw`: `{ chunks, stream: true }` 原始 SSE 数据块数组

### callModelWithToolsStream()

流式调用 LLM API（带工具支持）。

```javascript
async callModelWithToolsStream(
  messages: Array<{role, content}>,
  systemPrompt: string = '',
  modelId: string | null = null,
  llmParams: object = {},
  toolDefinitions: Array = [],
  thinkingConfig: object | null = null,
  onDelta: (deltaContent: string, deltaThinking: string) => void | null = null
): Promise<{content, tool_calls, finish_reason, thinking, timing, raw}>
```

**返回值**:
- `content`: 累积的模型响应内容
- `tool_calls`: 工具调用数组（从流式增量中按 index 聚合）
- `finish_reason`: 结束原因
- `thinking`: 累积的思考过程
- `timing.totalTime`: 总耗时(ms)
- `raw`: `{ chunks, stream: true }` 原始 SSE 数据块数组

### File Parser API 函数

文件解析服务的辅助函数，通过 `/file-parser/*` 路由访问。

#### checkFileParserHealth()

```javascript
async checkFileParserHealth(): Promise<{status: string, error?: string}>
```

检查文件解析服务健康状态。返回 `{status: 'UP'}` 或 `{status: 'DOWN', error: ...}`。

#### getFileParsers()

```javascript
async getFileParsers(): Promise<object>
```

获取可用的解析器列表。

#### parseFile()

```javascript
async parseFile(file: File, parserIds: string[]): Promise<object>
```

上传文件并使用指定解析器解析，返回各解析器的解析结果。

#### parseFileToText()

```javascript
async parseFileToText(file: File, parserIds: string[]): Promise<object>
```

上传文件并返回纯文本解析结果。

---

## 常量定义

### ATTACK_TYPES

```javascript
export const ATTACK_TYPES = {
  integrity: { label: "完整性攻击", color: "bg-orange-500", icon: "🟠", desc: "绕过控制/篡改决策" },
  confidentiality: { label: "机密性攻击", color: "bg-red-500", icon: "🔴", desc: "数据/信息泄露" },
  availability: { label: "可用性攻击", color: "bg-yellow-500", icon: "🟡", desc: "拒绝服务/系统崩溃" },
  jailbreak: { label: "越狱攻击", color: "bg-purple-500", icon: "🟣", desc: "突破安全限制" }
};
```

### RISK_LEVELS

```javascript
export const RISK_LEVELS = {
  critical: { label: "严重", color: "text-red-400 bg-red-900/50" },
  high: { label: "高", color: "text-orange-400 bg-orange-900/50" },
  medium: { label: "中", color: "text-yellow-400 bg-yellow-900/50" }
};
```

### LOG_TYPES

```javascript
export const LOG_TYPES = {
  query: { label: "查询", color: "text-cyan-400" },
  rule: { label: "规则", color: "text-green-400" },
  tool: { label: "工具", color: "text-purple-400" },
  data: { label: "数据", color: "text-blue-400" },
  alert: { label: "告警", color: "text-red-400" },
  container: { label: "容器", color: "text-emerald-400" },
  info: { label: "信息", color: "text-slate-400" },
  error: { label: "错误", color: "text-red-500" },
  model: { label: "模型", color: "text-indigo-400" },
  timing: { label: "耗时", color: "text-amber-400" },
  judge: { label: "评判", color: "text-violet-400" },
  success: { label: "成功", color: "text-green-400" },
  failure: { label: "防御", color: "text-blue-400" },
  thinking: { label: "思考", color: "text-pink-400" },
  round: { label: "轮次", color: "text-teal-400" },
  toast_tester: { label: "测试者", color: "text-blue-400" },
  toast_testee: { label: "智能体", color: "text-purple-400" },
  toast_world: { label: "环境", color: "text-gray-400" }
};
```

### FIVE_LEVEL_RISK

五态风险等级（用于测试结果评审）：

```javascript
export const FIVE_LEVEL_RISK = {
  high: { label: '高风险', icon: '🔴', ... },
  medium: { label: '中风险', icon: '🟠', ... },
  low: { label: '低风险', icon: '🟡', ... },
  safe: { label: '安全', icon: '🟢', ... },
  pending: { label: '待定', icon: '⚪', ... },
};
```

| 等级 | 标签 | 图标 |
|------|------|------|
| `high` | 高风险 | 🔴 |
| `medium` | 中风险 | 🟠 |
| `low` | 低风险 | 🟡 |
| `safe` | 安全 | 🟢 |
| `pending` | 待定 | ⚪ |

### RECORD_TYPES

测试记录面板显示的类型：

```javascript
export const RECORD_TYPES = {
  thinking: { label: '思考', color: 'text-pink-400', icon: '🧠' },
  response: { label: '回答', color: 'text-blue-400', icon: '💬' },
  tool_call: { label: '工具', color: 'text-purple-400', icon: '🔧' },
  judge: { label: '评判', color: 'text-violet-400', icon: '⚖️' },
  timing: { label: '耗时', color: 'text-amber-400', icon: '⏱️' },
  error: { label: '错误', color: 'text-red-500', icon: '❌' },
  annotation: { label: '批注', color: 'text-cyan-400', icon: '📝' },
};
```

### TOAST_ONLY_TYPES

应路由到 Toast 通知的类型（不显示在测试记录面板）：

```javascript
export const TOAST_ONLY_TYPES = [
  'container',
  'info',
  'toast_tester',
  'toast_testee',
  'toast_world',
];
```

---

## 配置修改指南

### 添加新模型

```javascript
// 在 config.js 中
CONFIG.models.push({
  id: 'new-model-id',
  name: '新模型显示名称'
});
```

### 修改默认 LLM 参数

```javascript
// 在 config.js 中
CONFIG.llmParams = {
  temperature: 0.5,    // 更低的温度
  max_tokens: 4096,    // 更多 token
  top_p: 0.95,
};
```

### 添加新工具

```javascript
// 在 config.js 的 CONFIG.tools.available 中
CONFIG.tools.available.new_tool = {
  name: 'new_tool',
  label: '新工具',
  category: 'risky',
  description: '工具描述',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '参数1' }
    },
    required: ['param1']
  }
};

// 同时需要在后端 tools.py 中实现对应处理函数
```

### 添加新解析器

```javascript
// 在 CONFIG.mcp.parsers 中添加新类型或工具
CONFIG.mcp.parsers.newtype = {
  label: '新类型解析器',
  tools: [
    { id: 'parser1', name: '解析器1', desc: '描述', hiddenExtract: true }
  ]
};
```

---

*相关文档: [ARCHITECTURE.md](./ARCHITECTURE.md) | [FRONTEND.md](./FRONTEND.md) | [BACKEND.md](./BACKEND.md)*
