import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

const LEVEL_OPTIONS = ['low', 'medium', 'high', 'auto'];

export default function ThinkingSection() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const { enabled, thinking_type, level, budget } = config.thinking;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-on-canvas">
          {t('caseConfig.thinking')}
        </label>
        <button
          type="button"
          onClick={() => updateField('thinking.enabled', !enabled)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600'
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-4' : ''
          }`} />
        </button>
        {thinking_type && (
          <span className="text-xs text-on-dim px-2 py-0.5 bg-surface border border-edge rounded">
            {thinking_type}
          </span>
        )}
      </div>

      {enabled && thinking_type === 'level' && (
        <div className="flex gap-1">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => updateField('thinking.level', opt)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                level === opt
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
              }`}
            >
              {t(`caseConfig.thinkingLevel_${opt}`, opt)}
            </button>
          ))}
        </div>
      )}

      {enabled && thinking_type === 'budget' && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-on-dim">{t('caseConfig.thinkingBudget')}:</label>
          <input
            type="number"
            value={budget}
            onChange={(e) => updateField('thinking.budget', Number(e.target.value))}
            min={1000}
            max={100000}
            step={1000}
            className="w-28 px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                       focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <span className="text-xs text-on-dim">tokens</span>
        </div>
      )}

      {enabled && thinking_type === 'toggle' && (
        <p className="text-xs text-on-dim">{t('caseConfig.thinkingToggleHint')}</p>
      )}
    </div>
  );
}
