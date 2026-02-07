import { useState, useEffect } from 'react';
import { authFetch } from '../auth';

export default function UsagePanel() {
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
    { key: 'day', label: '今日' },
    { key: 'week', label: '本周' },
    { key: 'month', label: '本月' },
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
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >{p.label}</button>
        ))}
      </div>

      {loading && <div className="text-slate-400 text-sm">加载中...</div>}
      {error && <div className="text-red-400 text-sm">加载失败: {error}</div>}

      {data && !loading && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{data.totals.call_count}</div>
              <div className="text-xs text-slate-400">调用次数</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{data.totals.total_tokens.toLocaleString()}</div>
              <div className="text-xs text-slate-400">总 Token</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">${data.totals.cost.toFixed(4)}</div>
              <div className="text-xs text-slate-400">费用</div>
            </div>
          </div>

          {/* Per-model table */}
          {data.by_model.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-700">
                  <th className="py-2 font-medium">模型</th>
                  <th className="py-2 font-medium text-right">调用</th>
                  <th className="py-2 font-medium text-right">输入 Token</th>
                  <th className="py-2 font-medium text-right">输出 Token</th>
                  <th className="py-2 font-medium text-right">费用</th>
                </tr>
              </thead>
              <tbody>
                {data.by_model.map(row => (
                  <tr key={row.model} className="border-b border-slate-800 text-slate-300">
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
            <div className="text-slate-500 text-sm text-center py-4">暂无使用记录</div>
          )}
        </>
      )}
    </div>
  );
}
