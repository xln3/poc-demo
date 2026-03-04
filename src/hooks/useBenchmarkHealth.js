import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchBenchmarkHealth } from '../api/evalBridgeApi';

/**
 * useBenchmarkHealth — cached health data with auto-refresh.
 *
 * Returns { health, loading, error, refresh }
 *   health: { benchmarks: { [name]: { status, venv_ready, tasks, dependencies } }, summary, checked_at }
 *   loading: boolean
 *   error: string|null
 *   refresh: () => void  (force refresh)
 */

// Module-level cache shared across all hook instances
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function useBenchmarkHealth() {
  const [health, setHealth] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && _cache && (now - _cacheTs) < CACHE_TTL) {
      setHealth(_cache);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchBenchmarkHealth(force);
      _cache = data;
      _cacheTs = Date.now();
      if (mountedRef.current) {
        setHealth(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { health, loading, error, refresh };
}

/**
 * Helper: get status for a specific benchmark from health data.
 */
export function getBenchmarkStatus(health, benchmarkKey) {
  if (!health?.benchmarks) return null;
  return health.benchmarks[benchmarkKey] || null;
}

/**
 * Helper: count healthy tasks in a list of selected tasks.
 */
export function countHealthyTasks(health, selectedTasks) {
  if (!health?.benchmarks || !selectedTasks) return { total: 0, healthy: 0 };
  let total = 0;
  let healthy = 0;
  for (const { benchmark, task } of selectedTasks) {
    total++;
    const bm = health.benchmarks[benchmark];
    if (bm?.tasks?.[task]?.discoverable) healthy++;
  }
  return { total, healthy };
}
