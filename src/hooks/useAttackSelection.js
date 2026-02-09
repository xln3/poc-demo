import { useState, useMemo, useCallback } from 'react';
import { SCENARIOS } from '../scenarios/index.js';
import { ATTACK_TYPES, RISK_LEVELS } from '../config.js';
import { RISK_ITEMS_BY_ID } from '../riskItems/index.js';

/**
 * Manages attack scenario selection state and sidebar expansion.
 * Supports both the new T1-T4 risk tree and legacy scenario references.
 */
export function useAttackSelection() {
  // Selected attack still references legacy SCENARIOS
  const [selectedAttack, setSelectedAttack] = useState(null);

  // T1-T4 tree expansion: { category, subcategory, riskItem }
  const [expanded, setExpanded] = useState({ category: null, subcategory: null, riskItem: null });

  // Selected risk item ID (new)
  const [selectedRiskItem, setSelectedRiskItem] = useState(null);

  // Legacy compatibility: old {type, scenario} expansion
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
    () => selectedRiskItem ? RISK_ITEMS_BY_ID[selectedRiskItem] : null,
    [selectedRiskItem]
  );

  // T1-T4 tree toggles
  const toggleCategory = useCallback((catId) => {
    setExpanded(prev => ({
      category: prev.category === catId ? null : catId,
      subcategory: null,
      riskItem: null,
    }));
  }, []);

  const toggleSubcategory = useCallback((subId) => {
    setExpanded(prev => ({
      ...prev,
      subcategory: prev.subcategory === subId ? null : subId,
      riskItem: null,
    }));
  }, []);

  const toggleRiskItem = useCallback((riskId) => {
    setExpanded(prev => ({
      ...prev,
      riskItem: prev.riskItem === riskId ? null : riskId,
    }));
  }, []);

  // Legacy compatibility aliases
  const toggleType = toggleCategory;
  const toggleScenario = toggleSubcategory;

  return {
    selectedAttack, setSelectedAttack,
    expanded, setExpanded,
    selectedRiskItem, setSelectedRiskItem,
    scenarioListExpanded, setScenarioListExpanded,
    currentScenario, currentAttack, attackType, riskLevel,
    currentRiskItemData,
    toggleCategory, toggleSubcategory, toggleRiskItem,
    toggleType, toggleScenario,
  };
}
