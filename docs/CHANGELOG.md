# 变更日志

本文档记录项目的重要变更。

---

## 格式规范

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

### 变更类型

- **Added** - 新增功能
- **Changed** - 功能变更
- **Deprecated** - 即将废弃的功能
- **Removed** - 已移除的功能
- **Fixed** - Bug 修复
- **Security** - 安全相关修复
- **Docs** - 文档更新

---

## 文档更新触发规则

代码变更后，请检查以下对应关系并更新相关文档：

| 变更类型 | 需更新的文档 |
|----------|--------------|
| 新增 `useState` | [FRONTEND.md](./FRONTEND.md) 状态表 |
| 修改 `config.js` | [CONFIG.md](./CONFIG.md) |
| 新增 API 端点 | [API-REFERENCE.md](./API-REFERENCE.md), [BACKEND.md](./BACKEND.md) |
| 新增场景 | [SCENARIOS.md](./SCENARIOS.md), CHANGELOG.md |
| 新增工具 | [CONFIG.md](./CONFIG.md), [BACKEND.md](./BACKEND.md) |
| 架构变更 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 新增隐藏技术 | [SCENARIOS.md](./SCENARIOS.md) |
| 新增 MCP Server | [CONFIG.md](./CONFIG.md), [API-REFERENCE.md](./API-REFERENCE.md) |

---

## 变更记录

### [2.0.0] - 2026-02-07

#### Security

**全端 JWT 认证加固**

- 新增 `backend/app/auth/security.py` 轻量认证依赖 `require_auth`（JWT-only，无 DB 查询，适合高并发）
- 9 个后端路由全部接入 JWT 认证（health 端点除外）
  - 路由级 `dependencies=[Depends(require_auth)]`：cases, datasets, test_results, report_templates
  - 逐端点 `dependencies=[Depends(require_auth)]`：rag, mcp, file_parser（health 端点免认证）
  - 逐端点认证 + WebSocket 手动 token 验证：sandbox, clawdbot
- 7 个前端 API 客户端全部改用 `authFetch()`（sandbox, rag, mcp, caseApi, datasetApi, testResultsApi, clawdbotApi）
- WebSocket 连接通过 `?token=xxx` query parameter 认证
- XHR 上传通过 `xhr.setRequestHeader('Authorization', ...)` 认证
- Nginx 安全头：X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, CSP
- TLS 配置模板（注释状态，激活时取消注释）
- 新增 `deploy/backup.sh`：PostgreSQL 备份脚本（gzip 压缩，7 天保留）

#### Added

- 新增 `src/components/UsagePanel.jsx`：用量统计组件，集成到 LLMProviderSettings

#### Changed

**前端组件拆分重构**

App.jsx 从约 4000+ 行拆分为模块化组件架构：

- 新增 10 个页面组件：LeftSidebar, ConversationPanel, RightPanel, AttackHeader, AttackDetailPanel, PlaybackControlBar, RealTestControlPanel, AppModals, SavedCaseDetailView, TestResultDetailView
- 提取 3 个自定义 Hooks：useAttackSelection, useProviders, useTestRecords
- App.jsx 降至约 1000 行，仅保留状态编排和核心逻辑

#### Docs

- 更新 [FRONTEND.md](./FRONTEND.md) 组件列表、hooks 列表、状态架构说明
- 更新 [BACKEND.md](./BACKEND.md) 新增认证层说明
- 更新 [API-REFERENCE.md](./API-REFERENCE.md) 新增认证要求标注
- 更新 [ARCHITECTURE.md](./ARCHITECTURE.md) 新增认证流程
- 更新 [DEPLOY.md](./DEPLOY.md) 新增备份、安全头、TLS 说明

---

### [1.9.0] - 2026-01-30

#### Added

**F6-messaging-agent: ClawdBot 安全测试场景**

新增能力层级 F6，专门针对 ClawdBot/Moltbot 类消息集成 AI 助手的攻击场景。

