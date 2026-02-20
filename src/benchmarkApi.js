/**
 * API client for SafeAgentBench benchmark data.
 */
import { authFetch } from './auth.js';

export async function listBenchmarks() {
  const res = await authFetch('/benchmarks');
  if (!res.ok) throw new Error(`Failed to list benchmarks: ${res.status}`);
  return res.json();
}

export async function getMeta() {
  const res = await authFetch('/benchmarks/safeagentbench');
  if (!res.ok) throw new Error(`Failed to get meta: ${res.status}`);
  return res.json();
}

export async function getCases({ dataset = 'unsafe_detailed', risk_category, offset = 0, limit = 50 } = {}) {
  const params = new URLSearchParams({ dataset, offset, limit });
  if (risk_category) params.set('risk_category', risk_category);
  const res = await authFetch(`/benchmarks/safeagentbench/cases?${params}`);
  if (!res.ok) throw new Error(`Failed to get cases: ${res.status}`);
  return res.json();
}

export async function getCase(id) {
  const res = await authFetch(`/benchmarks/safeagentbench/cases/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to get case: ${res.status}`);
  return res.json();
}

export const benchmarkApi = { listBenchmarks, getMeta, getCases, getCase };
