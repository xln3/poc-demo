/**
 * Test Results API Client
 *
 * 批量测试结果存储 API
 */

import { authFetch } from './auth.js';

// 使用相对路径，走 Vite 代理（避免外网部署时 8000 端口不开放的问题）
const API_BASE = '';

/**
 * 获取所有测试结果列表
 */
export async function listTestResults() {
  const response = await authFetch(`${API_BASE}/test-results`);
  if (!response.ok) {
    throw new Error(`Failed to list test results: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 获取单个测试结果详情
 */
export async function getTestResult(resultId) {
  const response = await authFetch(`${API_BASE}/test-results/${resultId}`);
  if (!response.ok) {
    throw new Error(`Failed to get test result: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 保存测试结果
 */
export async function saveTestResult(data) {
  const response = await authFetch(`${API_BASE}/test-results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to save test result: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 删除测试结果
 */
export async function deleteTestResult(resultId) {
  const response = await authFetch(`${API_BASE}/test-results/${resultId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete test result: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 删除单条测试用例
 */
export async function deleteTestCase(resultId, caseIndex) {
  const response = await authFetch(`${API_BASE}/test-results/${resultId}/cases/${caseIndex}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete test case: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 更新单条用例的评审
 * @param {string} resultId - 测试结果 ID
 * @param {number} caseIndex - 用例索引
 * @param {object} review - 评审数据 { type: 'llm'|'human', riskLevel, reason, notes?, reviewer? }
 */
export async function updateCaseReview(resultId, caseIndex, review) {
  const response = await authFetch(`${API_BASE}/test-results/${resultId}/cases/${caseIndex}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(review),
  });
  if (!response.ok) {
    throw new Error(`Failed to update case review: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 更新报告文字版内容
 * @param {string} resultId - 测试结果 ID
 * @param {string} content - Markdown 内容
 * @param {string} editedBy - 'llm' | 'human'
 */
export async function updateReport(resultId, content, editedBy = 'human') {
  const response = await authFetch(`${API_BASE}/test-results/${resultId}/report`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, editedBy }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update report: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 获取报告模板列表
 */
export async function listReportTemplates() {
  const response = await authFetch(`${API_BASE}/report-templates`);
  if (!response.ok) {
    throw new Error(`Failed to list report templates: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 获取报告模板内容
 */
export async function getReportTemplate(templateId) {
  const response = await authFetch(`${API_BASE}/report-templates/${templateId}`);
  if (!response.ok) {
    throw new Error(`Failed to get report template: ${response.statusText}`);
  }
  return response.json();
}
