import { useState, useMemo, useCallback } from 'react';
import { SCENARIOS } from '../scenarios/index.js';
import { ATTACK_TYPES, RISK_LEVELS } from '../config.js';

/**
 * Manages attack scenario selection state and sidebar expansion.
 */
export function useAttackSelection() {
  const [mode, setMode] = useState('real'); // 'mock' | 'real'
  const [selectedAttack, setSelectedAttack] = useState(null);
  const [expanded, setExpanded] = useState({ type: null, scenario: null });
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

  const toggleType = useCallback((type) => {
    setExpanded(prev => ({ type: prev.type === type ? null : type, scenario: null }));
  }, []);

  const toggleScenario = useCallback((scenario) => {
    setExpanded(prev => ({ ...prev, scenario: prev.scenario === scenario ? null : scenario }));
  }, []);

  return {
    mode, setMode,
    selectedAttack, setSelectedAttack,
    expanded, setExpanded,
    scenarioListExpanded, setScenarioListExpanded,
    currentScenario, currentAttack, attackType, riskLevel,
    toggleType, toggleScenario,
  };
}
