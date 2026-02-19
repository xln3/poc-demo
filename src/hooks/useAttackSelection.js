import { useState, useMemo, useCallback } from 'react';
import { SCENARIOS } from '../scenarios/index.js';
import { ATTACK_TYPES, RISK_LEVELS } from '../config.js';
import { SUBCATEGORY_BY_ID } from '../riskItems/index.js';

/**
 * Manages attack scenario selection state and risk tree expansion.
 * Supports the new 15-category benchmark risk tree + legacy scenario cases.
 */
export function useAttackSelection() {
  // Selected attack references legacy SCENARIOS
  const [selectedAttack, setSelectedAttack] = useState(null);

  // Risk tree expansion: { category, subcategory }
  const [expanded, setExpanded] = useState({ category: null, subcategory: null });

  // Selected risk subcategory ID (e.g., '1.1', '5.2')
  const [selectedRiskItem, setSelectedRiskItem] = useState(null);

  // Risk tree collapsed/expanded toggle
  const [scenarioListExpanded, setScenarioListExpanded] = useState(false);

  const currentScenario = useMemo(
    () => selectedAttack ? SCENARIOS[selectedAttack.scenario] : null,
    [selectedAttack]
  );
  const currentAttack = useMemo(
    () => currentScenario?.attacks[selectedAttack?.index] ?? null,
    [currentScenario, selectedAttack]
  );
  const attackType = useMemo(
    () => currentAttack ? ATTACK_TYPES[currentAttack.type] : null,
    [currentAttack]
  );
  const riskLevel = useMemo(
    () => currentAttack ? RISK_LEVELS[currentAttack.level] : null,
    [currentAttack]
  );
  const currentRiskItemData = useMemo(
    () => selectedRiskItem ? SUBCATEGORY_BY_ID[selectedRiskItem] : null,
    [selectedRiskItem]
  );

  const toggleCategory = useCallback((catId) => {
    setExpanded(prev => ({
      category: prev.category === catId ? null : catId,
      subcategory: null,
    }));
  }, []);

  const toggleSubcategory = useCallback((subId) => {
    setExpanded(prev => ({
      ...prev,
      subcategory: prev.subcategory === subId ? null : subId,
    }));
  }, []);

  return {
    selectedAttack, setSelectedAttack,
    expanded, setExpanded,
    selectedRiskItem, setSelectedRiskItem,
    scenarioListExpanded, setScenarioListExpanded,
    currentScenario, currentAttack, attackType, riskLevel,
    currentRiskItemData,
    toggleCategory, toggleSubcategory,
  };
}
