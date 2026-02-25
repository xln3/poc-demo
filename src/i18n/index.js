import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Eagerly loaded namespaces
import zhCommon from './locales/zh/common.json';
import zhConfig from './locales/zh/config.json';
import enCommon from './locales/en/common.json';
import enConfig from './locales/en/config.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { common: zhCommon, config: zhConfig },
      en: { common: enCommon, config: enConfig },
    },
    fallbackLng: 'zh',
    defaultNS: 'common',
    ns: ['common', 'config'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: { useSuspense: false },
  });

// Cache for loaded scenario namespaces
const loadedNamespaces = new Set(['common', 'config']);

/**
 * Dynamically load a scenario translation namespace.
 * @param {string} key - e.g. 'F1-loan'
 * @returns {Promise<void>}
 */
export async function loadScenarioNamespace(key) {
  const ns = `scenario_${key}`;
  if (loadedNamespaces.has(ns)) return;

  try {
    const [zhMod, enMod] = await Promise.all([
      import(`./locales/zh/scenarios/${key}.json`),
      import(`./locales/en/scenarios/${key}.json`),
    ]);
    i18n.addResourceBundle('zh', ns, zhMod.default, true, true);
    i18n.addResourceBundle('en', ns, enMod.default, true, true);
    loadedNamespaces.add(ns);
  } catch (e) {
    console.warn(`[i18n] Failed to load scenario namespace: ${key}`, e);
  }
}

/**
 * Load hidingTechniques namespace lazily.
 */
export async function loadHidingTechniquesNamespace() {
  const ns = 'hidingTechniques';
  if (loadedNamespaces.has(ns)) return;

  try {
    const [zhMod, enMod] = await Promise.all([
      import('./locales/zh/hidingTechniques.json'),
      import('./locales/en/hidingTechniques.json'),
    ]);
    i18n.addResourceBundle('zh', ns, zhMod.default, true, true);
    i18n.addResourceBundle('en', ns, enMod.default, true, true);
    loadedNamespaces.add(ns);
  } catch (e) {
    console.warn('[i18n] Failed to load hidingTechniques namespace', e);
  }
}

// Update HTML lang attribute on language change
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
