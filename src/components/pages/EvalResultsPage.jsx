import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchResults, fetchResultDetail, getReproduceConfig } from '../../api/evalBridgeApi';
import SafetyScoreGauge from '../eval/SafetyScoreGauge';
import RadarChart from '../eval/RadarChart';
import RiskLevelBadge from '../eval/RiskLevelBadge';
import ScoreBar from '../eval/ScoreBar';

/**
 * EvalResultsPage — evaluation results dashboard
 */
export default function EvalResultsPage({ initialModel, onNavigate }) {
  const { t } = useTranslation('eval');
  const [results, setResults] = useState([]);
  const [detail, setDetail] = useState(null);
  const [selectedModel, setSelectedModel] = useState(initialModel || '');
  const [loading, setLoading] = useState(true);

  // Load all results
  useEffect(() => {
    fetchResults()
      .then(data => {
        setResults(data);
        if (!selectedModel && data.length > 0) {
          setSelectedModel(data[0].model);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load detail when model selected
  useEffect(() => {
    if (!selectedModel) return;
    setDetail(null);
    fetchResultDetail(selectedModel)
      .then(setDetail)
      .catch(() => {});
  }, [selectedModel]);

  const handleReproduce = async (task) => {
    try {
      const config = await getReproduceConfig(selectedModel, task);
      onNavigate?.('run-reproduce', config);
    } catch (err) {
      console.error('Reproduce failed:', err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  if (results.length === 0) {
    return (
      <div className="p-8 text-center text-on-muted">
        <div className="text-4xl mb-4">📊</div>
        <div>{t('results.noResults')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-on-canvas">{t('results.title')}</h1>

      {/* Model selector */}
      <div className="flex gap-2 flex-wrap">
        {results.map(r => (
          <button
            key={r.model}
            onClick={() => setSelectedModel(r.model)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedModel === r.model
                ? 'bg-blue-600 text-white'
                : 'bg-surface border border-edge text-on-surface hover:bg-surface-hover'
            }`}
          >
            {r.model}
            <span className="ml-2 opacity-70">{Math.round(r.avg_score)}</span>
          </button>
        ))}
      </div>

      {detail && (
        <>
          {/* Top summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Gauge */}
            <div className="bg-surface border border-edge rounded-xl p-5 flex flex-col items-center justify-center">
              <SafetyScoreGauge score={detail.avg_score} riskLevel={detail.risk_level} />
              <div className="mt-3 flex items-center gap-2">
                <RiskLevelBadge level={detail.risk_level} />
                <span className="text-sm text-on-muted">{detail.rating}</span>
                <span className="text-sm text-on-dim">{'★'.repeat(detail.stars)}{'☆'.repeat(5 - detail.stars)}</span>
              </div>
            </div>

            {/* Radar chart */}
            <div className="bg-surface border border-edge rounded-xl p-5 flex items-center justify-center">
              <RadarChart
                data={detail.tasks.slice(0, 8).map(t => ({
                  label: t.display_name || t.task,
                  score: t.safety_score,
                }))}
                size={240}
              />
            </div>

            {/* Stats */}
            <div className="bg-surface border border-edge rounded-xl p-5 space-y-4">
              <StatRow label={t('results.avgScore')} value={`${Math.round(detail.avg_score)} / 100`} />
              <StatRow label={t('results.taskCount')} value={detail.tasks.length} />
              <StatRow label={t('results.evalDate')} value={detail.eval_date || '-'} />
              <RiskDistribution tasks={detail.tasks} />
            </div>
          </div>

          {/* Per-task scores */}
          <div className="bg-surface border border-edge rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-on-canvas">{t('results.perTask')}</h2>
            <div className="space-y-2">
              {detail.tasks.map(task => (
                <div key={task.task} className="flex items-center gap-3">
                  <div className="flex-1">
                    <ScoreBar
                      score={task.safety_score}
                      label={task.display_name || task.task}
                    />
                  </div>
                  <RiskLevelBadge level={task.risk_level} className="flex-shrink-0" />
                  {(task.risk_level === 'CRITICAL' || task.risk_level === 'HIGH') && (
                    <button
                      onClick={() => handleReproduce(task.task)}
                      className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 flex-shrink-0"
                    >
                      {t('results.reproduce')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate?.('eval-report', { model: selectedModel })}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              {t('results.generateReport')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-on-muted">{label}</span>
      <span className="text-sm font-medium text-on-canvas">{value}</span>
    </div>
  );
}

function RiskDistribution({ tasks }) {
  const { t } = useTranslation('eval');
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, MINIMAL: 0 };
  tasks.forEach(task => { counts[task.risk_level] = (counts[task.risk_level] || 0) + 1; });

  const colors = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-green-500',
    MINIMAL: 'bg-blue-500',
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-on-muted">{t('results.riskDistribution')}</span>
      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-surface-raised">
        {Object.entries(counts).map(([level, count]) => {
          if (count === 0) return null;
          const pct = (count / tasks.length) * 100;
          return (
            <div
              key={level}
              className={`${colors[level]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${t(`risk.${level}`)}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {Object.entries(counts).filter(([, c]) => c > 0).map(([level, count]) => (
          <span key={level} className="text-xs text-on-dim">
            <span className={`inline-block w-2 h-2 rounded-full ${colors[level]} mr-1`} />
            {t(`risk.${level}`)} {count}
          </span>
        ))}
      </div>
    </div>
  );
}
