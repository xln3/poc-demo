// ============ 攻击场景聚合导出 ============
// 兼容原有 import { SCENARIOS } from './scenarios' 用法

// ============ F1-conversation: 文本对话 ============
import { loan } from './F1-conversation/loan.js';
import { service } from './F1-conversation/service.js';
import { promptLeakage } from './F1-conversation/promptLeakage.js';
import { vehicleAssistant } from './F1-conversation/vehicleAssistant.js';
import { autoRepair } from './F1-conversation/autoRepair.js';

// ============ F2-file-injection: 文件注入 ============
import { indirectInjection } from './F2-file-injection/index.js';

// ============ F3-tool-use: 沙箱终端工具 ============
import { configPoison } from './F3-tool-use/configPoison.js';
import { jumpPad } from './F3-tool-use/jumpPad.js';
import { persistent } from './F3-tool-use/persistent.js';
import { financialForgery } from './F3-tool-use/financialForgery.js';
import { financeConfig } from './F3-tool-use/financeConfig.js';

// ============ F4-rag: RAG检索 ============
import { ragSecurity } from './F4-rag/ragSecurity.js';
import { ragAttackChain } from './F4-rag/ragAttackChain.js';

// ============ F5-mcp: MCP 扩展工具 ============
import { salesData } from './F5-mcp/salesData.js';
import { financeQuery } from './F5-mcp/financeQuery.js';
import { email } from './F5-mcp/email.js';
import { payment } from './F5-mcp/payment.js';

// 导出与原 scenarios.js 兼容的 SCENARIOS 对象
export const SCENARIOS = {
  // F1-conversation: 文本对话
  loan,
  service,
  promptLeakage,
  vehicleAssistant,
  autoRepair,

  // F2-file-injection: 文件注入
  indirectInjection,

  // F3-tool-use: 沙箱终端工具
  configPoison,
  jumpPad,
  persistent,
  financialForgery,
  financeConfig,

  // F4-rag: RAG检索
  ragSecurity,
  ragAttackChain,

  // F5-mcp: MCP 扩展工具
  salesData,
  financeQuery,
  email,
  payment
};

// 按能力层级分组导出
export const SCENARIOS_BY_LEVEL = {
  'F1-conversation': {
    loan,
    service,
    promptLeakage,
    vehicleAssistant,
    autoRepair
  },
  'F2-file-injection': {
    indirectInjection
  },
  'F3-tool-use': {
    configPoison,
    jumpPad,
    persistent,
    financialForgery,
    financeConfig
  },
  'F4-rag': {
    ragSecurity,
    ragAttackChain
  },
  'F5-mcp': {
    salesData,
    financeQuery,
    email,
    payment
  }
};

// 便于按需导入的单独导出
export {
  // F1-conversation
  loan,
  service,
  promptLeakage,
  vehicleAssistant,
  autoRepair,
  // F2-file-injection
  indirectInjection,
  // F3-tool-use
  configPoison,
  jumpPad,
  persistent,
  financialForgery,
  financeConfig,
  // F4-rag
  ragSecurity,
  ragAttackChain,
  // F5-mcp
  salesData,
  financeQuery,
  email,
  payment
};

// 导出类型定义
export * from './types.js';

// 导出构建器
export { AttackBuilder } from './builders/AttackBuilder.js';
export { IndirectAttackBuilder } from './builders/IndirectAttackBuilder.js';

// 导出隐藏技术库
export { HidingTechniques, getTechniquesByFileType, getTechniqueIds } from './constants/hidingTechniques.js';
