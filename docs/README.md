# LLM Agent 安全攻击演示平台 - 开发文档

## 项目概述

本项目是一个 **LLM 智能体安全风险场景演示平台**，用于展示和测试针对大语言模型智能体的各类攻击场景。平台支持模拟演示和真实 API 测试两种模式，涵盖完整性、机密性、可用性和越狱四大类攻击。

### 核心特性

- **5 个能力层级 (F1-F5)**：从基础对话到 MCP 工具扩展，逐级递进
- **20+ 攻击场景**：覆盖车贷审核、客服助手、财务分析等业务场景
- **40+ 攻击样例**：包含各类提示注入、间接注入、工具滥用等攻击
- **双模式测试**：Mock 模拟动画演示 + Real 真实 LLM API 测试
- **自动评判**：使用评判模型判断攻击是否成功
- **Docker 沙箱**：安全隔离的工具执行环境

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + Tailwind CSS v4 |
| 后端 | Python FastAPI + Docker SDK |
| 向量存储 | ChromaDB (容器化) |
| 沙箱 | Docker 容器 (资源限制: 512MB 内存, 50% CPU) |

---

## 快速上手

### 1. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖 (可选，需要沙箱功能时)
cd backend
pip install -r requirements.txt
```

### 2. 配置环境

创建 `.env` 文件（参考 `.env.example`）：

```bash
VITE_API_BASE_URL=https://your-llm-api.com/v1/chat/completions
VITE_API_KEY=your-api-key
```

### 3. 启动服务

```bash
# 仅前端（Mock 模式）
npm run dev