- **8 个攻击场景**：
  - `emailInjection`: 邮件 Prompt Injection 窃取私钥
  - `skillPoisoning`: ClawdHub 技能库投毒
  - `gatewayExposure`: 暴露的控制面板未授权访问 (CVE-2025-49596)
  - `mcpHijacking`: MCP 会话劫持 (CVE-2025-6514)
  - `covertToolCall`: 隐蔽工具调用攻击 (CVE-2025-52882)
  - `dmBypass`: DM 策略绕过
  - `tokenTheft`: Token 窃取和账户接管
  - `supplyChain`: 恶意 VS Code 扩展 RAT 植入

- **ClawdBot 沙箱环境**：
  - 新增 `/clawdbot` API 路由：沙箱管理、攻击注入、行为监控
  - 新增 `clawdbot_sandbox.py`: 沙箱管理服务
  - 新增 `honeypot.py`: 蜜罐文件生成器
  - 新增 `behavior_monitor.py`: 行为监控代理
  - 新增 `Dockerfile.moltbot-sandbox`: 沙箱镜像
  - 新增 `setup-clawdbot-network.sh`: 网络隔离配置

- **前端集成**：
  - 新增 `useClawdBotSandbox.js`: 沙箱管理 Hook
  - 新增 `clawdbotApi.js`: API 客户端

- **攻击样本**：
  - `public/attack-samples/clawdbot/malicious-email.eml`
  - `public/attack-samples/clawdbot/poisoned-skill.js`
  - `public/attack-samples/clawdbot/exploit-gateway.js`
  - `public/attack-samples/clawdbot/fake-extension/`

#### Security

- 基于已知 CVE 和安全报告设计攻击场景
- 沙箱网络隔离：允许外网（测试数据外泄），阻止内网私有 IP
- 蜜罐文件系统：提供假的敏感数据供攻击测试

---

### [1.8.0] - 2026-01-28

#### Added

**Schema v2.2.0 - Benchmark 数据支持**

- **Dataset Case 扩展**：
  - 新增 `benchmarkMeta` 字段：记录 Benchmark 数据溯源（evalId, runId, taskName, sampleId 等）
  - 新增 `criteria.referenceAnswer`：标准答案（用于自动评分）
  - 新增 `criteria.answerFormat`：答案匹配方式（exact_match, regex, semantic_similarity）
  - 新增 `criteria.referenceCode`：目标代码（用于代码漏洞测试）

- **RecordingSession 扩展**：
  - 新增 `result.tokenUsage`：记录实际 Token 消耗（inputTokens, outputTokens, reasoningTokens, totalTokens）
  - 新增 `result.evaluation`：记录评分信息（rawScore, score, details）
  - 支持 Inspect-AI 风格的评分历史和约束满足度统计

- **Sandbox 扩展**：
  - 新增 `capabilities.sandbox.buildCommands`：编译命令数组（用于 CyberSecEval2 等需要编译的测试）

#### Changed

- Schema 版本从 2.1.0 升级到 2.2.0
- 前端 `testCase.js` 更新 `createDatasetCase()` 支持新字段
- 后端新增 7 个 Pydantic 模型：`BenchmarkMeta`, `BenchmarkSource`, `ReferenceCode`, `TokenUsage`, `RawScore`, `EvaluationDetails`, `Evaluation`
- 后端 `datasets.py` 扩展 `TestCriteria` 和 `DatasetCase` 模型
- 模板文件 `dataset-template.json` 更新，包含 v2.2.0 所有新字段示例

#### Docs

- 更新 [ARCHITECTURE.md](./ARCHITECTURE.md) 新增 v2.2.0 schema 说明
- 更新 [API-REFERENCE.md](./API-REFERENCE.md) 新增 Dataset/RecordingSession schema
- 更新 [CHANGELOG.md](./CHANGELOG.md) 记录此次变更

#### Notes

- **向后兼容**：所有新字段均为可选，v2.1.0 数据可直接导入
- **用途**：支持 CyberSecEval2、AgentHarm 等学术 Benchmark 数据导入
- **测试**：新增 `backend/test_v2_2_0_schema.py` 验证兼容性

---

### [1.7.0] - 2026-01-27

