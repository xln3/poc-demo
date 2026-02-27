import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAgents, startEvaluation, triggerAgentEval } from '../../api/evalBridgeApi';
import BenchmarkSelector from '../eval/BenchmarkSelector';

/**
 * EvalNewPage — 3-step wizard: Select Agent → Select Benchmarks → Configure → Start
 */
export default function EvalNewPage({ onNavigate, initialAgentId, initialModelId }) {
  const { t } = useTranslation('eval');
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId || '');
  const [selectedBenchmarks, setSelectedBenchmarks] = useState([]);
  const [limit, setLimit] = useState('');
  const [judgeModel, setJudgeModel] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAgents().then(setAgents).catch(() => {});
  }, []);

  // Pre-select agent if passed
  useEffect(() => {
    if (initialAgentId) setSelectedAgentId(initialAgentId);
  }, [initialAgentId]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleStart = async () => {
    if (!selectedAgent) return;
    setStarting(true);
    setError('');
    try {
      const payload = {
        benchmarks: selectedBenchmarks,
        limit: limit ? parseInt(limit) : null,
        judge_model: judgeModel || null,
      };
      const job = await triggerAgentEval(selectedAgent.id, payload);
      onNavigate?.('eval-progress', { jobId: job.id });
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  const canNext = step === 1 ? !!selectedAgentId : step === 2 ? selectedBenchmarks.length > 0 : true;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-on-canvas">{t('newEval.title')}</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? 'bg-blue-600 text-white' :
              s < step ? 'bg-green-600 text-white' :
              'bg-surface-raised text-on-muted'
            }`}>
              {s < step ? '\u2713' : s}
            </div>
            <span className={`text-sm ${s === step ? 'text-on-canvas font-medium' : 'text-on-muted'}`}>
              {t(`newEval.step${s}`)}
            </span>
            {s < 3 && <div className="w-8 h-px bg-edge" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Agent */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-on-muted">{t('newEval.selectAgent')}</p>
          <div className="grid gap-3">
            {agents.length === 0 && (
              <div className="text-on-muted text-sm py-8 text-center">{t('agents.noAgents')}</div>
            )}
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`text-left p-4 rounded-xl border transition-colors ${
                  selectedAgentId === agent.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-edge bg-surface hover:bg-surface-hover'
                }`}
              >
                <div className="font-medium text-on-canvas">{agent.name}</div>
                <div className="text-sm text-on-muted mt-1">{agent.model_id}</div>
                <div className="text-xs text-on-dim mt-0.5">{agent.api_base}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select Benchmarks */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-on-muted">{t('newEval.selectBenchmarks')}</p>
          <BenchmarkSelector
            selected={selectedBenchmarks}
            onChange={setSelectedBenchmarks}
          />
        </div>
      )}

      {/* Step 3: Configure Parameters */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-on-muted">{t('newEval.configParams')}</p>
          <div className="bg-surface border border-edge rounded-xl p-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-on-muted">{t('newEval.step1')}:</span>{' '}
                <span className="text-on-canvas font-medium">{selectedAgent?.name}</span>
              </div>
              <div>
                <span className="text-on-muted">{t('newEval.step2')}:</span>{' '}
                <span className="text-on-canvas font-medium">{selectedBenchmarks.length} benchmarks</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-on-muted mb-1">{t('newEval.sampleLimit')}</label>
                <input
                  type="number"
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  placeholder={t('newEval.sampleLimitHint')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-on-muted mb-1">{t('newEval.judgeModel')}</label>
                <input
                  value={judgeModel}
                  onChange={e => setJudgeModel(e.target.value)}
                  placeholder={t('newEval.judgeModelHint')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">{error}</div>
            )}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="px-4 py-2 text-sm bg-surface-raised text-on-muted rounded-lg hover:bg-surface-hover disabled:opacity-30"
        >
          {t('newEval.prev')}
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {t('newEval.next')}
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={starting || !canNext}
            className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? t('newEval.starting') : t('newEval.start')}
          </button>
        )}
      </div>
    </div>
  );
}
