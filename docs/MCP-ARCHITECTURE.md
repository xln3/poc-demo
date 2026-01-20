# MCP Server 实现架构

## 概述

MCP (Model Context Protocol) Server 功能为 LLM Agent 安全演示平台提供外部工具调用能力。通过配置不同的 MCP 服务（文件系统、邮件、支付），可以模拟真实的 Agent 工具调用场景，用于测试各类安全攻击。

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  src/App.jsx                                                     │
│  ├── MCP 开关按钮 (mcpServerEnabled)                             │
│  ├── MCP 配置面板                                                │
│  │   ├── 左栏: 服务列表 (filesystem/email/payment)               │
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
│      ├── POST /test     - 测试服务连接                           │
│      ├── POST /tool     - 执行工具调用                           │
│      ├── GET  /servers  - 列出可用服务                           │
│      └── GET  /status/{server_id} - 获取服务状态                 │
├─────────────────────────────────────────────────────────────────┤
│  backend/app/services/mcp.py                                     │
│  └── McpService                                                  │
│      ├── Filesystem Tools (本地执行)                             │
│      │   ├── fs_read_file    - 读取文件                          │
│      │   ├── fs_write_file   - 写入文件                          │
│      │   ├── fs_list_dir     - 列目录                            │
│      │   └── fs_search       - 搜索文件                          │
│      ├── Email Tools (smtplib)                                   │
│      │   ├── email_send      - 发送邮件                          │
│      │   └── email_send_with_attachment - 带附件邮件             │
│      └── Payment Tools (Stripe API)                              │
│          ├── payment_create_order  - 创建支付订单                │
│          ├── payment_query_status  - 查询订单状态                │
│          └── payment_refund        - 发起退款                    │
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
