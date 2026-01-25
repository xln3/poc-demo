/**
 * Test Results API Client
 *
 * 批量测试结果存储 API
 */

const API_BASE = 'http://localhost:8000';

/**
 * 获取所有测试结果列表
 */
export async function listTestResults() {
  const response = await fetch(`${API_BASE}/test-results`);
  if (!response.ok) {
    throw new Error(`Failed to list test results: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 获取单个测试结果详情
 */
export async function getTestResult(resultId) {
  const response = await fetch(`${API_BASE}/test-results/${resultId}`);
  if (!response.ok) {
    throw new Error(`Failed to get test result: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 保存测试结果
 */
export async function saveTestResult(data) {
  const response = await fetch(`${API_BASE}/test-results`, {
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
  const response = await fetch(`${API_BASE}/test-results/${resultId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete test result: ${response.statusText}`);
  }
  return response.json();
}
