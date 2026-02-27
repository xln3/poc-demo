import { useTranslation } from 'react-i18next';

const STATUS_STYLES = {
  pending: 'bg-surface-raised',
  running: 'bg-blue-500 animate-pulse',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-yellow-500',
};

/**
 * EvalProgress — evaluation progress display with per-task bars
 */
export default function EvalProgress({ job }) {
  const { t } = useTranslation('eval');
  if (!job) return null;

  const { status, progress = 0, tasks = [], current_task, error } = job;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-on-canvas">
            {t(`status.${status}`, status)}
          </span>
          <span className="text-sm text-on-muted">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2.5 bg-surface-raised rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === 'failed' ? 'bg-red-500' :
              status === 'completed' ? 'bg-green-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${Math.max(2, progress)}%` }}
          />
        </div>
      </div>

      {/* Current task indicator */}
      {current_task && status === 'running' && (
        <div className="text-xs text-on-muted flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          {t('progress.running')}: {current_task}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 rounded p-2 border border-red-800">
          {error}
        </div>
      )}

      {/* Per-task progress */}
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-on-muted">{t('progress.tasks')}</div>
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_STYLES[task.status] || STATUS_STYLES.pending}`} />
              <span className="text-xs text-on-surface flex-1 truncate" title={task.task_name}>
                {task.task_name}
              </span>
              <span className="text-xs text-on-muted">
                {t(`status.${task.status}`, task.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
