import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchAgents,
  listEvaluations,
  fetchResultByJob,
  fetchJobTaskSamples,
} from '../../api/evalBridgeApi.js';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

export default function ImportFromEvalDialog({ open, onClose }) {
  const { t } = useTranslation();
  const { loadSample } = useCaseConfig();

  // Cascade state
  const [agents, setAgents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [samples, setSamples] = useState([]);

  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [selectedTask, setSelectedTask] = useState('');

  const [loading, setLoading] = useState({ agents: false, jobs: false, tasks: false, samples: false });
  const [error, setError] = useState(null);

  // Load agents on open
  useEffect(() => {
    if (!open) return;
    setLoading((l) => ({ ...l, agents: true }));
    fetchAgents()
      .then((data) => setAgents(Array.isArray(data) ? data : data.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading((l) => ({ ...l, agents: false })));
  }, [open]);

  // Load jobs when agent changes
  useEffect(() => {
    if (!selectedAgentId) { setJobs([]); return; }
    setLoading((l) => ({ ...l, jobs: true }));
    setSelectedJobId('');
    setTasks([]);
    setSamples([]);
    setError(null);
    listEvaluations()
      .then((data) => {
        const allJobs = Array.isArray(data) ? data : data.items || [];
        const filtered = allJobs.filter((j) => j.agent_id === selectedAgentId);
        setJobs(filtered);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading((l) => ({ ...l, jobs: false })));
  }, [selectedAgentId]);

  // Load tasks when job changes
  useEffect(() => {
    if (!selectedJobId) { setTasks([]); return; }
    setLoading((l) => ({ ...l, tasks: true }));
    setSelectedTask('');
    setSamples([]);
    setError(null);
    fetchResultByJob(selectedJobId)
      .then((data) => {
        // tasks may be a list of {task, display_name, ...} or a dict keyed by task name
        const raw = data.tasks || [];
        const taskList = Array.isArray(raw)
          ? raw.map((t) => t.task || t.name || String(t))
          : Object.keys(raw);
        setTasks(taskList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading((l) => ({ ...l, tasks: false })));
  }, [selectedJobId]);

  // Load samples when task changes
  useEffect(() => {
    if (!selectedJobId || !selectedTask) { setSamples([]); return; }
    setLoading((l) => ({ ...l, samples: true }));
    fetchJobTaskSamples(selectedJobId, selectedTask)
      .then((data) => setSamples(data.samples || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading((l) => ({ ...l, samples: false })));
  }, [selectedJobId, selectedTask]);

  const getJobId = (j) => j.job_id || j.id;

  const handleImport = (sample) => {
    const job = jobs.find((j) => getJobId(j) === selectedJobId);
    loadSample(sample, {
      model: job?.model_id || '',
      task: selectedTask,
      sample_id: sample.sample_id,
      job_id: selectedJobId,
    });
    onClose();
  };

  if (!open) return null;

  const riskColor = (level) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return 'text-red-600 dark:text-red-400';
      case 'HIGH': return 'text-orange-600 dark:text-orange-400';
      case 'MEDIUM': return 'text-amber-600 dark:text-amber-400';
      case 'LOW': return 'text-green-600 dark:text-green-400';
      default: return 'text-on-dim';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-canvas border border-edge rounded-2xl shadow-xl w-[56rem] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-edge">
          <h2 className="text-base font-semibold text-on-canvas">{t('caseConfig.importFromEval')}</h2>
          <button type="button" onClick={onClose} className="text-on-dim hover:text-on-canvas text-lg">&times;</button>
        </div>

        {/* Cascade selectors */}
        <div className="grid grid-cols-4 gap-3 p-4 border-b border-edge">
          {/* Agent */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.agent')}</label>
            <select value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}
              className="w-full px-2 py-1.5 bg-surface border border-edge rounded-lg text-xs text-on-canvas">
              <option value="">{loading.agents ? '...' : t('caseConfig.selectAgent')}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {/* Job */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.job')}</label>
            <select value={selectedJobId} onChange={(e) => setSelectedJobId(e.target.value)}
              disabled={!selectedAgentId}
              className="w-full px-2 py-1.5 bg-surface border border-edge rounded-lg text-xs text-on-canvas disabled:opacity-50">
              <option value="">{loading.jobs ? '...' : t('caseConfig.selectJob')}</option>
              {jobs.map((j) => (
                <option key={getJobId(j)} value={getJobId(j)}>
                  {j.status} - {j.created_at ? new Date(j.created_at).toLocaleDateString() : getJobId(j).slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          {/* Task */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.task')}</label>
            <select value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)}
              disabled={!selectedJobId}
              className="w-full px-2 py-1.5 bg-surface border border-edge rounded-lg text-xs text-on-canvas disabled:opacity-50">
              <option value="">{loading.tasks ? '...' : t('caseConfig.selectTask')}</option>
              {tasks.map((tk) => <option key={tk} value={tk}>{tk}</option>)}
            </select>
          </div>
          {/* Count */}
          <div className="flex items-end">
            <span className="text-xs text-on-dim pb-2">
              {samples.length > 0 && `${samples.length} ${t('reportPage.samples')}`}
            </span>
          </div>
        </div>

        {/* Sample list */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          {loading.samples ? (
            <p className="text-sm text-on-dim text-center py-8">{t('batchTest.loading')}</p>
          ) : samples.length === 0 ? (
            <p className="text-sm text-on-dim text-center py-8">{t('caseConfig.noSamples')}</p>
          ) : (
            <div className="space-y-1.5">
              {samples.map((s) => {
                const input = typeof s.input === 'string' ? s.input : JSON.stringify(s.input);
                const preview = input.length > 120 ? input.slice(0, 120) + '...' : input;
                return (
                  <div
                    key={s.sample_id}
                    onClick={() => handleImport(s)}
                    className="flex items-start gap-3 p-2.5 bg-surface border border-edge rounded-lg
                               hover:border-blue-500/30 cursor-pointer transition-colors"
                  >
                    <span className="text-xs font-mono text-on-dim w-8 flex-shrink-0">#{s.sample_id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-on-canvas line-clamp-2">{preview}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono">{s.score?.toFixed(2)}</span>
                      {s.risk_level && (
                        <span className={`text-xs font-medium ${riskColor(s.risk_level)}`}>
                          {s.risk_level}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-edge">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 text-sm bg-surface border border-edge rounded-lg text-on-surface hover:bg-surface-hover">
            {t('buttons.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
