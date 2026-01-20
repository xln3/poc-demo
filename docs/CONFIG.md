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

### 变量说明

| 变量 | 必需 | 说明 |
|------|------|------|
| `VITE_API_BASE_URL` | 是 | LLM API 端点 URL |
| `VITE_API_KEY` | 是 | API 密钥 |

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
  baseUrl: 'http://localhost:8001',
  enabled: true,
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `baseUrl` | `string` | `'http://localhost:8001'` | RAG 服务端点 |
| `enabled` | `boolean` | `true` | 是否启用 RAG 功能 |

### Sandbox 配置

```javascript
CONFIG.sandbox = {
  baseUrl: 'http://localhost:8000',
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `baseUrl` | `string` | `'http://localhost:8000'` | 沙箱后端端点 |

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
  max_tokens: 2048,
  top_p: 0.9,
}
```

| 参数 | 类型 | 默认值 | 范围 | 说明 |
|------|------|--------|------|------|
| `temperature` | `number` | `0.7` | 0-2 | 采样温度，越高越随机 |
| `max_tokens` | `number` | `2048` | 1-128000 | 最大生成 token 数 |
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
| `query_database` | risky | `query`, `database?` | SQL 查询 |
| `send_email` | risky | `to`, `subject?`, `body?` | 发送邮件 |
| `get_system_info` | safe | (无) | 系统信息 |
| `access_secret` | dangerous | `name`, `namespace?` | 访问密钥 |

---

## MCP 解析器配置

```javascript
CONFIG.mcp = {
  enabled: true,
  serverUrl: 'http://localhost:8000',

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

```javascript
CONFIG.mcpServers = {
  enabled: false,
  apiUrl: 'http://localhost:8000/mcp',

  available: {
    filesystem: {
      id: 'filesystem',
      name: 'Filesystem',
      icon: '📁',
      description: '本地文件系统读写',
      fields: [
        { key: 'basePath', label: '根目录路径', type: 'text', required: true },
        { key: 'allowWrite', label: '允许写入', type: 'checkbox', default: false }
      ],
      tools: ['fs_read_file', 'fs_write_file', 'fs_list_dir', 'fs_search']
    },
    email: {
      id: 'email',
      name: 'Email',
      icon: '📧',
      description: 'SMTP 邮件服务',
      fields: [
        { key: 'smtpHost', label: 'SMTP 主机', type: 'text', required: true },
        { key: 'smtpPort', label: 'SMTP 端口', type: 'number', default: 587 },
        { key: 'username', label: '用户名', type: 'text', required: true },
        { key: 'password', label: '密码', type: 'password', required: true },
        { key: 'fromAddress', label: '发件人地址', type: 'text', required: true }
      ],
      tools: ['email_send', 'email_send_with_attachment']
    },
    payment: {
      id: 'payment',
      name: 'Payment (Stripe)',
      icon: '💳',
      description: 'Stripe 支付网关',
      fields: [
        { key: 'apiKey', label: 'Stripe Secret Key', type: 'password', required: true },
        { key: 'merchantId', label: '商户标识', type: 'text', required: true }
      ],
      tools: ['payment_create_order', 'payment_query_status', 'payment_refund']
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

使用评判模型判断攻击结果。

```javascript
async judgeAttackSuccess(
  attack: Attack,
  systemPrompt: string,
  modelResponse: string,
  actualPayload: string | null = null
): Promise<{success: boolean | null, reason: string}>
```

**返回值**:
- `success`: `true`=攻击成功, `false`=防御成功, `null`=无法判断
- `reason`: 判断理由

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
  round: { label: "轮次", color: "text-teal-400" }
};
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
