import { useState, useEffect, useCallback } from 'react';
import { saveCaseToServer, listSavedCases, getCaseDetail, deleteCase } from '../caseApi.js';
import {
  // v1 兼容
  buildTestCaseFromState,
  downloadTestCaseAsJSON,
  importTestCaseFromFile,
  // v2 新增
  buildTestInput,
  buildPlaybackSequence,
  downloadPlaybackSequenceAsJSON,
  detectSchemaVersion,
  migrateV1ToV2,
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
} from '../schemas/testCase.js';
import { CONFIG } from '../config.js';

/**
 * Custom hook for test case persistence
 *
 * 支持两种格式：
 * - v1.0.0: 传统 TestCase 格式（向后兼容）
 * - v2.0.0: 新 TestInput + PlaybackSequence 格式
 *
 * @param {Object} options - 所有需要收集的应用状态
 * @returns {Object} Case management state and functions
 */
export const useCases = ({
  // 基础状态
  mode,
  dialogMode,
  messages,
  logs,
  conversationHistory,

  // 场景和攻击
  selectedAttack,
  currentScenario,
  currentAttack,

  // LLM 配置
  selectedModel,
  llmTemperature,
  llmMaxTokens,
  llmTopP,
  thinkingEnabled,
  thinkingBudget,

  // 系统提示词
  customSystemPrompt,

  // 工具配置
  toolsEnabled,
  enabledTools,
  maxToolCalls,
  toolCallHistory,

  // 沙箱配置
  sandboxEnabled,
  sandboxStatus,
  sandboxImage,
  containerInfo,
  presetSandboxFiles,
  sandboxFiles,

  // RAG 配置
  ragEnabled,
  ragMode,
  ragKnowledge,
  ragDocuments,

  // MCP 配置
  mcpEnabled,
  mcpParsers,
  mcpServerEnabled,
  selectedMcpServer,
  mcpServerConfigs,
  mcpServerStatus,

  // Payload 文件
  payloadFiles,
  customTestPayload,

  // API 结果
  apiStatus,
  apiError,
  realResponse,
  lastJudgment,
  apiTime,

  // v2 状态收集器（可选）
  stateCollector,
}) => {
  // Case management states
  const [viewMode, setViewMode] = useState('scenarios'); // 'scenarios' | 'saved'
  const [savedCases, setSavedCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingSavedCases, setLoadingSavedCases] = useState(false);

  // Load saved cases when view mode changes
  useEffect(() => {
    if (viewMode === 'saved') {
      loadSavedCases();
    }
  }, [viewMode]);

  /**
   * 确定能力层级
   */
  const getCapabilityLevel = useCallback(() => {
    const scenarioKey = selectedAttack?.scenario || 'unknown';
    if (scenarioKey.startsWith('F1-') || ['loan', 'service'].includes(scenarioKey)) {
      return 'F1-conversation';
    } else if (scenarioKey.startsWith('F2-')) {
      return 'F2-file-injection';
    } else if (scenarioKey.startsWith('F3-')) {
      return 'F3-tool-use';
    } else if (scenarioKey.startsWith('F4-')) {
      return 'F4-rag';
    } else if (scenarioKey.startsWith('F5-')) {
      return 'F5-mcp';
    }
    return null;
  }, [selectedAttack]);

  /**
   * 确定 payload 信息
   */
  const getPayloadInfo = useCallback(() => {
    const hasUserFiles = payloadFiles && payloadFiles.length > 0;
    const hasCustomPayload = customTestPayload && customTestPayload !== currentAttack?.testPayload;

    let displayPayload, actualPayload, payloadSource, payloadFile;

    if (hasUserFiles) {
      displayPayload = customTestPayload || currentAttack?.testPayload;
      actualPayload = payloadFiles.map(f => f.parsedContent || '').join('\n\n') || displayPayload;
      payloadSource = 'custom_file';
      payloadFile = {
        name: payloadFiles[0]?.name,
        size: payloadFiles[0]?.size,
        parsedWith: payloadFiles[0]?.parsedWith,
        parsedContent: payloadFiles[0]?.parsedContent,
      };
    } else if (hasCustomPayload) {
      displayPayload = customTestPayload;
      actualPayload = customTestPayload;
      payloadSource = 'custom_text';
      payloadFile = null;
    } else {
      displayPayload = currentAttack?.testPayload;
      actualPayload = currentAttack?.realTestPayload || currentAttack?.testPayload;
      payloadSource = 'predefined';
      payloadFile = null;
    }

    const injectionSource = hasUserFiles
      ? `📎 ${payloadFiles.map(f => f.name).join(', ')}`
      : (currentAttack?.documentFileName ? `📄 ${currentAttack.documentFileName}` : null);

    return {
      displayPayload,
      actualPayload,
      payloadSource,
      payloadFile,
      injectionSource,
      isCustomized: hasUserFiles || hasCustomPayload,
    };
  }, [payloadFiles, customTestPayload, currentAttack]);

  /**
   * 构建 v2 TestInput
   */
  const buildCurrentTestInput = useCallback(() => {
    if (!currentScenario || !currentAttack) {
      throw new Error('缺少场景或攻击信息');
    }

    const capabilityLevel = getCapabilityLevel();
    const scenarioKey = selectedAttack?.scenario || 'unknown';
    const modelConfig = CONFIG.models.find(m => m.id === selectedModel);
    const modelName = modelConfig?.name || selectedModel;
    const { displayPayload, actualPayload, payloadSource, payloadFile } = getPayloadInfo();

    return buildTestInput({
      // 基础信息
      name: currentAttack.name,
      tags: [currentAttack.type, currentAttack.level].filter(Boolean),
      notes: null,

      // 来源信息
      capabilityLevel,
      scenarioKey,
      scenario: currentScenario,
      attackIndex: selectedAttack?.index ?? 0,
      attack: currentAttack,

      // LLM 配置
      selectedModel,
      modelName,
      llmTemperature,
      llmMaxTokens,
      llmTopP,
      thinkingEnabled,
      thinkingBudget,

      // 系统提示词
      customSystemPrompt,
      originalSystemPrompt: currentScenario.systemPrompt,

      // Payload
      payloadSource,
      displayPayload,
      actualPayload,
      payloadFile,

      // 能力配置
      toolsEnabled,
      enabledTools,
      maxToolCalls,
      toolDefinitions: toolsEnabled ? CONFIG.buildToolDefinitions(
        Object.entries(enabledTools || {}).filter(([_, v]) => v).map(([k]) => k)
      ) : [],

      sandboxEnabled,
      sandboxImage,
      presetSandboxFiles,

      ragEnabled,
      ragMode,
      ragKnowledge,
      ragDocuments,

      mcpEnabled,
      mcpParsers,
      mcpServerEnabled,
      selectedMcpServer,
      mcpServerConfig: selectedMcpServer ? mcpServerConfigs?.[selectedMcpServer] : null,
    });
  }, [
    currentScenario, currentAttack, selectedAttack, selectedModel,
    llmTemperature, llmMaxTokens, llmTopP, thinkingEnabled, thinkingBudget,
    customSystemPrompt, toolsEnabled, enabledTools, maxToolCalls,
    sandboxEnabled, sandboxImage, presetSandboxFiles,
    ragEnabled, ragMode, ragKnowledge, ragDocuments,
    mcpEnabled, mcpParsers, mcpServerEnabled, selectedMcpServer, mcpServerConfigs,
    getCapabilityLevel, getPayloadInfo,
  ]);

  /**
   * 从当前应用状态构建 v1 TestCase（向后兼容）
   */
  const buildCurrentTestCase = useCallback(async () => {
    if (!currentScenario || !currentAttack) {
      throw new Error('缺少场景或攻击信息');
    }

    const capabilityLevel = getCapabilityLevel();
    const scenarioKey = selectedAttack?.scenario || 'unknown';
    const modelConfig = CONFIG.models.find(m => m.id === selectedModel);
    const modelName = modelConfig?.name || selectedModel;
    const activeSystemPrompt = customSystemPrompt || currentScenario.systemPrompt;
    const { displayPayload, actualPayload, injectionSource, isCustomized } = getPayloadInfo();

    return await buildTestCaseFromState({
      // 基础信息
      mode: mode || 'real',
      dialogMode: dialogMode || 'single',
      name: currentAttack.name,
      tags: [currentAttack.type, currentAttack.level].filter(Boolean),
      notes: null,

      // 来源信息
      capabilityLevel,
      scenarioKey,
      scenario: currentScenario,
      attackIndex: selectedAttack?.index ?? 0,
      attack: currentAttack,

      // LLM 配置
      selectedModel,
      modelName,
      llmTemperature,
      llmMaxTokens,
      llmTopP,
      thinkingEnabled,
      thinkingBudget,

      // 系统提示词
      systemPrompt: activeSystemPrompt,
      originalSystemPrompt: currentScenario.systemPrompt,

      // 工具配置
      toolsEnabled,
      enabledTools,
      maxToolCalls,
      toolDefinitions: toolsEnabled ? CONFIG.buildToolDefinitions(
        Object.entries(enabledTools || {}).filter(([_, v]) => v).map(([k]) => k)
      ) : [],

      // 沙箱配置
      sandboxEnabled,
      sandboxStatus,
      sandboxImage,
      containerInfo,
      presetFiles: presetSandboxFiles,
      sandboxFiles,

      // RAG 配置
      ragEnabled,
      ragMode,
      ragKnowledge,
      ragDocuments,
      injectedRagContext: null,

      // MCP 配置
      mcpParserEnabled: mcpEnabled,
      mcpParsers,
      mcpServerEnabled,
      selectedMcpServer,
      mcpServerConfig: selectedMcpServer ? mcpServerConfigs?.[selectedMcpServer] : null,
      mcpServerStatus,

      // Payload 文件
      payloadFiles,

      // 执行数据
      displayPayload,
      actualPayload,
      isCustomized,
      injectionSource,
      messages,
      conversationHistory: conversationHistory || [],
      logs,
      toolCalls: toolCallHistory || [],
      ragQueryResults: null,

      // 计时数据
      totalApiTimeMs: apiTime || 0,
      firstResponseMs: null,
      toolCallCount: toolCallHistory?.length || 0,
      ragQueryTimeMs: null,
      judgeTimeMs: null,

      // 结果
      resultStatus: apiStatus === 'success' ? 'success' : (apiStatus === 'error' ? 'error' : null),
      response: realResponse,
      thinking: null,
      error: apiError,
      judgment: lastJudgment ? {
        judgeModel: CONFIG.judgeModel,
        success: lastJudgment.success,
        reason: lastJudgment.reason,
        rawResponse: lastJudgment.rawResponse,
      } : null,
    });
  }, [
    mode, dialogMode, messages, logs, conversationHistory,
    selectedAttack, currentScenario, currentAttack,
    selectedModel, llmTemperature, llmMaxTokens, llmTopP, thinkingEnabled, thinkingBudget,
    customSystemPrompt, toolsEnabled, enabledTools, maxToolCalls, toolCallHistory,
    sandboxEnabled, sandboxStatus, sandboxImage, containerInfo, presetSandboxFiles, sandboxFiles,
    ragEnabled, ragMode, ragKnowledge, ragDocuments,
    mcpEnabled, mcpParsers, mcpServerEnabled, selectedMcpServer, mcpServerConfigs, mcpServerStatus,
    payloadFiles, apiStatus, apiError, realResponse, lastJudgment, apiTime,
    getCapabilityLevel, getPayloadInfo,
  ]);

  /**
   * 构建 v2 PlaybackSequence（需要 stateCollector）
   */
  const buildCurrentPlaybackSequence = useCallback(async () => {
    if (!stateCollector) {
      throw new Error('状态收集器未初始化');
    }

    const input = buildCurrentTestInput();
    const result = {
      status: apiStatus === 'success' ? 'success' : (apiStatus === 'error' ? 'error' : null),
      finalResponse: realResponse,
      thinking: null,
      error: apiError,
      judgment: lastJudgment ? {
        judgeModel: CONFIG.judgeModel,
        success: lastJudgment.success,
        reason: lastJudgment.reason,
        rawResponse: lastJudgment.rawResponse,
      } : null,
      timing: {
        totalApiTimeMs: apiTime || 0,
        firstResponseMs: null,
        toolCallCount: toolCallHistory?.length || 0,
        ragQueryTimeMs: null,
        judgeTimeMs: null,
      },
    };

    return await stateCollector.buildSequence(result);
  }, [stateCollector, buildCurrentTestInput, apiStatus, apiError, realResponse, lastJudgment, apiTime, toolCallHistory]);

  /**
   * 保存到服务器（v1 格式，向后兼容）
   */
  const saveToServer = async () => {
    if (apiStatus !== 'success') {
      alert('暂无测试结果，请先执行真实测试');
      return;
    }

    setIsSaving(true);
    try {
      const testCase = await buildCurrentTestCase();
      const saved = await saveCaseToServer(testCase);
      const caseId = saved.meta?.caseId || saved.id;
      alert(`保存成功！用例 ID: ${caseId}`);
      if (viewMode === 'saved') {
        loadSavedCases();
      }
    } catch (error) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 导出当前测试结果为 JSON 文件（v1 格式）
   */
  const exportCurrentCase = async () => {
    if (apiStatus !== 'success') {
      alert('暂无测试结果，请先执行真实测试');
      return;
    }

    try {
      const testCase = await buildCurrentTestCase();
      const filename = `${currentAttack?.name || 'test-case'}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadTestCaseAsJSON(testCase, filename);
    } catch (error) {
      alert(`导出失败: ${error.message}`);
    }
  };

  /**
   * 导出 v2 PlaybackSequence（需要 stateCollector）
   */
  const exportPlaybackSequence = async () => {
    if (apiStatus !== 'success') {
      alert('暂无测试结果，请先执行真实测试');
      return;
    }

    if (!stateCollector || stateCollector.states.length === 0) {
      // 降级到 v1 导出
      await exportCurrentCase();
      return;
    }

    try {
      const sequence = await buildCurrentPlaybackSequence();
      const filename = `playback-${currentAttack?.name || 'sequence'}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadPlaybackSequenceAsJSON(sequence, filename);
    } catch (error) {
      alert(`导出失败: ${error.message}`);
    }
  };

  /**
   * 从文件导入测试用例（自动检测版本）
   */
  const importFromFile = async () => {
    const result = await importTestCaseFromFile();

    if (result.error) {
      alert(`导入失败: ${result.error}`);
      return null;
    }

    // 返回导入的数据（v1 或 v2）
    return result.testCase || result.playbackSequence;
  };

  // Load saved cases list
  const loadSavedCases = async () => {
    setLoadingSavedCases(true);
    try {
      const cases = await listSavedCases();
      setSavedCases(cases);
    } catch (error) {
      console.error('加载已保存用例失败:', error);
    } finally {
      setLoadingSavedCases(false);
    }
  };

  // View case detail
  const viewCaseDetail = async (caseId) => {
    try {
      const detail = await getCaseDetail(caseId);
      setSelectedCase(detail);
    } catch (error) {
      alert(`获取详情失败: ${error.message}`);
    }
  };

  // Delete case
  const handleDeleteCase = async (caseId) => {
    if (!confirm('确定要删除这个用例吗？')) return;
    try {
      await deleteCase(caseId);
      setSavedCases(prev => prev.filter(c => c.id !== caseId));
      if (selectedCase?.meta?.caseId === caseId || selectedCase?.id === caseId) {
        setSelectedCase(null);
      }
    } catch (error) {
      alert(`删除失败: ${error.message}`);
    }
  };

  /**
   * 迁移 v1 用例到 v2
   */
  const migrateToV2 = async (v1Case) => {
    try {
      const { input, sequence } = await migrateV1ToV2(v1Case);
      return { input, sequence };
    } catch (error) {
      console.error('迁移失败:', error);
      return null;
    }
  };

  return {
    // State
    viewMode,
    setViewMode,
    savedCases,
    setSavedCases,
    selectedCase,
    setSelectedCase,
    isSaving,
    loadingSavedCases,

    // v1 Functions（向后兼容）
    buildCurrentTestCase,
    saveToServer,
    exportCurrentCase,
    importFromFile,
    loadSavedCases,
    viewCaseDetail,
    handleDeleteCase,

    // v2 Functions
    buildCurrentTestInput,
    buildCurrentPlaybackSequence,
    exportPlaybackSequence,
    migrateToV2,

    // 辅助函数
    getCapabilityLevel,
    getPayloadInfo,
  };
};
