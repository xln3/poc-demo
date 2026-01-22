# 系统架构

本文档描述 LLM Agent 安全攻击演示平台的整体架构设计。

## 架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│  │   App.jsx    │  │  config.js   │  │ scenarios/   │  │  API 客户端  ││
│  │  (主组件)     │  │  (全局配置)   │  │ (场景定义)    │  │ sandbox/rag ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │   LLM API    │ │ Backend API  │ │  WebSocket   │
            │  (外部服务)   │ │ (FastAPI)    │ │  (实时日志)   │
            └──────────────┘ └──────────────┘ └──────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │   Sandbox    │ │     RAG      │ │     MCP      │
            │ (Docker容器)  │ │ (ChromaDB)   │ │  (工具服务)   │
            └──────────────┘ └──────────────┘ └──────────────┘
```

## 前端架构

### 核心组件

```
src/
├── App.jsx              # 主应用组件，包含所有 UI 和业务逻辑
├── config.js            # 全局配置和 LLM API 调用函数
├── sandbox.js           # 沙箱 API 客户端
├── rag.js               # RAG API 客户端
├── mcp.js               # MCP API 客户端
├── caseApi.js           # 用例存储 API 客户端
└── scenarios/           # 攻击场景系统
    ├── index.js         # 聚合导出
    ├── types.js         # 类型定义
    ├── builders/        # 攻击构建器
    └── F1-F5 目录       # 按能力层级组织的场景
```

### App.jsx 结构

`App.jsx` 是一个大型单文件组件（约 4400 行），包含：

| 区域 | 行数 | 功能 |
|------|------|------|
| 状态声明 | 1-170 | 77 个 useState 定义 |
| Effects | 170-400 | 副作用和服务检测 |
| 工具函数 | 400-1200 | 沙箱、RAG、MCP 操作 |
| 测试逻辑 | 1200-2000 | Mock/Real 测试执行 |
| 渲染函数 | 2000-4400 | UI 组件渲染 |

### 状态管理分组

```javascript
// 1. 核心状态
mode, selectedAttack, messages, logs, isPlaying

// 2. 沙箱状态
sandboxEnabled, sandboxStatus, containerInfo, toolResult

// 3. RAG 状态
ragEnabled, ragMode, ragDocuments, ragQueryResults

// 4. MCP 状态
mcpEnabled, mcpParsers, mcpServerEnabled, mcpServerConfigs

// 5. 测试配置
selectedModel, llmTemperature, llmMaxTokens, thinkingEnabled

// 6. 对话模式
dialogMode, conversationMode, conversationHistory

// 7. UI 状态
showDocument, docTab, expandedLogs, apiStatus
```

## 后端架构

### 服务层次

```
backend/app/
├── main.py              # FastAPI 应用入口
├── routers/             # API 路由层
│   ├── sandbox.py       # 沙箱管理 API
│   ├── rag.py           # RAG 服务 API
│   ├── mcp.py           # MCP 解析/工具 API
│   └── cases.py         # 用例存储 API
├── services/            # 业务逻辑层
│   ├── container.py     # Docker 容器管理
│   ├── tools.py         # 工具执行器
│   ├── log_manager.py   # WebSocket 日志
│   ├── rag_service.py   # RAG 业务逻辑
│   ├── container_rag.py # 容器化 RAG
│   ├── container_parser.py # 容器化文件解析
│   ├── mcp.py           # MCP Server 实现
│   ├── file_parsers.py   # 文件解析器
│   └── case_storage.py  # 用例持久化
└── models/              # 数据模型层
    ├── schemas.py       # Pydantic 模型
    └── rag_schemas.py   # RAG 专用模型
```

### 路由概览

| 路由前缀 | 功能 | 主要端点 |
|----------|------|----------|
| `/sandbox` | 沙箱管理 | container, tool, logs |
| `/rag` | RAG 服务 | upload, query, documents |
| `/mcp` | MCP 服务 | parse, servers, tool |
| `/cases` | 用例存储 | CRUD 操作 |

## 数据流

### Mock 模式数据流

```
用户选择攻击 → 加载场景数据 → 播放对话动画
                                  ↓
                          逐条显示消息/日志
                                  ↓
                            动画播放完成
```

```javascript
// 核心函数：playMockAttack()
1. 清空 messages/logs
2. 遍历 attack.conversations
3. 每条消息延迟显示（打字动画）
4. 同步显示对应日志
5. 播放完成设置 isPlaying=false
```

### Real 模式数据流

```
┌──────────────────────────────────────────────────────────────────┐
│                        Real 测试流程                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. 准备阶段                                                      │
│     ├── 获取 testPayload（自定义或场景默认）                        │
│     ├── 获取 systemPrompt（自定义或场景默认）                       │
│     └── 检查沙箱/RAG/MCP 状态                                     │
│                                                                   │
│  2. RAG 增强（如启用）                                            │
│     ├── 调用 ragClient.query(payload)                            │
│     ├── 格式化检索结果为上下文                                     │
│     └── 附加到 payload                                           │
│                                                                   │
│  3. 文件解析（如有附件）                                          │
│     ├── 调用 MCP 解析器提取文本                                   │
│     └── 附加到 payload                                           │
│                                                                   │
│  4. LLM 调用                                                      │
│     ├── 构建 messages 数组                                        │
│     ├── 调用 CONFIG.callModelWithTools()                         │
│     └── 处理响应（content / tool_calls）                          │
│                                                                   │
│  5. 工具调用循环（如有）                                          │
│     ├── 解析 tool_calls                                          │
│     ├── 在沙箱中执行工具                                          │
│     ├── 返回结果给 LLM                                           │
│     └── 重复直到无工具调用或达到限制                               │
│                                                                   │
│  6. 攻击评判                                                      │
│     ├── 调用 CONFIG.judgeAttackSuccess()                         │
│     ├── 解析评判结果 {success, reason}                           │
│     └── 显示评判结论                                              │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 工具调用数据流

