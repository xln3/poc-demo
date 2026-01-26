# MCP Server 实现架构

## 概述

MCP (Model Context Protocol) Server 功能为 LLM Agent 安全演示平台提供外部工具调用能力。通过配置不同的 MCP 服务，可以模拟真实的 Agent 工具调用场景，用于测试各类安全攻击。

> **注意**：文件解析服务已独立为 `/file-parser/*` 路由，与 MCP Server 无关。详见 [FILE-PARSER.md](./FILE-PARSER.md)。

### 可用 MCP Server

| Server ID | 名称 | 说明 | 工具数量 |
|-----------|------|------|----------|
| `filesystem` | Filesystem | 本地文件系统读写 | 4 |
| `email` | Email | SMTP 邮件发送 | 2 |
| `email_receive` | Email (Receive) | IMAP 邮件接收 | 3 |
| `payment` | Payment | Stripe 支付网关 | 3 |
| `notion` | Notion | Notion 文档管理 | 4 |
| `github` | GitHub | GitHub 仓库操作 | 5 |
| `database` | Database | SQL 数据库查询 | 3 |
| `http` | HTTP | HTTP 请求代理 | 2 |
| `slack` | Slack | Slack 消息通知 | 3 |
| `calendar` | Calendar | 日历事件管理 | 4 |
| `storage` | Storage | 对象存储服务 | 4 |
| `memory` | Memory | 会话记忆存储 | 3 |
| `browser_chrome` | Chrome Browser | Chrome 浏览器数据读取 | 2 |
| `browser_firefox` | Firefox Browser | Firefox 浏览器数据读取 | 2 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  src/App.jsx                                                     │
│  ├── MCP 开关按钮 (mcpServerEnabled)                             │
│  ├── MCP 配置面板                                                │
│  │   ├── 左栏: 服务列表 (14 个 Server)                          │
│  │   └── 右栏: 动态配置表单 + 测试连接 + 启用/禁用               │
│  └── 状态管理                                                    │
│      ├── mcpServerConfigs (localStorage 持久化)                  │
│      └── mcpServerStatus (连接状态)                              │
├─────────────────────────────────────────────────────────────────┤
│  src/config.js                                                   │
│  └── CONFIG.mcpServers.available                                 │
│      ├── 服务定义 (id, name, icon, description)                  │
│      ├── 配置字段 (fields[])                                     │
│      └── 可用工具 (tools[])                                      │
├─────────────────────────────────────────────────────────────────┤
│  src/mcp.js                                                      │
│  └── mcpClient                                                   │
│      ├── testConnection(serverId, config)                        │
│      ├── executeTool(serverId, toolName, params, config)         │
│      └── getServerStatus(serverId)                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────┤
│  backend/app/routers/mcp.py                                      │
│  └── API Endpoints (prefix: /mcp)                                │
│      ├── GET  /health   - 健康检查                               │
│      ├── POST /test     - 测试服务连接                           │
│      ├── POST /tool     - 执行工具调用                           │
│      ├── GET  /servers  - 列出可用服务                           │
│      └── GET  /status/{server_id} - 获取服务状态                 │
├─────────────────────────────────────────────────────────────────┤
│  backend/app/services/                                           │
│  ├── mcp.py              - MCP Server 核心                       │
│  ├── mcp_service.py      - MCP 服务封装                          │
│  ├── mcp_notion.py       - Notion Server                         │
│  ├── mcp_github.py       - GitHub Server                         │
│  ├── mcp_database.py     - Database Server                       │
│  ├── mcp_http.py         - HTTP Server                           │
│  ├── mcp_slack.py        - Slack Server                          │
│  ├── mcp_calendar.py     - Calendar Server                       │
│  ├── mcp_storage.py      - Storage Server                        │
│  ├── mcp_memory.py       - Memory Server                         │
│  ├── mcp_email_receive.py - Email Receive (IMAP)                 │
│  ├── mcp_browser_chrome.py - Chrome Browser                      │
│  └── mcp_browser_firefox.py - Firefox Browser                    │
├─────────────────────────────────────────────────────────────────┤
│  backend/app/models/schemas.py                                   │
│  └── Pydantic Models                                             │
│      ├── McpServerType (enum)                                    │
│      ├── McpTestConnectionRequest/Response                       │
│      ├── McpToolRequest/Result                                   │
│      └── McpServerStatus                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流

### 1. 配置保存流程

```
用户填写配置 → setMcpServerConfigs() → localStorage.setItem()
                                              ↓
页面刷新 → useState 初始化 ← localStorage.getItem()
```

