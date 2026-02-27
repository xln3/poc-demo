import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchResults, fetchResultDetail, fetchResultSamples,
  generateReport, fetchDatasetDescription, fetchRiskHierarchy,
  listEvaluations, fetchAgents,
} from '../../api/evalBridgeApi';
import SafetyScoreGauge from '../eval/SafetyScoreGauge';
import RiskLevelBadge from '../eval/RiskLevelBadge';

/**
 * EvalReportPage — standalone report viewer
 * Cascade selector: Agent → Result (completed evaluation) → Report
 * Level 1: Single benchmark report
 * Level 2: Full evaluation report
 * Level 3: High-risk case report
 * Level 4: Dataset examples
 */
export default function EvalReportPage({ model: initialModel, onNavigate }) {
  const { t, i18n } = useTranslation('eval');

  // Agent and result cascade state
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [resultMap, setResultMap] = useState({});

  // Report data state
  const [detail, setDetail] = useState(null);
  const [activeLevel, setActiveLevel] = useState(2);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSample, setSelectedSample] = useState(null);
  const [samples, setSamples] = useState([]);
  const [generatedReport, setGeneratedReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Risk hierarchy for grouping tasks
  const [hierarchy, setHierarchy] = useState([]);

  // Dataset examples state
  const [datasetData, setDatasetData] = useState(null);
  const [datasetLoading, setDatasetLoading] = useState(false);

  // Load agents, jobs, and results
  useEffect(() => {
    Promise.all([
      fetchAgents().catch(() => []),
      listEvaluations().catch(() => []),
      fetchResults().catch(() => []),
    ]).then(([agentList, jobList, results]) => {
      setAgents(agentList);

      // Build model→result lookup
      const rmap = {};
      for (const r of results) {
        rmap[r.model] = r;
        rmap[r.model.trim()] = r;
        const lastSeg = r.model.split('/').pop().trim();
        if (lastSeg) rmap[lastSeg] = r;
      }
      setResultMap(rmap);

      // Sort jobs by created_at desc
      const sorted = [...(Array.isArray(jobList) ? jobList : [])].sort((a, b) => {
        const aTime = a.created_at || a.started_at || 0;
        const bTime = b.created_at || b.started_at || 0;
        return new Date(bTime) - new Date(aTime);
      });
      setJobs(sorted);

      // If initialModel provided (from View Report click), find the agent for it
      if (initialModel) {
        const trimmedInit = initialModel.trim();
        const matchJob = sorted.find(j => {
          const mid = (j.model_id || '').trim();
          const midLast = mid.split('/').pop();
          return mid === trimmedInit || midLast === trimmedInit;
        });
        if (matchJob) {
          setSelectedAgentId(matchJob.agent_id || '_model_' + (matchJob.model_id || '').trim());
          setSelectedJobId(matchJob.id);
        } else {
          // Fallback: try direct result lookup
          const r = rmap[trimmedInit];
          if (r) {
            setSelectedAgentId('_model_' + r.model);
            // Find first job matching this model
            const mj = sorted.find(j => {
              const mid = (j.model_id || '').trim();
              const midLast = mid.split('/').pop();
              return mid === r.model || midLast === r.model;
            });
            if (mj) setSelectedJobId(mj.id);
          }
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  // Load risk hierarchy for grouping
  useEffect(() => {
    fetchRiskHierarchy().then(setHierarchy).catch(() => {});
  }, []);

  // Derive unique agents from jobs (some may not have agent_name)
  const agentOptions = (() => {
    const seen = new Map();
    for (const j of jobs) {
      const key = j.agent_id || '_model_' + (j.model_id || '').trim();
      if (!seen.has(key)) {
        seen.set(key, {
          id: key,
          agent_id: j.agent_id,
          name: j.agent_name || (j.model_id || '').trim(),
          model_id: (j.model_id || '').trim(),
        });
      }
    }
    return Array.from(seen.values());
  })();

  // Filter jobs for selected agent
  const agentJobs = jobs.filter(j => {
    if (!selectedAgentId) return false;
    const key = j.agent_id || '_model_' + (j.model_id || '').trim();
    return key === selectedAgentId;
  });

  // Get the selected job
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  // Resolve result model for the selected job
  const selectedResultModel = (() => {
    if (!selectedJob) return null;
    const mid = (selectedJob.model_id || '').trim();
    const midLast = mid.split('/').pop();
    const r = resultMap[mid] || resultMap[midLast];
    return r ? r.model : null;
  })();

  // Load detail when result model resolved
  useEffect(() => {
    if (!selectedResultModel) { setDetail(null); return; }
    setDetail(null);
    fetchResultDetail(selectedResultModel)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [selectedResultModel]);

  // Load samples for Level 3
  useEffect(() => {
    if (selectedTask && selectedResultModel) {
      fetchResultSamples(selectedResultModel, selectedTask, 'HIGH')
        .then(data => setSamples(data.samples || []))
        .catch(() => setSamples([]));
    }
  }, [selectedTask, selectedResultModel]);

  // Load dataset examples when Level 4 selected
  useEffect(() => {
    if (activeLevel === 4 && !datasetData) {
      setDatasetLoading(true);
      const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
      fetchDatasetDescription('', lang)
        .then(setDatasetData)
        .catch(() => setDatasetData({ categories: [], samples: [] }))
        .finally(() => setDatasetLoading(false));
    }
  }, [activeLevel, i18n.language]);

  const handleGenerate = async () => {
    if (!selectedResultModel) return;
    setGenerating(true);
    try {
      const resp = await generateReport(selectedResultModel);
      setGeneratedReport(resp.content || '');
    } catch (err) {
      setGeneratedReport(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectAgent = (agentId) => {
    setSelectedAgentId(agentId);
    setSelectedJobId(null);
    setDetail(null);
    setActiveLevel(2);
    setSelectedTask(null);
    setGeneratedReport('');
  };

  const handleSelectJob = (jobId) => {
    setSelectedJobId(jobId);
    setDetail(null);
    setActiveLevel(2);
    setSelectedTask(null);
    setGeneratedReport('');
  };

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  if (agentOptions.length === 0) {
    return (
      <div className="p-8 text-center text-on-muted">
        <div className="text-4xl mb-4">📝</div>
        <div>{t('results.noResults')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-on-canvas">{t('report.title')}</h1>

      {/* Agent selector */}
      <div>
        <div className="text-xs text-on-muted mb-2">{t('report.selectAgent')}</div>
        <div className="flex gap-2 flex-wrap">
          {agentOptions.map(a => (
            <button
              key={a.id}
              onClick={() => handleSelectAgent(a.id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedAgentId === a.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface border border-edge text-on-surface hover:bg-surface-hover'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Result (job) selector — cascade from selected agent */}
      {selectedAgentId && agentJobs.length > 0 && (
        <div>
          <div className="text-xs text-on-muted mb-2">{t('report.selectResult')}</div>
          <div className="flex gap-2 flex-wrap">
            {agentJobs.map(j => {
              const mid = (j.model_id || '').trim();
              const midLast = mid.split('/').pop();
              const r = resultMap[mid] || resultMap[midLast];
              const score = r ? Math.round(r.avg_score) : null;
              const isRunning = j.status === 'running' || j.status === 'pending';
              const hasResult = !!r;
              const timeStr = j.created_at ? formatDateTime(new Date(j.created_at)) : '';

              return (
                <button
                  key={j.id}
                  onClick={() => handleSelectJob(j.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                    selectedJobId === j.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface border border-edge text-on-surface hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{timeStr}</span>
                    {isRunning && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400">
                        {t(`status.${j.status}`)}
                      </span>
                    )}
                    {!isRunning && hasResult && score !== null && (
                      <span className={`opacity-70 ${selectedJobId === j.id ? '' : ''}`}>{score}</span>
                    )}
                    {!isRunning && !hasResult && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400">
                        {t('status.failed')}
                      </span>
                    )}
                  </div>
                  {j.benchmarks && j.benchmarks.length > 0 && (
                    <div className={`text-[10px] mt-0.5 truncate max-w-[200px] ${selectedJobId === j.id ? 'opacity-70' : 'text-on-dim'}`}>
                      {j.benchmarks.length} benchmarks
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedAgentId && agentJobs.length === 0 && (
        <div className="text-center text-on-muted py-4 text-sm">
          {t('results.noResults')}
        </div>
      )}

      {/* No result model found for selected job */}
      {selectedJobId && !selectedResultModel && (
        <div className="text-center text-on-muted py-8 text-sm">
          {selectedJob?.status === 'running' || selectedJob?.status === 'pending'
            ? t('report.evalRunning')
            : t('results.noResults')}
        </div>
      )}

      {/* Loading detail */}
      {selectedResultModel && !detail && (
        <div className="text-center text-on-muted py-8">{t('loading')}</div>
      )}

      {selectedResultModel && detail && (
        <>
          {/* Level tabs */}
          <div className="flex gap-2 border-b border-edge pb-2">
            {[
              { level: 2, label: t('report.level2') },
              { level: 1, label: t('report.level1') },
              { level: 3, label: t('report.level3') },
              { level: 4, label: t('report.level4') },
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
            <FullReportView
              detail={detail}
              model={selectedResultModel}
              hierarchy={hierarchy}
              lang={i18n.language}
              t={t}
              onSelectTask={(task) => { setSelectedTask(task); setActiveLevel(1); }}
              onHighRiskDetail={(task) => { setSelectedTask(task); setActiveLevel(3); }}
              onGenerate={handleGenerate}
              generating={generating}
              generatedReport={generatedReport}
            />
          )}

          {/* Level 1: Single Benchmark Report */}
          {activeLevel === 1 && (
            <SingleBenchmarkView
              detail={detail}
              hierarchy={hierarchy}
              lang={i18n.language}
              selectedTask={selectedTask}
              setSelectedTask={setSelectedTask}
              t={t}
            />
          )}

          {/* Level 3: High-Risk Case Report */}
          {activeLevel === 3 && (
            <HighRiskView
              detail={detail}
              model={selectedResultModel}
              hierarchy={hierarchy}
              lang={i18n.language}
              selectedTask={selectedTask}
              setSelectedTask={setSelectedTask}
              samples={samples}
              t={t}
              onNavigate={onNavigate}
            />
          )}

          {/* Level 4: Dataset Examples */}
          {activeLevel === 4 && (
            <DatasetExamplesView
              data={datasetData}
              loading={datasetLoading}
              t={t}
              lang={i18n.language}
            />
          )}
        </>
      )}
    </div>
  );
}

// ---- Task grouping by risk hierarchy ----

/**
 * Groups tasks by risk hierarchy categories.
 * Returns: [{ category, subcategory, tasks: [taskObj] }]
 * Tasks not matching any hierarchy entry go into an "Other" group.
 */
function groupTasksByHierarchy(tasks, hierarchy, lang) {
  const isZh = lang?.startsWith('zh');
  // Build task→group mapping from hierarchy
  const taskGroupMap = {};
  for (const cat of hierarchy) {
    for (const sub of cat.subcategories || []) {
      for (const bm of sub.benchmarks || []) {
        for (const t of bm.tasks || []) {
          if (!taskGroupMap[t.name]) {
            taskGroupMap[t.name] = {
              category: isZh ? cat.name : cat.name_en,
              subcategory: isZh ? sub.name : sub.name_en,
            };
          }
        }
      }
    }
  }

  // Group tasks
  const groups = [];
  const groupIndex = {};
  for (const task of tasks) {
    const info = taskGroupMap[task.task];
    const key = info ? info.subcategory : '_other';
    if (!groupIndex[key]) {
      groupIndex[key] = {
        category: info?.category || '',
        subcategory: info?.subcategory || (isZh ? '其他' : 'Other'),
        tasks: [],
      };
      groups.push(groupIndex[key]);
    }
    groupIndex[key].tasks.push(task);
  }
  return groups;
}

function GroupedTaskRows({ group, onSelectTask }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="pt-3 pb-1 px-0">
          <div className="text-xs font-medium text-on-muted border-b border-edge/30 pb-1">
            {group.subcategory}
          </div>
        </td>
      </tr>
      {group.tasks.map(task => (
        <tr key={task.task} className="border-b border-edge/50 hover:bg-surface-hover/50">
          <td className="py-2 pl-4 text-on-canvas">
            <button
              onClick={() => onSelectTask(task.task)}
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
    </>
  );
}

// ---- Level 2: Full Report ----

function FullReportView({ detail, model, hierarchy, lang, t, onSelectTask, onHighRiskDetail, onGenerate, generating, generatedReport }) {
  const highRiskTasks = detail.tasks.filter(t => t.risk_level === 'CRITICAL' || t.risk_level === 'HIGH');

  return (
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

      {/* Score Table — grouped by risk hierarchy */}
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
              {groupTasksByHierarchy(detail.tasks, hierarchy, lang).map(group => (
                <GroupedTaskRows
                  key={group.subcategory}
                  group={group}
                  onSelectTask={onSelectTask}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Risk Analysis — grouped */}
      {highRiskTasks.length > 0 && (
        <Section title={t('report.riskAnalysis')}>
          <div className="space-y-4">
            {groupTasksByHierarchy(highRiskTasks, hierarchy, lang).map(group => (
              <div key={group.subcategory}>
                <div className="text-xs font-medium text-on-muted mb-2">{group.subcategory}</div>
                <div className="space-y-2">
                  {group.tasks.map(task => (
                    <div key={task.task} className="flex items-center justify-between p-3 bg-red-900/10 border border-red-800/30 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-on-canvas">{task.display_name || task.task}</div>
                        <div className="text-xs text-on-muted mt-0.5">{task.interpretation}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RiskLevelBadge level={task.risk_level} />
                        <button
                          onClick={() => onHighRiskDetail(task.task)}
                          className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                        >
                          {t('report.level3')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Generate markdown report */}
      <div className="flex gap-3">
        <button
          onClick={onGenerate}
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
  );
}

// ---- Level 1: Single Benchmark ----

function SingleBenchmarkView({ detail, hierarchy, lang, selectedTask, setSelectedTask, t }) {
  const groups = groupTasksByHierarchy(detail.tasks, hierarchy, lang);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {groups.map(group => (
          <div key={group.subcategory}>
            <div className="text-xs font-medium text-on-muted mb-1.5">{group.subcategory}</div>
            <div className="flex gap-2 flex-wrap">
              {group.tasks.map(task => (
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
          </div>
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
  );
}

// ---- Level 3: High-Risk Cases ----

function HighRiskView({ detail, model, hierarchy, lang, selectedTask, setSelectedTask, samples, t, onNavigate }) {
  const highRiskTasks = detail.tasks.filter(t => t.risk_level === 'CRITICAL' || t.risk_level === 'HIGH');
  const groups = groupTasksByHierarchy(highRiskTasks, hierarchy, lang);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {groups.map(group => (
          <div key={group.subcategory}>
            <div className="text-xs font-medium text-on-muted mb-1.5">{group.subcategory}</div>
            <div className="flex gap-2 flex-wrap">
              {group.tasks.map(task => (
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
          </div>
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
  );
}

// ---- Level 4: Dataset Examples ----

function DatasetExamplesView({ data, loading, t, lang }) {
  const [expandedCat, setExpandedCat] = useState(null);
  const [showSamples, setShowSamples] = useState(false);

  if (loading || !data) {
    return <div className="text-center text-on-muted py-8">{t('dataset.loading')}</div>;
  }

  if (!data.categories || data.categories.length === 0) {
    return <div className="text-center text-on-muted py-8">{t('dataset.noData')}</div>;
  }

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(data.samples || [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eval_dataset_examples.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('dataset.totalCategories')} value={data.total_categories} />
        <StatCard label={t('dataset.totalSamples')} value={data.total_samples} />
        <StatCard label={t('dataset.totalBenchmarks')} value={data.total_benchmarks} />
      </div>

      {/* Category list */}
      <Section title={t('dataset.title')}>
        <div className="space-y-2">
          {data.categories.map((cat, ci) => (
            <div key={ci} className="border border-edge rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedCat(expandedCat === ci ? null : ci)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
              >
                <span className="text-sm font-medium text-on-canvas">{cat.name}</span>
                <span className="text-xs text-on-dim">
                  {cat.items?.length || 0} {lang?.startsWith('zh') ? '个风险点' : 'risk points'}
                  <span className="ml-2">{expandedCat === ci ? '▾' : '▸'}</span>
                </span>
              </button>
              {expandedCat === ci && cat.items && (
                <div className="border-t border-edge px-4 py-2 space-y-1.5 bg-surface-raised/30">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex items-center justify-between text-xs py-1">
                      <span className="text-on-surface">{item.risk_point}</span>
                      <span className="text-on-dim">{item.sample_count} samples</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Sample preview + download */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowSamples(!showSamples)}
          className="px-4 py-2 bg-surface border border-edge text-on-surface text-sm rounded-lg hover:bg-surface-hover"
        >
          {showSamples ? (lang?.startsWith('zh') ? '隐藏样本' : 'Hide Samples') : (lang?.startsWith('zh') ? '查看样本' : 'View Samples')}
        </button>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          {t('dataset.downloadJson')}
        </button>
      </div>

      {/* Sample table */}
      {showSamples && data.samples && data.samples.length > 0 && (
        <SampleTable samples={data.samples} t={t} />
      )}
    </div>
  );
}

function SampleTable({ samples, t }) {
  const [page, setPage] = useState(0);
  const perPage = 10;
  const totalPages = Math.ceil(samples.length / perPage);
  const pageItems = samples.slice(page * perPage, (page + 1) * perPage);

  return (
    <Section title={`${t('dataset.totalSamples')} (${samples.length})`}>
      <div className="space-y-3">
        {pageItems.map((s, i) => (
          <div key={page * perPage + i} className="border border-edge rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                {s.risk_category}
              </span>
              <span className="text-xs text-on-muted">{s.risk_point}</span>
            </div>
            <div>
              <div className="text-xs font-medium text-on-muted mb-0.5">{t('dataset.input')}</div>
              <pre className="text-xs text-on-surface bg-canvas rounded p-2 max-h-24 overflow-y-auto custom-scroll whitespace-pre-wrap">
                {s.input}
              </pre>
            </div>
            {s.expected_behavior && (
              <div>
                <div className="text-xs font-medium text-on-muted mb-0.5">{t('dataset.expectedBehavior')}</div>
                <p className="text-xs text-on-surface">{s.expected_behavior}</p>
              </div>
            )}
            {s.risk_description && (
              <div>
                <div className="text-xs font-medium text-on-muted mb-0.5">{t('dataset.riskDescription')}</div>
                <p className="text-xs text-on-muted">{s.risk_description}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40"
          >
            &lt;
          </button>
          <span className="text-xs text-on-muted">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      )}
    </Section>
  );
}

// ---- Shared ----

function Section({ title, children }) {
  return (
    <div className="bg-surface border border-edge rounded-xl p-5">
      <h2 className="text-base font-semibold text-on-canvas mb-4">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-edge rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-on-canvas">{value}</div>
      <div className="text-xs text-on-muted mt-1">{label}</div>
    </div>
  );
}

function formatDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
