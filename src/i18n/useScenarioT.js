import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadScenarioNamespace } from './index.js';
import { SCENARIO_NS_MAP } from './scenarioKeys.js';

/**
 * Hook that lazily loads a scenario's translation namespace.
 * Returns a translation function scoped to that scenario.
 *
 * @param {string} scenarioKey - key from SCENARIO_NS_MAP, e.g. 'loan'
 * @returns {{ st: Function, ready: boolean }}
 */
export function useScenarioT(scenarioKey) {
  const [ready, setReady] = useState(false);
  const fileKey = SCENARIO_NS_MAP[scenarioKey];
  const ns = fileKey ? `scenario_${fileKey}` : null;
  const { t, i18n } = useTranslation(ns || 'common');

  useEffect(() => {
    if (!fileKey) {
      setReady(true);
      return;
    }
    let cancelled = false;
    loadScenarioNamespace(fileKey).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [fileKey, i18n.language]);

  // Wrapper that falls back gracefully
  const st = (key, fallback) => {
    if (!ns) return fallback || key;
    const result = t(key, { ns, defaultValue: fallback || key });
    return result;
  };

  return { st, ready };
}
