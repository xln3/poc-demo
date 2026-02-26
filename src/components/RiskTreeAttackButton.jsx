import { useScenarioTranslation } from '../hooks/useScenarioTranslation.js';

/**
 * A single attack case button in the risk tree sidebar.
 * Lazily loads the scenario translation namespace and displays the translated attack name.
 */
export default function RiskTreeAttackButton({ caseRef, isSelected, onSelect }) {
  const { scenario: scenarioKey, attackIndex, attack, scenarioData } = caseRef;

  const { translatedAttack, translatedScenario } = useScenarioTranslation(
    scenarioKey, scenarioData, attack
  );

  const displayAttackName = (translatedAttack || attack)?.name || attack?.name || '';
  const displayScenarioName = (translatedScenario || scenarioData)?.name || scenarioData?.name || '';

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-2 py-0.5 rounded text-[11px] truncate ${
        isSelected
          ? 'bg-blue-600 text-white'
          : 'hover:bg-surface-muted/50 text-on-muted'
      }`}
      title={`${displayScenarioName} - ${displayAttackName}`}
    >
      {displayAttackName}
    </button>
  );
}
