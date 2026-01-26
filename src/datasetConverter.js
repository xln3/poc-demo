/**
 * 数据集格式转换模块
 *
 * 使用 LLM 将任意格式数据转换为标准 Dataset 格式
 */

import { CONFIG } from './config.js';
import { generateUUID, SCHEMA_VERSION, createEmptyDataset } from './schemas/testCase.js';

// 模板文件路径
const TEMPLATE_URL = '/templates/dataset-template.json';

/**
 * 获取当前版本的数据集模板（动态加载）
 */
async function getDatasetTemplate() {
  try {
    const response = await fetch(TEMPLATE_URL);
    if (!response.ok) {
      throw new Error('无法加载模板文件');
    }
    return await response.json();
  } catch (error) {
    // 回退：使用代码中的空模板
    console.warn('模板加载失败，使用代码内置模板:', error);
    return createEmptyDataset();
  }
}

/**
 * 构建转换提示词（动态生成）
 */
function buildConversionPrompt(template, inputData) {
  // 清理模板中的 _comment 字段，只保留结构
  const cleanTemplate = JSON.parse(JSON.stringify(template));
  delete cleanTemplate._comment;
  delete cleanTemplate._instructions;

  // 只保留第一个 case 作为示例
  if (cleanTemplate.cases && cleanTemplate.cases.length > 0) {
    const exampleCase = cleanTemplate.cases[0];
    delete exampleCase._comment;
    cleanTemplate.cases = [exampleCase];
  }

  return `你是一个数据格式转换专家。
将用户提供的测试数据转换为标准的 Dataset 格式。

## 目标格式（参考模板）
${JSON.stringify(cleanTemplate, null, 2)}

## 能力级别说明
- F1-conversation: 纯文字对话
- F2-file-injection: 文件解析注入
- F3-tool-use: 工具调用/终端
- F4-rag: RAG检索
- F5-mcp: MCP服务

## 用户输入数据
${JSON.stringify(inputData, null, 2)}

## 要求
1. 仅输出 JSON，不要其他文字
2. 保留原始数据的语义，智能映射字段
3. 为缺失字段生成合理默认值
4. datasetId 和 case id 使用 UUID 格式
5. 根据数据内容推断 capability 级别
6. schemaVersion 使用模板中的版本号`;
}

/**
 * 使用 LLM 将任意格式数据转换为 Dataset 格式
 *
 * @param {Object} inputData - 任意格式的输入数据
 * @returns {Promise<Object>} 转换后的 Dataset 格式数据
 */
export async function convertToDatasetFormat(inputData) {
  // 1. 动态获取当前模板
  const template = await getDatasetTemplate();

  // 2. 构建提示词
  const prompt = buildConversionPrompt(template, inputData);

  // 3. 调用 LLM
  const response = await CONFIG.callModel(
    [{ role: 'user', content: prompt }],
    '你是数据格式转换专家，只输出有效的 JSON，不要任何解释。',
    CONFIG.judgeModel
  );

  // 4. 解析结果
  const content = typeof response === 'object' ? response.content : response;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI 未返回有效的 JSON 格式');
  }

  const converted = JSON.parse(jsonMatch[0]);

  // 5. 确保必要字段（使用当前版本号）
  converted.meta = converted.meta || {};
  if (!converted.meta.datasetId) converted.meta.datasetId = generateUUID();
  if (!converted.meta.schemaVersion) converted.meta.schemaVersion = SCHEMA_VERSION;
  converted.meta.type = 'Dataset';
  if (!converted.meta.createdAt) converted.meta.createdAt = new Date().toISOString();
  if (!Array.isArray(converted.cases)) converted.cases = [];
  converted.meta.caseCount = converted.cases.length;

  return converted;
}
