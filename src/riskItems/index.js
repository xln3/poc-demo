export { RISK_CATEGORIES, SUBCATEGORY_BY_ID } from './benchmarkRiskItems.js';
export { LEGACY_CASE_MAP } from './legacyCases.js';

import { RISK_CATEGORIES } from './benchmarkRiskItems.js';
import { LEGACY_CASE_MAP } from './legacyCases.js';
import { SCENARIOS } from '../scenarios/index.js';

/**
 * Build a 3-level tree: Category → Subcategory → (Benchmarks + LegacyCases)
 *
 * Returns:
 * {
 *   '1': {
 *     id: '1', name: '模型安全性',
 *     subcategories: {
 *       '1.1': {
 *         id: '1.1', name: '恶意使用', description: '...',
 *         benchmarks: [...],
 *         cases: [{ scenario, attackIndex, attack, scenarioData }]
 *       }
 *     }
 *   }
 * }
 */
export function getRiskTree() {
  const tree = {};

  for (const cat of RISK_CATEGORIES) {
    const subcategories = {};

    for (const sub of cat.subcategories) {
      const legacyCases = (LEGACY_CASE_MAP[sub.id] || [])
        .map(ref => {
          const scenarioData = SCENARIOS[ref.scenario];
          if (!scenarioData) return null;
          const attack = scenarioData.attacks[ref.attackIndex];
          if (!attack) return null;
          return { ...ref, attack, scenarioData };
        })
        .filter(Boolean);

      subcategories[sub.id] = {
        id: sub.id,
        name: sub.name,
        description: sub.description,
        benchmarks: sub.benchmarks,
        cases: legacyCases,
      };
    }

    tree[cat.id] = {
      id: cat.id,
      name: cat.name,
      subcategories,
    };
  }

  return tree;
}

// Category icons for the 15 risk categories
export const CATEGORY_ICONS = {
  '1':  '🛡️',
  '2':  '📝',
  '3':  '⚖️',
  '4':  '🔒',
  '5':  '⚠️',
  '6':  '🔧',
  '7':  '📚',
  '8':  '🎨',
  '9':  '📋',
  '10': '🤝',
  '11': '👤',
  '12': '⏱️',
  '13': '🏢',
  '14': '🔄',
  '15': '🎭',
};
