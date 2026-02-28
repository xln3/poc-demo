import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchResults, fetchAgents, listEvaluations } from '../../api/evalBridgeApi.js';
import { createReport, updateReport } from '../../api/reportEditorApi.js';

const SCENARIOS = [
  { id: 'single_agent', icon: '🤖' },
  { id: 'comparison', icon: '⚔️' },
  { id: 'time_compare', icon: '📈' },
  { id: 'risk_deep_dive', icon: '🔍' },
  { id: 'custom', icon: '✏️' },
];

export default function SourceSelectionPanel({ existingReport, onReportCreated, onCancel }) {
  const { t } = useTranslation('reportEditor');

  // Data sources
  const [results, setResults] = useState([]);
  const [agents, setAgents] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selection state
  const [selectedModels, setSelectedModels] = useState([]);
  const [scenarioType, setScenarioType] = useState('single_agent');
  const [generationMode, setGenerationMode] = useState('modular'); // modular | legacy
  const [title, setTitle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  // Load eval data
  useEffect(() => {
    (async () => {
      try {
        setLoadingData(true);
        const [res, ags, evals] = await Promise.all([
          fetchResults().catch(() => []),
          fetchAgents().catch(() => []),
          listEvaluations().catch(() => []),
        ]);
        setResults(Array.isArray(res) ? res : []);
        setAgents(Array.isArray(ags) ? ags : []);
        setEvaluations(Array.isArray(evals) ? evals : []);
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  // Pre-fill if editing existing report
  useEffect(() => {
    if (existingReport) {
      setTitle(existingReport.title || '');
      setScenarioType(existingReport.scenario_type || 'single_agent');
      setSystemPrompt(existingReport.system_prompt || '');
      const models = existingReport.source_data?.models || [];
      setSelectedModels(models);
    }
  }, [existingReport]);

  // Toggle model selection
  const toggleModel = (modelName) => {
    setSelectedModels(prev =>
      prev.includes(modelName)
        ? prev.filter(m => m !== modelName)
        : [...prev, modelName]
    );
  };

  // Build result items with agent info
  const resultItems = results.map(r => {
    const modelName = (r.model || r.name || '').trim();
    // Find matching agent
    const agent = agents.find(a =>
      a.eval_model_id === modelName || a.model_id === modelName
    );
    // Find matching evaluations
    const relatedEvals = evaluations.filter(e =>
      (e.model_id || '').trim() === modelName && e.status === 'completed'
    );
    return {
      modelName,
      agentName: agent?.name || modelName,
      modelId: agent?.model_id || modelName,
      score: r.overall_score ?? r.score ?? null,
      taskCount: r.task_count ?? Object.keys(r.tasks || {}).length,
      lastEval: relatedEvals[0]?.completed_at || r.created_at,
    };
  });

  // Generate report
  const handleGenerate = async () => {
    if (selectedModels.length === 0) return;

    setCreating(true);
    try {
      const reportTitle = title ||
        (scenarioType === 'single_agent'
          ? `${resultItems.find(r => r.modelName === selectedModels[0])?.agentName || selectedModels[0]} 安全评测报告`
          : `${t(`scenario.${scenarioType}`)} — ${new Date().toLocaleDateString()}`);

      if (existingReport) {
        // Update existing
        await updateReport(existingReport.id, {
          title: reportTitle,
          status: 'draft',
        });
        onReportCreated({
          ...existingReport,
          title: reportTitle,
          scenario_type: scenarioType,
          system_prompt: systemPrompt || null,
          source_data: { models: selectedModels },
        });
      } else {
        // Create new
        const report = await createReport({
          title: reportTitle,
          scenario_type: scenarioType,
          system_prompt: systemPrompt || null,
          source_data: { models: selectedModels },
          generation_mode: generationMode,
        });
        onReportCreated(report);
      }
    } catch (e) {
      console.error('Failed to create report:', e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scroll p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-lg font-semibold text-on-canvas mb-4">{t('source.title')}</h2>
        </div>

        {/* Report title input */}
        <div>
          <label className="block text-xs text-on-muted mb-1">{t('reportTitle')}</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('untitledReport')}
            className="w-full px-3 py-2 bg-surface border border-edge rounded text-sm text-on-canvas placeholder-on-muted/50 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Scenario selector */}
        <div>
          <label className="block text-xs text-on-muted mb-2">{t('scenario.title')}</label>
          <div className="grid grid-cols-1 gap-2">
            {SCENARIOS.map(s => (
              <label
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  scenarioType === s.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-edge hover:border-on-muted/30'
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  value={s.id}
                  checked={scenarioType === s.id}
                  onChange={() => setScenarioType(s.id)}
                  className="sr-only"
                />
                <span className="text-lg flex-shrink-0">{s.icon}</span>
                <div>
                  <div className="text-sm font-medium text-on-canvas">{t(`scenario.${s.id}`)}</div>
                  <div className="text-xs text-on-muted">{t(`scenario.${s.id}_desc`)}</div>
                </div>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  scenarioType === s.id ? 'border-blue-500 bg-blue-500' : 'border-edge'
                }`}>
                  {scenarioType === s.id && (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Data source multi-select */}
        <div>
          <label className="block text-xs text-on-muted mb-2">
            {t('source.selectResults')}
            {selectedModels.length > 0 && (
              <span className="ml-2 text-blue-400">({t('source.selectedCount', { count: selectedModels.length })})</span>
            )}
          </label>

          {loadingData ? (
            <div className="p-4 text-center text-on-muted text-xs">Loading...</div>
          ) : resultItems.length === 0 ? (
            <div className="p-4 text-center text-on-muted text-xs border border-edge rounded">{t('source.noResults')}</div>
          ) : (
            <div className="border border-edge rounded divide-y divide-edge max-h-64 overflow-y-auto custom-scroll">
              {resultItems.map(item => (
                <label
                  key={item.modelName}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedModels.includes(item.modelName) ? 'bg-blue-500/10' : 'hover:bg-surface'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.includes(item.modelName)}
                    onChange={() => toggleModel(item.modelName)}
                    className="rounded border-edge"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-on-canvas truncate">{item.agentName}</div>
                    <div className="text-[10px] text-on-muted flex gap-3 mt-0.5">
                      <span>{t('source.model')}: {item.modelId}</span>
                      {item.taskCount > 0 && <span>{item.taskCount} tasks</span>}
                      {item.lastEval && (
                        <span>{new Date(item.lastEval).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {item.score != null && (
                    <div className={`text-sm font-bold flex-shrink-0 ${
                      item.score >= 80 ? 'text-blue-400' :
                      item.score >= 60 ? 'text-green-400' :
                      item.score >= 40 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {Math.round(item.score)}
                    </div>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Custom system prompt (for custom scenario or override) */}
        {(scenarioType === 'custom' || systemPrompt) && (
          <div>
            <label className="block text-xs text-on-muted mb-1">{t('generate.systemPrompt')}</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder={t('generate.systemPromptPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 bg-surface border border-edge rounded text-sm text-on-canvas placeholder-on-muted/50 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>
        )}

        {/* Generation Mode Toggle */}
        <div>
          <label className="block text-xs text-on-muted mb-2">
            {t('source.generationMode', 'Generation Mode')}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGenerationMode('modular')}
              className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
                generationMode === 'modular'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-edge text-on-canvas/60 hover:border-on-muted/30'
              }`}
            >
              <div className="font-medium">{t('source.modeModular', 'Modular')}</div>
              <div className="text-[10px] text-on-muted mt-0.5">
                {t('source.modeModularDesc', 'Outline → parallel module generation → block editor')}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setGenerationMode('legacy')}
              className={`flex-1 px-3 py-2 rounded border text-sm transition-colors ${
                generationMode === 'legacy'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-edge text-on-canvas/60 hover:border-on-muted/30'
              }`}
            >
              <div className="font-medium">{t('source.modeLegacy', 'Classic')}</div>
              <div className="text-[10px] text-on-muted mt-0.5">
                {t('source.modeLegacyDesc', 'Single-pass generation → HTML editor')}
              </div>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedModels.length === 0 || creating}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors"
          >
            {creating ? '...' : t('generate.button')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-on-muted hover:text-on-canvas text-sm transition-colors"
          >
            {t('editor.cancelSource')}
          </button>
        </div>
      </div>
    </div>
  );
}
