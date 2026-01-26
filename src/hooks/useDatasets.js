import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listDatasets,
  saveDataset,
  getDataset,
  updateDataset,
  deleteDataset,
  addCaseToDataset,
  removeCaseFromDataset,
  getCaseFromDataset,
} from '../datasetApi.js';
import {
  createEmptyDataset,
  buildDataset,
  validateDataset,
  importFromJSON,
  importFromFileDialog,
  downloadAsJSON,
  CapabilityLevel,
} from '../schemas/testCase.js';
import { convertToDatasetFormat } from '../datasetConverter.js';

/**
 * 能力层级配置
 */
export const CAPABILITY_CONFIG = {
  [CapabilityLevel.F1_CONVERSATION]: {
    key: CapabilityLevel.F1_CONVERSATION,
    label: '文字对话',
    icon: '💬',
    shortLabel: 'F1',
  },
  [CapabilityLevel.F2_FILE_INJECTION]: {
    key: CapabilityLevel.F2_FILE_INJECTION,
    label: '文件解析',
    icon: '📎',
    shortLabel: 'F2',
  },
  [CapabilityLevel.F3_TOOL_USE]: {
    key: CapabilityLevel.F3_TOOL_USE,
    label: '终端运行',
    icon: '🔧',
    shortLabel: 'F3',
  },
  [CapabilityLevel.F4_RAG]: {
    key: CapabilityLevel.F4_RAG,
    label: 'RAG知识',
    icon: '🔍',
    shortLabel: 'F4',
  },
  [CapabilityLevel.F5_MCP]: {
    key: CapabilityLevel.F5_MCP,
    label: 'MCP连接',
    icon: '🔌',
    shortLabel: 'F5',
  },
};

/**
 * 数据集管理 Hook
 *
 * 提供数据集的 CRUD 操作、能力筛选、导入/导出等功能
 */
