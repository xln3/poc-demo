import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

const MODES = [
  { key: 'chat', labelKey: 'caseConfig.modeChat' },
  { key: 'act',  labelKey: 'caseConfig.modeAct' },
];

export default function TestModeSelector() {
  const { t } = useTranslation();
  const { config, setTestMode } = useCaseConfig();

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-on-canvas">
        {t('caseConfig.testMode')}
      </label>
      <div className="flex gap-1 p-0.5 bg-surface border border-edge rounded-lg w-fit">
        {MODES.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTestMode(key)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              config.test_mode === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-on-surface hover:bg-surface-hover'
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
