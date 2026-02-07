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
├── App.jsx              # 主应用组件（状态编排，约 1000 行）
├── config.js            # 全局配置和 LLM API 调用函数
├── auth.js              # 认证工具（authFetch, getToken, setToken）
├── sandbox.js           # 沙箱 API 客户端
├── rag.js               # RAG API 客户端
├── mcp.js               # MCP API 客户端
├── caseApi.js           # 用例存储 API 客户端
├── datasetApi.js        # 数据集 API 客户端
├── testResultsApi.js    # 测试结果 API 客户端
├── clawdbotApi.js       # ClawdBot API 客户端
├── hooks/               # 19 个自定义 Hooks
├── components/          # 20 个 UI 组件
└── scenarios/           # 攻击场景系统
    ├── index.js         # 聚合导出
    ├── types.js         # 类型定义
    ├── builders/        # 攻击构建器
    ├── F1-conversation/  # 纯文本对话场景
    ├── F2-file-injection/ # 文件注入场景
    ├── F3-tool-use/      # 工具调用场景
    ├── F4-rag/           # RAG 检索场景
    ├── F5-mcp/           # MCP 工具场景
    └── F6-messaging-agent/ # 消息代理场景 (ClawdBot)
```

### App.jsx 结构

`App.jsx` 已从约 4400 行拆分为模块化组件架构，当前约 1000 行，仅保留状态编排和核心逻辑：

| 职责 | 实现位置 |
|------|----------|
| 攻击选择状态 | `useAttackSelection` hook |
| LLM 供应商管理 | `useProviders` hook |
| 测试记录管理 | `useTestRecords` hook |
| Payload 编辑 | `usePayloadEditor` hook |
| 攻击评判 | `useJudgment` hook |
| 面板布局 | `usePanelLayout` hook |
| API 调试 | `useApiInspector` hook |
| 左侧栏 | `LeftSidebar` 组件 |
| 对话面板 | `ConversationPanel` 组件 |
| 右侧面板 | `RightPanel` 组件 |
| 攻击详情 | `AttackDetailPanel` 组件 |
| 真实测试控制 | `RealTestControlPanel` 组件 |
| 弹窗集合 | `AppModals` 组件 |

### 状态管理

状态通过 19 个自定义 Hooks 管理，App.jsx 负责编排和组件间数据传递：

```javascript
// 由 Hooks 管理的状态组（App.jsx 调用 hook 获取）
useAttackSelection()   // 场景选择、展开/折叠
useProviders()         // LLM 供应商列表、选中供应商
useTestRecords()       // 测试记录列表
usePayloadEditor()     // 自定义 payload、系统提示词
useJudgment()          // 评判配置、人类评判
usePanelLayout()       // 面板标签页、布局状态
useApiInspector()      // API 请求/响应检视
useSandbox()           // 沙箱容器
useRAG()               // RAG 知识库
useMCP()               // MCP 解析器和 Server
useCases()             // 用例持久化
useConversation()      // 对话模式
useLLMConfig()         // LLM 参数
usePlayback()          // 用例回放
useDatasets()          // 数据集管理
useTestExecution()     // 批量测试执行
useClawdBotSandbox()   // ClawdBot 沙箱
useToast()             // Toast 通知
useStateCollector()    // 状态收集器
```

## 后端架构

### 服务层次

```
backend/app/
├── main.py              # FastAPI 应用入口
├── auth/                # 认证模块
│   └── security.py      # JWT 认证（require_auth, require_user, require_admin）
├── routers/             # API 路由层（全部需 JWT 认证，health 端点除外）
│   ├── sandbox.py       # 沙箱管理 (/sandbox)
│   ├── rag.py           # RAG 服务 (/rag)
│   ├── mcp.py           # MCP Server 工具 (/mcp)
│   ├── file_parser.py   # 文件解析 (/file-parser)
│   ├── cases.py         # 用例存储 (/cases)
│   ├── datasets.py      # 数据集管理 (/datasets)
│   ├── test_results.py  # 测试结果 (/test-results)
│   └── report_templates.py # 报告模板 (/report-templates)
├── services/            # 业务逻辑层
│   ├── container.py     # Docker 容器管理
│   ├── tools.py         # 工具执行器
│   ├── log_manager.py   # WebSocket 日志
│   ├── rag_service.py   # RAG 业务逻辑
│   ├── container_rag.py # 容器化 RAG
│   ├── container_parser.py # 容器化文件解析
│   ├── file_parsers.py  # 文件解析器定义
│   ├── mcp.py           # MCP Server 核心
│   ├── mcp_*.py         # MCP Server 实现 (notion, github, database, http, slack, calendar, storage, memory)
│   ├── case_storage.py  # 用例持久化
│   ├── dataset_storage.py # 数据集持久化
│   └── test_results_storage.py # 测试结果持久化
└── models/              # 数据模型层
    ├── schemas.py       # Pydantic 模型
    └── rag_schemas.py   # RAG 专用模型