### 2. 测试连接流程

```
点击"测试连接" → mcpClient.testConnection()
                        ↓
              POST /mcp/test
              {server_id, config}
                        ↓
              McpService.test_xxx_connection()
                        ↓
              验证配置有效性 (路径存在/SMTP登录/Stripe API)
                        ↓
              返回 {success, message/error}
                        ↓
              更新 mcpServerStatus 状态
```

### 3. 工具执行流程

```
Agent 请求工具调用 → mcpClient.executeTool()
                            ↓
                  POST /mcp/tool
                  {server_id, tool_name, params, config}
                            ↓
                  McpService.execute_xxx_tool()
                            ↓
                  实际执行操作 (文件IO/SMTP/Stripe)
                            ↓
                  返回 {success, result/error, execution_time_ms}
```

## 服务详情

### Filesystem 服务

| 配置字段 | 说明 |
|---------|------|
| basePath | 根目录路径，所有操作限制在此目录内 |
| allowWrite | 是否允许写入操作 |

**安全措施**:
- 路径遍历防护：所有路径经过 `resolve()` 后验证是否在 basePath 内
- 写入权限控制：需显式启用 allowWrite

### Email 服务

| 配置字段 | 说明 |
|---------|------|
| smtpHost | SMTP 服务器地址 |
| smtpPort | SMTP 端口（默认 587） |
| username | 登录用户名 |
| password | 登录密码 |
| fromAddress | 发件人地址 |

**实现**: 使用 Python 内置 `smtplib`，支持 TLS 加密

### Payment 服务 (Stripe)

| 配置字段 | 说明 |
|---------|------|
| apiKey | Stripe Secret Key (sk_test_* 或 sk_live_*) |
| merchantId | 商户标识，用于订单元数据 |

**API 映射**:
| 工具 | Stripe API |
|-----|-----------|
| payment_create_order | PaymentIntent.create() |
| payment_query_status | PaymentIntent.retrieve() |
| payment_refund | Refund.create() |

**金额单位**: 最小货币单位（如 USD 为 cents，1000 = $10.00）

## 前端组件结构

```jsx
{/* MCP 开关 */}
<input type="checkbox" checked={mcpServerEnabled} />

{/* MCP 配置面板 */}
{mcpServerEnabled && (
  <div className="border-emerald-900/50">
    {/* 标题栏 - 可折叠 */}
    <button onClick={() => setMcpServerConfigCollapsed(!collapsed)}>
      🔌 MCP Server 配置
    </button>

    {!collapsed && (
      <div className="grid grid-cols-3">
        {/* 左栏: 服务列表 */}
        <div>
          {Object.values(CONFIG.mcpServers.available).map(server => (
            <button onClick={() => setSelectedMcpServer(server.id)}>
              {server.icon} {server.name}
              {/* 状态指示器 */}
              <StatusIndicator status={mcpServerStatus[server.id]} />
            </button>
          ))}
        </div>

        {/* 右栏: 配置表单 */}
        <div className="col-span-2">
          {selectedMcpServer && (
            <>
              {/* 动态表单字段 */}
              {server.fields.map(field => (
                <FormField field={field} value={config[field.key]} />
              ))}

              {/* 操作按钮 */}
              <button onClick={testConnection}>测试连接</button>
              <button onClick={toggleEnabled}>启用/禁用</button>

              {/* 工具列表 */}
              <ToolsList tools={server.tools} />
            </>
          )}
        </div>
      </div>
    )}
  </div>
)}
```

## API 接口定义

### POST /mcp/test

测试 MCP 服务连接。

**Request**:
```json
{
  "server_id": "filesystem" | "email" | "payment",
  "config": {
    // 服务特定配置
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Connected to /path/to/workspace"
}
// 或
{
  "success": false,
  "error": "Path does not exist"
}
```

### POST /mcp/tool

执行 MCP 工具调用。

**Request**:
```json
{
  "server_id": "payment",
  "tool_name": "payment_create_order",
  "params": {
    "amount": 1000,
    "currency": "usd",
    "description": "Test order"
  },
  "config": {
    "apiKey": "sk_test_xxx",
    "merchantId": "demo"
  }
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "payment_intent_id": "pi_xxx",
    "client_secret": "pi_xxx_secret_xxx",
    "amount": 1000,
    "currency": "usd",
    "status": "requires_payment_method"
  },
  "execution_time_ms": 234
}
```

## 扩展指南

### 添加新的 MCP 服务