#### Security

- 沙箱容器网络隔离：容器从默认 bridge 网络切换到独立子网 `poc-sandbox-isolated`（10.200.0.0/16）
- 新增 `backend/setup-sandbox-network.sh` iptables 脚本，阻止沙箱容器访问内网私有 IP 段（RFC 1918 + 链路本地/云元数据）
- `docker-compose.yml` 新增 `poc-sandbox-isolated` 网络定义

---

### [1.6.2] - 2026-01-27

- 修复部署版本报告模板缺失（Dockerfile 未复制 `backend/data`）
- 修复部署版本数据不持久化（docker-compose 挂载路径不匹配，改用 Named Volume）
- 更新 [BACKEND.md](./BACKEND.md) 新增"数据持久化"章节

---

### [1.6.1] - 2026-01-27

- 修复外网部署模式 API 连接失败（`datasetApi.js`、`testResultsApi.js` 硬编码 `localhost:8000`，改为动态获取主机名）

---

### [1.6.0] - 2026-01-26

- 新增邮件 PDF 攻击场景（F5-mcp，通过邮件附件 PDF 间接注入）
- 新增邮件接收 MCP 服务（IMAP）、浏览器数据 MCP 服务（Firefox/Chrome）
- 新增文件解析 Base64 端点 `POST /file-parser/parse/base64`
- MCP Server 数量从 11 增加到 14

---

### [1.5.0] - 2026-01-26

- 新增 AI 格式转换功能，使用 LLM 将任意格式数据转换为标准 Dataset 格式
- Schema 版本升级 2.0.0 -> 2.1.0，改进 `detectSchemaVersion` 结构检测
- 更新 [FRONTEND.md](./FRONTEND.md)、[BACKEND.md](./BACKEND.md) 相关章节

---

### [1.4.1] - 2026-01-26

- 新增文件解析服务文档（解析器详解、API 参考、扩展指南），内容已合并至 [BACKEND.md](./BACKEND.md)
- 更新 [API-REFERENCE.md](./API-REFERENCE.md)、[BACKEND.md](./BACKEND.md)、[ARCHITECTURE.md](./ARCHITECTURE.md)、[CONFIG.md](./CONFIG.md)

---

### [1.4.0] - 2026-01-26

- 新增批量测试模块（用例选择、暂停/继续/取消、导出报告）
- 新增数据集模板 `public/templates/dataset-template.json`
- 修复批量测试执行记录序号错乱、思考记录无法跳转
- 新增批量测试文档，内容参见 [FRONTEND.md](./FRONTEND.md) 和 [BACKEND.md](./BACKEND.md)

---

### [1.3.0] - 2026-01-22

- 清理 F3/F4/F5 场景，每层级仅保留 1 个空骨架供人工测试
- 删除 `public/attack-samples/rag/` 目录及 19 个预置场景
- 修复 Dockerfile pip install shell 重定向问题（版本约束需引号包裹）

---

### [1.2.0] - 2026-01-21

- 新增测试用例 v1.0.0 Schema（JSON 格式，支持 F1-F5 完整状态记录和 SHA-256 校验）
- 新增回放模式（从已保存用例恢复完整测试环境并按时序回放）
- 移除旧格式支持（Breaking Change：旧格式用例不再兼容，API 要求 v1 格式）

---

### [1.1.0] - 2026-01-21

- App.jsx 重构：4399 行单文件拆分为模块化结构，减少约 680 行
- 提取 6 个自定义 Hooks（useSandbox、useRAG、useCases、useMCP、useConversation、useLLMConfig）
- 提取导出函数到 `src/utils/export.js`

---

### [1.0.0] - 2026-01-21

- 初始版本发布
- 5 个能力层级 (F1-F5) 的攻击场景系统
- Docker 沙箱、RAG 向量知识库、MCP 文件解析和 Server 工具集成
- 测试用例持久化存储
- 创建完整开发文档（ARCHITECTURE、FRONTEND、BACKEND、SCENARIOS、CONFIG、API-REFERENCE）

---

*相关文档: [README.md](./README.md)*
