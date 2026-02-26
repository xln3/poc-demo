import { useScenarioTranslation } from '../hooks/useScenarioTranslation.js';

/**
 * Component that renders a translated attack name for use in lists.
 * Each instance lazily loads its own scenario namespace (cached after first load).
 *
 * Usage:
 *   <TranslatedAttackName scenarioKey="loan" attack={attack} scenarioData={scenario} />
 *   <TranslatedAttackName scenarioKey="loan" attack={attack} scenarioData={scenario} field="description" />
 */
export default function TranslatedAttackName({ scenarioKey, attack, scenarioData, field = 'name' }) {
  const { translatedAttack, translatedScenario } = useScenarioTranslation(
    scenarioKey, scenarioData, attack
  );
  if (field === 'scenarioName') {
    return (translatedScenario || scenarioData)?.name || scenarioData?.name || '';
  }
  return (translatedAttack || attack)?.[field] || attack?.[field] || '';
}

/**
 * Hook version for use in component bodies (not inside loops/maps).
 */
export function useTranslatedAttackField(scenarioKey, attack, scenarioData, field = 'name') {
  const { translatedAttack, translatedScenario } = useScenarioTranslation(
    scenarioKey, scenarioData, attack
  );
  if (field === 'scenarioName') {
    return (translatedScenario || scenarioData)?.name || scenarioData?.name || '';
  }
  return (translatedAttack || attack)?.[field] || attack?.[field] || '';
}
