import { useTranslation } from 'react-i18next';

/**
 * Compact language toggle button.
 * Shows "EN" when in Chinese mode, "中" when in English mode.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();
  const isChinese = i18n.language?.startsWith('zh');

  const toggle = () => {
    i18n.changeLanguage(isChinese ? 'en' : 'zh');
  };

  return (
    <button
      onClick={toggle}
      className={`px-2 py-1 rounded text-[10px] font-bold transition-colors
        bg-surface-raised text-on-muted hover:bg-surface-hover hover:text-on-canvas
        ${className}`}
      title={isChinese ? 'Switch to English' : '切换到中文'}
      aria-label={isChinese ? 'Switch to English' : '切换到中文'}
    >
      {isChinese ? 'EN' : '中'}
    </button>
  );
}
