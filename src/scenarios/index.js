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
import { sandbox } from './F3-tool-use/sandbox.js';
import { finbot } from './F3-tool-use/finbot.js';

// ============ F4-rag: RAG检索 ============
import { rag } from './F4-rag/rag.js';

// ============ F5-mcp: MCP 扩展工具 ============
import { mcp } from './F5-mcp/mcp.js';

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
  sandbox,
  finbot,

  // F4-rag: RAG检索
  rag,

  // F5-mcp: MCP 扩展工具
  mcp
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
    sandbox,
    finbot
  },
  'F4-rag': {
    rag
  },
  'F5-mcp': {
    mcp
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
  sandbox,
  finbot,
  // F4-rag
  rag,
  // F5-mcp
  mcp
};

// 导出类型定义
export * from './types.js';

// 导出构建器
export { AttackBuilder } from './builders/AttackBuilder.js';
export { IndirectAttackBuilder } from './builders/IndirectAttackBuilder.js';

// 导出隐藏技术库
export { HidingTechniques, getTechniquesByFileType, getTechniqueIds } from './constants/hidingTechniques.js';
