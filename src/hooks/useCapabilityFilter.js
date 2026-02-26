import { useState, useCallback, useMemo } from 'react';
import { RISK_ITEMS } from '../riskItems/index.js';
import i18n from '../i18n/index.js';

/**
 * M-S-O-B capability profile definitions from ATTACK-TAXONOMY.md.
 *
 * Each risk item maps to a minimum capability profile.
 * The filter shows only risk items whose required capabilities
 * are within the selected profile.
 */

export const CAPABILITY_AXES = {
  M: {
    get label() { return i18n.t('labels.inputModality'); },
    levels: {
      get M1() { return i18n.t('capabilityDimensions.m1'); },
      get M2() { return i18n.t('capabilityDimensions.m2'); },
      get M3() { return i18n.t('capabilityDimensions.m3'); },
      get M4() { return i18n.t('capabilityDimensions.m4'); },
      get M5() { return i18n.t('capabilityDimensions.m5'); },
    },
  },
  S: {
    get label() { return i18n.t('labels.inputSource'); },
    levels: {
      get S1() { return i18n.t('capabilityDimensions.s1'); },
      get S2() { return i18n.t('capabilityDimensions.s2'); },
      get S3() { return i18n.t('capabilityDimensions.s3'); },
    },
  },
  O: {
    get label() { return i18n.t('labels.outputCapability'); },
    levels: {
      get O1() { return i18n.t('capabilityDimensions.o1'); },
      get O2() { return i18n.t('capabilityDimensions.o2'); },
      get O3() { return i18n.t('capabilityDimensions.o3'); },
    },
  },
  B: {
    get label() { return i18n.t('labels.trustBoundary'); },
    levels: {
      get B1() { return i18n.t('capabilityDimensions.b1'); },
      get B2() { return i18n.t('capabilityDimensions.b2'); },
      get B3() { return i18n.t('capabilityDimensions.b3'); },
      get B4() { return i18n.t('capabilityDimensions.b4'); },
      get B5() { return i18n.t('capabilityDimensions.b5'); },
      get B6() { return i18n.t('capabilityDimensions.b6'); },
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
