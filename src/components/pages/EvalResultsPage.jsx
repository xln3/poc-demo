import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { listEvaluations, fetchResults } from '../../api/evalBridgeApi';
import RiskLevelBadge from '../eval/RiskLevelBadge';

/**
 * EvalResultsPage — evaluation job status table
 * Shows all past and running evaluations with status, progress, duration.
 */
export default function EvalResultsPage({ onNavigate }) {
  const { t } = useTranslation('eval');
  const [jobs, setJobs] = useState([]);
  const [resultMap, setResultMap] = useState({});
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const loadData = async () => {
    try {
      const [jobList, results] = await Promise.all([
        listEvaluations().catch(() => []),
        fetchResults().catch(() => []),
      ]);
      // Build model→result lookup (multiple keys for robust matching)
      const rmap = {};
      for (const r of results) {
        rmap[r.model] = r;
        rmap[r.model.trim()] = r;
        // Also index by last segment (result_reader strips provider prefix)
        const lastSeg = r.model.split('/').pop().trim();
        if (lastSeg) rmap[lastSeg] = r;
      }
      setResultMap(rmap);
      // Sort jobs: running first, then by created_at desc
      const sorted = [...(Array.isArray(jobList) ? jobList : [])].sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (b.status === 'running' && a.status !== 'running') return 1;
        const aTime = a.created_at || a.started_at || 0;
        const bTime = b.created_at || b.started_at || 0;
        return new Date(bTime) - new Date(aTime);
      });
      setJobs(sorted);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 5s if there are running jobs
    pollRef.current = setInterval(loadData, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  // Stop polling when no running jobs
  useEffect(() => {
    const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'pending');
    if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [jobs]);

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="p-8 text-center text-on-muted">
        <div className="text-4xl mb-4">📊</div>
        <div>{t('results.noJobs')}</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-on-canvas">{t('results.title')}</h1>

      <div className="bg-surface border border-edge rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge bg-surface-raised/50">
              <th className="text-left py-3 px-4 text-on-muted font-medium">{t('results.agent')}</th>
              <th className="text-center py-3 px-3 text-on-muted font-medium">{t('results.score')}</th>
              <th className="text-center py-3 px-3 text-on-muted font-medium">{t('results.tasks')}</th>
              <th className="text-center py-3 px-3 text-on-muted font-medium">{t('results.status')}</th>
              <th className="text-left py-3 px-3 text-on-muted font-medium">{t('results.startTime')}</th>
              <th className="text-left py-3 px-3 text-on-muted font-medium">{t('results.duration')}</th>
              <th className="text-center py-3 px-3 text-on-muted font-medium">{t('results.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const mid = (job.model_id || job.model || '').trim();
              const midLast = mid.split('/').pop();
              const result = resultMap[mid] || resultMap[midLast] || resultMap[job.model_id || job.model];
              return (
                <JobRow
                  key={job.job_id || job.id}
                  job={job}
                  result={result}
                  hasResults={!!result}
                  t={t}
                  onNavigate={onNavigate}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job, result, hasResults, t, onNavigate }) {
  const modelName = (job.model_id || job.model || '-').trim();
  const agentName = job.agent_name || null;
  const displayName = agentName || modelName;
  const status = job.status || 'pending';
  const startedAt = job.started_at ? new Date(job.started_at)
    : job.created_at ? new Date(job.created_at) : null;
  const completedAt = job.completed_at ? new Date(job.completed_at) : null;

  // Calculate duration
  let durationStr = '-';
  if (startedAt) {
    const end = completedAt || (status === 'running' ? new Date() : null);
    if (end) {
      const diffSec = Math.floor((end - startedAt) / 1000);
      if (diffSec < 60) durationStr = `${diffSec}s`;
      else if (diffSec < 3600) durationStr = `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`;
      else durationStr = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
    }
  }

  // Progress from job data
  const jobTasks = job.tasks || [];
  const tasksTotal = jobTasks.length || job.benchmarks?.length || 0;
  const tasksDone = typeof job.progress === 'number'
    ? Math.round(job.progress / 100 * tasksTotal)
    : jobTasks.filter(t => t.status === 'completed' || t.status === 'error').length;

  // Score from result data
  const score = result ? Math.round(result.avg_score) : null;
  const riskLevel = result?.risk_level;
  const taskCount = result?.task_count ?? tasksTotal;

  return (
    <tr className="border-b border-edge/50 hover:bg-surface-hover/50 transition-colors">
      {/* Agent / Model */}
      <td className="py-3 px-4">
        <div className="font-medium text-on-canvas">{displayName}</div>
        {agentName && (
          <div className="text-xs text-on-dim mt-0.5">{modelName}</div>
        )}
        {job.benchmarks && job.benchmarks.length > 0 && (
          <div className="text-xs text-on-dim mt-0.5 truncate max-w-[200px]">
            {job.benchmarks.slice(0, 3).join(', ')}{job.benchmarks.length > 3 ? '...' : ''}
          </div>
        )}
      </td>

      {/* Score */}
      <td className="py-3 px-3 text-center">
        {score !== null ? (
          <div className="flex items-center justify-center gap-1.5">
            <span className="font-semibold text-on-canvas">{score}</span>
            {riskLevel && <RiskLevelBadge level={riskLevel} />}
          </div>
        ) : (
          <span className="text-on-dim">-</span>
        )}
      </td>

      {/* Tasks */}
      <td className="py-3 px-3 text-center text-on-surface">
        {taskCount || '-'}
      </td>

      {/* Status */}
      <td className="py-3 px-3 text-center">
        <StatusBadge status={status} t={t} tasksDone={tasksDone} tasksTotal={tasksTotal} />
      </td>

      {/* Start time */}
      <td className="py-3 px-3 text-on-muted text-xs">
        {startedAt ? formatDateTime(startedAt) : '-'}
      </td>

      {/* Duration */}
      <td className="py-3 px-3 text-on-muted text-xs">
        {status === 'running' ? (
          <span className="text-blue-400">{durationStr}</span>
        ) : durationStr}
      </td>

      {/* Actions */}
      <td className="py-3 px-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {status === 'completed' && hasResults && (
            <button
              onClick={() => onNavigate?.('eval-report', { model: result.model })}
              className="px-2 py-1 text-xs bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30"
            >
              {t('results.viewReport')}
            </button>
          )}
          {status === 'completed' && !hasResults && (
            <span className="text-xs text-on-dim">{t('status.failed')}</span>
          )}
          {status === 'running' && (
            <button
              onClick={() => onNavigate?.('eval-progress', { jobId: job.job_id || job.id })}
              className="px-2 py-1 text-xs bg-amber-600/20 text-amber-400 rounded hover:bg-amber-600/30"
            >
              {t('results.viewDetail')}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status, t, tasksDone, tasksTotal }) {
  const styles = {
    pending: 'bg-gray-500/20 text-gray-400',
    running: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {t(`status.${status}`)}
      </span>
      {status === 'running' && tasksTotal > 0 && (
        <div className="w-full max-w-[80px]">
          <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${Math.round((tasksDone / tasksTotal) * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-on-dim mt-0.5">{tasksDone}/{tasksTotal}</div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
