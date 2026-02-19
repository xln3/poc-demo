/**
 * Eval Import API Client
 *
 * 导入 inspect-ai .eval 文件到测试结果系统
 */

import { authFetch } from './auth.js';

const API_BASE = '';

/**
 * 预览 .eval 文件内容（不保存）
 * @param {File} file - .eval 文件
 * @returns {{ meta, sample_count, samples_preview }}
 */
export async function previewEval(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await authFetch(`${API_BASE}/eval-import/preview`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Preview failed: ${err}`);
  }
  return response.json();
}

/**
 * 上传并导入 .eval 文件
 * @param {File} file - .eval 文件
 * @returns {{ id, name, sample_count, meta }}
 */
export async function uploadEval(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await authFetch(`${API_BASE}/eval-import/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return response.json();
}
