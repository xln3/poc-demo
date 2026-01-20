# LLM Agent 安全攻击演示平台

演示 LLM 智能体在不同能力层级下的安全风险，支持模拟演示和真实 API 测试。

## 攻击场景

按智能体能力层级组织，共 17 个攻击场景：

| 层级 | 能力 | 场景数 | 示例 |
|------|------|--------|------|
| F1 | 文本对话 | 5 | 车贷审批绕过、提示词泄露 |
| F2 | 文件处理 | 8 | 简历/合同/报销单中的隐藏指令 |
| F3 | 沙箱工具 | 5 | 配置投毒、跳板攻击、持久化后门 |
| F4 | RAG 检索 | 2 | 知识库污染、攻击链演示 |
| F5 | MCP 扩展 | 4 | 销售数据窃取、支付劫持 |

## 快速开始

```bash
# 前端
npm install && npm run dev    # http://localhost:5173

# 后端（F3-F5 场景需要）
cd backend && ./run.sh        # http://localhost:8000
```

## 配置

复制 `.env.example` 为 `.env`，填入 API 密钥。或编辑 `src/config.js`：

```javascript
api: {
  baseUrl: 'https://your-api-endpoint/v1/chat/completions',
  apiKey: 'your-api-key',
  model: 'mock',  // 'mock' 为模拟模式，换成真实模型名启用 API 测试
}
```

## 项目结构

```
src/scenarios/     # 攻击场景定义
backend/           # FastAPI 后端
  app/services/    # 容器管理、RAG、MCP 服务
  dockerfiles/     # Docker 镜像构建
docs/              # 架构文档
```

## 技术栈

前端：React + Vite + Tailwind CSS
后端：Python FastAPI + Docker
