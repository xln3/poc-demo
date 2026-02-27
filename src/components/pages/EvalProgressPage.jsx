import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getEvaluation } from '../../api/evalBridgeApi';
import EvalProgress from '../eval/EvalProgress';

/**
 * EvalProgressPage — real-time polling for evaluation progress
 */
export default function EvalProgressPage({ jobId, onNavigate }) {
  const { t } = useTranslation('eval');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const data = await getEvaluation(jobId);
        setJob(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(timerRef.current);
        }
      } catch (err) {
        setError(err.message);
        clearInterval(timerRef.current);
      }
    };

    poll(); // Initial fetch
    timerRef.current = setInterval(poll, 3000);

    return () => clearInterval(timerRef.current);
  }, [jobId]);

  if (!jobId) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-on-canvas">{t('evalProgress.title')}</h1>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 rounded p-3 border border-red-800">{error}</div>
      )}

      {job && (
        <div className="bg-surface border border-edge rounded-xl p-5 space-y-4">
          {/* Job info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-on-muted">{t('evalProgress.model')}:</span>{' '}
              <span className="text-on-canvas font-medium">{job.model_name || job.model_id}</span>
            </div>
            <div>
              <span className="text-on-muted">{t('evalProgress.startedAt')}:</span>{' '}
              <span className="text-on-canvas">{job.created_at ? new Date(job.created_at).toLocaleString() : '-'}</span>
            </div>
          </div>

          {/* Progress component */}
          <EvalProgress job={job} />

          {/* Actions */}
          {(job.status === 'completed') && (
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onNavigate?.('eval-results', { model: job.model_id })}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                {t('evalProgress.viewResults')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
