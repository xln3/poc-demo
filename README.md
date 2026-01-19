# LLM Agent 安全攻击演示平台

演示 LLM 智能体面临的安全攻击场景，支持模拟演示和真实 API 测试。

## 功能

- **4 类攻击场景**：完整性、机密性、可用性、越狱攻击
- **4 个智能体场景**：车贷审核、汽车客服、汽车维修、金融销售
- **两种测试模式**：
  - 模拟演示：预设对话动画展示攻击过程
  - 真实测试：向真实模型发送攻击 Payload
- **自动评判**：使用 glm-4.7 模型判断攻击是否成功
- **多模型支持**：可切换被测模型

## 运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器访问 http://localhost:5173

## 配置

编辑 `src/config.js` 修改 API 配置：

```javascript
api: {
  baseUrl: 'https://aihubmix.com/v1/chat/completions',
  apiKey: 'your-api-key',
  model: 'doubao-seed-1-8-251228',
}
```

## 技术栈

- React + Vite
- Tailwind CSS