# 前端 + 后端（完整功能）
npm run dev &
cd backend && ./run.sh
```

### 4. 访问应用

- 前端: http://localhost:port
- 后端 API: http://localhost:port
- API 文档: http://localhost:port/docs

---

## 文档导航

| 文档 | 说明 | 适合读者 |
|------|------|----------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统架构总览、数据流图、模块依赖 | 所有开发者 |
| [FRONTEND.md](./FRONTEND.md) | 前端状态管理、组件结构、API 客户端 | 前端开发者 |
| [BACKEND.md](./BACKEND.md) | 后端服务架构、Docker 容器管理、工具执行 | 后端开发者 |
| [TERMINAL.md](./TERMINAL.md) | F3 终端运行模块：架构、API、安全、扩展展望 | 后端/安全开发者 |
| [SCENARIOS.md](./SCENARIOS.md) | 场景数据结构、Builder 模式、扩展指南 | 场景开发者 |
| [TEST-CASE-SCHEMA.md](./TEST-CASE-SCHEMA.md) | 测试用例 JSON 格式规范、回放功能 | 所有开发者/外行 |
| [CONFIG.md](./CONFIG.md) | 配置项完整参考、环境变量说明 | 运维/配置人员 |
| [API-REFERENCE.md](./API-REFERENCE.md) | API 接口文档、请求响应示例 | 前后端开发者 |
| [CHANGELOG.md](./CHANGELOG.md) | 变更日志、文档维护规范 | 所有贡献者 |

---

## 阅读路线图

### 新手入门

1. 阅读本文档了解项目概况
2. 阅读 [ARCHITECTURE.md](./ARCHITECTURE.md) 理解整体架构
3. 运行 `npm run dev` 体验 Mock 模式
4. 阅读 [SCENARIOS.md](./SCENARIOS.md) 了解攻击场景

### 前端开发者

1. [ARCHITECTURE.md](./ARCHITECTURE.md) → 系统架构
2. [FRONTEND.md](./FRONTEND.md) → 状态管理和组件
3. [CONFIG.md](./CONFIG.md) → 前端配置项
4. [SCENARIOS.md](./SCENARIOS.md) → 场景数据结构

### 后端开发者

1. [ARCHITECTURE.md](./ARCHITECTURE.md) → 系统架构
2. [BACKEND.md](./BACKEND.md) → 服务实现
3. [API-REFERENCE.md](./API-REFERENCE.md) → API 接口
4. [CONFIG.md](./CONFIG.md) → 后端配置

### 安全研究者

1. [SCENARIOS.md](./SCENARIOS.md) → 攻击场景详解
2. [ARCHITECTURE.md](./ARCHITECTURE.md) → 能力层级映射
3. 运行真实测试体验攻击效果

---

## 核心概念

### 能力层级 (Capability Levels)

平台按智能体能力复杂度分为 5 个层级：

| 层级 | 名称 | 说明 | 典型场景 |
|------|------|------|----------|
| F1 | 文字对话 | 纯文本输入输出 | 车贷审核、客服助手 |
| F2 | 文件解析 | 处理上传文件 | PDF/DOCX 间接注入 |
| F3 | 终端运行 | 执行沙箱工具 | 配置投毒、持久化后门 |
| F4 | RAG知识 | 向量知识库查询 | 知识库投毒、检索劫持 |
| F5 | MCP连接 | 外部服务集成 | 邮件/支付服务滥用 |

### 攻击类型

| 类型 | 说明 | 图标 |
|------|------|------|
| integrity | 完整性攻击：绕过控制、篡改决策 | 🟠 |
| confidentiality | 机密性攻击：数据泄露、信息窃取 | 🔴 |
| availability | 可用性攻击：拒绝服务、资源耗尽 | 🟡 |
| jailbreak | 越狱攻击：突破安全限制 | 🟣 |

### 测试模式

| 模式 | 说明 | 用途 |
|------|------|------|
| Mock | 预配置对话动画 | 演示、教学 |
| Real | 真实 LLM API 调用 | 安全测试、研究 |

---

## 项目结构

```
poc-demo/
├── src/                      # 前端源码
│   ├── App.jsx              # 主应用组件 (4000+ 行)
│   ├── config.js            # 全局配置
│   ├── sandbox.js           # 沙箱 API 客户端
│   ├── rag.js               # RAG API 客户端
│   ├── mcp.js               # MCP API 客户端
│   ├── caseApi.js           # 用例存储 API 客户端
│   └── scenarios/           # 攻击场景定义
│       ├── index.js         # 场景聚合导出
│       ├── types.js         # 类型定义
│       ├── builders/        # 攻击构建器
│       ├── constants/       # 隐藏技术库
│       ├── F1-conversation/ # 文本对话场景
│       ├── F2-file-injection/ # 文件注入场景
│       ├── F3-tool-use/     # 工具调用场景
│       ├── F4-rag/          # RAG 检索场景
│       └── F5-mcp/          # MCP 工具场景
├── backend/                  # 后端源码
│   └── app/
│       ├── main.py          # FastAPI 入口
│       ├── routers/         # API 路由
│       ├── services/        # 业务服务
│       └── models/          # 数据模型
├── public/                   # 静态资源
│   └── attack-samples/      # 恶意文件样本
├── docs/                     # 开发文档（本目录）
└── CLAUDE.md                # AI 助手指南
```

---

## 常见问题

### Mock 模式和 Real 模式的区别？

- **Mock 模式**：播放预配置的对话动画，无需 API Key，用于演示
- **Real 模式**：调用真实 LLM API，需要配置 API Key，用于测试

### 如何添加新的攻击场景？

参见 [SCENARIOS.md](./SCENARIOS.md) 的"添加新场景"章节。

### 沙箱服务启动失败？

1. 确保 Docker 服务已启动
2. 检查端口 8000 是否被占用
3. 确保有足够的系统资源

### RAG 服务无法使用？

1. 检查后端服务是否运行
2. 确认 ChromaDB 容器正常启动
3. 查看 `backend/` 日志排查问题

---

## 贡献指南

1. 修改代码前阅读相关文档
2. 遵循现有代码风格
3. 更新 [CHANGELOG.md](./CHANGELOG.md) 记录变更
4. 同步更新受影响的文档

---

*最后更新: 2026-01-21*
