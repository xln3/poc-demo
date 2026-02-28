import { useTranslation } from 'react-i18next';

const SUB_PAGES = [
  { id: 'agents', icon: '🤖' },
  { id: 'eval-manage', icon: '📋' },
  { id: 'eval-results', icon: '📊' },
];

/**
 * EvalSubNav — horizontal sub-navigation within the Eval tab
 */
export default function EvalSubNav({ active, onChange }) {
  const { t } = useTranslation('eval');

  const labels = {
    'agents': t('nav.agents'),
    'eval-manage': t('nav.evalManage'),
    'eval-results': t('nav.results'),
  };

  // Treat eval-result-detail as part of eval-results for highlighting
  const effectiveActive = active === 'eval-result-detail' ? 'eval-results' : active;

  return (
    <div className="px-6 pt-4 pb-2 border-b border-edge flex gap-1 flex-wrap">
      {SUB_PAGES.map(({ id, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
            effectiveActive === id
              ? 'bg-blue-600 text-white'
              : 'text-on-muted hover:text-on-canvas hover:bg-surface-hover'
          }`}
        >
          <span className="text-xs">{icon}</span>
          {labels[id] || id}
        </button>
      ))}
    </div>
  );
}
