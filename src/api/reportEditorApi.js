/**
 * Report Editor API client — CRUD + streaming helpers
 */

import { authFetch } from '../auth.js';
import i18n from '../i18n/index.js';

/** Get current UI language code (zh or en) */
function getLang() {
  const lang = i18n.language || 'zh';
  return lang.startsWith('en') ? 'en' : 'zh';
}

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
  const lang = getLang();
  const promise = authFetch(`/report-editor/${reportId}/generate?lang=${lang}`, {
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
  const lang = getLang();
  const promise = authFetch(`/report-editor/${reportId}/regenerate-section?lang=${lang}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selected_html: selectedHtml, instruction }),
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}


// ======================================================================
// Modular V2 API — Outline, Modules, Charts, Images
// ======================================================================

// ---- Outline ----

export function generateOutlineStream(reportId) {
  const controller = new AbortController();
  const lang = getLang();
  const promise = authFetch(`/report-editor/${reportId}/generate-outline?lang=${lang}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}

export function getOutline(reportId) {
  return request('GET', `/report-editor/${reportId}/outline`);
}

export function updateOutline(reportId, data) {
  return request('PUT', `/report-editor/${reportId}/outline`, data);
}

// ---- Modules ----

export function generateModulesStream(reportId) {
  const controller = new AbortController();
  const lang = getLang();
  const promise = authFetch(`/report-editor/${reportId}/generate-modules?lang=${lang}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}

export function listModules(reportId) {
  return request('GET', `/report-editor/${reportId}/modules`);
}

export function getModule(reportId, moduleId) {
  return request('GET', `/report-editor/${reportId}/modules/${moduleId}`);
}

export function updateModule(reportId, moduleId, data) {
  return request('PUT', `/report-editor/${reportId}/modules/${moduleId}`, data);
}

export function regenerateModuleStream(reportId, moduleId) {
  const controller = new AbortController();
  const lang = getLang();
  const promise = authFetch(`/report-editor/${reportId}/modules/${moduleId}/regenerate?lang=${lang}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}

export function insertModule(reportId, data) {
  return request('POST', `/report-editor/${reportId}/insert-module`, data);
}

// ---- Charts ----

export function generateChartConfig(reportId, data) {
  const lang = getLang();
  return request('POST', `/report-editor/${reportId}/generate-chart?lang=${lang}`, data);
}

// ---- Images ----

export function generateImage(reportId, data) {
  return request('POST', `/report-editor/${reportId}/generate-image`, data);
}

// ---- Assembly ----

export function assembleReport(reportId) {
  return request('POST', `/report-editor/${reportId}/assemble`);
}
