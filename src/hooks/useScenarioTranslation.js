import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { loadScenarioNamespace } from '../i18n/index.js';
import { SCENARIO_NS_MAP, resolveScenarioNsKey } from '../i18n/scenarioKeys.js';
import { getTranslatedScenario, getTranslatedAttack } from '../i18n/scenarioHelpers.js';

/**
 * Hook that provides translated scenario and attack objects.
 *
 * - Lazily loads the correct translation namespace when scenario/attack changes.
 * - For most scenarios, loads SCENARIO_NS_MAP[scenarioKey].
 * - For 'indirectInjection' (F2), loads the namespace corresponding to the
 *   specific attack (e.g. I1 -> F2-resume).
 * - Falls back to original Chinese text when translation is unavailable.
 *
 * @param {string|null} scenarioKey - key in SCENARIOS (e.g. 'loan', 'indirectInjection')
 * @param {Object|null} scenario - raw scenario object from SCENARIOS
 * @param {Object|null} attack - raw attack object from scenario.attacks
 * @returns {{ translatedScenario: Object|null, translatedAttack: Object|null, ready: boolean }}
 */
export function useScenarioTranslation(scenarioKey, scenario, attack) {
  const [ready, setReady] = useState(false);
  const { t, i18n } = useTranslation();

  // Resolve which SCENARIO_NS_MAP key to use
  const nsKey = useMemo(
    () => scenarioKey ? resolveScenarioNsKey(scenarioKey, attack) : null,
    [scenarioKey, attack?.id]
  );

  // The actual file key (e.g. 'F1-loan', 'F2-resume')
  const fileKey = nsKey ? SCENARIO_NS_MAP[nsKey] : null;
  // The i18next namespace
  const ns = fileKey ? `scenario_${fileKey}` : null;

  // Load the namespace when it changes
  useEffect(() => {
    if (!fileKey) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    loadScenarioNamespace(fileKey).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [fileKey, i18n.language]);

  // Translation function scoped to the loaded namespace
  const st = useCallback((key, fallback) => {
    if (!ns) return fallback || key;
    const result = t(key, { ns, defaultValue: fallback || key });
    return result;
  }, [ns, t]);

  // Build translated objects
  const translatedScenario = useMemo(() => {
    if (!scenario) return null;
    if (!ns || !ready) return scenario;
    return getTranslatedScenario(scenario, st);
  }, [scenario, ns, ready, st]);

  const translatedAttack = useMemo(() => {
    if (!attack) return null;
    if (!ns || !ready) return attack;
    return getTranslatedAttack(attack, st);
  }, [attack, ns, ready, st]);

  return { translatedScenario, translatedAttack, ready, st };
}
