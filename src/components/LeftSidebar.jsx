import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../i18n/LanguageSwitcher';

/**
 * LeftSidebar - 垂直 tab bar 导航
 * 包含测试/演示模式切换 + 4 个 tab 按钮
 */
export default function LeftSidebar({
  activeTab, setActiveTab,
  appMode, setAppMode,
}) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const tabs = [
    { id: 'config', label: t('nav.config'), icon: '\u2699\uFE0F' },
    { id: 'run', label: t('nav.run'), icon: '\u25B6\uFE0F' },
    { id: 'report', label: t('nav.report'), icon: '\uD83D\uDCCA' },
    { id: 'risk-items', label: t('nav.riskItems'), icon: '\uD83D\uDEE1\uFE0F' },
  ];

  return (
    <div className="w-12 sm:w-[72px] bg-surface flex flex-col items-center py-3 flex-shrink-0 border-r border-edge">
      {/* Mode toggle */}
      <div className="flex flex-col gap-1 w-full px-1 sm:px-2 mb-3">
        <button
          onClick={() => setAppMode('test')}
          className={`py-1.5 rounded text-[10px] font-medium transition ${
            appMode === 'test' ? 'bg-blue-600 text-white' : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
          }`}
        >
          <span className="hidden sm:inline">{t('modes.test')}</span>
          <span className="sm:hidden">T</span>
        </button>
        <button
          onClick={() => setAppMode('demo')}
          className={`py-1.5 rounded text-[10px] font-medium transition ${
            appMode === 'demo' ? 'bg-amber-600 text-white' : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
          }`}
        >
          <span className="hidden sm:inline">{t('modes.demo')}</span>
          <span className="sm:hidden">D</span>
        </button>
      </div>

      <div className="w-8 h-px bg-surface-raised mb-3" />

      {/* Tab buttons */}
      <div className="flex flex-col gap-0.5 w-full" role="tablist">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 mx-1 rounded-lg transition-colors ${
                isActive
                  ? 'bg-canvas text-on-canvas'
                  : 'text-on-muted hover:text-on-canvas hover:bg-surface-muted/50'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[11px] font-medium hidden sm:block">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Language toggle */}
      <LanguageSwitcher className="mb-2" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="mb-3 p-2 rounded-lg text-on-muted hover:text-on-canvas hover:bg-surface-hover transition-colors"
        title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
        aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      >
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
