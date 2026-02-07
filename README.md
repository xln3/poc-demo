# poc-demo · LLM/Agent 安全测评报告工作台

面向 LLM/Agent 安全场景的 **演示 + 真实测试 + 证据回放/复现 + 报告产出** 工作台。

## 产品定位：报告引擎 vs 评测引擎

poc-demo（报告引擎）与 safety-benchmarks（评测引擎）定位互补，分工如下：

| 维度 | safety-benchmarks（评测引擎） | poc-demo（报告引擎） |
|------|------|------|
| 核心方法 | 纯语义评测，基于 Inspect AI | 语义 + 非语义（文件注入、工具调用、RAG、MCP、消息代理） |
| 测试规模 | 量大管饱，30+ benchmarks 批量统计 | 典型 case 精选，逐条复现/重试 |
| 输出物 | Scorecard、统计数据、原始证据 (.eval) | 审计报告、可交互证据回放、Before/After 对比 |
| 面向用户 | 被测方填写测评准备数据 | 被测方回顾结果 + 审计人员生成最终报告 |
| 对接方式 | 产物契约（OSS + DB 索引 + 队列事件） | 消费评测产物，产出审计报告 |

两者协作流程：safety-benchmarks 完成评测后，产物通过 dataset（v2.2.0 schema + benchmarkMeta 溯源）流入 poc-demo 进行证据展示、复现验证与报告生成。

## 核心能力

- **安全风险场景库** — F1–F7 覆盖输入层/能力层/产品层/物理层，19 个场景、50 个预设测评用例（F7 规划中）
- **双模式测试** — Mock 动画演示 + Real API 真实测试
- **LLM-as-Judge 自动判定** — 支持人工复核与判定理由展示
- **证据录制与回放** — 状态机快照，可回放全过程
- **数据集管理** — v2.2.0 schema，benchmarkMeta 溯源
- **批量测试** — 队列执行，结果持久化
- **报告模板与生成** — LLM 辅助报告撰写
- **Docker 沙箱** — 多终端隔离执行环境
- **RAG 知识库** — ChromaDB 容器化
- **MCP 工具服务** — 14 种外部工具集成
- **文件解析与隐藏内容检测** — PDF/DOCX/XLSX/图片
- **JWT 认证 + API Key 加密代理** — Fernet 加密存储，服务端代理 LLM 调用
- **用量追踪与成本分析** — Token/请求/费用统计

## 安全风险场景库

场景按 agent 的**风险暴露面**组织为四层，每层引入不同性质的风险：

**输入层** — 进入 agent 的内容

| 层级 | 风险维度 | 场景 | 用例 | 所需服务 | 说明 |
|------|---------|------|------|----------|------|
| F1 | 对话操控 | 5 | 21 | LLM API | 通过文本直接操控 agent：越权审批、提示词窃取、推荐操控 |
| F2 | 文档注入 | 1 | 8 | LLM API + 文件解析 | 文档中的隐藏指令触发间接注入，攻击者无需直接对话 |

**能力层** — agent 能做的事

| 层级 | 风险维度 | 场景 | 用例 | 所需服务 | 说明 |
|------|---------|------|------|----------|------|
| F3 | 工具滥用 | 2 | 1 | LLM API + Docker | 利用沙箱执行能力，风险从"说错话"升级为"做错事" |
| F4 | 知识投毒 | 1 | — | LLM API + ChromaDB | 污染共享知识库，跨会话持久化影响所有用户 |
| F5 | 服务越权 | 2 | 2 | LLM API + MCP Server | 通过外部服务集成窃取数据或越权操作 |

**产品层** — agent 作为完整软件产品的综合攻击面

| 层级 | 风险维度 | 场景 | 用例 | 所需服务 | 说明 |
|------|---------|------|------|----------|------|
| F6 | 产品安全 | 8 | 18 | LLM API + ClawdBot | 基于真实产品 OpenClaw 的安全事件复现（含真实 CVE） |

**物理层** — agent 在物理环境中执行动作，风险从数字世界扩展到物理世界

| 层级 | 风险维度 | 场景 | 用例 | 所需服务 | 说明 |
|------|---------|------|------|----------|------|
| F7 | 具身安全 | 🚧 | 🚧 | SafeAgentBench + AI2-THOR | 具身 agent 的物理危险行为：火灾、爆炸、触电等 10 类风险 |