```

### 路由概览

| 路由前缀 | 功能 | 主要端点 |
|----------|------|----------|
| `/` | 根端点 | 服务信息和版本号 |
| `/health` | 健康检查 | 服务状态 |
| `/sandbox` | 沙箱管理 | container, tool, logs |
| `/rag` | RAG 服务 | upload, query, documents |
| `/file-parser` | 文件解析 | parse, parsers |
| `/mcp` | MCP Server 工具 | servers, tool, test |
| `/cases` | 用例存储 | CRUD 操作 |
| `/datasets` | 数据集管理 | CRUD 操作 |
| `/test-results` | 测试结果 | CRUD 操作 |
| `/report-templates` | 报告模板 | 获取模板 |

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
│   ├── file_parser.py → container_parser.py, file_parsers.py
│   ├── cases.py → case_storage.py
│   ├── datasets.py → dataset_storage.py
│   ├── test_results.py → test_results_storage.py
│   └── report_templates.py → (内置模板数据)
└── models/schemas.py, rag_schemas.py (共享数据模型)
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

## 安全架构

### JWT 认证流程

```
登录请求 POST /auth/login
    ↓
验证用户名密码 (bcrypt)
    ↓
签发 JWT (HS256, 8小时有效)
    ↓
前端存储 token → authFetch() 自动附加 Authorization header
    ↓