1. **前端配置** (`src/config.js`):
```javascript
mcpServers: {
  available: {
    newService: {
      id: 'newService',
      name: 'New Service',
      icon: '🆕',
      description: '服务描述',
      fields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true }
      ],
      tools: ['new_tool_1', 'new_tool_2']
    }
  }
}
```

2. **后端枚举** (`backend/app/models/schemas.py`):
```python
class McpServerType(str, Enum):
    FILESYSTEM = "filesystem"
    EMAIL = "email"
    PAYMENT = "payment"
    NEW_SERVICE = "newService"  # 添加
```

3. **后端服务** (`backend/app/services/mcp.py`):
```python
async def execute_newservice_tool(self, tool_name, params, config):
    if tool_name == "new_tool_1":
        return await self._new_tool_1(params, config)
    # ...

async def test_newservice_connection(self, config):
    # 验证逻辑
    return {"success": True, "message": "Connected"}
```

4. **后端路由** (`backend/app/routers/mcp.py`):
```python
# 在 test_mcp_connection 和 execute_mcp_tool 中添加分支
elif server_id == McpServerType.NEW_SERVICE:
    result = await mcp_service.execute_newservice_tool(...)
```

## 安全考虑

1. **配置存储**: 敏感配置（API Key、密码）仅存储在浏览器 localStorage，每次工具调用时临时传入后端
2. **路径安全**: Filesystem 服务强制路径在 basePath 内，防止目录遍历攻击
3. **权限控制**: 写入操作需显式启用 allowWrite
4. **API 隔离**: 每次请求独立设置 API Key，不在后端持久化

## 颜色主题

| 功能模块 | 主题色 | Tailwind Class |
|---------|--------|----------------|
| 文件解析 | Purple | `text-purple-*`, `border-purple-*` |
| 工具调用 | Cyan | `text-cyan-*`, `border-cyan-*` |
| RAG | Amber | `text-amber-*`, `border-amber-*` |
| **MCP Server** | **Emerald** | `text-emerald-*`, `border-emerald-*` |

---

## 新增 MCP Server 详情

### Notion 服务

| 配置字段 | 说明 |
|---------|------|
| apiKey | Notion Integration Token |
| workspaceId | 工作区 ID (可选) |

**可用工具**:
- `notion_search` - 搜索页面
- `notion_get_page` - 获取页面内容
- `notion_create_page` - 创建新页面
- `notion_update_page` - 更新页面

### GitHub 服务

| 配置字段 | 说明 |
|---------|------|
| token | GitHub Personal Access Token |
| owner | 仓库所有者 |
| repo | 仓库名称 |

**可用工具**:
- `github_get_repo` - 获取仓库信息
- `github_list_issues` - 列出 Issues
- `github_create_issue` - 创建 Issue
- `github_get_file` - 获取文件内容
- `github_search_code` - 搜索代码

### Database 服务

| 配置字段 | 说明 |
|---------|------|
| connectionString | 数据库连接字符串 |
| type | 数据库类型 (mysql/postgres/sqlite) |

**可用工具**:
- `db_query` - 执行 SQL 查询
- `db_list_tables` - 列出表
- `db_describe_table` - 描述表结构

### HTTP 服务

| 配置字段 | 说明 |
|---------|------|
| baseUrl | API 基础 URL |
| headers | 默认请求头 (JSON) |

**可用工具**:
- `http_request` - 发起 HTTP 请求
- `http_graphql` - GraphQL 查询

### Slack 服务

| 配置字段 | 说明 |
|---------|------|
| token | Slack Bot Token |
| channel | 默认频道 |

**可用工具**:
- `slack_send_message` - 发送消息
- `slack_list_channels` - 列出频道
- `slack_get_history` - 获取消息历史

### Calendar 服务

| 配置字段 | 说明 |
|---------|------|
| provider | 日历提供商 (google/outlook) |
| credentials | OAuth 凭证 |

**可用工具**:
- `calendar_list_events` - 列出事件
- `calendar_create_event` - 创建事件
- `calendar_update_event` - 更新事件
- `calendar_delete_event` - 删除事件

### Storage 服务

| 配置字段 | 说明 |
|---------|------|
| provider | 存储提供商 (s3/gcs/azure) |
| bucket | 存储桶名称 |
| credentials | 访问凭证 |

**可用工具**:
- `storage_list` - 列出对象
- `storage_get` - 获取对象
- `storage_put` - 上传对象
- `storage_delete` - 删除对象

### Memory 服务

| 配置字段 | 说明 |
|---------|------|
| sessionId | 会话 ID |
| maxItems | 最大存储条目数 |

