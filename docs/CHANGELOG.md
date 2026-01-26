# 变更日志

本文档记录项目的重要变更，并提供文档维护规范。

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

### 条目格式

```markdown
## [版本号] - YYYY-MM-DD

### Added
- 新增 XXX 功能 (#issue编号)

### Changed
- 修改 XXX 行为

### Fixed
- 修复 XXX 问题
```

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

## 文档影响清单模板

在提交 PR 时，使用此模板记录文档影响：

```markdown
## 文档影响

### 需要更新的文档
- [ ] FRONTEND.md - 新增状态: xxx
- [ ] CONFIG.md - 新增配置: xxx
- [ ] API-REFERENCE.md - 新增端点: xxx
- [ ] SCENARIOS.md - 新增场景: xxx
- [ ] CHANGELOG.md - 记录变更

### 不需要更新
- ARCHITECTURE.md (架构无变化)
- BACKEND.md (后端无变化)
```

---

## 变更记录

### [1.5.0] - 2026-01-26

#### Added
- **AI 格式转换** - 使用 LLM 将任意格式数据转换为标准 Dataset 格式
  - `src/datasetConverter.js` - 转换模块，提供 `convertToDatasetFormat()` 函数
  - `useDatasets` 新增 `pendingConversion`、`isConverting` 状态
  - `executeConversion()`、`cancelConversion()` 函数
  - 格式转换确认弹窗（非 Dataset 格式时触发）

#### Changed
- **Schema 版本升级** - 2.0.0 → 2.1.0
- **detectSchemaVersion 改进** - 基于结构检测类型，不再严格依赖版本号
  - 支持 Dataset、RecordingSession、TestCase、PlaybackSequence、TestInput、TestCaseV1 等类型
  - 缺失或未知版本号的标准结构数据可正确识别
- **importDatasetFromFile 返回值变更** - 返回 `{saved, needsConversion}` 对象，支持转换流程

#### Docs
- 更新 BATCH-TESTING.md - 添加"格式转换功能"章节
- 更新 FRONTEND.md - 添加 useDatasets Hook 及状态表
- 更新 TEST-CASE-SCHEMA.md - 版本更新和检测逻辑说明

---

### [1.4.1] - 2026-01-26

#### Docs
- **新增 FILE-PARSER.md** - 独立的文件解析服务文档
  - 解析器详解（PDF/DOCX/XLSX/图片）
  - `/file-parser/*` API 参考
  - 容器化实现说明
  - 扩展指南（添加新解析器/新文件类型）
- **更新 API-REFERENCE.md** - 添加 File Parser API 章节
- **更新 BACKEND.md** - 补充缺失的路由和服务文件
  - 新增路由：file_parser.py, datasets.py, test_results.py, report_templates.py
  - 新增服务：mcp_notion.py, mcp_github.py, mcp_database.py, mcp_http.py, mcp_slack.py, mcp_calendar.py, mcp_storage.py, mcp_memory.py
- **更新 ARCHITECTURE.md** - 补充路由概览（8 个路由前缀）
- **更新 MCP-ARCHITECTURE.md** - 区分文件解析与 MCP Server
  - 明确文件解析已独立为 `/file-parser/*` 路由
  - 添加 8 个新 MCP Server 详情
- **更新 CONFIG.md** - 添加 8 个新 MCP Server 配置
- **更新 README.md** - 文档导航添加 FILE-PARSER.md, MCP-ARCHITECTURE.md, RAG-ARCHITECTURE.md

---

### [1.4.0] - 2026-01-26

#### Added
- **批量测试模块** - 从数据集选择用例进行批量自动化测试
  - `src/components/BatchTestModal.jsx` - 用例选择弹窗组件
  - `src/testResultsApi.js` - 测试结果 API 客户端
  - `backend/app/routers/test_results.py` - 测试结果 API 路由
  - `backend/app/services/test_results_storage.py` - 测试结果存储服务
  - 支持暂停/继续/取消测试
  - 支持导出 JSON 报告或保存到服务器
  - 左侧栏"📊 已测试"视图查看历史报告
- **数据集模板** - `public/templates/dataset-template.json`
  - 包含 F1-F5 各能力级别的完整用例示例
  - 详细的字段说明注释

#### Changed
- 左侧栏"📁 已保存"改为"📊 已测试"，用于查看批量测试报告
- 批量测试时标题区动态显示当前测试用例信息

#### Fixed
- **批量测试执行记录序号错乱** - 使用 `flushSync` 强制同步重置状态
- **思考记录无法跳转** - 批量测试思考记录添加 `thinkingIndex` 支持"查看"跳转

#### Docs
- 新增 [BATCH-TESTING.md](./BATCH-TESTING.md) - 批量测试模块文档
- 更新 [API-REFERENCE.md](./API-REFERENCE.md) - 添加 Test Results API
- 更新 [README.md](./README.md) - 添加文档链接

---

### [1.3.0] - 2026-01-22

#### Changed
- **清理 F3/F4/F5 场景**: 每个层级保留 1 个空骨架，供人工测试
  - F3-tool-use: 删除 5 个场景，保留 `sandbox.js`
  - F4-rag: 删除 2 个场景，保留 `rag.js`
  - F5-mcp: 删除 12 个场景，保留 `mcp.js`

