export { ThreatCategory, ThreatSubcategory, RiskGoal } from './taxonomy.js';
export { RISK_ITEMS, RISK_ITEMS_BY_ID } from './items.js';
export { LEGACY_CASE_MAP } from './legacyCases.js';

import { ThreatCategory, ThreatSubcategory } from './taxonomy.js';
import { RISK_ITEMS } from './items.js';
import { LEGACY_CASE_MAP } from './legacyCases.js';
import { SCENARIOS } from '../scenarios/index.js';

/**
 * Build a 4-level tree: Category → Subcategory → RiskItem → LegacyCases
 *
 * Returns:
 * {
 *   T1: {
 *     ...ThreatCategory.T1,
 *     subcategories: {
 *       'T1.1': {
 *         ...ThreatSubcategory['T1.1'],
 *         riskItems: [
 *           {
 *             ...riskItem,
 *             cases: [{ scenario, attackIndex, attack, scenarioData }]
 *           }
 *         ]
 *       }
 *     }
 *   }
 * }
 */
export function getRiskTree() {
  const tree = {};

  // Initialize categories
  for (const [catId, cat] of Object.entries(ThreatCategory)) {
    tree[catId] = {
      ...cat,
      subcategories: {},
    };
  }

  // Initialize subcategories under their parent categories
  for (const [subId, sub] of Object.entries(ThreatSubcategory)) {
    if (tree[sub.parent]) {
      tree[sub.parent].subcategories[subId] = {
        ...sub,
        id: subId,
        riskItems: [],
      };
    }
  }

  // Place risk items into subcategories and resolve legacy cases
  for (const item of RISK_ITEMS) {
    const sub = tree[ThreatSubcategory[item.threatClass]?.parent]
      ?.subcategories[item.threatClass];
    if (!sub) continue;

    const legacyCases = (LEGACY_CASE_MAP[item.id] || [])
      .map(ref => {
        const scenarioData = SCENARIOS[ref.scenario];
        if (!scenarioData) return null;
        const attack = scenarioData.attacks[ref.attackIndex];
        if (!attack) return null;
        return { ...ref, attack, scenarioData };
      })
      .filter(Boolean);

    sub.riskItems.push({ ...item, cases: legacyCases });
  }

  return tree;
}

// Category icons
export const CATEGORY_ICONS = {
  T1: '🗣️',
  T2: '💉',
  T3: '🔓',
  T4: '🧠',
};
