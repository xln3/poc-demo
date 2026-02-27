import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchResultDetail, fetchResultSamples, generateReport } from '../../api/evalBridgeApi';
import SafetyScoreGauge from '../eval/SafetyScoreGauge';
import RiskLevelBadge from '../eval/RiskLevelBadge';

/**
 * EvalReportPage — three-level report viewer
 * Level 1: Single benchmark report
 * Level 2: Full evaluation report
 * Level 3: High-risk case report
 */
export default function EvalReportPage({ model, onNavigate }) {
  const { t } = useTranslation('eval');
  const [detail, setDetail] = useState(null);
  const [activeLevel, setActiveLevel] = useState(2); // default to full report
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [samples, setSamples] = useState([]);
  const [generatedReport, setGeneratedReport] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!model) return;
    fetchResultDetail(model).then(setDetail).catch(() => {});
  }, [model]);

  // Load samples for Level 3
  useEffect(() => {
    if (selectedTask && model) {
      fetchResultSamples(model, selectedTask, 'HIGH')
        .then(data => setSamples(data.samples || []))
        .catch(() => setSamples([]));
    }
  }, [selectedTask, model]);

  const handleGenerate = async () => {
    if (!model) return;
    setGenerating(true);
    try {
      const resp = await generateReport(model);
      setGeneratedReport(resp.content || '');
    } catch (err) {
      setGeneratedReport(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  if (!model || !detail) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  const highRiskTasks = detail.tasks.filter(t => t.risk_level === 'CRITICAL' || t.risk_level === 'HIGH');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-on-canvas">{t('report.title')}: {model}</h1>

      {/* Level tabs */}
      <div className="flex gap-2 border-b border-edge pb-2">
        {[
          { level: 2, label: t('report.level2') },
          { level: 1, label: t('report.level1') },
          { level: 3, label: t('report.level3') },
        ].map(({ level, label }) => (
          <button
            key={level}
            onClick={() => setActiveLevel(level)}
            className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${
              activeLevel === level
                ? 'bg-surface text-on-canvas border border-edge border-b-surface'
                : 'text-on-muted hover:text-on-canvas'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Level 2: Full Report */}
      {activeLevel === 2 && (
        <div className="space-y-6">
          {/* Overview */}
          <Section title={t('report.overview')}>
            <div className="flex items-center gap-8">
              <SafetyScoreGauge score={detail.avg_score} riskLevel={detail.risk_level} size={120} />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <RiskLevelBadge level={detail.risk_level} />
                  <span className="text-on-surface">{detail.rating}</span>
                  <span className="text-on-dim">{'★'.repeat(detail.stars)}{'☆'.repeat(5 - detail.stars)}</span>
                </div>
                <div className="text-sm text-on-muted">
                  {detail.tasks.length} {t('benchmarks.tasks')} | {t('results.evalDate')}: {detail.eval_date || '-'}
                </div>
              </div>
            </div>
          </Section>

          {/* Score Table */}
          <Section title={t('report.scoreTable')}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-edge">
                    <th className="text-left py-2 text-on-muted font-medium">Task</th>
                    <th className="text-right py-2 text-on-muted font-medium">Score</th>
                    <th className="text-center py-2 text-on-muted font-medium">Risk</th>
                    <th className="text-right py-2 text-on-muted font-medium">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.tasks.map(task => (
                    <tr key={task.task} className="border-b border-edge/50 hover:bg-surface-hover/50">
                      <td className="py-2 text-on-canvas">
                        <button
                          onClick={() => { setSelectedTask(task.task); setActiveLevel(1); }}
                          className="hover:text-blue-400 hover:underline text-left"
                        >
                          {task.display_name || task.task}
                        </button>
                      </td>
                      <td className="py-2 text-right text-on-canvas font-medium">{Math.round(task.safety_score)}</td>
                      <td className="py-2 text-center"><RiskLevelBadge level={task.risk_level} /></td>
                      <td className="py-2 text-right text-on-muted">{task.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Risk Analysis */}
          {highRiskTasks.length > 0 && (
            <Section title={t('report.riskAnalysis')}>
              <div className="space-y-2">
                {highRiskTasks.map(task => (
                  <div key={task.task} className="flex items-center justify-between p-3 bg-red-900/10 border border-red-800/30 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-on-canvas">{task.display_name || task.task}</div>
                      <div className="text-xs text-on-muted mt-0.5">{task.interpretation}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskLevelBadge level={task.risk_level} />
                      <button
                        onClick={() => { setSelectedTask(task.task); setActiveLevel(3); }}
                        className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                      >
                        {t('report.level3')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Generate markdown report */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? t('report.generating') : t('results.generateReport')}
            </button>
          </div>

          {generatedReport && (
            <Section title={t('results.generateReport')}>
              <pre className="whitespace-pre-wrap text-sm text-on-surface bg-canvas rounded-lg p-4 max-h-96 overflow-y-auto custom-scroll">
                {generatedReport}
              </pre>
            </Section>
          )}
        </div>
      )}

      {/* Level 1: Single Benchmark Report */}
      {activeLevel === 1 && (
        <div className="space-y-4">
          {/* Task selector */}
          <div className="flex gap-2 flex-wrap">
            {detail.tasks.map(task => (
              <button
                key={task.task}
                onClick={() => setSelectedTask(task.task)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedTask === task.task
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface border border-edge text-on-surface hover:bg-surface-hover'
                }`}
              >
                {task.display_name || task.task}
              </button>
            ))}
          </div>

          {selectedTask && (() => {
            const task = detail.tasks.find(t => t.task === selectedTask);
            if (!task) return null;
            return (
              <Section title={task.display_name || task.task}>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-on-canvas">{Math.round(task.safety_score)}</div>
                    <div className="text-xs text-on-muted">{t('gauge.safetyScore')}</div>
                  </div>
                  <div className="text-center">
                    <RiskLevelBadge level={task.risk_level} />
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-on-canvas">{task.samples}</div>
                    <div className="text-xs text-on-muted">Samples</div>
                  </div>
                </div>
                {task.description && (
                  <p className="text-sm text-on-muted mb-3">{task.description}</p>
                )}
                <p className="text-sm text-on-surface">{task.interpretation}</p>
              </Section>
            );
          })()}
        </div>
      )}

      {/* Level 3: High-Risk Case Report */}
      {activeLevel === 3 && (
        <div className="space-y-4">
          {/* Task selector (high-risk only) */}
          <div className="flex gap-2 flex-wrap">
            {highRiskTasks.map(task => (
              <button
                key={task.task}
                onClick={() => setSelectedTask(task.task)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedTask === task.task
                    ? 'bg-red-600 text-white'
                    : 'bg-surface border border-edge text-on-surface hover:bg-surface-hover'
                }`}
              >
                {task.display_name || task.task}
              </button>
            ))}
          </div>

          {selectedTask && samples.length > 0 && (
            <div className="space-y-3">
              {samples.map((sample, i) => (
                <div key={sample.sample_id || i} className="bg-surface border border-edge rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-on-canvas">
                        {t('report.caseId')}: {sample.sample_id}
                      </span>
                      <RiskLevelBadge level={sample.risk_level} />
                    </div>
                    <span className="text-xs text-on-muted">Score: {sample.score}</span>
                  </div>

                  {sample.input && (
                    <div>
                      <div className="text-xs font-medium text-on-muted mb-1">{t('report.attackInput')}</div>
                      <pre className="text-xs text-on-surface bg-canvas rounded p-2 max-h-32 overflow-y-auto custom-scroll whitespace-pre-wrap">
                        {sample.input}
                      </pre>
                    </div>
                  )}

                  {sample.output && (
                    <div>
                      <div className="text-xs font-medium text-on-muted mb-1">{t('report.modelResponse')}</div>
                      <pre className="text-xs text-on-surface bg-canvas rounded p-2 max-h-32 overflow-y-auto custom-scroll whitespace-pre-wrap">
                        {sample.output}
                      </pre>
                    </div>
                  )}

                  {/* Reproduce button */}
                  <button
                    onClick={() => {
                      const config = { model, task: selectedTask, sampleId: sample.sample_id };
                      onNavigate?.('run-reproduce', config);
                    }}
                    className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"
                  >
                    {t('results.reproduce')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedTask && samples.length === 0 && (
            <div className="text-center text-on-muted py-8 text-sm">
              {t('results.noResults')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-edge rounded-xl p-5">
      <h2 className="text-base font-semibold text-on-canvas mb-4">{title}</h2>
      {children}
    </div>
  );
}
