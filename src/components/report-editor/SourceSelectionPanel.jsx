import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { listEvaluations } from '../../api/evalBridgeApi.js';
import { createReport, updateReport } from '../../api/reportEditorApi.js';

const SCENARIOS = [
  { id: 'single_agent', icon: '🤖' },
  { id: 'comparison', icon: '⚔️' },
  { id: 'time_compare', icon: '📈' },
  { id: 'risk_deep_dive', icon: '🔍' },
  { id: 'custom', icon: '✏️' },
];

export default function SourceSelectionPanel({ existingReport, onReportCreated, onCancel }) {
  const { t, i18n } = useTranslation('reportEditor');
  const isZh = (i18n.language || '').startsWith('zh');

  // Data sources
  const [evaluations, setEvaluations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selection state — now job-based
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [scenarioType, setScenarioType] = useState('single_agent');
  const [generationMode, setGenerationMode] = useState('modular');
  const [title, setTitle] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  // Load eval jobs
  useEffect(() => {
    (async () => {
      try {
        setLoadingData(true);
        const evals = await listEvaluations().catch(() => []);
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
      // Support both old models-based and new job_ids-based source_data
      const jobIds = existingReport.source_data?.job_ids || [];
      setSelectedJobIds(jobIds);
    }
  }, [existingReport]);

  // Only show completed jobs, sorted by date (newest first)
  const completedJobs = useMemo(() => {
    return evaluations
      .filter(e => e.status === 'completed')
      .sort((a, b) => {
        const da = a.completed_at || a.created_at || '';
        const db = b.completed_at || b.created_at || '';
        return db.localeCompare(da);
      });
  }, [evaluations]);

  // Toggle job selection
  const toggleJob = (jobId) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId)
        ? prev.filter(j => j !== jobId)
        : [...prev, jobId]
    );
  };

  // Format date
  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(isZh ? 'zh-CN' : 'en-US', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  // Generate report
  const handleGenerate = async () => {
    if (selectedJobIds.length === 0) return;

    setCreating(true);
    try {
      // Derive model names from selected jobs for data context
      const selectedJobs = completedJobs.filter(j => selectedJobIds.includes(j.id));
      const models = [...new Set(selectedJobs.map(j => (j.model_id || j.model_name || '').trim()).filter(Boolean))];
      const firstJob = selectedJobs[0];

      const reportTitle = title ||
        (scenarioType === 'single_agent'
          ? `${firstJob?.agent_name || firstJob?.model_name || firstJob?.model_id || ''} ${t('source.reportSuffix', 'Safety Report')}`
          : `${t(`scenario.${scenarioType}`)} — ${new Date().toLocaleDateString()}`);

      const sourceData = { job_ids: selectedJobIds, models };

      if (existingReport) {
        await updateReport(existingReport.id, {
          title: reportTitle,
          status: 'draft',
        });
        onReportCreated({
          ...existingReport,
          title: reportTitle,
          scenario_type: scenarioType,
          system_prompt: systemPrompt || null,
          source_data: sourceData,
        });
      } else {
        const report = await createReport({
          title: reportTitle,
          scenario_type: scenarioType,
          system_prompt: systemPrompt || null,
          source_data: sourceData,
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

        {/* Data source: evaluation jobs */}
        <div>
          <label className="block text-xs text-on-muted mb-2">
            {t('source.selectResults', 'Select Evaluation Results')}
            {selectedJobIds.length > 0 && (
              <span className="ml-2 text-blue-400">({t('source.selectedCount', { count: selectedJobIds.length })})</span>
            )}
          </label>

          {loadingData ? (
            <div className="p-4 text-center text-on-muted text-xs">{t('loading')}</div>
          ) : completedJobs.length === 0 ? (
            <div className="p-4 text-center text-on-muted text-xs border border-edge rounded">
              {t('source.noResults', 'No completed evaluation results')}
            </div>
          ) : (
            <div className="border border-edge rounded divide-y divide-edge max-h-80 overflow-y-auto custom-scroll">
              {completedJobs.map(job => {
                const displayName = job.agent_name || job.model_name || job.model_id || job.id;
                const taskCount = Array.isArray(job.tasks) ? job.tasks.length : 0;
                const benchmarkList = (job.benchmarks || []).join(', ');

                return (
                  <label
                    key={job.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      selectedJobIds.includes(job.id) ? 'bg-blue-500/10' : 'hover:bg-surface'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedJobIds.includes(job.id)}
                      onChange={() => toggleJob(job.id)}
                      className="rounded border-edge flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-on-canvas truncate">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-on-muted flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        <span>{t('source.model', 'Model')}: {(job.model_id || '').trim()}</span>
                        {taskCount > 0 && <span>{taskCount} {t('source.tasks', 'tasks')}</span>}
                        {job.completed_at && <span>{fmtDate(job.completed_at)}</span>}
                      </div>
                      {benchmarkList && (
                        <div className="text-[10px] text-on-muted/60 truncate mt-0.5">
                          {benchmarkList}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-on-muted/50 flex-shrink-0 font-mono">
                      {job.id.slice(0, 8)}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom system prompt */}
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
            disabled={selectedJobIds.length === 0 || creating}
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