**可用工具**:
- `memory_store` - 存储记忆
- `memory_retrieve` - 检索记忆
- `memory_clear` - 清除记忆

### Email Receive 服务 (IMAP)

| 配置字段 | 说明 |
|---------|------|
| imapHost | IMAP 服务器地址（如 `imap.163.com`） |
| imapPort | IMAP 端口（默认 993） |
| username | 邮箱账号 |
| password | 授权码（非登录密码） |
| useSSL | 是否使用 SSL（默认 true） |

**可用工具**:
- `email_list_inbox` - 列出收件箱邮件
- `email_receive` - 读取邮件内容和附件列表
- `email_download_attachment` - 下载附件（返回 base64）

**实现文件**: `backend/app/services/mcp_email_receive.py`

### Browser Chrome 服务

| 配置字段 | 说明 |
|---------|------|
| profilePath | Chrome 配置目录（留空自动检测） |

**默认路径**:
- Linux: `~/.config/google-chrome/Default`
- macOS: `~/Library/Application Support/Google/Chrome/Default`

**可用工具**:
- `chrome_get_cookies` - 读取 cookies（AES 加密密文）
- `chrome_get_history` - 读取浏览历史

**实现文件**: `backend/app/services/mcp_browser_chrome.py`

**安全说明**: Chrome 使用 OS 级别加密存储 cookies，本服务返回加密后的密文（base64 格式），用于演示数据泄露风险。

### Browser Firefox 服务

| 配置字段 | 说明 |
|---------|------|
| profilePath | Firefox 配置目录（留空自动检测） |

**默认路径**:
- Linux: `~/.mozilla/firefox/*.default*`
- macOS: `~/Library/Application Support/Firefox/Profiles/*.default*`

**可用工具**:
- `firefox_get_cookies` - 读取 cookies（明文）
- `firefox_get_history` - 读取浏览历史

**实现文件**: `backend/app/services/mcp_browser_firefox.py`

**安全说明**: Firefox cookies 以明文存储在 SQLite 数据库中，可直接读取。

---

## 常见问题

### 163 邮箱 IMAP "Unsafe Login" 错误

**问题现象**:

使用 Email Receive 服务连接 163 邮箱时，登录成功但执行操作时报错：
```
EXAMINE Unsafe Login. Please contact kefu@188.com for help
```

**根本原因**:

163 邮箱（网易）的安全策略要求第三方客户端必须发送 **IMAP ID 命令**（RFC 2971）来表明身份。未发送 ID 命令的客户端会被判定为"不安全登录"。

**解决方案**:

在 `login()` 成功后、`select()` 之前发送 IMAP ID 命令：

```python
def _send_imap_id(self, conn: imaplib.IMAP4) -> None:
    """发送 IMAP ID 命令（RFC 2971）"""
    try:
        args = '("name" "poc-demo" "version" "1.0" "vendor" "LLM-Security-Demo")'
        tag = conn._new_tag()
        cmd = f'{tag.decode()} ID {args}\r\n'
        conn.send(cmd.encode())
        # 读取响应直到收到 tagged 响应
        response = conn.readline()
        while not response.startswith(tag):
            response = conn.readline()
    except Exception as e:
        logger.warning(f"[IMAP] ID command failed: {e}")
```

**IMAP 调用顺序**:

```
1. connect()     → 建立连接
2. login()       → 认证（状态: AUTH）
3. ID command    → 发送客户端身份 ← 关键步骤
4. select()      → 选择邮箱（状态: SELECTED）
5. search()      → 搜索邮件
```

**参考**:
- [RFC 2971 - IMAP4 ID Extension](https://tools.ietf.org/html/rfc2971)
- [博客：163邮箱 Unsafe Login 解决方案](https://blog.yrpang.com/posts/45207/)

### Chrome 数据库锁定

**问题**: 读取 Chrome 数据时报 "database is locked"

**原因**: Chrome 正在运行，锁定了 SQLite 数据库

**解决**:
1. 关闭 Chrome 浏览器后重试
2. 或者代码中复制数据库文件到临时目录后读取（已实现）

### Firefox Profile 找不到

**问题**: 报错 "Firefox profile not found"

**原因**: Firefox 未安装或使用了非标准的 profile 目录

**解决**: 在配置中手动指定 `profilePath`，例如：
```
~/.mozilla/firefox/abc123.default-release
```

---

*相关文档: [FILE-PARSER.md](./FILE-PARSER.md) | [CONFIG.md](./CONFIG.md) | [API-REFERENCE.md](./API-REFERENCE.md)*
