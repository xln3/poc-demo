import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listSavedCases, deleteCase } from '../../caseApi.js';

/**
 * CasesPage — overview of saved test cases (v1 + v3 format).
 * Shows case list with agent info, test mode badge, and action buttons.
 */
export default function CasesPage({ setActiveTab, setEditingCaseId }) {
  const { t } = useTranslation();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCases = useCallback(() => {
    setLoading(true);
    listSavedCases()
      .then(setCases)
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  const handleEdit = (caseItem) => {
    setEditingCaseId?.(caseItem.id);
    setActiveTab('config');
  };

  const handleDelete = async (caseItem) => {
    if (!confirm(t('errors.deleteConfirmCase'))) return;
    try {
      await deleteCase(caseItem.id);
      setCases((prev) => prev.filter((c) => c.id !== caseItem.id));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleNewCase = () => {
    setEditingCaseId?.(null);
    setActiveTab('config');
  };

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('batchTest.loading')}</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-on-canvas">{t('nav.cases')}</h1>
          <button
            type="button"
            onClick={handleNewCase}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + {t('caseConfig.newCase')}
          </button>
        </div>

        {cases.length === 0 ? (
          <div className="text-center text-on-muted py-12">
            <div className="text-4xl mb-4">📋</div>
            <div>{t('riskItemsPage.noTestCases')}</div>
            <p className="text-sm mt-2 text-on-dim">{t('caseConfig.createFirstHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => (
              <CaseCard
                key={c.id}
                caseItem={c}
                t={t}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CaseCard({ caseItem, t, onEdit, onDelete }) {
  // v3 fields
  const isV3 = caseItem.schemaVersion === '3.0.0' || caseItem.test_mode;
  const name = caseItem.name || caseItem.metadata?.name || t('labels.unnamed');
  const testMode = caseItem.test_mode;
  const agentName = caseItem.agent_name;
  const description = caseItem.description || caseItem.metadata?.description || '';
  const savedAt = caseItem.savedAt || caseItem.created_at || '';

  // v1 fallbacks
  const scenario = !isV3 ? (caseItem.scenarioName || caseItem.environment?.scenario_name || '') : '';
  const model = !isV3 ? (caseItem.modelId || caseItem.environment?.model || '') : '';

  const modeBadgeColor = {
    single: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    multi: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    interact: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="bg-surface border border-edge rounded-xl p-4 hover:border-blue-500/30 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-on-canvas">{name}</span>
            {testMode && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${modeBadgeColor[testMode] || 'bg-surface text-on-dim'}`}>
                {testMode}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-on-muted line-clamp-2">{description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-on-dim">
            {agentName && <span>{t('caseConfig.agent')}: {agentName}</span>}
            {scenario && <span>{t('labels.scenarioLabel')} {scenario}</span>}
            {model && <span>{t('labels.modelLabel')} {model}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {savedAt && (
            <span className="text-xs text-on-dim">
              {new Date(savedAt).toLocaleDateString()}
            </span>
          )}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onEdit(caseItem)}
              className="px-2 py-1 text-xs bg-surface border border-edge rounded-lg
                         text-on-surface hover:bg-surface-hover"
            >
              {t('buttons.edit')}
            </button>
            <button
              type="button"
              onClick={() => onDelete(caseItem)}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-600 border border-red-500/20
                         rounded-lg hover:bg-red-500/5"
            >
              {t('buttons.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
