import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listSavedCases } from '../../caseApi.js';

/**
 * CasesPage — overview of saved test cases
 * Shows case list with agent info, description, and creation time.
 * Sub-tabs Config and Run are separate pages in the left sidebar.
 */
export default function CasesPage({ setActiveTab }) {
  const { t } = useTranslation();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSavedCases()
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('batchTest.loading')}</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-on-canvas">{t('nav.cases')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('config')}
            className="px-3 py-1.5 text-sm bg-surface border border-edge rounded-lg hover:bg-surface-hover text-on-surface"
          >
            {t('nav.config')}
          </button>
          <button
            onClick={() => setActiveTab('run')}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('nav.run')}
          </button>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="text-center text-on-muted py-12">
          <div className="text-4xl mb-4">📋</div>
          <div>{t('riskItemsPage.noTestCases')}</div>
          <p className="text-sm mt-2 text-on-dim">
            {t('errors.noTestResults')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map((c) => (
            <CaseCard key={c.id} caseItem={c} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseCard({ caseItem, t }) {
  const name = caseItem.name || caseItem.metadata?.name || t('labels.unnamed');
  const scenario = caseItem.environment?.scenario_name || caseItem.metadata?.scenario || '';
  const model = caseItem.environment?.model || '';
  const savedAt = caseItem.created_at || caseItem.metadata?.saved_at || '';
  const description = caseItem.metadata?.description || caseItem.environment?.attack_description || '';

  return (
    <div className="bg-surface border border-edge rounded-xl p-4 hover:border-blue-500/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="font-medium text-on-canvas">{name}</div>
          {description && (
            <p className="text-xs text-on-muted line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-on-dim">
            {scenario && <span>{t('labels.scenarioLabel')} {scenario}</span>}
            {model && <span>{t('labels.modelLabel')} {model}</span>}
          </div>
        </div>
        {savedAt && (
          <span className="text-xs text-on-dim flex-shrink-0 ml-4">
            {new Date(savedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
