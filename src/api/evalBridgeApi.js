/**
 * Eval Bridge API client — calls /eval/* proxy endpoints
 * (authenticated through poc-demo JWT)
 */

const API_BASE = '';  // Relative paths, proxied via Vite/Nginx

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: authHeaders(),
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${path}`, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

// ---- Benchmarks ----

export function fetchBenchmarks() {
  return request('GET', '/eval/benchmarks');
}

export function fetchTaskMeta() {
  return request('GET', '/eval/benchmarks/task-meta');
}

// ---- Models ----

export function fetchEvalModels() {
  return request('GET', '/eval/models');
}

export function registerEvalModel(config) {
  return request('POST', '/eval/models', config);
}

export function deleteEvalModel(modelId) {
  return request('DELETE', `/eval/models/${modelId}`);
}

// ---- Evaluations ----

export function startEvaluation(payload) {
  return request('POST', '/eval/evaluations', payload);
}

export function listEvaluations() {
  return request('GET', '/eval/evaluations');
}

export function getEvaluation(jobId) {
  return request('GET', `/eval/evaluations/${jobId}`);
}

export function pollEvaluation(jobId, intervalMs = 3000) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getEvaluation(jobId);
        if (job.status === 'completed' || job.status === 'failed') {
          resolve(job);
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}

// ---- Results ----

export function fetchResults() {
  return request('GET', '/eval/results');
}

export function fetchResultDetail(model) {
  return request('GET', `/eval/results/${encodeURIComponent(model)}`);
}

export function fetchResultSamples(model, task, riskLevel = null) {
  let path = `/eval/results/${encodeURIComponent(model)}/tasks/${encodeURIComponent(task)}/samples`;
  if (riskLevel) path += `?risk_level=${riskLevel}`;
  return request('GET', path);
}

// ---- Reports ----

export function generateReport(model) {
  return request('POST', `/eval/reports/generate?model=${encodeURIComponent(model)}`);
}

// ---- Reproduce ----

export function getReproduceConfig(model, task, sampleId = null) {
  return request('POST', `/eval/reproduce/${encodeURIComponent(model)}/tasks/${encodeURIComponent(task)}`, {
    sample_id: sampleId,
  });
}

// ---- Agents ----

export function fetchAgents() {
  return request('GET', '/agents');
}

export function createAgent(config) {
  return request('POST', '/agents', config);
}

export function getAgent(agentId) {
  return request('GET', `/agents/${agentId}`);
}

export function updateAgent(agentId, updates) {
  return request('PUT', `/agents/${agentId}`, updates);
}

export function deleteAgent(agentId) {
  return request('DELETE', `/agents/${agentId}`);
}

export function triggerAgentEval(agentId, payload) {
  return request('POST', `/agents/${agentId}/evaluate`, payload);
}