后端验证流程：
┌─────────────────────────────────────────────┐
│ require_auth（轻量级）                        │
│  ↓ JWT 解码验证                              │
│  ↓ 返回 payload（无 DB 查询）                │
│  用于：绝大部分 API 端点（认证网关）           │
├─────────────────────────────────────────────┤
│ require_user（完整）                          │
│  ↓ JWT 解码验证                              │
│  ↓ DB 查询用户对象                           │
│  用于：需要 User 对象的端点（如 llm_proxy）    │
├─────────────────────────────────────────────┤
│ require_admin                                │
│  ↓ require_user + 检查 role == "admin"       │
│  用于：管理操作                              │
└─────────────────────────────────────────────┘
```

WebSocket 端点无法使用 HTTP header，通过 URL query parameter `?token=xxx` 传递 token，后端手动调用 `jwt.decode()` 验证。

### 认证覆盖

| 路由 | 认证方式 | 免认证端点 |
|------|----------|-----------|
| cases, datasets, test_results, report_templates | 路由级 `dependencies` | 无 |
| rag, mcp, file_parser | 逐端点 `dependencies` | `/health` |
| sandbox, clawdbot | 逐端点 + WebSocket 手动验证 | `/health` |
| llm_proxy, usage | `require_user`（需 User 对象） | 无 |
| auth | 无需认证 | `/auth/login`, `/auth/register` |

### 沙箱隔离

- 所有工具调用在 Docker 容器内执行
- 容器资源限制防止资源耗尽
- 路径遍历检查（禁止 `..`）
- 工作目录限制为 `/workspace`
- 网络隔离：独立子网 `poc-sandbox-isolated`，iptables 阻止访问内网

### Nginx 安全

- CORS 白名单限制
- 安全响应头：X-Frame-Options, X-Content-Type-Options, CSP 等
- TLS 配置模板（注释状态，激活时取消注释）

### 敏感信息处理

- API Key 通过环境变量配置
- JWT 密钥通过 `JWT_SECRET_KEY` 环境变量配置
- 模拟数据明确标注为 MOCK
- 日志中过滤敏感信息

---

## 数据 Schema

### Schema 版本演进

| 版本 | 发布日期 | 主要变更 |
|------|----------|----------|
| 1.0.0 | 2026-01 | 初始版本：TestCaseV1 |
| 2.0.0 | 2026-01 | 三层架构：TestInput, State, PlaybackSequence |
| 2.1.0 | 2026-01 | Dataset + RecordingSession 架构 |
| **2.2.0** | **2026-01** | **Benchmark 数据支持（本版本）** |

### Schema v2.2.0 新增字段

**目标**：支持 CyberSecEval2、AgentHarm 等学术 Benchmark 数据导入。

#### Dataset Case 扩展

```javascript
{
  "id": "case-001",
  "name": "测试用例名",
  "capability": "F3",
  "input": { /* TestInput */ },
  "criteria": {
    "expectedBehavior": "...",
    "riskLevelConditions": { /* ... */ },

    // v2.2.0 新增字段
    "referenceAnswer": "标准答案（用于自动评分）",
    "answerFormat": "exact_match | regex | semantic_similarity",
    "referenceCode": {
      "language": "c",
      "filename": "vulnerable.c",
      "content": "...",
      "description": "目标代码说明"
    }
  },
  "recording": { /* RecordingSession */ },

  // v2.2.0 新增字段
  "benchmarkMeta": {
    "benchmarkName": "CyberSecEval2",
    "benchmarkVersion": "1.0.0",
    "source": {
      "evalId": "eval_abc123",
      "runId": "run_xyz789",
      "taskName": "cyse2_vulnerability_exploit",
      "taskVersion": "1.0.0",
      "sampleId": "42",
      "datasetName": "constraint_satisfaction"
    },
    "customFields": { /* benchmark 特有字段 */ }
  }
}
```

#### RecordingSession 扩展

```javascript
{
  "meta": { /* ... */ },
  "states": [ /* State 数组 */ ],
  "result": {
    "status": "success",
    "finalResponse": "...",
    "judgment": { /* ... */ },
    "timing": { /* ... */ },

    // v2.2.0 新增字段
    "tokenUsage": {
      "inputTokens": 1234,
      "outputTokens": 567,
      "reasoningTokens": 890,
      "totalTokens": 2691
    },
    "evaluation": {
      "rawScore": {
        "value": 0.8,         // float 或 "C"/"I" 等类别值
        "type": "float"       // "float" | "categorical"
      },
      "score": 0.8,           // 归一化分数（0.0-1.0）
      "details": {
        "history": [ /* 评分步骤 */ ],
        "constraintsSatisfied": 16,
        "constraintsTotal": 20,
        "metadata": { /* inspector/judge 输出 */ }
      }
    }
  }
}
```

#### Sandbox 扩展

```javascript
{
  "capabilities": {
    "sandbox": {
      "enabled": true,
      "image": "python:3.11-slim",
      "presetFiles": {},

      // v2.2.0 新增字段
      "buildCommands": [
        "gcc -o vulnerable vulnerable.c",
        "./vulnerable"
      ]
    }
  }
}
```

### 向后兼容性

- 所有 v2.2.0 新增字段均为 `Optional`，默认值为 `null`
- v2.1.0 和 v2.0.0 数据可直接导入，无需迁移
- Pydantic 验证层不会剥离未知字段

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
