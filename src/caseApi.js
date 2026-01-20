// Case API 客户端
// 用于与后端测试用例存储服务通信

const BASE_URL = '';  // 使用 Vite 代理

/**
 * 保存测试用例到服务器
 * @param {Object} caseData - 测试用例数据
 * @returns {Promise<Object>} 保存后的用例（含ID）
 */
export async function saveCaseToServer(caseData) {
  const response = await fetch(`${BASE_URL}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caseData),
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
 * @returns {Promise<Object>} 用例详情
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