```
LLM 返回 tool_calls
        ↓
解析工具名称和参数
        ↓
┌───────────────────────────┐
│     工具执行分发           │
├───────────────────────────┤
│ read_file    → 容器执行    │
│ write_file   → 容器执行    │
│ run_command  → 容器执行    │
│ http_request → 直接请求    │
│ list_dir     → 容器执行    │
│ query_db     → 模拟返回    │
│ send_email   → 模拟返回    │
│ get_sys_info → 容器执行    │
│ access_secret→ 模拟返回    │
└───────────────────────────┘
        ↓
收集执行结果
        ↓
构建 tool 消息返回 LLM
        ↓
LLM 继续对话或结束
```

## 能力层级与服务映射

| 层级 | 需要服务 | 可选服务 | 说明 |
|------|----------|----------|------|
| F1-conversation | LLM API | - | 纯文本对话，仅需 LLM |
| F2-file-injection | LLM API | MCP 解析器 | 文件解析后注入 prompt |
| F3-tool-use | LLM API, Sandbox | - | 需要 Docker 沙箱执行工具 |
| F4-rag | LLM API, RAG | Sandbox | 需要向量存储服务 |
| F5-mcp | LLM API, MCP Servers | Sandbox, RAG | 需要外部服务集成 |

## 组件依赖关系

### 前端依赖

```
App.jsx
├── config.js         (配置和 LLM 调用)
├── sandbox.js        (沙箱客户端)
├── rag.js            (RAG 客户端)
├── mcp.js            (MCP 客户端)
├── caseApi.js        (用例 API)
└── scenarios/
    ├── index.js      (场景聚合)
    ├── types.js      (类型定义)
    └── builders/     (攻击构建器)
```

### 后端依赖

```
main.py
├── routers/
│   ├── sandbox.py → container.py, tools.py, log_manager.py
│   ├── rag.py → container_rag.py, rag_service.py
│   ├── mcp.py → container_parser.py, file_parsers.py, mcp.py
│   └── cases.py → case_storage.py
└── models/schemas.py (共享数据模型)
```

### 外部依赖

| 服务 | 用途 | 必需性 |
|------|------|--------|
| Docker | 沙箱容器运行时 | F3+ 必需 |
| LLM API | 模型调用 | Real 模式必需 |
| ChromaDB | 向量存储 | F4 RAG 必需 |

## Docker 容器架构

### 可用镜像

| 镜像 | 用途 | 工作目录 |
|------|------|----------|
| `python:3.11-slim` | Python 环境 | /workspace |
| `ubuntu:22.04` | 完整 Linux | /workspace |
| `node:20-slim` | Node.js 环境 | /workspace |
| `file-parser:latest` | 文件解析工具 | /workspace |

### 容器资源限制

```python
# container.py
container = client.containers.run(
    image=image,
    mem_limit="512m",      # 内存限制
    cpu_period=100000,
    cpu_quota=50000,       # 50% CPU
    network_mode="bridge", # 允许网络访问
    command="tail -f /dev/null"  # 保持容器运行
)
```

### 容器生命周期

```
创建请求 → get_or_create_container()
              ↓
         检查现有容器
              ↓
     ┌────────┴────────┐
     ↓                 ↓
   存在且运行        不存在
     ↓                 ↓
   直接返回         创建新容器
                       ↓
                  初始化 workspace
                       ↓
                    返回信息

销毁请求 → destroy_container()
              ↓
         停止并删除容器
              ↓
         清理会话状态
```

## 安全考虑

### 沙箱隔离

- 所有工具调用在 Docker 容器内执行
- 容器资源限制防止资源耗尽
- 路径遍历检查（禁止 `..`）
- 工作目录限制为 `/workspace`

### API 安全

- CORS 白名单限制
- 无持久化认证（演示用途）
- 模拟工具不执行真实操作

### 敏感信息处理

- API Key 通过环境变量配置
- 模拟数据明确标注为 MOCK
- 日志中过滤敏感信息

---

## 扩展点

### 添加新能力层级

1. 在 `src/scenarios/` 创建新目录
2. 在 `types.js` 添加 `CapabilityLevel` 枚举
3. 在 `index.js` 注册新层级
4. 更新 `App.jsx` 中的 `LEVEL_ICONS`

### 添加新后端服务

1. 在 `backend/app/routers/` 创建路由
2. 在 `backend/app/services/` 实现服务
3. 在 `main.py` 注册路由
4. 在前端创建对应 API 客户端

### 添加新工具类型

1. 在 `schemas.py` 添加 `ToolType` 枚举
2. 在 `tools.py` 实现工具处理函数
3. 在 `sandbox.js` 添加客户端方法
4. 在 `config.js` 添加工具定义

---

*相关文档: [FRONTEND.md](./FRONTEND.md) | [BACKEND.md](./BACKEND.md) | [CONFIG.md](./CONFIG.md)*
