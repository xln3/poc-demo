import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchBenchmarks } from '../../api/evalBridgeApi';

/**
 * BenchmarkSelector — multi-select for benchmarks
 */
export default function BenchmarkSelector({ selected = [], onChange, disabled = false }) {
  const { t } = useTranslation('eval');
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBenchmarks()
      .then(setBenchmarks)
      .catch(() => setBenchmarks([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? benchmarks.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        (b.display_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : benchmarks;

  const toggleBenchmark = (name) => {
    if (disabled) return;
    const next = selected.includes(name)
      ? selected.filter(s => s !== name)
      : [...selected, name];
    onChange(next);
  };

  const selectAll = () => {
    if (disabled) return;
    onChange(filtered.map(b => b.name));
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  if (loading) {
    return <div className="text-on-muted text-sm py-4 text-center">{t('loading')}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Search + actions */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('benchmarks.search')}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-edge bg-surface text-on-canvas placeholder-on-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
        />
        <button
          onClick={selectAll}
          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={disabled}
        >
          {t('benchmarks.selectAll')}
        </button>
        <button
          onClick={clearAll}
          className="px-2 py-1 text-xs rounded bg-surface-raised text-on-muted hover:bg-surface-hover disabled:opacity-50"
          disabled={disabled}
        >
          {t('benchmarks.clearAll')}
        </button>
      </div>

      {/* Selected count */}
      <div className="text-xs text-on-muted">
        {t('benchmarks.selected', { count: selected.length, total: benchmarks.length })}
      </div>

      {/* Benchmark grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scroll">
        {filtered.map(b => {
          const isSelected = selected.includes(b.name);
          return (
            <button
              key={b.name}
              onClick={() => toggleBenchmark(b.name)}
              disabled={disabled}
              className={`text-left p-2 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-edge bg-surface hover:bg-surface-hover'
              } disabled:opacity-50`}
            >
              <div className="text-sm font-medium text-on-canvas truncate">
                {b.display_name || b.name}
              </div>
              <div className="text-xs text-on-muted truncate mt-0.5">
                {b.description || b.name}
              </div>
              <div className="text-xs text-on-dim mt-1">
                {b.tasks?.length || 0} {t('benchmarks.tasks')}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
