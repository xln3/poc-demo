/**
 * Case API 客户端
 * 用于与后端测试用例存储服务通信
 * 支持 v1.0.0 和 v3.0.0 格式
 */

import { validateTestCase } from './schemas/testCase.js';
import { authFetch } from './auth.js';

const BASE_URL = '';  // 使用 Vite 代理

/**
 * 保存测试用例到服务器（v1 或 v3 格式）
 * v3 格式 (schema_version: '3.0.0') 跳过 v1 验证
 * @param {Object} testCase - 测试用例
 * @returns {Promise<Object>} 保存后的用例（含ID）
 */
export async function saveCaseToServer(testCase) {
  // v3 format skips v1 validation
  if (testCase.schema_version !== '3.0.0' && testCase.schema_version !== '4.0.0') {
    const validation = validateTestCase(testCase);
    if (!validation.valid) {
      throw new Error(`测试用例验证失败: ${validation.errors.join('; ')}`);
    }
  }

  const response = await authFetch(`${BASE_URL}/cases`, {
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
  const response = await authFetch(`${BASE_URL}/cases`);
  if (!response.ok) {
    throw new Error(`获取列表失败: ${response.status}`);
  }
  const data = await response.json();
  return data.items;
}

/**
 * 获取单个用例详情
 * @param {string} id - 用例ID
 * @returns {Promise<Object>} 用例详情（v1 格式）
 */
export async function getCaseDetail(id) {
  const response = await authFetch(`${BASE_URL}/cases/${id}`);
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
  const response = await authFetch(`${BASE_URL}/cases/${id}`, {
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
  const response = await authFetch(`${BASE_URL}/cases/${id}`, {
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
  let targetIds = ids;
  if (targetIds.length === 0) {
    const summaries = await listSavedCases();
    targetIds = summaries.map(s => s.id);
  }
  // Fetch all in parallel instead of sequential N+1
  return Promise.all(targetIds.map(id => getCaseDetail(id)));
}

/**
 * 批量导入用例
 * @param {Object[]} testCases - 测试用例列表
 * @returns {Promise<{success: number, failed: number, errors: string[]}>}
 */
export async function importCases(testCases) {
  // Validate all cases first — fail fast before any writes
  // v3/v4 format cases skip v1 validation
  const validationErrors = [];
  for (const testCase of testCases) {
    if (testCase.schema_version === '3.0.0' || testCase.schema_version === '4.0.0') continue;
    const validation = validateTestCase(testCase);
    if (!validation.valid) {
      validationErrors.push(`${testCase.meta?.caseId || 'unknown'}: ${validation.errors.join('; ')}`);
    }
  }
  if (validationErrors.length > 0) {
    return {
      success: 0,
      failed: validationErrors.length,
      errors: validationErrors,
    };
  }

  // All valid — save sequentially (saveCaseToServer re-validates, so skip validation there)
  const results = { success: 0, failed: 0, errors: [] };
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
