import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchResultByJob, fetchJobTaskSamples, fetchResultSamples,
  fetchRiskHierarchy, fetchDatasetDescription, generateReport,
  getEvaluation,
} from '../../api/evalBridgeApi';
import { listReports } from '../../api/reportEditorApi';
import SafetyScoreGauge from '../eval/SafetyScoreGauge';
import RiskLevelBadge from '../eval/RiskLevelBadge';

/**
 * EvalResultDetailPage — detail view for a single evaluation result
 * 5 tabs: Overview, Benchmark Details, High-Risk Cases, Dataset Examples, Reports
 */
export default function EvalResultDetailPage({ jobId, onNavigate }) {
  const { t, i18n } = useTranslation('eval');
  const lang = i18n.language;

  const [job, setJob] = useState(null);
  const [detail, setDetail] = useState(null);
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Samples state (shared by Benchmark Details and High-Risk tabs)
  const [selectedTask, setSelectedTask] = useState(null);
  const [samples, setSamples] = useState([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const sampleRequestRef = useRef(0);

  // Dataset state
  const [datasetData, setDatasetData] = useState(null);
  const [datasetLoading, setDatasetLoading] = useState(false);

  // Reports state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Generate report state
  const [generatedReport, setGeneratedReport] = useState('');
  const [generating, setGenerating] = useState(false);

  const pollRef = useRef(null);

  // Load job, results, hierarchy on mount
  const loadData = async (isInitial = false) => {
    if (!jobId) return;
    try {
      const [jobData, resultData, hier] = await Promise.all([
        getEvaluation(jobId).catch(() => null),
        fetchResultByJob(jobId).catch(() => null),
        ...(isInitial ? [fetchRiskHierarchy().catch(() => [])] : []),
      ]);
      setJob(jobData);
      setDetail(resultData);
      if (isInitial && hier !== undefined) {
        setHierarchy(Array.isArray(hier) ? hier : (hier?.categories || []));
      }
      // Stop polling when job finishes
      if (jobData && jobData.status !== 'running' && jobData.status !== 'pending') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
    // Poll every 5s for running jobs
    pollRef.current = setInterval(() => loadData(false), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  // Load samples when task selected
  useEffect(() => {
    if (!selectedTask || !jobId) { setSamples([]); setSamplesLoading(false); return; }
    setSamples([]);
    setSamplesLoading(true);
    const reqId = ++sampleRequestRef.current;
    const stale = () => sampleRequestRef.current !== reqId;
    const done = (data) => { if (!stale()) { setSamples(data.samples || []); setSamplesLoading(false); } };
    const fail = () => { if (!stale()) { setSamples([]); setSamplesLoading(false); } };

    // Only use job-scoped samples — never fall back to model-level
    // to avoid cross-contamination between runs
    fetchJobTaskSamples(jobId, selectedTask).then(done).catch(fail);
  }, [selectedTask, jobId]);

  // Load dataset examples when tab selected
  useEffect(() => {
    if (activeTab === 'dataset' && !datasetData) {
      setDatasetLoading(true);
      const langParam = lang?.startsWith('zh') ? 'zh' : 'en';
      // Pass the job's benchmarks to get relevant dataset descriptions
      const benchmarks = (job?.benchmarks || []).join(',');
      fetchDatasetDescription(benchmarks, langParam)
        .then(setDatasetData)
        .catch(() => setDatasetData({ categories: [], samples: [] }))
        .finally(() => setDatasetLoading(false));
    }
  }, [activeTab, lang]);

  // Load reports when tab selected
  useEffect(() => {
    if (activeTab === 'reports' && reports.length === 0 && !reportsLoading) {
      setReportsLoading(true);
      listReports()
        .then(allReports => {
          // Filter by matching model
          const mid = (job?.model_id || '').trim();
          const midLast = mid.split('/').pop();
          const filtered = allReports.filter(r => {
            const models = r.source_data?.models || [];
            return models.some(m => {
              const mt = (m || '').trim();
              const mtLast = mt.split('/').pop();
              return mt === mid || mt === midLast || mtLast === mid || mtLast === midLast;
            });
          });
          setReports(filtered);
        })
        .catch(() => setReports([]))
        .finally(() => setReportsLoading(false));
    }
  }, [activeTab]);

  const handleGenerate = async () => {
    if (!job) return;
    const model = (job.model_id || '').trim().split('/').pop();
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

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  if (!job && !detail) {
    return (
      <div className="p-8 text-center text-on-muted">
        <div className="text-4xl mb-4">📊</div>
        <div>{t('results.noResults')}</div>
        <button
          type="button"
          onClick={() => onNavigate?.('eval-results')}
          className="mt-4 px-4 py-2 text-sm bg-surface border border-edge rounded-lg hover:bg-surface-hover text-on-surface"
        >
          {t('report.backToResults')}
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: t('report.overview') },
    { id: 'benchmark-details', label: t('report.benchmarkDetails') },
    { id: 'high-risk', label: t('report.highRiskCases') },
    { id: 'dataset', label: t('report.datasetExamples') },
    { id: 'reports', label: t('report.reports') },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onNavigate?.('eval-results')}
          className="px-3 py-1.5 text-sm bg-surface border border-edge rounded-lg hover:bg-surface-hover text-on-surface"
        >
          ← {t('report.backToResults')}
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-on-canvas">
            {job?.agent_name || (job?.model_id || '').trim() || t('report.title')}
          </h1>
          {job?.agent_name && (
            <div className="text-xs text-on-dim">{(job.model_id || '').trim()}</div>
          )}
        </div>
        {detail ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-on-canvas">{Math.round(detail.avg_score)}</span>
            <RiskLevelBadge level={detail.risk_level} />
          </div>
        ) : job && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            job.status === 'running' ? 'bg-blue-500/20 text-blue-400'
            : job.status === 'failed' ? 'bg-red-500/20 text-red-400'
            : job.status === 'cancelled' ? 'bg-amber-500/20 text-amber-400'
            : 'bg-gray-500/20 text-gray-400'
          }`}>
            {t(`status.${job.status}`)}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-edge pb-0">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setActiveTab(id); if (id !== 'benchmark-details' && id !== 'high-risk') setSelectedTask(null); }}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'border-blue-500 text-on-canvas font-medium'
                : 'border-transparent text-on-muted hover:text-on-canvas hover:border-edge'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          detail={detail}
          job={job}
          hierarchy={hierarchy}
          lang={lang}
          t={t}
          onSelectTask={(task) => { setSelectedTask(task); setActiveTab('benchmark-details'); }}
          onHighRisk={(task) => { setSelectedTask(task); setActiveTab('high-risk'); }}
          onGenerate={handleGenerate}
          generating={generating}
          generatedReport={generatedReport}
        />
      )}

      {activeTab === 'benchmark-details' && detail && (
        <BenchmarkDetailsTab
          detail={detail}
          hierarchy={hierarchy}
          lang={lang}
          selectedTask={selectedTask}
          setSelectedTask={setSelectedTask}
          samples={samples}
          samplesLoading={samplesLoading}
          t={t}
        />
      )}
      {activeTab === 'benchmark-details' && !detail && (
        <div className="text-center text-on-muted py-8">{t('results.noResults')}</div>
      )}

      {activeTab === 'high-risk' && detail && (
        <HighRiskCasesTab
          detail={detail}
          model={(job?.model_id || '').trim().split('/').pop()}
          hierarchy={hierarchy}
          lang={lang}
          selectedTask={selectedTask}
          setSelectedTask={setSelectedTask}
          samples={samples}
          samplesLoading={samplesLoading}
          t={t}
          onNavigate={onNavigate}
        />
      )}
      {activeTab === 'high-risk' && !detail && (
        <div className="text-center text-on-muted py-8">{t('results.noResults')}</div>
      )}

      {activeTab === 'dataset' && (
        <DatasetExamplesTab
          data={datasetData}
          loading={datasetLoading}
          t={t}
          lang={lang}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab
          reports={reports}
          loading={reportsLoading}
          t={t}
          lang={lang}
        />
      )}
    </div>
  );
}

// ============================================================
// Task grouping by risk hierarchy (improved matching, no "Other")
// ============================================================

function buildTaskGroupMap(hierarchy, lang) {
  const isZh = lang?.startsWith('zh');
  const map = {};
  const bmMap = {}; // benchmark catalog_key → group info

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
        const groupInfo = {
          category: isZh ? cat.name : (cat.name_en || cat.name),
          subcategory: isZh ? sub.name : (sub.name_en || sub.name),
          benchmark: bmLabel,
          _catIdx: catIdx,
          _subIdx: subIdx,
          _bmIdx: bmIdx,
        };

        // Register all task names
        for (const t of bm.tasks || []) {
          map[t.name] = groupInfo;
        }

        // Register benchmark catalog_key
        if (bm.catalog_key) {
          bmMap[bm.catalog_key] = groupInfo;
        }
        if (bm.name) {
          bmMap[bm.name] = groupInfo;
        }
      }
    }
  }

  return { map, bmMap };
}

function resolveTaskGroup(taskName, taskGroupMap, bmMap) {
  // 1. Exact match
  if (taskGroupMap[taskName]) return taskGroupMap[taskName];

  // 2. Strip common prefixes
  const stripped = taskName.replace(/^(eval_benchmarks|inspect_evals)\//, '');
  if (taskGroupMap[stripped]) return taskGroupMap[stripped];

  // 3. Handle benchmark:task format
  const colonIdx = stripped.indexOf(':');
  if (colonIdx >= 0) {
    const afterColon = stripped.substring(colonIdx + 1);
    if (taskGroupMap[afterColon]) return taskGroupMap[afterColon];
    const beforeColon = stripped.substring(0, colonIdx);
    if (bmMap[beforeColon]) return bmMap[beforeColon];
  }

  // 4. Last path segment
  const lastSeg = taskName.split('/').pop();
  if (lastSeg && taskGroupMap[lastSeg]) return taskGroupMap[lastSeg];

  // 5. Benchmark key from first part
  const firstPart = stripped.split(':')[0].split('/')[0];
  if (bmMap[firstPart]) return bmMap[firstPart];

  return null;
}

function groupTasksByHierarchy(tasks, hierarchy, lang) {
  const isZh = lang?.startsWith('zh');
  const { map: taskGroupMap, bmMap } = buildTaskGroupMap(hierarchy, lang);

  const groups = [];
  const groupIndex = {};

  for (const task of tasks) {
    const info = resolveTaskGroup(task.task, taskGroupMap, bmMap);
    const key = info ? `${info.subcategory}::${info.benchmark}` : '_uncategorized';
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

  groups.sort((a, b) =>
    a._catIdx - b._catIdx || a._subIdx - b._subIdx || a._bmIdx - b._bmIdx
  );

  return groups;
}

// ============================================================
// Tab 1: Overview
// ============================================================

function OverviewTab({ detail, job, hierarchy, lang, t, onSelectTask, onHighRisk, onGenerate, generating, generatedReport }) {
  const detailTasks = detail?.tasks || [];
  const highRiskTasks = detailTasks.filter(tk => tk.risk_level === 'CRITICAL' || tk.risk_level === 'HIGH');

  // Merge job.tasks status info with detail.tasks scores
  const jobTasks = job?.tasks || [];
  const jobTaskMap = {};
  for (const jt of jobTasks) {
    const name = jt.task_name || jt.name || jt.task || '';
    jobTaskMap[name] = jt;
  }

  // Build merged task list: completed tasks from detail + pending/running/failed from job
  const mergedTasks = useMemo(() => {
    const detailTaskNames = new Set(detailTasks.map(t => t.task));
    const merged = [...detailTasks.map(dt => ({
      ...dt,
      _status: 'completed',
      _jobTask: jobTaskMap[dt.task],
    }))];

    // Add non-completed tasks from job that aren't in detail
    for (const jt of jobTasks) {
      const name = jt.task_name || jt.name || jt.task || '';
      if (!detailTaskNames.has(name) && name) {
        const status = jt.status || 'pending';
        if (status !== 'completed') {
          merged.push({
            task: name,
            display_name: jt.display_name || name,
            safety_score: null,
            risk_level: null,
            samples: jt.progress?.total || 0,
            _status: status,
            _jobTask: jt,
          });
        }
      }
    }

    return merged;
  }, [detailTasks, jobTasks]);

  const jobStatus = job?.status || 'pending';
  const hasDetail = !!detail;

  // Job status banner styles
  const statusBannerConfig = {
    running: { bg: 'bg-blue-600/10 border-blue-500/30', icon: '⏳', color: 'text-blue-400' },
    pending: { bg: 'bg-gray-600/10 border-gray-500/30', icon: '⏳', color: 'text-gray-400' },
    failed: { bg: 'bg-red-600/10 border-red-500/30', icon: '⚠', color: 'text-red-400' },
    cancelled: { bg: 'bg-amber-600/10 border-amber-500/30', icon: '⊘', color: 'text-amber-400' },
  };

  return (
    <div className="space-y-6">
      {/* Job status banner for non-completed jobs */}
      {jobStatus !== 'completed' && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${statusBannerConfig[jobStatus]?.bg || 'bg-gray-600/10 border-gray-500/30'}`}>
          <span className="text-lg">{statusBannerConfig[jobStatus]?.icon || '?'}</span>
          <div className="flex-1">
            <div className={`text-sm font-medium ${statusBannerConfig[jobStatus]?.color || 'text-on-muted'}`}>
              {t(`status.${jobStatus}`)}
            </div>
            {(jobStatus === 'running' || jobStatus === 'pending') && (
              <div className="text-xs text-on-dim mt-0.5">
                {t('report.evalRunningHint')}
              </div>
            )}
          </div>
          {jobTasks.length > 0 && (
            <div className="text-xs text-on-muted">
              {jobTasks.filter(jt => jt.status === 'completed').length}/{jobTasks.length} {t('benchmarks.tasks')}
            </div>
          )}
        </div>
      )}

      {/* Score overview — only show when we have result data */}
      {hasDetail && (
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
                {detailTasks.length} {t('benchmarks.tasks')} | {t('results.evalDate')}: {detail.eval_date || '-'}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Score Details table with task status */}
      {mergedTasks.length > 0 && (
        <Section title={t('report.scoreTable')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge">
                  <th className="text-left py-2 text-on-muted font-medium">{t('report.taskCol')}</th>
                  <th className="text-center py-2 text-on-muted font-medium">{t('report.statusCol')}</th>
                  <th className="text-right py-2 text-on-muted font-medium">{t('report.scoreCol')}</th>
                  <th className="text-center py-2 text-on-muted font-medium">{t('report.riskCol')}</th>
                  <th className="text-right py-2 text-on-muted font-medium">{t('report.samplesCol')}</th>
                </tr>
              </thead>
              <tbody>
                {groupTasksByHierarchy(mergedTasks, hierarchy, lang).map(group => (
                  <GroupedTaskRows
                    key={`${group.subcategory}::${group.benchmark}`}
                    group={group}
                    onSelectTask={onSelectTask}
                    t={t}
                    lang={lang}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* No data message when no tasks at all */}
      {mergedTasks.length === 0 && (
        <div className="text-center text-on-muted py-8">
          {jobStatus === 'pending' ? t('report.evalRunning') : t('results.noResults')}
        </div>
      )}

      {/* Risk Analysis */}
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
                          type="button"
                          onClick={() => onHighRisk(task.task)}
                          className="px-2 py-1 text-xs bg-red-600/20 text-red-400 rounded hover:bg-red-600/30"
                        >
                          {t('report.highRiskCases')}
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

      {/* Generate report — only when we have results */}
      {hasDetail && (
        <>
          <div className="flex gap-3">
            <button
              type="button"
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
        </>
      )}
    </div>
  );
}

function GroupedTaskRows({ group, onSelectTask, t, lang }) {
  return (
    <>
      {/* Group header (subcategory + benchmark) — only if not uncategorized empty group */}
      {(group.subcategory || group.benchmark) && (
        <tr>
          <td colSpan={5} className="pt-3 pb-1 px-0">
            <div className="text-xs font-medium text-on-muted border-b border-edge/30 pb-1">
              {group.subcategory && <span className="text-on-dim">{group.subcategory}</span>}
              {group.benchmark && (
                <span className="ml-2 text-on-surface">{group.benchmark}</span>
              )}
            </div>
          </td>
        </tr>
      )}
      {group.tasks.map(task => {
        const status = task._status || 'completed';
        const isCompleted = status === 'completed';
        const isRunning = status === 'running';
        const isFailed = status === 'failed' || status === 'error';
        const isPending = status === 'pending';
        const progress = task._jobTask?.progress;

        return (
          <tr key={task.task} className="border-b border-edge/50 hover:bg-surface-hover/50">
            <td className="py-2 pl-4 text-on-canvas">
              {isCompleted ? (
                <button
                  type="button"
                  onClick={() => onSelectTask(task.task)}
                  className="hover:text-blue-400 hover:underline text-left"
                >
                  {task.display_name || task.task}
                </button>
              ) : (
                <span className="text-on-muted">{task.display_name || task.task}</span>
              )}
            </td>
            <td className="py-2 text-center">
              {isCompleted && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400">
                  {t('status.completed')}
                </span>
              )}
              {isRunning && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400">
                    {t('status.running')}
                  </span>
                  {progress && (
                    <div className="w-full max-w-[60px]">
                      <div className="h-1 bg-surface-raised rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-on-dim mt-0.5">{progress.completed}/{progress.total}</div>
                    </div>
                  )}
                </div>
              )}
              {isFailed && (
                <div className="flex flex-col items-center gap-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
                    {t('status.failed')}
                  </span>
                  {task._jobTask?.error_type && (
                    <span className="text-[9px] text-red-400 font-medium">
                      {t(`status.errorType.${task._jobTask.error_type}`, { defaultValue: task._jobTask.error_type })}
                    </span>
                  )}
                  {task._jobTask?.error && (
                    <span className="text-[9px] text-on-muted max-w-[200px] truncate block" title={task._jobTask.error}>
                      {task._jobTask.error}
                    </span>
                  )}
                  {task._jobTask?.retry_count > 0 && (
                    <span className="text-[9px] text-on-dim">
                      {t('status.retries', { count: task._jobTask.retry_count })}
                    </span>
                  )}
                </div>
              )}
              {isPending && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/20 text-gray-400">
                  {t('status.pending')}
                </span>
              )}
            </td>
            <td className="py-2 text-right text-on-canvas font-medium">
              {isCompleted && task.safety_score != null ? Math.round(task.safety_score) : '-'}
            </td>
            <td className="py-2 text-center">
              {isCompleted && task.risk_level ? <RiskLevelBadge level={task.risk_level} /> : <span className="text-on-dim">-</span>}
            </td>
            <td className="py-2 text-right text-on-muted">
              {task.samples || '-'}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ============================================================
// Collapsible + Searchable Sidebar (shared by tabs 2 & 3)
// ============================================================

function CollapsibleSidebar({ groups, selectedTask, onSelectTask, t, lang, isHighRisk = false }) {
  const isZh = lang?.startsWith('zh');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());

  // Build nested structure: category → subcategory → benchmark → tasks
  const categoryMap = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      const catKey = g.category || (isZh ? t('report.uncategorized') : t('report.uncategorized'));
      if (!map.has(catKey)) map.set(catKey, new Map());
      const subMap = map.get(catKey);
      const subKey = g.subcategory || '';
      if (!subMap.has(subKey)) subMap.set(subKey, []);
      subMap.get(subKey).push(g);
    }
    return map;
  }, [groups, isZh]);

  // Filter by search
  const matchesSearch = (text) => {
    if (!search) return true;
    return (text || '').toLowerCase().includes(search.toLowerCase());
  };

  const toggleCategory = (key) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const collapseAll = () => {
    const keys = new Set();
    for (const [cat] of categoryMap) keys.add(cat);
    setCollapsed(keys);
  };

  const expandAll = () => setCollapsed(new Set());

  return (
    <div className="space-y-2">
      {/* Search + collapse controls */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('report.searchPlaceholder')}
          className="flex-1 px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg text-on-canvas placeholder:text-on-dim focus:outline-none focus:border-blue-500"
        />
        <button type="button" onClick={expandAll} className="px-2 py-1 text-[10px] text-on-dim hover:text-on-muted" title={t('report.expandAll')}>
          ▼
        </button>
        <button type="button" onClick={collapseAll} className="px-2 py-1 text-[10px] text-on-dim hover:text-on-muted" title={t('report.collapseAll')}>
          ▲
        </button>
      </div>

      {/* Hierarchy */}
      <div className="space-y-1 max-h-[50vh] overflow-y-auto custom-scroll">
        {[...categoryMap.entries()].map(([cat, subMap]) => {
          const isCatCollapsed = collapsed.has(cat);

          // Check if any task in this category matches search
          let hasMatch = false;
          if (search) {
            for (const [, benchGroups] of subMap) {
              for (const g of benchGroups) {
                for (const task of g.tasks) {
                  if (matchesSearch(task.display_name || task.task) || matchesSearch(g.benchmark)) {
                    hasMatch = true;
                    break;
                  }
                }
                if (hasMatch) break;
              }
              if (hasMatch) break;
            }
            if (!hasMatch && !matchesSearch(cat)) return null;
          }

          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="w-full text-left text-xs font-semibold text-on-canvas py-1 px-1 hover:bg-surface-hover/50 rounded flex items-center gap-1"
              >
                <span className="text-[10px] text-on-dim">{isCatCollapsed ? '▸' : '▾'}</span>
                {cat}
              </button>
              {!isCatCollapsed && (
                <div className="pl-3 space-y-1">
                  {[...subMap.entries()].map(([sub, benchGroups]) => (
                    <div key={sub}>
                      {sub && <div className="text-[10px] font-medium text-on-muted mb-0.5 pl-1">{sub}</div>}
                      <div className="space-y-0.5 pl-1">
                        {benchGroups.map(group => (
                          <div key={group.benchmark || '_default'}>
                            {group.benchmark && (
                              <div className="text-[10px] text-on-dim mb-0.5">{group.benchmark}</div>
                            )}
                            <div className="flex gap-1 flex-wrap">
                              {group.tasks
                                .filter(task => matchesSearch(task.display_name || task.task) || matchesSearch(group.benchmark))
                                .map(task => (
                                  <button
                                    key={task.task}
                                    type="button"
                                    onClick={() => onSelectTask(task.task)}
                                    className={`px-2 py-1 text-[11px] rounded transition-colors ${
                                      selectedTask === task.task
                                        ? (isHighRisk ? 'bg-red-600 text-white' : 'bg-blue-600 text-white')
                                        : 'bg-surface border border-edge text-on-surface hover:bg-surface-hover'
                                    }`}
                                  >
                                    {task.display_name || task.task}
                                  </button>
                                ))
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Tab 2: Benchmark Details
// ============================================================

const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, MINIMAL: 4, UNKNOWN: 5 };
const ALL_RISK_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];

function BenchmarkDetailsTab({ detail, hierarchy, lang, selectedTask, setSelectedTask, samples, samplesLoading, t }) {
  const groups = groupTasksByHierarchy(detail.tasks, hierarchy, lang);

  // Sample table state
  const [riskFilter, setRiskFilter] = useState(new Set(['CRITICAL', 'HIGH']));
  const [sortKey, setSortKey] = useState('score');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [expandedSample, setExpandedSample] = useState(null);
  const perPage = 20;

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
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
    setPage(0);
    setExpandedSample(null);
  };

  const filteredSamples = samples
    .filter(s => riskFilter.size === 0 || riskFilter.has(s.risk_level))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'score') cmp = (a.score ?? 1) - (b.score ?? 1);
      else if (sortKey === 'risk') cmp = (RISK_ORDER[a.risk_level] ?? 5) - (RISK_ORDER[b.risk_level] ?? 5);
      else cmp = String(a.sample_id || '').localeCompare(String(b.sample_id || ''));
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filteredSamples.length / perPage);
  const pageItems = filteredSamples.slice(page * perPage, (page + 1) * perPage);

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <span className="text-on-dim/40 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortAsc ? '↑' : '↓'}</span>;
  };

  return (
    <div className="flex gap-4">
      {/* Collapsible sidebar */}
      <div className="w-64 shrink-0">
        <CollapsibleSidebar
          groups={groups}
          selectedTask={selectedTask}
          onSelectTask={(task) => { setSelectedTask(task); setPage(0); setExpandedSample(null); }}
          t={t}
          lang={lang}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-4">
        {selectedTask && (() => {
          const task = detail.tasks.find(tk => tk.task === selectedTask);
          if (!task) return <div className="text-center text-on-muted py-8">{t('results.noResults')}</div>;
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
                {task.description && <p className="text-sm text-on-muted mb-3">{task.description}</p>}
                <p className="text-sm text-on-surface">{task.interpretation}</p>
              </Section>

              {/* Sample table */}
              <Section title={`${t('report.sampleDetails')} (${samplesLoading ? '...' : `${filteredSamples.length}/${samples.length}`})`}>
                {/* Risk level filter */}
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
                  <button type="button" onClick={() => { setRiskFilter(new Set(ALL_RISK_LEVELS)); setPage(0); }} className="px-2 py-0.5 text-[11px] text-on-dim hover:text-on-muted">
                    {t('report.all')}
                  </button>
                  <button type="button" onClick={() => { setRiskFilter(new Set(['CRITICAL', 'HIGH'])); setPage(0); }} className="px-2 py-0.5 text-[11px] text-on-dim hover:text-on-muted">
                    {t('report.highRiskOnly')}
                  </button>
                </div>

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
                  <div className="text-center text-on-muted py-6 text-sm">{t('report.noSamples')}</div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination page={page} totalPages={totalPages} total={filteredSamples.length} perPage={perPage} onPageChange={setPage} t={t} />
                )}
              </Section>
            </>
          );
        })()}

        {!selectedTask && (
          <div className="text-center text-on-muted py-12 text-sm">{t('report.selectModel')}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tab 3: High-Risk Cases
// ============================================================

function HighRiskCasesTab({ detail, model, hierarchy, lang, selectedTask, setSelectedTask, samples, samplesLoading, t, onNavigate }) {
  const highRiskTasks = detail.tasks.filter(tk => tk.risk_level === 'CRITICAL' || tk.risk_level === 'HIGH');
  const groups = groupTasksByHierarchy(highRiskTasks, hierarchy, lang);
  const highRiskSamples = samples.filter(s => s.risk_level === 'CRITICAL' || s.risk_level === 'HIGH');

  return (
    <div className="flex gap-4">
      {/* Collapsible sidebar */}
      <div className="w-64 shrink-0">
        <CollapsibleSidebar
          groups={groups}
          selectedTask={selectedTask}
          onSelectTask={setSelectedTask}
          t={t}
          lang={lang}
          isHighRisk
        />
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-3">
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
                  <span className="text-xs text-on-muted">{t('report.scoreCol')}: {sample.score}</span>
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
                  type="button"
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
          <div className="text-center text-on-muted py-8 text-sm">{t('results.noResults')}</div>
        )}

        {!selectedTask && (
          <div className="text-center text-on-muted py-12 text-sm">{t('report.selectModel')}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tab 4: Dataset Examples (fixed sidebar + i18n)
// ============================================================

function DatasetExamplesTab({ data, loading, t, lang }) {
  const isZh = lang?.startsWith('zh');
  const [expandedCat, setExpandedCat] = useState(null);
  const [showSamples, setShowSamples] = useState(false);
  const [search, setSearch] = useState('');

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

  // Filter categories by search
  const filteredCategories = data.categories.filter(cat => {
    if (!search) return true;
    const q = search.toLowerCase();
    if ((cat.name || '').toLowerCase().includes(q)) return true;
    return cat.items?.some(item =>
      (item.risk_point || '').toLowerCase().includes(q) ||
      (item.input || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('dataset.totalCategories')} value={data.total_categories} />
        <StatCard label={t('dataset.totalSamples')} value={data.total_samples} />
        <StatCard label={t('dataset.totalBenchmarks')} value={data.total_benchmarks} />
      </div>

      {/* Category list with search */}
      <Section title={t('dataset.title')}>
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('report.searchPlaceholder')}
            className="w-full px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg text-on-canvas placeholder:text-on-dim focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scroll">
          {filteredCategories.map((cat, ci) => (
            <div key={ci} className="border border-edge rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCat(expandedCat === ci ? null : ci)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
              >
                <span className="text-sm font-medium text-on-canvas">{cat.name}</span>
                <span className="text-xs text-on-dim">
                  {cat.items?.length || 0} {t('report.riskPoints')}
                  <span className="ml-2">{expandedCat === ci ? '▾' : '▸'}</span>
                </span>
              </button>
              {expandedCat === ci && cat.items && (
                <div className="border-t border-edge px-4 py-2 space-y-1.5 bg-surface-raised/30">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex items-center justify-between text-xs py-1">
                      <span className="text-on-surface">{item.risk_point}</span>
                      <span className="text-on-dim">{item.sample_count} {t('report.samplesCol').toLowerCase()}</span>
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
          type="button"
          onClick={() => setShowSamples(!showSamples)}
          className="px-4 py-2 bg-surface border border-edge text-on-surface text-sm rounded-lg hover:bg-surface-hover"
        >
          {showSamples ? t('report.hideSamples') : t('report.viewSamples')}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          {t('dataset.downloadJson')}
        </button>
      </div>

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

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} total={samples.length} perPage={perPage} onPageChange={setPage} t={t} />
      )}
    </Section>
  );
}

// ============================================================
// Tab 5: Reports
// ============================================================

function ReportsTab({ reports, loading, t, lang }) {
  if (loading) {
    return <div className="text-center text-on-muted py-8">{t('loading')}</div>;
  }

  if (reports.length === 0) {
    return (
      <div className="text-center text-on-muted py-12">
        <div className="text-4xl mb-4">📝</div>
        <div>{t('report.noReports')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map(r => (
        <div key={r.id} className="bg-surface border border-edge rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-on-canvas">{r.title}</div>
              <div className="text-xs text-on-muted mt-0.5">
                {r.scenario_type} · {r.generation_mode}
                {r.created_at && ` · ${formatDateTime(new Date(r.created_at))}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                r.status === 'published' ? 'bg-green-500/20 text-green-400' :
                r.status === 'draft' ? 'bg-amber-500/20 text-amber-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {r.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Shared components
// ============================================================

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

function Pagination({ page, totalPages, total, perPage, onPageChange, t }) {
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-xs text-on-dim">
        {t('report.showing', {
          start: page * perPage + 1,
          end: Math.min((page + 1) * perPage, total),
          total,
        })}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPageChange(0)} disabled={page === 0}
          className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40">««</button>
        <button type="button" onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}
          className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40">«</button>
        <span className="text-xs text-on-muted">{page + 1} / {totalPages}</span>
        <button type="button" onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40">»</button>
        <button type="button" onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs bg-surface border border-edge rounded hover:bg-surface-hover disabled:opacity-40">»»</button>
      </div>
    </div>
  );
}

function formatDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
