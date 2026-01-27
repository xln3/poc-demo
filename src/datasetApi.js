/**
 * Dataset API client
 *
 * 数据集管理 API，支持 v2.0.0 Dataset Schema 格式
 */

const BACKEND_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const BACKEND_URL = `http://${BACKEND_HOST}:8000`;

/**
 * 列出所有数据集
 * @returns {Promise<Array>} 数据集摘要列表
 */
export async function listDatasets() {
  const response = await fetch(`${BACKEND_URL}/datasets`);
  if (!response.ok) {
    throw new Error(`Failed to list datasets: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 保存新数据集
 * @param {Object} dataset - 数据集数据
 * @returns {Promise<Object>} 保存后的数据集
 */
export async function saveDataset(dataset) {
  const response = await fetch(`${BACKEND_URL}/datasets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dataset),
  });
  if (!response.ok) {
    throw new Error(`Failed to save dataset: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 获取数据集详情
 * @param {string} datasetId - 数据集 ID
 * @returns {Promise<Object>} 数据集完整数据
 */
export async function getDataset(datasetId) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}`);
  if (!response.ok) {
    throw new Error(`Failed to get dataset: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 更新数据集
 * @param {string} datasetId - 数据集 ID
 * @param {Object} updates - 更新字段
 * @returns {Promise<Object>} 更新后的数据集
 */
export async function updateDataset(datasetId, updates) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`Failed to update dataset: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 删除数据集
 * @param {string} datasetId - 数据集 ID
 * @returns {Promise<Object>} 删除结果
 */
export async function deleteDataset(datasetId) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete dataset: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 获取数据集内的用例列表
 * @param {string} datasetId - 数据集 ID
 * @returns {Promise<Array>} 用例列表
 */
export async function listCasesInDataset(datasetId) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}/cases`);
  if (!response.ok) {
    throw new Error(`Failed to list cases: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 向数据集添加用例
 * @param {string} datasetId - 数据集 ID
 * @param {Object} caseData - 用例数据
 * @returns {Promise<Object>} 添加结果
 */
export async function addCaseToDataset(datasetId, caseData) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caseData),
  });
  if (!response.ok) {
    throw new Error(`Failed to add case: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 从数据集获取单个用例
 * @param {string} datasetId - 数据集 ID
 * @param {string} caseId - 用例 ID
 * @returns {Promise<Object>} 用例数据
 */
export async function getCaseFromDataset(datasetId, caseId) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}/cases/${caseId}`);
  if (!response.ok) {
    throw new Error(`Failed to get case: ${response.statusText}`);
  }
  return response.json();
}

/**
 * 从数据集移除用例
 * @param {string} datasetId - 数据集 ID
 * @param {string} caseId - 用例 ID
 * @returns {Promise<Object>} 移除结果
 */
export async function removeCaseFromDataset(datasetId, caseId) {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}/cases/${caseId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove case: ${response.statusText}`);
  }
  return response.json();
}
