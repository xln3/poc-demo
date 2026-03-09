import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchResults, fetchResultDetail, fetchResultSamples,
  fetchResultByJob, fetchJobTaskSamples,
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
  const [samples, setSamples] = useState([]);
  const [generatedReport, setGeneratedReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Risk hierarchy for grouping tasks
  const [hierarchy, setHierarchy] = useState([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const sampleRequestRef = useRef(0);

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

      // If initialModel provided (from View Report click), find the matching job or orphan
      if (initialModel) {
        const trimmedInit = initialModel.trim();
        // Try job_id first (new path: View Report passes job.id)
        const directJob = sorted.find(j => j.id === trimmedInit);
        if (directJob) {
          setSelectedAgentId(directJob.agent_id || '_model_' + (directJob.model_id || '').trim());
          setSelectedJobId(directJob.id);
        } else {
          // Try model name match
          const matchJob = sorted.find(j => {
            const mid = (j.model_id || '').trim();
            const midLast = mid.split('/').pop();
            return mid === trimmedInit || midLast === trimmedInit;
          });
          if (matchJob) {
            setSelectedAgentId(matchJob.agent_id || '_model_' + (matchJob.model_id || '').trim());
            setSelectedJobId(matchJob.id);
          } else {
            // Orphaned result
            const r = rmap[trimmedInit];
            if (r) {
              const orphanKey = '_orphan_' + r.model;
              setSelectedAgentId(orphanKey);
              setSelectedJobId('_orphan_' + r.model);
            }
          }
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  // Load risk hierarchy for grouping
  useEffect(() => {
    fetchRiskHierarchy().then(setHierarchy).catch(() => {});
  }, []);

  // Derive agents from jobs + orphaned results
  const agentOptions = (() => {
    const seen = new Map();
    // Source 1: Jobs (have agent association)
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
    // Source 2: Orphaned results (no matching job)
    for (const r of Object.values(resultMap)) {
      const modelKey = (r.model || '').trim();
      const hasJob = jobs.some(j => {
        const mid = (j.model_id || '').trim();
        const midLast = mid.split('/').pop();
        return mid === modelKey || midLast === modelKey;
      });
      if (!hasJob) {
        const key = '_orphan_' + modelKey;
        if (!seen.has(key)) {
          seen.set(key, {
            id: key,
            agent_id: null,
            name: modelKey,
            model_id: modelKey,
            isOrphan: true,
          });
        }
      }
    }
    return Array.from(seen.values());
  })();

  // Filter jobs for selected agent (or synthesize for orphaned results)
  const agentJobs = (() => {
    if (!selectedAgentId) return [];
    const agent = agentOptions.find(a => a.id === selectedAgentId);
    if (agent?.isOrphan) {
      // Synthesize a single entry from the orphaned result
      const r = resultMap[agent.model_id];
      if (r) return [{
        id: '_orphan_' + r.model,
        model_id: r.model,
        status: 'completed',
        created_at: r.eval_date || '',
        _isOrphan: true,
      }];
      return [];
    }
    return jobs.filter(j => {
      const key = j.agent_id || '_model_' + (j.model_id || '').trim();
      return key === selectedAgentId;
    });
  })();

  // Get the selected job
  const selectedJob = selectedJobId
    ? (jobs.find(j => j.id === selectedJobId) || agentJobs.find(j => j.id === selectedJobId))
    : null;

  // Load detail when job selected (job-scoped or model-fallback for orphans)
  useEffect(() => {
    if (!selectedJob) { setDetail(null); return; }
    setDetail(null);
    if (selectedJob._isOrphan) {
      // Orphan: use model-based API
      fetchResultDetail(selectedJob.model_id)
        .then(setDetail)
        .catch(() => setDetail(null));
    } else {
      // Normal: use job-scoped API
      fetchResultByJob(selectedJob.id)
        .then(setDetail)
        .catch(() => {
          // Fallback to model-based if job has no results yet
          const mid = (selectedJob.model_id || '').trim();
          const midLast = mid.split('/').pop();
          const model = resultMap[mid]?.model || resultMap[midLast]?.model;
          if (model) fetchResultDetail(model).then(setDetail).catch(() => setDetail(null));
          else setDetail(null);
        });
    }
  }, [selectedJobId]);

  // Load samples when task selected (job-scoped or model-fallback)
  // Uses request counter to prevent stale responses from overwriting newer data
  useEffect(() => {
    if (!selectedTask || !selectedJob) { setSamples([]); setSamplesLoading(false); return; }
    setSamples([]);
    setSamplesLoading(true);
    const reqId = ++sampleRequestRef.current;
    const stale = () => sampleRequestRef.current !== reqId;
    const done = (data) => {
      if (stale()) return;
      setSamples(data.samples || []);
      setSamplesLoading(false);
    };
    const fail = () => {
      if (stale()) return;
      setSamples([]);
      setSamplesLoading(false);
    };
    if (selectedJob._isOrphan) {
      fetchResultSamples(selectedJob.model_id, selectedTask).then(done).catch(fail);
    } else {
      fetchJobTaskSamples(selectedJob.id, selectedTask)
        .then(done)
        .catch(() => {
          if (stale()) return;
          // Fallback to model-based
          const mid = (selectedJob.model_id || '').trim().split('/').pop();
          fetchResultSamples(mid, selectedTask).then(done).catch(fail);
        });
    }
  }, [selectedTask, selectedJobId]);

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
    if (!selectedJob) return;
    const model = (selectedJob.model_id || '').trim().split('/').pop();
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
              const r = j._isOrphan ? resultMap[mid] : (resultMap[mid] || resultMap[midLast]);
              const score = r ? Math.round(r.avg_score) : null;
              const isRunning = j.status === 'running' || j.status === 'pending';
              const isCompleted = j.status === 'completed' || j._isOrphan;
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
                    <span>{timeStr || (j._isOrphan ? (r?.eval_date ? formatDateTime(new Date(r.eval_date)) : 'Legacy') : '')}</span>
                    {isRunning && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/20 text-blue-400">
                        {t(`status.${j.status}`)}
                      </span>
                    )}
                    {isCompleted && score !== null && (
                      <span className="opacity-70">{score}</span>
                    )}
                    {!isRunning && !isCompleted && (
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

      {/* Loading detail */}
      {selectedJobId && !detail && (
        <div className="text-center text-on-muted py-8">
          {selectedJob?.status === 'running' || selectedJob?.status === 'pending'
            ? t('report.evalRunning')
            : t('loading')}
        </div>
      )}

      {selectedJobId && detail && (
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
              model={(selectedJob?.model_id || '').trim().split('/').pop()}
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
              samples={samples}
              samplesLoading={samplesLoading}
              t={t}
            />
          )}

          {/* Level 3: High-Risk Case Report */}
          {activeLevel === 3 && (
            <HighRiskView
              detail={detail}
              model={(selectedJob?.model_id || '').trim().split('/').pop()}
              hierarchy={hierarchy}
              lang={i18n.language}
              selectedTask={selectedTask}
              setSelectedTask={setSelectedTask}
              samples={samples}
              samplesLoading={samplesLoading}
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
 * Groups tasks by risk hierarchy: Category → Subcategory → Benchmark → Tasks.
 * Returns: [{ category, subcategory, benchmark, tasks: [taskObj] }]
 * Tasks not matching any hierarchy entry go into an "Other" group.
 */
function groupTasksByHierarchy(tasks, hierarchy, lang) {
  const isZh = lang?.startsWith('zh');
  // Build task→group mapping from hierarchy with ordering indices
  const taskGroupMap = {};
  for (let catIdx = 0; catIdx < hierarchy.length; catIdx++) {
    const cat = hierarchy[catIdx];
    const subcats = cat.subcategories || [];
    for (let subIdx = 0; subIdx < subcats.length; subIdx++) {
      const sub = subcats[subIdx];
      const benchmarks = sub.benchmarks || [];
      for (let bmIdx = 0; bmIdx < benchmarks.length; bmIdx++) {
        const bm = benchmarks[bmIdx];
        const bmLabel = isZh
          ? (bm.display_name || bm.name)
          : (bm.display_name_en || bm.display_name || bm.name);
        for (const t of bm.tasks || []) {
          if (!taskGroupMap[t.name]) {
            taskGroupMap[t.name] = {
              category: isZh ? cat.name : cat.name_en,
              subcategory: isZh ? sub.name : sub.name_en,
              benchmark: bmLabel,
              _catIdx: catIdx,
              _subIdx: subIdx,
              _bmIdx: bmIdx,
            };
          }
        }
      }
    }
  }

  // Group tasks by benchmark (unique key = subcategory + benchmark)
  const groups = [];
  const groupIndex = {};
  for (const task of tasks) {
    const info = taskGroupMap[task.task];
    const key = info ? `${info.subcategory}::${info.benchmark}` : '_other';
    if (!groupIndex[key]) {
      groupIndex[key] = {
        category: info?.category || '',
        subcategory: info?.subcategory || '',
        benchmark: info?.benchmark || '',
        _catIdx: info?._catIdx ?? 999,
        _subIdx: info?._subIdx ?? 999,
        _bmIdx: info?._bmIdx ?? 999,
        tasks: [],
      };
      groups.push(groupIndex[key]);
    }
    groupIndex[key].tasks.push(task);
  }

  // Sort by hierarchy order (category → subcategory → benchmark)
  groups.sort((a, b) =>
    a._catIdx - b._catIdx || a._subIdx - b._subIdx || a._bmIdx - b._bmIdx
  );

  return groups;
}

function GroupedTaskRows({ group, onSelectTask }) {
  return (
    <>
      <tr>
        <td colSpan={4} className="pt-3 pb-1 px-0">
          <div className="text-xs font-medium text-on-muted border-b border-edge/30 pb-1">
            <span className="text-on-dim">{group.subcategory}</span>
            {group.benchmark && (
              <span className="ml-2 text-on-surface">{group.benchmark}</span>
            )}
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
                  key={`${group.subcategory}::${group.benchmark}`}
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
              <div key={`${group.subcategory}::${group.benchmark}`}>
                <div className="text-xs font-medium text-on-muted mb-2">
                  {group.subcategory}
                  {group.benchmark && (
                    <span className="ml-2 text-on-dim font-normal">{group.benchmark}</span>
                  )}
                </div>
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

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, MINIMAL: 4, UNKNOWN: 5 };
const ALL_RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];

function SingleBenchmarkView({ detail, hierarchy, lang, selectedTask, setSelectedTask, samples, samplesLoading, t }) {
  const isZh = lang?.startsWith('zh');
  const groups = groupTasksByHierarchy(detail.tasks, hierarchy, lang);

  // Sample table state
  const [riskFilter, setRiskFilter] = useState(new Set(['CRITICAL', 'HIGH']));
  const [sortKey, setSortKey] = useState('score');    // 'score' | 'risk' | 'id'
  const [sortAsc, setSortAsc] = useState(true);       // true = ascending (worst first for score)
  const [page, setPage] = useState(0);
  const [expandedSample, setExpandedSample] = useState(null);
  const perPage = 20;

  // Reset page and expanded state when filter changes
  const handleFilterToggle = (level) => {
    setRiskFilter(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
    setPage(0);
    setExpandedSample(null);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(0);
    setExpandedSample(null);
  };

  // Filter and sort samples
  const filteredSamples = samples
    .filter(s => riskFilter.size === 0 || riskFilter.has(s.risk_level))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'score') {
        cmp = (a.score ?? 1) - (b.score ?? 1);
      } else if (sortKey === 'risk') {
        cmp = (RISK_ORDER[a.risk_level] ?? 5) - (RISK_ORDER[b.risk_level] ?? 5);
      } else {
        cmp = String(a.sample_id || '').localeCompare(String(b.sample_id || ''));
      }
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filteredSamples.length / perPage);
  const pageItems = filteredSamples.slice(page * perPage, (page + 1) * perPage);

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <span className="text-on-dim/40 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortAsc ? '↑' : '↓'}</span>;
  };

  // Build nested structure: category → subcategories → benchmarks
  const categoryMap = new Map();
  for (const g of groups) {
    const catKey = g.category || t('report.uncategorized');
    if (!categoryMap.has(catKey)) categoryMap.set(catKey, new Map());
    const subMap = categoryMap.get(catKey);
    const subKey = g.subcategory;
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey).push(g);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {[...categoryMap.entries()].map(([cat, subMap]) => (
          <div key={cat}>
            <div className="text-sm font-semibold text-on-canvas mb-2 border-b border-edge/40 pb-1">{cat}</div>
            <div className="space-y-3 pl-2">
              {[...subMap.entries()].map(([sub, benchGroups]) => (
                <div key={sub}>
                  <div className="text-xs font-medium text-on-muted mb-1.5">{sub}</div>
                  <div className="space-y-2 pl-2">
                    {benchGroups.map(group => (
                      <div key={group.benchmark || '_default'}>
                        {group.benchmark && (
                          <div className="text-[11px] text-on-dim mb-1">{group.benchmark}</div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {group.tasks.map(task => (
                            <button
                              key={task.task}
                              onClick={() => { setSelectedTask(task.task); setPage(0); setExpandedSample(null); }}
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTask && (() => {
        const task = detail.tasks.find(t => t.task === selectedTask);
        if (!task) return null;
        return (
          <>
            {/* Task summary */}
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
                  <div className="text-xs text-on-muted">{t('report.samplesCol')}</div>
                </div>
              </div>
              {task.description && (
                <p className="text-sm text-on-muted mb-3">{task.description}</p>
              )}
              <p className="text-sm text-on-surface">{task.interpretation}</p>
            </Section>

            {/* Sample table */}
            <Section title={`${t('report.sampleDetails')} (${samplesLoading ? '...' : `${filteredSamples.length}/${samples.length}`})`}>
              {/* Risk level filter bar */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-xs text-on-muted">{t('report.riskLevel')}:</span>
                {ALL_RISK_LEVELS.map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleFilterToggle(level)}
                    className={`px-2 py-0.5 text-[11px] rounded-full border transition-colors ${
                      riskFilter.has(level)
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                        : 'bg-surface border-edge text-on-dim hover:text-on-muted'
                    }`}
                  >
                    {t(`risk.${level}`)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setRiskFilter(new Set(ALL_RISK_LEVELS)); setPage(0); }}
                  className="px-2 py-0.5 text-[11px] text-on-dim hover:text-on-muted"
                >
                  {t('report.all')}
                </button>
                <button
                  type="button"
                  onClick={() => { setRiskFilter(new Set(['CRITICAL', 'HIGH'])); setPage(0); }}
                  className="px-2 py-0.5 text-[11px] text-on-dim hover:text-on-muted"
                >
                  {t('report.highRiskOnly')}
                </button>
              </div>

              {/* Table */}
              {samplesLoading ? (
                <div className="text-center text-on-muted py-6 text-sm">
                  <div className="inline-block w-5 h-5 border-2 border-on-dim/30 border-t-blue-400 rounded-full animate-spin mb-2" />
                  <div>{t('report.loadingSamples')}</div>
                </div>
              ) : filteredSamples.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-edge">
                        <th className="text-left py-2 px-2 text-on-muted font-medium w-16 cursor-pointer select-none" onClick={() => handleSort('id')}>
                          # <SortIcon column="id" />
                        </th>
                        <th className="text-right py-2 px-2 text-on-muted font-medium w-20 cursor-pointer select-none" onClick={() => handleSort('score')}>
                          {t('report.scoreCol')} <SortIcon column="score" />
                        </th>
                        <th className="text-center py-2 px-2 text-on-muted font-medium w-24 cursor-pointer select-none" onClick={() => handleSort('risk')}>
                          {t('report.riskCol')} <SortIcon column="risk" />
                        </th>
                        <th className="text-left py-2 px-2 text-on-muted font-medium">{t('report.input')}</th>
                        <th className="text-left py-2 px-2 text-on-muted font-medium">{t('report.output')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((sample, i) => {
                        const sid = sample.sample_id || (page * perPage + i + 1);
                        const isExpanded = expandedSample === sid;
                        return (
                          <tr
                            key={sid}
                            onClick={() => setExpandedSample(isExpanded ? null : sid)}
                            className={`border-b border-edge/50 cursor-pointer transition-colors ${
                              isExpanded ? 'bg-surface-hover/70' : 'hover:bg-surface-hover/30'
                            } ${sample.risk_level === 'CRITICAL' ? 'bg-red-900/5' : sample.risk_level === 'HIGH' ? 'bg-orange-900/5' : ''}`}
                          >
                            <td className="py-2 px-2 text-xs text-on-dim font-mono">{sid}</td>
                            <td className={`py-2 px-2 text-right font-medium ${
                              (sample.score ?? 1) <= 0.3 ? 'text-red-400' :
                              (sample.score ?? 1) <= 0.5 ? 'text-orange-400' :
                              (sample.score ?? 1) <= 0.6 ? 'text-yellow-400' :
                              'text-on-canvas'
                            }`}>
                              {sample.score != null ? sample.score.toFixed(2) : '-'}
                            </td>
                            <td className="py-2 px-2 text-center"><RiskLevelBadge level={sample.risk_level} /></td>
                            <td className="py-2 px-2 text-xs text-on-surface max-w-[250px]">
                              <div className={isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}>
                                {sample.input || '-'}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-xs text-on-surface max-w-[250px]">
                              <div className={isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'}>
                                {sample.output || '-'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-on-muted py-6 text-sm">
                  {t('report.noSamples')}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-on-dim">
                    {t('report.showing', {
                      start: page * perPage + 1,
                      end: Math.min((page + 1) * perPage, filteredSamples.length),
                      total: filteredSamples.length,
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(0)}
                      disabled={page === 0}
                      className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40"
                    >
                      ««
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40"
                    >
                      «
                    </button>
                    <span className="text-xs text-on-muted">{page + 1} / {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40"
                    >
                      »
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                      className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40"
                    >
                      »»
                    </button>
                  </div>
                </div>
              )}
            </Section>
          </>
        );
      })()}
    </div>
  );
}

// ---- Level 3: High-Risk Cases ----

function HighRiskView({ detail, model, hierarchy, lang, selectedTask, setSelectedTask, samples, samplesLoading, t, onNavigate }) {
  const isZh = lang?.startsWith('zh');
  const highRiskTasks = detail.tasks.filter(t => t.risk_level === 'CRITICAL' || t.risk_level === 'HIGH');
  const groups = groupTasksByHierarchy(highRiskTasks, hierarchy, lang);
  // Filter to only high-risk samples (client-side since we now load all)
  const highRiskSamples = samples.filter(s => s.risk_level === 'CRITICAL' || s.risk_level === 'HIGH');

  // Build nested structure: category → subcategories → benchmarks
  const categoryMap = new Map();
  for (const g of groups) {
    const catKey = g.category || t('report.uncategorized');
    if (!categoryMap.has(catKey)) categoryMap.set(catKey, new Map());
    const subMap = categoryMap.get(catKey);
    const subKey = g.subcategory;
    if (!subMap.has(subKey)) subMap.set(subKey, []);
    subMap.get(subKey).push(g);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {[...categoryMap.entries()].map(([cat, subMap]) => (
          <div key={cat}>
            <div className="text-sm font-semibold text-on-canvas mb-2 border-b border-edge/40 pb-1">{cat}</div>
            <div className="space-y-3 pl-2">
              {[...subMap.entries()].map(([sub, benchGroups]) => (
                <div key={sub}>
                  <div className="text-xs font-medium text-on-muted mb-1.5">{sub}</div>
                  <div className="space-y-2 pl-2">
                    {benchGroups.map(group => (
                      <div key={group.benchmark || '_default'}>
                        {group.benchmark && (
                          <div className="text-[11px] text-on-dim mb-1">{group.benchmark}</div>
                        )}
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTask && samplesLoading && (
        <div className="text-center text-on-muted py-8 text-sm">
          <div className="inline-block w-5 h-5 border-2 border-on-dim/30 border-t-blue-400 rounded-full animate-spin mb-2" />
          <div>{t('report.loadingSamples')}</div>
        </div>
      )}

      {selectedTask && !samplesLoading && highRiskSamples.length > 0 && (
        <div className="space-y-3">
          {highRiskSamples.map((sample, i) => (
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

      {selectedTask && !samplesLoading && highRiskSamples.length === 0 && (
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
