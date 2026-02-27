/**
 * Report Editor API client — CRUD + streaming helpers
 */

import { authFetch } from '../auth.js';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await authFetch(path, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

// ---- CRUD ----

export function listReports() {
  return request('GET', '/report-editor');
}

export function createReport(data) {
  return request('POST', '/report-editor', data);
}

export function getReport(id) {
  return request('GET', `/report-editor/${id}`);
}

export function updateReport(id, data) {
  return request('PUT', `/report-editor/${id}`, data);
}

export function deleteReport(id) {
  return request('DELETE', `/report-editor/${id}`);
}

// ---- History ----

export function listHistory(reportId) {
  return request('GET', `/report-editor/${reportId}/history`);
}

export function getHistoryContent(reportId, version) {
  return request('GET', `/report-editor/${reportId}/history/${version}`);
}

export function rollbackReport(reportId, version) {
  return request('PUT', `/report-editor/${reportId}/rollback/${version}`);
}

// ---- LLM Streaming ----

/**
 * Start streaming report generation via SSE.
 * Returns a ReadableStream reader + abort controller.
 */
export function generateReportStream(reportId) {
  const controller = new AbortController();
  const promise = authFetch(`/report-editor/${reportId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}

/**
 * Start streaming section regeneration via SSE.
 */
export function regenerateSectionStream(reportId, selectedHtml, instruction) {
  const controller = new AbortController();
  const promise = authFetch(`/report-editor/${reportId}/regenerate-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selected_html: selectedHtml, instruction }),
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}
