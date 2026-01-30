/**
 * F6-messaging-agent: 消息代理攻击场景
 *
 * 专门针对 ClawdBot/Moltbot 类消息集成 AI 助手的攻击场景。
 *
 * 信息来源:
 * - The Register: Clawdbot becomes Moltbot
 * - Bitdefender: Moltbot Security Alert
 * - Aikido: Fake Clawdbot VS Code Extension
 * - SOC Prime: Moltbot Epidemic
 * - Intruder: Clawdbot Security Nightmare
 * - Palo Alto Unit42: MCP Attack Vectors
 */

// 场景导入
import { emailInjection } from './emailInjection.js';
import { skillPoisoning } from './skillPoisoning.js';
import { gatewayExposure } from './gatewayExposure.js';
import { mcpHijacking } from './mcpHijacking.js';
import { covertToolCall } from './covertToolCall.js';
import { dmBypass } from './dmBypass.js';
import { tokenTheft } from './tokenTheft.js';
import { supplyChain } from './supplyChain.js';

// 聚合所有场景
export const clawdbotScenarios = {
  emailInjection,
  skillPoisoning,
  gatewayExposure,
  mcpHijacking,
  covertToolCall,
  dmBypass,
  tokenTheft,
  supplyChain,
};

// 导出单个场景
export {
  emailInjection,
  skillPoisoning,
  gatewayExposure,
  mcpHijacking,
  covertToolCall,
  dmBypass,
  tokenTheft,
  supplyChain,
};

export default clawdbotScenarios;
