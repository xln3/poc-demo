// ============ 攻击场景聚合导出 ============
// 兼容原有 import { SCENARIOS } from './scenarios' 用法

// 业务场景
import { loan } from './business/loan.js';
import { service } from './business/service.js';

// 系统攻击场景
import { configPoison } from './system/configPoison.js';
import { jumpPad } from './system/jumpPad.js';
import { persistent } from './system/persistent.js';

// 行业场景
import { salesData } from './industry/salesData.js';
import { autoRepair } from './industry/autoRepair.js';
import { finance } from './industry/finance.js';

// 间接注入场景
import { indirectInjection } from './indirect/index.js';

// 导出与原 scenarios.js 兼容的 SCENARIOS 对象
export const SCENARIOS = {
  // 业务智能体场景
  loan,
  service,

  // 系统级 Agent 攻击
  configPoison,
  jumpPad,
  persistent,

  // 行业场景攻击
  salesData,
  autoRepair,
  finance,

  // 间接注入攻击
  indirectInjection
};

// 便于按需导入的单独导出
export {
  loan,
  service,
  configPoison,
  jumpPad,
  persistent,
  salesData,
  autoRepair,
  finance,
  indirectInjection
};

// 导出类型定义
export * from './types.js';

// 导出构建器
export { AttackBuilder } from './builders/AttackBuilder.js';
export { IndirectAttackBuilder } from './builders/IndirectAttackBuilder.js';

// 导出隐藏技术库
export { HidingTechniques, getTechniquesByFileType, getTechniqueIds } from './constants/hidingTechniques.js';
