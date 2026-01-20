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

// ============ F3-tool-use: 工具调用 ============
import { configPoison } from './F3-tool-use/configPoison.js';
import { jumpPad } from './F3-tool-use/jumpPad.js';
import { persistent } from './F3-tool-use/persistent.js';
import { salesData } from './F3-tool-use/salesData.js';
import { finance } from './F3-tool-use/finance.js';

// ============ F4-rag: RAG检索 ============
import { ragSecurity } from './F4-rag/ragSecurity.js';

// ============ F5-mcp: MCP工具（占位） ============
// import { mcpScenarios } from './F5-mcp/index.js';

// 导出与原 scenarios.js 兼容的 SCENARIOS 对象
export const SCENARIOS = {
  // F1-conversation: 文本对话
  loan,
  service,
  promptLeakage,
  vehicleAssistant,  // 修复: 之前遗漏了这个导出
  autoRepair,

  // F2-file-injection: 文件注入
  indirectInjection,

  // F3-tool-use: 工具调用
  configPoison,
  jumpPad,
  persistent,
  salesData,
  finance,

  // F4-rag: RAG检索
  ragSecurity
};

// 按能力层级分组导出（新增）
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
    salesData,
    finance
  },
  'F4-rag': {
    ragSecurity
  },
  'F5-mcp': {
    // 占位，待扩展
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
  salesData,
  finance,
  // F4-rag
  ragSecurity
};

// 导出类型定义
export * from './types.js';

// 导出构建器
export { AttackBuilder } from './builders/AttackBuilder.js';
export { IndirectAttackBuilder } from './builders/IndirectAttackBuilder.js';

// 导出隐藏技术库
export { HidingTechniques, getTechniquesByFileType, getTechniqueIds } from './constants/hidingTechniques.js';