export const useDatasets = () => {
  // 数据集列表
  const [datasets, setDatasets] = useState([]);

  // 当前选中的数据集
  const [selectedDataset, setSelectedDataset] = useState(null);

  // 当前选中的用例（在数据集内）
  const [selectedCase, setSelectedCase] = useState(null);

  // 能力筛选
  const [selectedCapabilities, setSelectedCapabilities] = useState([]);

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 错误状态
  const [error, setError] = useState(null);

  // 格式转换状态
  const [pendingConversion, setPendingConversion] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

  /**
   * 加载数据集列表
   */
  const loadDatasets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listDatasets();
      setDatasets(list);
    } catch (err) {
      setError(err.message);
      console.error('加载数据集失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  /**
   * 按能力筛选的数据集列表
   */
  const filteredDatasets = useMemo(() => {
    if (selectedCapabilities.length === 0) {
      return datasets;
    }
    return datasets.filter(ds => {
      const dsCapabilities = ds.capabilities || [];
      return selectedCapabilities.some(cap => dsCapabilities.includes(cap));
    });
  }, [datasets, selectedCapabilities]);

  /**
   * 切换能力筛选
   */
  const toggleCapability = useCallback((capability) => {
    setSelectedCapabilities(prev => {
      if (prev.includes(capability)) {
        return prev.filter(c => c !== capability);
      }
      return [...prev, capability];
    });
  }, []);

  /**
   * 清除能力筛选
   */
  const clearCapabilityFilter = useCallback(() => {
    setSelectedCapabilities([]);
  }, []);

  /**
   * 导入数据集（从文件）
   * @returns {Promise<{saved: Object|null, needsConversion: boolean}>}
   */
  const importDatasetFromFile = useCallback(async () => {
    try {
      const result = await importFromFileDialog();

      // 用户取消选择
      if (!result.data && !result.error) {
        return { saved: null, needsConversion: false };
      }

      if (result.error) {
        setError(result.error);
        return { saved: null, needsConversion: false };
      }

      if (result.type === 'Dataset') {
        // 标准格式，直接保存
        setIsSaving(true);
        const saved = await saveDataset(result.data);
        await loadDatasets();
        setIsSaving(false);
        return { saved, needsConversion: false };
      }

      // 非标准格式，设置待转换数据
      setPendingConversion({
        data: result.data,
        detectedType: result.type,
        detectedVersion: result.version,
      });
      return { saved: null, needsConversion: true };
    } catch (err) {
      setError(err.message);
      setIsSaving(false);
      return { saved: null, needsConversion: false };
    }
  }, [loadDatasets]);

  /**
   * 从 JSON 数据导入数据集
   */
  const importDatasetFromJSON = useCallback(async (json) => {
    try {
      const result = importFromJSON(json);

      if (result.error) {
        setError(result.error);
        return null;
      }

      if (result.type !== 'Dataset') {
        setError(`不支持的数据类型: ${result.type}`);
        return null;
      }

      // 保存到服务器
      setIsSaving(true);
      const saved = await saveDataset(result.data);
      await loadDatasets();
      setIsSaving(false);

      return saved;
    } catch (err) {
      setError(err.message);
      setIsSaving(false);
      return null;
    }
  }, [loadDatasets]);

  /**
   * 创建新数据集
   */
  const createDataset = useCallback(async ({ name, description, capabilities, source, tags }) => {
    try {
      setIsSaving(true);
      const dataset = buildDataset({
        name,
        description,
        cases: [],
        capabilities,
        source,
        tags,
      });

      const saved = await saveDataset(dataset);
      await loadDatasets();
      return saved;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [loadDatasets]);

  /**
   * 导出数据集为 JSON 文件
   */
  const exportDataset = useCallback(async (datasetId) => {
    try {
      const dataset = await getDataset(datasetId);
      const filename = `dataset-${dataset.meta?.name || datasetId}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadAsJSON(dataset, filename);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * 导出单个用例
   */
  const exportCase = useCallback(async (datasetId, caseId) => {
    try {
      const caseData = await getCaseFromDataset(datasetId, caseId);
      const filename = `case-${caseData.name || caseId}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadAsJSON(caseData, filename);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, []);

  /**
   * 删除数据集
   */
  const removeDataset = useCallback(async (datasetId) => {
    try {
      await deleteDataset(datasetId);
      await loadDatasets();
      if (selectedDataset?.id === datasetId) {
        setSelectedDataset(null);
        setSelectedCase(null);
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [loadDatasets, selectedDataset]);

  /**
   * 加载数据集详情
   */
  const loadDatasetDetail = useCallback(async (datasetId) => {
    try {
      setIsLoading(true);
      const detail = await getDataset(datasetId);
      setSelectedDataset(detail);
      setSelectedCase(null);
      return detail;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 向数据集添加用例
   */
  const addCase = useCallback(async (datasetId, caseData) => {
    try {
      setIsSaving(true);
      await addCaseToDataset(datasetId, caseData);
      // 刷新数据集详情
      if (selectedDataset?.id === datasetId || selectedDataset?.meta?.datasetId === datasetId) {
        await loadDatasetDetail(datasetId);
      }
      await loadDatasets();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [selectedDataset, loadDatasetDetail, loadDatasets]);

  /**
   * 从数据集移除用例
   */
  const removeCase = useCallback(async (datasetId, caseId) => {
    try {
      await removeCaseFromDataset(datasetId, caseId);
      // 刷新数据集详情
      if (selectedDataset?.id === datasetId || selectedDataset?.meta?.datasetId === datasetId) {
        await loadDatasetDetail(datasetId);
      }
      await loadDatasets();
      if (selectedCase?.id === caseId) {
        setSelectedCase(null);
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [selectedDataset, selectedCase, loadDatasetDetail, loadDatasets]);

  /**
   * 选择数据集内的用例
   */
  const selectCase = useCallback((caseData) => {
    setSelectedCase(caseData);
  }, []);

  /**
   * 执行格式转换（使用 LLM）
   */
  const executeConversion = useCallback(async () => {
    if (!pendingConversion) return null;
    try {
      setIsConverting(true);
      const converted = await convertToDatasetFormat(pendingConversion.data);
      const saved = await saveDataset(converted);
      await loadDatasets();
      setPendingConversion(null);
      setIsConverting(false);
      return saved;
    } catch (err) {
      setError(`格式转换失败: ${err.message}`);
      setIsConverting(false);
      return null;
    }
  }, [pendingConversion, loadDatasets]);

  /**
   * 取消格式转换
   */
  const cancelConversion = useCallback(() => {
    setPendingConversion(null);
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 格式化文件大小
   */
  const formatSize = useCallback((bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  return {
    // 状态
    datasets,
    filteredDatasets,
    selectedDataset,
    selectedCase,
    selectedCapabilities,
    isLoading,
    isSaving,
    error,

    // 格式转换状态
    pendingConversion,
    isConverting,

    // 数据集操作
    loadDatasets,
    createDataset,
    loadDatasetDetail,
    exportDataset,
    removeDataset,
    importDatasetFromFile,
    importDatasetFromJSON,

    // 格式转换操作
    executeConversion,
    cancelConversion,

    // 用例操作
    addCase,
    removeCase,
    exportCase,
    selectCase,
    setSelectedCase,

    // 筛选操作
    toggleCapability,
    clearCapabilityFilter,
    setSelectedCapabilities,

    // 选择操作
    setSelectedDataset,

    // 辅助
    clearError,
    formatSize,

    // 配置
    CAPABILITY_CONFIG,
  };
};

export default useDatasets;
