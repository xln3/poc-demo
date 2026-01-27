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