#### Removed
- 删除 `public/attack-samples/rag/` 目录 (14 个预置文件)
- 删除 F3 场景: configPoison, jumpPad, persistent, financialForgery, financeConfig
- 删除 F4 场景: ragSecurity, ragAttackChain
- 删除 F5 场景: salesData, financeQuery, email, payment, notion, github, database, http, slack, calendar, storage, memory

#### Fixed
- **修复 Dockerfile pip install shell 重定向问题**
  - 原因: `pip install requests>=2.31.0` 中的 `>` 被 shell 解释为重定向，创建空文件 `=2.31.0`
  - 修复: 所有版本约束用引号包裹 `"requests>=2.31.0"`
  - 影响文件:
    - `Dockerfile.terminal-python`
    - `Dockerfile.rag-server`
    - `Dockerfile.file-parser`
    - `Dockerfile.mcp-server`
  - **需要重新构建镜像**: `docker build -f dockerfiles/Dockerfile.terminal-python -t terminal-python:3.11 .`

---

### [1.2.0] - 2026-01-21

#### Added
- **测试用例 v1.0.0 Schema**: 完整的 JSON 格式用于记录、导出、回放测试用例
  - `src/schemas/testCase.js` - 前端 Schema 定义、验证、工具函数
  - 支持 F1-F5 所有能力层级的完整状态记录
  - 支持 SHA-256 校验和验证
- **回放模式**: 从已保存用例恢复完整测试环境并回放执行过程
  - `usePlayback` Hook - 回放状态管理
  - 支持恢复 LLM、工具、沙箱、RAG、MCP 配置
  - 按时序动画回放 messages 和 logs
  - 工具调用过程可视化还原

#### Changed
- **重构 useCases Hook**: 接收 60+ 状态参数，构建完整 v1 测试用例
- **重构 case_storage.py**: 只支持 v1 格式，移除旧格式兼容

#### Removed
- **移除旧格式支持** (Breaking Change)
  - 删除 `SourceScenario`, `TestConfig`, `Judgment` 等旧模型
  - 删除 `migrateOldCaseFormat()` 函数
  - 旧格式用例文件不再自动迁移

#### Breaking Changes
- **已保存的旧格式用例 (.json) 将不再兼容**
  - 影响: `backend/data/saved-cases/` 目录下的旧文件
  - 解决方案: 删除旧文件或手动转换为 v1 格式
- **API 请求格式变更**
  - `POST /cases` 现在要求 v1 格式 (必须包含 `meta`, `source` 字段)
  - 返回格式统一为 v1 结构

#### Docs
- 更新 CHANGELOG.md - 记录 Schema 变更和破坏性改动

---

### [1.1.0] - 2026-01-21

#### Changed
- **App.jsx 重构**: 将 4399 行单文件拆分为模块化结构，减少约 680 行
- 提取 6 个自定义 Hooks 到 `src/hooks/` 目录
- 提取导出函数到 `src/utils/export.js`
- 创建 `src/components/` 目录结构（预留）

#### Added
- `useSandbox` - 沙箱容器管理 Hook
- `useRAG` - RAG 知识库管理 Hook
- `useCases` - 用例持久化 Hook
- `useMCP` - MCP 配置管理 Hook
- `useConversation` - 对话状态管理 Hook
- `useLLMConfig` - LLM 参数配置 Hook
- `src/utils/export.js` - 导出功能模块

#### Docs
- 更新 FRONTEND.md - 添加自定义 Hooks 章节
- 更新 CHANGELOG.md - 记录重构变更

---

### [1.0.0] - 2026-01-21

#### Added
- 初始版本发布
- 5 个能力层级 (F1-F5) 的攻击场景系统
- Docker 沙箱执行环境
- RAG 向量知识库集成
- MCP 文件解析和 Server 工具
- 测试用例持久化存储
- 完整开发文档

#### Docs
- 创建 docs/README.md - 文档导航入口
- 创建 docs/ARCHITECTURE.md - 系统架构总览
- 创建 docs/FRONTEND.md - 前端状态管理详解
- 创建 docs/BACKEND.md - 后端服务实现详解
- 创建 docs/SCENARIOS.md - 场景系统和构建器
- 创建 docs/CONFIG.md - 配置参考
- 创建 docs/API-REFERENCE.md - API 接口文档
- 创建 docs/CHANGELOG.md - 变更日志

---

## 文档版本对应

| 文档版本 | 代码版本 | 日期 |
|----------|----------|------|
| 1.0.0 | dacae7d | 2026-01-21 |

---

## 维护指南

### 添加新场景时

1. 在 `src/scenarios/` 对应目录创建场景文件
2. 在 `src/scenarios/index.js` 注册场景
3. 更新 [SCENARIOS.md](./SCENARIOS.md) 的场景清单
4. 在本文件添加变更记录

### 添加新 API 时

1. 在 `backend/app/routers/` 添加路由
2. 更新 [API-REFERENCE.md](./API-REFERENCE.md)
3. 更新 [BACKEND.md](./BACKEND.md) 路由概览
4. 在本文件添加变更记录

### 修改配置项时

1. 修改 `src/config.js`
2. 更新 [CONFIG.md](./CONFIG.md)
3. 如涉及架构变化，更新 [ARCHITECTURE.md](./ARCHITECTURE.md)
4. 在本文件添加变更记录

### 修改前端状态时

1. 修改 `src/App.jsx`
2. 更新 [FRONTEND.md](./FRONTEND.md) 状态表
3. 在本文件添加变更记录

---

## 贡献者

- 初始文档创建: Claude Code (2026-01-21)

---

*相关文档: [README.md](./README.md)*
