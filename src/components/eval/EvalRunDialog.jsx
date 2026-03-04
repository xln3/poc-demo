import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAgents, runEvalTemplate, getEvalTemplate } from '../../api/evalBridgeApi';
import useBenchmarkHealth, { countHealthyTasks } from '../../hooks/useBenchmarkHealth';

/**
 * EvalRunDialog — lightweight dialog to run an eval template against an agent.
 *
 * Props:
 *   templateId: string
 *   templateName: string
 *   onClose: () => void
 *   onStarted: (job) => void — called after eval starts, with job data
 */
export default function EvalRunDialog({ templateId, templateName, onClose, onStarted }) {
  const { t } = useTranslation('eval');
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [limit, setLimit] = useState('');
  const [judgeModel, setJudgeModel] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [templateTasks, setTemplateTasks] = useState([]);
  const { health } = useBenchmarkHealth();

  useEffect(() => {
    fetchAgents()
      .then(data => {
        setAgents(data);
        if (data.length > 0) setAgentId(data[0].id);
      })
      .catch(err => setError(err.message));
    // Load template tasks for health check
    if (templateId) {
      getEvalTemplate(templateId)
        .then(tpl => setTemplateTasks(tpl?.config_json?.selected_tasks || []))
        .catch(() => {});
    }
  }, [templateId]);

  const healthStats = useMemo(
    () => countHealthyTasks(health, templateTasks),
    [health, templateTasks]
  );
  const hasUnhealthy = healthStats.total > 0 && healthStats.healthy < healthStats.total;

  const handleStart = async () => {
    if (!agentId) return;
    setStarting(true);
    setError(null);
    try {
      const payload = {
        agent_id: agentId,
        limit: limit ? parseInt(limit, 10) : null,
        judge_model: judgeModel || null,
      };
      const job = await runEvalTemplate(templateId, payload);
      onStarted?.(job);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-canvas border border-edge rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-on-canvas">{t('runDialog.title')}</h3>
        <p className="text-sm text-on-muted">{templateName}</p>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {hasUnhealthy && (
          <div className="px-3 py-2 text-xs rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {t('runDialog.healthWarning', {
              healthy: healthStats.healthy,
              total: healthStats.total,
              defaultValue: `${healthStats.healthy}/${healthStats.total} tasks ready — some may fail`,
            })}
          </div>
        )}

        {/* Agent selector */}
        <div>
          <label className="block text-sm font-medium text-on-canvas mb-1">
            {t('runDialog.selectAgent')}
          </label>
          {agents.length === 0 ? (
            <p className="text-sm text-on-muted">{t('runDialog.noAgents')}</p>
          ) : (
            <select
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.model_id})</option>
              ))}
            </select>
          )}
        </div>

        {/* Sample limit */}
        <div>
          <label className="block text-sm font-medium text-on-canvas mb-1">
            {t('runDialog.sampleLimit')}
          </label>
          <input
            type="number"
            min="1"
            value={limit}
            onChange={e => setLimit(e.target.value)}
            placeholder={t('runDialog.sampleLimitHint')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
          />
        </div>

        {/* Judge model */}
        <div>
          <label className="block text-sm font-medium text-on-canvas mb-1">
            {t('runDialog.judgeModel')}
          </label>
          <input
            type="text"
            value={judgeModel}
            onChange={e => setJudgeModel(e.target.value)}
            placeholder={t('runDialog.judgeModelHint')}
            className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-on-muted hover:text-on-canvas"
          >
            {t('runDialog.cancel')}
          </button>
          <button
            onClick={handleStart}
            disabled={!agentId || starting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {starting ? t('runDialog.starting') : t('runDialog.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
