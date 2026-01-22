/**
 * Case API 客户端
 * 用于与后端测试用例存储服务通信
 * 只支持 v1.0.0 Schema 格式
 */

import { validateTestCase } from './schemas/testCase.js';

const BASE_URL = '';  // 使用 Vite 代理

/**
 * 保存测试用例到服务器（v1 格式）
 * @param {Object} testCase - 完整的 v1 格式测试用例
 * @returns {Promise<Object>} 保存后的用例（含ID）
 */
export async function saveCaseToServer(testCase) {
  // 验证格式
  const validation = validateTestCase(testCase);
  if (!validation.valid) {
    console.warn('测试用例验证警告:', validation.errors);
  }

  const response = await fetch(`${BASE_URL}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testCase),
  });
  if (!response.ok) {
    throw new Error(`保存失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取所有已保存用例列表
 * @returns {Promise<Array>} 用例摘要列表
 */
export async function listSavedCases() {
  const response = await fetch(`${BASE_URL}/cases`);
  if (!response.ok) {
    throw new Error(`获取列表失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取单个用例详情
 * @param {string} id - 用例ID
 * @returns {Promise<Object>} 用例详情（v1 格式）
 */
export async function getCaseDetail(id) {
  const response = await fetch(`${BASE_URL}/cases/${id}`);
  if (!response.ok) {
    throw new Error(`获取详情失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 更新用例（名称、标签、备注）
 * @param {string} id - 用例ID
 * @param {Object} updates - 更新字段
 * @returns {Promise<Object>} 更新后的用例
 */
export async function updateCase(id, updates) {
  const response = await fetch(`${BASE_URL}/cases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`更新失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 删除用例
 * @param {string} id - 用例ID
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteCase(id) {
  const response = await fetch(`${BASE_URL}/cases/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`删除失败: ${response.status}`);
  }
  return response.json();
}

/**
 * 批量导出用例
 * @param {string[]} ids - 用例ID列表（空数组表示全部）
 * @returns {Promise<Object[]>} 用例列表
 */
export async function exportCases(ids = []) {
  const cases = [];
  if (ids.length === 0) {
    // 获取所有用例
    const summaries = await listSavedCases();
    for (const summary of summaries) {
      const detail = await getCaseDetail(summary.id);
      cases.push(detail);
    }
  } else {
    for (const id of ids) {
      const detail = await getCaseDetail(id);
      cases.push(detail);
    }
  }
  return cases;
}

/**
 * 批量导入用例
 * @param {Object[]} testCases - 测试用例列表
 * @returns {Promise<{success: number, failed: number, errors: string[]}>}
 */
export async function importCases(testCases) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const testCase of testCases) {
    try {
      await saveCaseToServer(testCase);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`${testCase.meta?.caseId || 'unknown'}: ${error.message}`);
    }
  }

  return results;
}
