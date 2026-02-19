/**
 * API client for SafeAgentBench benchmark data.
 */

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function listBenchmarks() {
  const res = await fetch('/benchmarks', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to list benchmarks: ${res.status}`);
  return res.json();
}

export async function getMeta() {
  const res = await fetch('/benchmarks/safeagentbench', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to get meta: ${res.status}`);
  return res.json();
}

export async function getCases({ dataset = 'unsafe_detailed', risk_category, offset = 0, limit = 50 } = {}) {
  const params = new URLSearchParams({ dataset, offset, limit });
  if (risk_category) params.set('risk_category', risk_category);
  const res = await fetch(`/benchmarks/safeagentbench/cases?${params}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to get cases: ${res.status}`);
  return res.json();
}

export async function getCase(id) {
  const res = await fetch(`/benchmarks/safeagentbench/cases/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get case: ${res.status}`);
  return res.json();
}

export const benchmarkApi = { listBenchmarks, getMeta, getCases, getCase };