> F3/F4/F5 场景包含交互式测试台，用于人工构造和验证风险。
>
> **关于 F6**：F1–F5 分别测试单一风险维度；F6 是真实 AI Agent 产品 [OpenClaw](https://openclaw.ai/) 的案例研究，覆盖该产品的完整攻击面——邮件注入、技能市场投毒（供应链）、Gateway 未授权访问（CVE-2025-49596）、MCP 会话劫持（CVE-2025-6514）、隐蔽工具调用（CVE-2025-52882）、凭证窃取等。
>
> **关于 F7**（规划中）：与 F1–F6 的数字风险不同轴——物理风险关注的是 agent 动作在真实/仿真环境中的物理后果。基于 [SafeAgentBench](https://github.com/SafeAgentBench/SafeAgentBench) 的 750 个具身任务（AI2-THOR 仿真），覆盖火灾、爆炸、触电等 10 类物理危险。证据回放采用视频录制机制，可扩展至无人机、自动驾驶等物理仿真场景。

## 系统架构

```
浏览器 ──→ Vite 代理 (5173) ──→ FastAPI 后端 (8001)
                                   ├── JWT 认证 (/auth)
                                   ├── LLM 代理 (/api/llm) — 加密 Key
                                   ├── Docker 沙箱 (/sandbox)
                                   ├── ClawdBot 沙箱 (/clawdbot)
                                   ├── RAG 知识库 (/rag) — ChromaDB
                                   ├── MCP Server (/mcp) — 14 种工具
                                   ├── 文件解析器 (/file-parser)
                                   ├── 用例管理 (/cases)
                                   ├── 数据集管理 (/datasets)
                                   ├── 测试结果 (/test-results)
                                   ├── 报告模板 (/report-templates)
                                   ├── 用量统计 (/usage)
                                   └── PostgreSQL / SQLite
```

- 前端通过 Vite dev server 代理转发所有 API 请求（不直连后端端口）
- 后端 12 个路由模块，JWT 保护
- API Key 加密存储（Fernet），LLM 调用走服务端代理

## 快速开始

**环境要求**：Node.js 18+、Python 3.11+、Docker（F3/F4/F5/F6 场景需要）

```bash
# 前端
npm install && npm run dev

# 后端
cd backend && pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001

# 首次使用：创建管理员
curl -X POST http://localhost:8001/auth/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your-password"}'
```

> **安全提示**：`npm run dev` / `uvicorn` 属于开发模式服务，不要在公网机器上直接暴露端口；远程开发请用 SSH/VS Code 端口转发。

## 配置

### 后端环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JWT_SECRET_KEY` | JWT 签名密钥 | 开发有默认值，生产必填 |
| `ENCRYPTION_KEY` | Fernet 加密密钥（API Key 存储） | 必填（使用 LLM 代理时） |
| `POC_DATA_ROOT` | 数据存储根目录 | `../poc-data` |
| `CORS_ORIGINS` | 允许的跨域来源（逗号分隔） | localhost:5173/5175 |
| `RATE_LIMIT_DEFAULT` | 全局默认限流 | `120/minute` |

### 前端配置

`src/config.js` 中可配置：模型列表、judge 模型（默认 `glm-4.7`）、LLM 请求默认参数。

详见 [docs/CONFIG.md](docs/CONFIG.md)。

## 项目结构

```
poc-demo/
├── src/                          # React 前端
│   ├── App.jsx                  # 主编排组件
│   ├── config.js                # 全局配置 + LLM 统一接口
│   ├── hooks/                   # 19 个自定义 Hooks
│   ├── components/              # 20 个 UI 组件
│   ├── scenarios/               # 安全风险场景库 (F1–F6)
│   │   ├── builders/           # AttackBuilder / IndirectAttackBuilder
│   │   └── F1~F6 目录
│   ├── schemas/                 # 数据 Schema 定义 (v2.2.0)
│   └── api/                     # API 客户端 (llmClient)
├── backend/                      # Python FastAPI 后端
│   ├── app/
│   │   ├── auth/                # JWT 认证 (security.py, router.py)
│   │   ├── db/                  # SQLAlchemy ORM (PostgreSQL/SQLite)
│   │   ├── routers/             # 12 个路由模块
│   │   └── services/            # 业务逻辑 (容器/RAG/MCP/加密/日志/存储)
│   └── requirements.txt
├── public/attack-samples/        # 攻击样本文件
├── docs/                         # 开发者文档 (11 篇)
└── docker-compose.yml            # 容器编排
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + Vite 6 + Tailwind CSS v4 |
| 后端 | Python FastAPI + SQLAlchemy async |
| 数据库 | PostgreSQL (生产) / SQLite (开发) |
| 沙箱 | Docker SDK + 受限容器 |
| RAG | ChromaDB (容器化) |
| 认证 | JWT (python-jose) + bcrypt |
| 加密 | Fernet (API Key 服务端加密) |
| 限流 | slowapi |

## 部署

- **开发模式** — Vite dev server + FastAPI（见上方「快速开始」）
- **生产模式** — `docker-compose up -d`（Nginx + FastAPI + PostgreSQL）
- **标准生产架构** — 2-ECS（Portal 4C16G + Worker 16C64G）+ RDS + Redis + OSS

详见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## 开发者文档

| 文档 | 内容 |
|------|------|
| [docs/README.md](docs/README.md) | 文档索引与快速导航 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构与数据流 |
| [docs/FRONTEND.md](docs/FRONTEND.md) | 前端：Hooks、组件、批量测试、Schema |
| [docs/BACKEND.md](docs/BACKEND.md) | 后端：路由、服务、子系统 |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | 安全风险场景系统与 Builder |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | API 端点文档 |
| [docs/CONFIG.md](docs/CONFIG.md) | 配置参考 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 部署指南 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 变更日志 |
| [docs/SECURITY-REMEDIATION.md](docs/SECURITY-REMEDIATION.md) | 安全整改报告 |
| [docs/CLAWDBOT-TEST-GUIDE.md](docs/CLAWDBOT-TEST-GUIDE.md) | ClawdBot 测试指南 |

## API 路由总览

| 前缀 | 用途 |
|------|------|
| `/auth` | 认证（登录、注册、Token 刷新） |
| `/api/llm` | LLM 代理（加密 Key 转发） |
| `/sandbox` | Docker 沙箱终端管理 |
| `/clawdbot` | ClawdBot 消息代理沙箱 |
| `/rag` | RAG 知识库（上传、查询） |
| `/mcp` | MCP Server 工具调用 |
| `/file-parser` | 文件解析与隐藏内容检测 |
| `/cases` | 测试用例 CRUD |
| `/datasets` | 数据集管理 CRUD |
| `/test-results` | 批量测试结果 |
| `/report-templates` | 报告模板管理 |
| `/usage` | 用量追踪与成本统计 |
| `/health` | 健康检查 |
