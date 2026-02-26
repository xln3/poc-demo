import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../auth';

export default function UsagePanel() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadUsage();
  }, [period]);

  const loadUsage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/usage/summary?period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const periods = [
    { key: 'day', label: t('usage.today') },
    { key: 'week', label: t('usage.thisWeek') },
    { key: 'month', label: t('usage.thisMonth') },
  ];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1 text-sm rounded ${
              period === p.key
                ? 'bg-blue-600 text-white'
                : 'bg-surface-raised text-on-surface hover:bg-surface-hover'
            }`}
          >{p.label}</button>
        ))}
      </div>

      {loading && <div className="text-on-muted text-sm">{t('usage.loading')}</div>}
      {error && <div className="text-red-400 text-sm">{t('usage.loadFailed', { error })}</div>}

      {data && !loading && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-on-canvas">{data.totals.call_count}</div>
              <div className="text-xs text-on-muted">{t('usage.callCount')}</div>
            </div>
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-on-canvas">{data.totals.total_tokens.toLocaleString()}</div>
              <div className="text-xs text-on-muted">{t('usage.totalTokens')}</div>
            </div>
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-on-canvas">${data.totals.cost.toFixed(4)}</div>
              <div className="text-xs text-on-muted">{t('usage.cost')}</div>
            </div>
          </div>

          {/* Per-model table */}
          {data.by_model.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-muted text-left border-b border-edge">
                  <th className="py-2 font-medium">{t('usage.modelColumn')}</th>
                  <th className="py-2 font-medium text-right">{t('usage.callsColumn')}</th>
                  <th className="py-2 font-medium text-right">{t('usage.inputTokens')}</th>
                  <th className="py-2 font-medium text-right">{t('usage.outputTokens')}</th>
                  <th className="py-2 font-medium text-right">{t('usage.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_model.map(row => (
                  <tr key={row.model} className="border-b border-edge text-on-surface">
                    <td className="py-2 font-mono text-xs">{row.model}</td>
                    <td className="py-2 text-right">{row.call_count}</td>
                    <td className="py-2 text-right">{row.prompt_tokens.toLocaleString()}</td>
                    <td className="py-2 text-right">{row.completion_tokens.toLocaleString()}</td>
                    <td className="py-2 text-right">${row.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-on-dim text-sm text-center py-4">{t('usage.noRecords')}</div>
          )}
        </>
      )}
    </div>
  );
}
