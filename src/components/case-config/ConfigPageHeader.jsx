import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

export default function ConfigPageHeader({ onSave, onImportFromEval, saving }) {
  const { t } = useTranslation();
  const { config, updateField, resetConfig } = useCaseConfig();

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={config.meta.name}
          onChange={(e) => updateField('meta.name', e.target.value)}
          placeholder={t('caseConfig.caseName')}
          className="w-full text-lg font-semibold bg-transparent border-none outline-none text-on-canvas
                     placeholder:text-on-dim/50 focus:ring-0"
        />
        <input
          type="text"
          value={config.meta.description}
          onChange={(e) => updateField('meta.description', e.target.value)}
          placeholder={t('caseConfig.caseDescription')}
          className="w-full text-sm bg-transparent border-none outline-none text-on-dim mt-0.5
                     placeholder:text-on-dim/40 focus:ring-0"
        />
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {onImportFromEval && (
          <button
            type="button"
            onClick={onImportFromEval}
            className="px-3 py-1.5 text-sm bg-surface border border-edge rounded-lg
                       text-on-surface hover:bg-surface-hover"
          >
            {t('caseConfig.importFromEval')}
          </button>
        )}
        <button
          type="button"
          onClick={resetConfig}
          className="px-3 py-1.5 text-sm bg-surface border border-edge rounded-lg
                     text-on-surface hover:bg-surface-hover"
        >
          {t('configPage.reset')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('buttons.saving') : t('buttons.save')}
        </button>
      </div>
    </div>
  );
}
