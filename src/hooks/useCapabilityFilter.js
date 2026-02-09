import { useState, useCallback, useMemo } from 'react';
import { RISK_ITEMS } from '../riskItems/index.js';

/**
 * M-S-O-B capability profile definitions from ATTACK-TAXONOMY.md.
 *
 * Each risk item maps to a minimum capability profile.
 * The filter shows only risk items whose required capabilities
 * are within the selected profile.
 */

export const CAPABILITY_AXES = {
  M: {
    label: '输入模态',
    levels: {
      M1: '纯文本',
      M2: '+文档文件',
      M3: '+图像',
      M4: '+音频',
      M5: '+视频',
    },
  },
  S: {
    label: '输入来源',
    levels: {
      S1: '用户直接',
      S2: '+第三方内容',
      S3: '+系统/环境反馈',
    },
  },
  O: {
    label: '输出能力',
    levels: {
      O1: '纯对话',
      O2: '+内容生成',
      O3: '+工具调用/代码执行',
    },
  },
  B: {
    label: '信任边界',
    levels: {
      B1: '对话边界',
      B2: '计算边界',
      B3: '数据边界',
      B4: '网络边界',
      B5: '身份边界',
      B6: '物理边界',
    },
  },
};

// Minimum capability profile for each risk item
// {riskItemId: {M: 'M1', S: 'S1', O: 'O1', B: 'B1'}}
const RISK_ITEM_PROFILES = {
  // T1 conversation attacks - basic text input
  1:  { M: 'M1', S: 'S1', O: 'O1', B: 'B1' },
  3:  { M: 'M1', S: 'S1', O: 'O1', B: 'B1' },
  4:  { M: 'M1', S: 'S2', O: 'O1', B: 'B1' },
  12: { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  13: { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  // T2 data injection - needs external content
  14: { M: 'M1', S: 'S3', O: 'O3', B: 'B2' },
  16: { M: 'M2', S: 'S2', O: 'O1', B: 'B3' },
  18: { M: 'M3', S: 'S2', O: 'O1', B: 'B1' },
  21: { M: 'M1', S: 'S3', O: 'O3', B: 'B4' },
  // T3 system vulnerabilities
  22: { M: 'M1', S: 'S1', O: 'O1', B: 'B3' },
  // T4.1 output safety
  5:  { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  7:  { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  8:  { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  9:  { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  10: { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  11: { M: 'M1', S: 'S1', O: 'O2', B: 'B3' },
  25: { M: 'M1', S: 'S1', O: 'O2', B: 'B1' },
  // T4.2 behavioral control
  2:  { M: 'M1', S: 'S1', O: 'O1', B: 'B1' },
  6:  { M: 'M1', S: 'S1', O: 'O1', B: 'B1' },
  23: { M: 'M1', S: 'S1', O: 'O1', B: 'B2' },
  26: { M: 'M1', S: 'S1', O: 'O3', B: 'B2' },
  27: { M: 'M1', S: 'S1', O: 'O3', B: 'B2' },
  // T4.3 autonomous decisions
  15: { M: 'M1', S: 'S3', O: 'O3', B: 'B2' },
  17: { M: 'M2', S: 'S2', O: 'O2', B: 'B1' },
  19: { M: 'M3', S: 'S2', O: 'O3', B: 'B6' },
  20: { M: 'M1', S: 'S1', O: 'O3', B: 'B2' },
  24: { M: 'M1', S: 'S1', O: 'O3', B: 'B3' },
};

/**
 * Extract numeric level from a capability string (e.g., 'M3' → 3).
 */
function levelNum(s) {
  return parseInt(s.replace(/[A-Z]/g, ''), 10);
}

/**
 * Check if a risk item's required capability fits within the selected filter.
 */
function matchesFilter(riskItemId, filter) {
  const profile = RISK_ITEM_PROFILES[riskItemId];
  if (!profile) return true; // No profile = always visible

  for (const axis of ['M', 'S', 'O', 'B']) {
    const selectedLevel = filter[axis];
    if (!selectedLevel) continue; // No filter on this axis
    const required = profile[axis];
    if (!required) continue;
    if (levelNum(required) > levelNum(selectedLevel)) return false;
  }
  return true;
}

export function useCapabilityFilter() {
  // Each axis can be null (no filter) or a level string like 'M2'
  const [filter, setFilter] = useState({ M: null, S: null, O: null, B: null });

  const setAxisLevel = useCallback((axis, level) => {
    setFilter(prev => ({
      ...prev,
      [axis]: prev[axis] === level ? null : level,
    }));
  }, []);

  const clearFilter = useCallback(() => {
    setFilter({ M: null, S: null, O: null, B: null });
  }, []);

  const isActive = useMemo(() => {
    return Object.values(filter).some(v => v !== null);
  }, [filter]);

  const filterRiskItem = useCallback((riskItemId) => {
    if (!isActive) return true;
    return matchesFilter(riskItemId, filter);
  }, [filter, isActive]);

  return {
    filter,
    setAxisLevel,
    clearFilter,
    isActive,
    filterRiskItem,
    CAPABILITY_AXES,
    RISK_ITEM_PROFILES,
  };
}
