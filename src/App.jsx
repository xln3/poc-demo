import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIG, ATTACK_TYPES, RISK_LEVELS, LOG_TYPES, FIVE_LEVEL_RISK, calculateRiskStats } from './config';
import { SCENARIOS } from './scenarios/index.js';
import { sandboxClient, ToolType, TOOL_DESCRIPTIONS } from './sandbox.js';
import { ragClient, formatRAGContext, formatRAGLogs } from './rag.js';
import { saveCaseToServer, listSavedCases, getCaseDetail, deleteCase } from './caseApi.js';
import { listTestResults, getTestResult, saveTestResult, deleteTestResult, deleteTestCase, updateCaseReview, updateReport, listReportTemplates, getReportTemplate } from './testResultsApi.js';
import { mcpClient } from './mcp.js';
import { useSandbox, TerminalImage, formatBytes, formatTimeAgo, useRAG, useCases, useMCP, useConversation, useLLMConfig, usePlayback, useToast, useDatasets, CAPABILITY_CONFIG, useTestExecution, ExecutionMode, useClawdBotSandbox, SandboxState, usePanelLayout, usePayloadEditor, useJudgment, useApiInspector, useProviders, useAttackSelection, useTestRecords, useTestRecordActions, useFileParsing, useRealTest, useConversationEngine, useBatchTest, useSimulator, useScenarioTranslation } from './hooks/index.js';
import {
  buildTestInput,
  buildRecordingSession,
  createStandaloneTestCase,
  downloadAsJSON,
  importFromFileDialog,
  detectSchemaVersion,
  SCHEMA_VERSION,
} from './schemas/testCase.js';
import Toast from './components/Toast.jsx';
import LLMProviderSettings from './components/LLMProviderSettings.jsx';
import LeftSidebar from './components/LeftSidebar.jsx';
import AppModals from './components/AppModals.jsx';
import RunPage from './components/pages/RunPage.jsx';
import ConfigPage from './components/pages/ConfigPage.jsx';
import ReportPage from './components/pages/ReportPage.jsx';
import ReportEditorPage from './components/pages/ReportEditorPage.jsx';
import RiskItemsPage from './components/pages/RiskItemsPage.jsx';
import RisksPage from './components/pages/RisksPage.jsx';
import CasesPage from './components/pages/CasesPage.jsx';
import EvalSubNav from './components/eval/EvalSubNav.jsx';
import AgentConfigPage from './components/pages/AgentConfigPage.jsx';
import EvalProgressPage from './components/pages/EvalProgressPage.jsx';
import EvalResultsPage from './components/pages/EvalResultsPage.jsx';
import EvalResultDetailPage from './components/pages/EvalResultDetailPage.jsx';
import EvalManagePage from './components/pages/EvalManagePage.jsx';
import {
  TerminalItem,
  DeletedTerminalsPanel,
  FileTreeBrowser,
  FileUploadDialog,
  FileTransferProgress,
} from './components/sandbox';


export default function App() {
  const { t } = useTranslation();
  // 状态
  const attackSelection = useAttackSelection();
  const {
    selectedAttack, setSelectedAttack,
    expanded, setExpanded, scenarioListExpanded, setScenarioListExpanded,
    selectedRiskItem, setSelectedRiskItem,
    currentScenario, currentAttack, attackType, riskLevel, currentRiskItemData,
    toggleCategory, toggleSubcategory,
  } = attackSelection;

  // Scenario i18n: translates scenario/attack display strings based on current language
  const {
    translatedScenario, translatedAttack,
  } = useScenarioTranslation(selectedAttack?.scenario, currentScenario, currentAttack);

  // Tab navigation: 5 tabs (config, run, eval, report, risk-items)
  const [activeTab, setActiveTab] = useState('risks');
  const [editingCaseId, setEditingCaseId] = useState(null);
  // App mode: test vs demo
  const [appMode, setAppMode] = useState('test');

  // Eval sub-navigation state
  const [evalSubPage, setEvalSubPage] = useState('agents'); // agents | eval-new | eval-progress | eval-results | eval-report
  const [evalContext, setEvalContext] = useState({}); // jobId, model, agentId, etc.

  const evalNavigate = (page, ctx = {}) => {
    setEvalSubPage(page);
    setEvalContext(prev => ({ ...prev, ...ctx }));
    if (page === 'run-reproduce' && ctx) {
      // Jump to Run tab with pre-config from eval reproduce
      setActiveTab('run');
      // Pre-select matching scenario
      if (ctx.scenarios?.length > 0) {
        const scenarioKey = ctx.scenarios[0];
        if (SCENARIOS[scenarioKey]) {
          setSelectedAttack({ scenario: scenarioKey, index: 0 });
          // Inject payload after the scenario-switch effect resets defaults (next tick)
          if (ctx.pre_config?.payload) {
            setTimeout(() => {
              setCustomTestPayload(ctx.pre_config.payload);
              setIsEditingPayload(true);
            }, 100);
          }
        }
      }
    }
  };

  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState(new Set()); // 跟踪展开的日志索引
  const [isPlaying, setIsPlaying] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [apiError, setApiError] = useState('');
  const [realResponse, setRealResponse] = useState('');
  const [selectedModel, setSelectedModel] = useState(CONFIG.models[0]?.id || '');
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const { providers, selectedProviderId, setSelectedProviderId, providerModels, reloadProviders } = useProviders();
  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false);
  const [documentReadme, setDocumentReadme] = useState('');
  const {
    customTestPayload, setCustomTestPayload,
    isEditingPayload, setIsEditingPayload,
    payloadFiles, setPayloadFiles,
    customSystemPrompt, setCustomSystemPrompt,
    resetPayloadEditor,
  } = usePayloadEditor();
  const [isEditingSystemPrompt, setIsEditingSystemPrompt] = useState(false);
  const [lastTestResult, setLastTestResult] = useState(null); // 存储最后一次测试结果

  // ============ 测试记录面板状态 ============
  const { testRecords, setTestRecords, expandedRecords, setExpandedRecords, toggleRecord, clearRecords } = useTestRecords();

  // 评判配置 + 人类评判 + 批注
  const {
    judgeConfig, setJudgeConfig,
    judgeConfigOpen, setJudgeConfigOpen,
    humanJudgment, setHumanJudgment,
    annotationModal, setAnnotationModal,
    newAnnotation, setNewAnnotation,
  } = useJudgment();

  // 面板布局
  const {
    leftPanelTab, setLeftPanelTab,
    rightPanelTab, setRightPanelTab,
    rightSubTab, setRightSubTab,
    showDocument, setShowDocument,
    docTab, setDocTab,
  } = usePanelLayout();

  // API 检查器（thinking + API 交互追踪）
  const {
    thinkingEntries, setThinkingEntries,
    apiInteractions, setApiInteractions,
    expandedThinking, setExpandedThinking, expandedApiInteraction, setExpandedApiInteraction,
    apiStartTime, setApiStartTime,
    apiElapsedTime, setApiElapsedTime,
    addApiInteraction,
    addThinkingEntry,
    toggleThinkingExpanded,
    toggleApiInteractionExpanded,
    resetInspector,
  } = useApiInspector();

  // Toast notifications
  const { toasts, addToast, removeToast } = useToast();

  // Types that show as toast (operation status)
  // 格式: toast_{entity} 其中 entity 是 tester/testee/world
  const TOAST_LOG_TYPES = new Set([
    'container', 'error', 'info',
    'toast_tester', 'toast_testee', 'toast_world'
  ]);

  // Map log status to toast type (消息类型)
  const getToastType = (log) => {
    if (log.status === 'danger') return 'error';
    if (log.status === 'success') return 'success';
    if (log.status === 'warning') return 'warning';
    return 'info';
  };

  // Extract entity from log type (实体类型)
  // toast_tester -> 'tester', toast_testee -> 'testee', toast_world -> 'world'
  const getToastEntity = (logType) => {
    if (logType?.startsWith('toast_')) {
      return logType.substring(6); // 'toast_tester' -> 'tester'
    }
    return null;
  };

  // Log helper for hooks - routes to toast or log panel
  const addLog = useCallback((log) => {
    if (TOAST_LOG_TYPES.has(log.type)) {
      // Route to toast notification (消息类型 + 实体类型)
      addToast(log.content, getToastType(log), getToastEntity(log.type));
    } else {
      // Route to log panel
      setLogs(prev => [...prev, log]);
    }
  }, [addToast]);

  // ============ 测试记录辅助函数 ============

  const idCounterRef = useRef(0);
  const generateId = useCallback(() => {
    idCounterRef.current += 1;
    return `${Date.now()}-${idCounterRef.current}`;
  }, []);

  const {
    addTestRecord, updateTestRecord, removeTestRecord,
    startThinkingRecord, finalizeThinkingRecord, addResponseRecord,
    addAnnotation, removeAnnotation, requestLLMAnnotation, submitHumanJudgment,
    thinkingIndexRef,
  } = useTestRecordActions({
    setTestRecords, testRecords, generateId,
    judgeConfig, setAnnotationModal, setNewAnnotation,
    humanJudgment, setHumanJudgment, addToast,
  });

  // 完成 thinking 流（更新 thinkingEntries 状态并更新测试记录）
  const pendingThinkingRef = useRef(null);
  const finalizeThinking = useCallback(() => {
    pendingThinkingRef.current = null;

    setThinkingEntries(prev => {
      const newEntries = [...prev];
      for (let i = newEntries.length - 1; i >= 0; i--) {
        if (newEntries[i].isStreaming) {
          const content = newEntries[i].content;
          newEntries[i] = { ...newEntries[i], isStreaming: false };
          pendingThinkingRef.current = { content, index: i };
          break;
        }
      }
      return newEntries;
    });

    setTimeout(() => {
      if (pendingThinkingRef.current) {
        const { content, index } = pendingThinkingRef.current;
        finalizeThinkingRecord(index, content);
        pendingThinkingRef.current = null;
      }
    }, 0);
  }, [finalizeThinkingRecord]);

  // Sandbox hook (multi-terminal)
  const sandbox = useSandbox({ addLog });
  const {
    // Multi-terminal state
    terminals, currentTag, setCurrentTag, newTerminalTag, setNewTerminalTag,
    newTerminalImage, setNewTerminalImage, deletedTerminals, deletedTotalSize,
    creatingTerminal, showCleanupConfirm, setShowCleanupConfirm, lockStatus,
    // UI state
    sandboxEnabled, setSandboxEnabled, sandboxStatus, setSandboxStatus,
    sandboxAvailable, toolCommand, setToolCommand, toolResult, setToolResult,
    sandboxFiles, setSandboxFiles, uploadingSandboxFile,
    // Multi-terminal functions
    createTerminal, switchTerminal, destroyTerminal, fetchTerminals,
    fetchDeletedTerminals, cleanupDeleted, cleanupAllDeleted, getCurrentTerminal,
    // File functions
    handleUploadToSandbox, handleRemoveSandboxFile, presetSandboxFiles,
    refreshSandboxFiles, handleDownloadSandboxFile, executeCommand,
    handleSandboxLog, isSandboxAvailable,
    // Legacy compatibility
    sandboxImage, setSandboxImage, containerInfo, setContainerInfo,
    startContainer, stopContainer, isFileParserReady,
    // File tree browser state
    fileTreeOpen, fileTreeTag, uploadDialogOpen, uploadTargetPath, transferState,
    // File tree browser functions
    openFileTree, closeFileTree, openUploadDialog, openUploadForTerminal, closeUploadDialog,
    uploadFilesWithProgress, downloadFileWithProgress, cancelTransfer,
    // File watch functions
    startFileWatch, stopFileWatch,
  } = sandbox;

  // ClawdBot Sandbox hook (黑盒 Agent 测试)
  const clawdbot = useClawdBotSandbox();
  const {
    sandbox: clawdbotSandbox,
    state: clawdbotState,
    error: clawdbotError,
    isRunning: clawdbotRunning,
    isCreating: clawdbotCreating,
    behaviors: clawdbotBehaviors,
    honeypotTriggers,
    serviceStatus: clawdbotServiceStatus,
    configLevels,
    selectedConfigLevel,
    setSelectedConfigLevel,
    createSandbox: createClawdbotSandbox,
    destroySandbox: destroyClawdbotSandbox,
  } = clawdbot;

  // RAG hook
  const rag = useRAG({ addLog });
  const {
    ragEnabled, setRagEnabled, ragConfigCollapsed, setRagConfigCollapsed,
    ragKnowledge, setRagKnowledge, ragKnowledgeEdit, setRagKnowledgeEdit,
    ragMode, setRagMode, ragServiceAvailable, ragDocuments, setRagDocuments,
    ragQueryResults, setRagQueryResults, ragUploading,
    refreshRagDocuments, handleRagUpload,
    handleRagDelete, handleRagClear, handleRagReset, performRagQuery
  } = rag;

  // Cases hook - 延迟初始化，在获取所有状态后调用
  // 注意：useCases 需要的状态在下面的 hooks 中定义
  // 这里先声明，实际调用移到所有 hooks 之后

  // MCP hook
  const mcp = useMCP();
  const {
    mcpEnabled, setMcpEnabled, mcpConfigCollapsed, setMcpConfigCollapsed,
    mcpParsers, setMcpParsers, isParsingFile, setIsParsingFile,
    parsingProgress, setParsingProgress, parsingAbortController, setParsingAbortController,
    mcpParserServiceAvailable, checkMcpParserHealth,
    mcpServerEnabled, setMcpServerEnabled, mcpServerConfigCollapsed, setMcpServerConfigCollapsed,
    selectedMcpServer, setSelectedMcpServer, mcpServerConfigs, setMcpServerConfigs,
    mcpServerStatus, setMcpServerStatus, getFileType, requiresDockerParsers, estimateParsingTime
  } = mcp;

  // File parsing hook
  const {
    getFileTypeForMcp, parseViaMcpBackend, parseInSandbox, parseFileWithMcp,
    handleAddFile, removePayloadFile,
  } = useFileParsing({
    containerInfo, mcpParsers, isFileParserReady, isSandboxAvailable,
    setParsingProgress, setSandboxImage, setSandboxStatus, setContainerInfo,
    setSandboxEnabled, setLogs, handleSandboxLog, estimateParsingTime,
    setIsParsingFile, setPayloadFiles,
  });

  // Conversation hook
  const conversation = useConversation();
  const {
    dialogMode, setDialogMode, conversationMode, setConversationMode,
    userInput, setUserInput, conversationHistory, setConversationHistory,
    initialPayload, setInitialPayload, resetConversation, addToHistory, clearHistory
  } = conversation;

  // LLM Config hook
  const llmConfig = useLLMConfig();
  const {
    selectedModel: llmSelectedModel, setSelectedModel: setLlmSelectedModel,
    llmTemperature, setLlmTemperature, llmMaxTokens, setLlmMaxTokens,
    llmTopP, setLlmTopP, thinkingEnabled, setThinkingEnabled,
    thinkingBudget, setThinkingBudget, enabledTools, setEnabledTools,
    maxToolCalls, setMaxToolCalls, toolCallHistory, setToolCallHistory,
    resetLLMConfig, enableAllTools, enableSafeToolsOnly, disableAllTools
  } = llmConfig;

  // Tool calling UI config
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [toolsConfigCollapsed, setToolsConfigCollapsed] = useState(true);

  // Simulation state
  const simulator = useSimulator();
  const [simEngine, setSimEngine] = useState(null);        // 'ai2thor' | null
  const [safeAgentBenchCase, setSafeAgentBenchCase] = useState(null);

  // 录制相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [lastRecording, setLastRecording] = useState(null); // 最近一次录制结果
  const [showImportMenu, setShowImportMenu] = useState(false); // 导入测试下拉菜单
  const [showSaveDialog, setShowSaveDialog] = useState(false); // 保存对话框
  const [showBatchTestModal, setShowBatchTestModal] = useState(false); // 批量测试弹窗

  // 已保存的测试结果列表
  const [savedTestResults, setSavedTestResults] = useState([]);
  const [selectedTestResult, setSelectedTestResult] = useState(null);

  // 测试结果详情/评审弹窗状态
  const [detailModalCase, setDetailModalCase] = useState(null);  // 详情弹窗
  const [reviewModalCase, setReviewModalCase] = useState(null);  // 评审弹窗
  const [reportContent, setReportContent] = useState('');        // 报告编辑器内容
  const [reportEditMode, setReportEditMode] = useState('edit');  // 'edit' | 'preview'
  const [reportTemplates, setReportTemplates] = useState([]);    // 报告模板列表
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [llmReviewLoading, setLlmReviewLoading] = useState(false);  // LLM 评审加载中
  const [reportSaving, setReportSaving] = useState(false);       // 报告保存中

  const chatRef = useRef(null);
  const logRef = useRef(null);
  const abortRef = useRef(false);

  // currentScenario, currentAttack, attackType, riskLevel come from useAttackSelection

  // Cases hook - 需要在所有状态定义之后调用
  const cases = useCases({
    // 基础状态
    mode: 'real',
    dialogMode,
    messages,
    logs,
    conversationHistory,

    // 场景和攻击（使用翻译版本）
    selectedAttack,
    currentScenario: translatedScenario || currentScenario,
    currentAttack: translatedAttack || currentAttack,

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
    lastJudgment: lastTestResult?.judgment,
    apiTime: lastTestResult?.apiTime,

    // 测试记录
    testRecords,
    humanJudgment,
    judgeConfig,
  });
  const {
    savedCases, setSavedCases, selectedCase, setSelectedCase,
    isSaving, loadingSavedCases, saveToServer, exportCurrentCase, importFromFile,
    loadSavedCases, viewCaseDetail, handleDeleteCase
  } = cases;

  // Playback hook - 回放已保存的测试用例
  const playback = usePlayback({
    setSelectedModel,
    setLlmTemperature,
    setLlmMaxTokens,
    setLlmTopP,
    setThinkingEnabled,
    setThinkingBudget,
    setCustomSystemPrompt,
    setToolsEnabled,
    setEnabledTools,
    setMaxToolCalls,
    setSandboxEnabled,
    setSandboxImage,
    setRagEnabled,
    setRagMode,
    setRagKnowledge,
    setMcpEnabled,
    setMcpParsers,
    setMcpServerEnabled,
    setSelectedMcpServer,
    setMessages,
    setLogs,
    setToolCallHistory,
    setApiStatus,
    setRealResponse,
    setLastTestResult,
    setCustomTestPayload,
  });
  const {
    isPlaybackMode, playbackCase, isPlaying: isPlaybackPlaying, isPaused: isPlaybackPaused,
    playbackProgress, playbackTotal,
    startPlayback, pausePlayback, resumePlayback, stopPlayback, exitPlayback, skipToEnd
  } = playback;

  // Apply case config from ConfigPage → Run tab
  // Maps v3 CaseConfig fields to App.jsx state setters so Run page can execute with saved config
  const applyCaseConfig = useCallback((caseConfig) => {
    if (!caseConfig) return;

    // Agent → LLM provider
    if (caseConfig.agent?.agent_id) setSelectedAgentId(caseConfig.agent.agent_id);
    if (caseConfig.agent?.model_id) setSelectedModel(caseConfig.agent.model_id);
    if (caseConfig.llm_params) {
      if (caseConfig.llm_params.temperature != null) setLlmTemperature(caseConfig.llm_params.temperature);
      if (caseConfig.llm_params.max_tokens != null) setLlmMaxTokens(caseConfig.llm_params.max_tokens);
      if (caseConfig.llm_params.top_p != null) setLlmTopP(caseConfig.llm_params.top_p);
    }

    // Thinking
    if (caseConfig.thinking) {
      setThinkingEnabled(caseConfig.thinking.enabled || false);
      if (caseConfig.thinking.budget) setThinkingBudget(caseConfig.thinking.budget);
    }

    // System prompt
    if (caseConfig.system_prompt) {
      setCustomSystemPrompt(caseConfig.system_prompt);
    }

    // Test mode → dialog mode
    if (caseConfig.test_mode === 'chat' || caseConfig.test_mode === 'act') {
      setDialogMode('multi');
    } else {
      setDialogMode('single');
    }

    // Test payload — chat mode first message or act mode
    if (caseConfig.test_mode === 'chat') {
      const firstMsg = caseConfig.chat_config?.messages?.[0];
      if (firstMsg?.content) {
        setCustomTestPayload(firstMsg.content);
      }
      if (firstMsg?.files?.length > 0) {
        setPayloadFiles(firstMsg.files);
      }
    } else if (caseConfig.test_mode === 'act') {
      setCustomTestPayload('[interactive session]');
    }

    // File parsing config → MCP parsers
    if (caseConfig.file_parsing) {
      setMcpParsers(caseConfig.file_parsing);
    }

    // LLM Judger config (standalone, applies to all modes)
    if (caseConfig.llm_judger) {
      const j = caseConfig.llm_judger;
      setJudgeConfig({
        model: j.model_id || null,
        systemPrompt: j.judge_prompt || '',
        agent_id: j.agent_id || null,
      });
    }

    // Act config — only apply the selected environment type
    if (caseConfig.test_mode === 'act') {
      const ic = caseConfig.act_config;
      const envType = ic?.environment_type;

      if (envType === 'tool_sandbox' && ic.tool_sandbox) {
        setSandboxEnabled(true);
        if (ic.tool_sandbox.image) setSandboxImage(ic.tool_sandbox.image);
        if (ic.tool_sandbox.enabled_tools) {
          setToolsEnabled(true);
          setEnabledTools(ic.tool_sandbox.enabled_tools);
        }
      }

      if (envType === 'rag_data' && ic.rag_data) {
        setRagEnabled(true);
        setRagMode(ic.rag_data.mode === 'document' ? 'real' : 'mock');
        if (ic.rag_data.knowledge) setRagKnowledge(ic.rag_data.knowledge);
        if (ic.rag_data.documents) setRagDocuments(ic.rag_data.documents);
      }

      if (envType === 'mcp_connection' && ic.mcp_connection) {
        const servers = ic.mcp_connection.servers || {};
        const hasEnabled = Object.values(servers).some((s) => s?.enabled);
        if (hasEnabled) {
          setMcpServerEnabled(true);
          setMcpServerConfigs(servers);
          if (ic.mcp_connection.selected_server) {
            setSelectedMcpServer(ic.mcp_connection.selected_server);
          }
        }
      }

      if (envType === 'simulation' && ic.simulation?.engine) {
        setSimEngine(ic.simulation.engine);
      }
    }

    // Clear conversation state for fresh run
    setMessages([]);
    setLogs([]);
    setToolCallHistory([]);
    setApiStatus('idle');
    setRealResponse('');
    setLastTestResult(null);
  }, [
    setSelectedAgentId, setSelectedModel, setLlmTemperature, setLlmMaxTokens, setLlmTopP,
    setThinkingEnabled, setThinkingBudget, setCustomSystemPrompt, setCustomTestPayload,
    setDialogMode, setPayloadFiles, setMcpParsers,
    setToolsEnabled, setEnabledTools,
    setSandboxEnabled, setSandboxImage,
    setRagEnabled, setRagMode, setRagKnowledge, setRagDocuments,
    setMcpServerEnabled, setMcpServerConfigs, setSelectedMcpServer,
    setSimEngine, setJudgeConfig,
    setMessages, setLogs, setToolCallHistory, setApiStatus, setRealResponse, setLastTestResult,
  ]);

  // Datasets hook - 数据集管理
  const datasets = useDatasets();
  const {
    datasets: datasetList,
    filteredDatasets,
    selectedDataset,
    selectedCapabilities,
    isLoading: datasetsLoading,
    error: datasetsError,
    loadDatasets,
    loadDatasetDetail,
    exportDataset,
    removeDataset,
    importDatasetFromFile,
    importDatasetFromJSON,
    toggleCapability,
    clearCapabilityFilter,
    setSelectedDataset,
    formatSize,
    // 格式转换相关
    pendingConversion,
    isConverting,
    executeConversion,
    cancelConversion,
    // 错误处理
    clearError: clearDatasetsError,
  } = datasets;

  // 监听数据集错误并显示 toast
  useEffect(() => {
    if (datasetsError) {
      addToast(datasetsError, 'error');
      clearDatasetsError();
    }
  }, [datasetsError, addToast, clearDatasetsError]);

  // Warn before unload when there are unsaved changes
  useEffect(() => {
    const handler = (e) => {
      if (isEditingPayload || isEditingSystemPrompt || apiStatus === 'loading') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditingPayload, isEditingSystemPrompt, apiStatus]);

  // 数据集详情弹窗状态
  const [showDatasetDetail, setShowDatasetDetail] = useState(false);

  // 当前导入的测试用例（来自数据集）
  const [importedTestCase, setImportedTestCase] = useState(null);

  // 数据集相关操作
  const handleImportDataset = useCallback(async () => {
    const result = await importDatasetFromFile();
    if (result.saved) {
      addToast(t('toasts.datasetImportSuccess', { name: result.saved.meta?.name || t('labels.unnamed') }), 'success');
    } else if (result.needsConversion) {
      // pendingConversion 已设置，弹窗会自动显示
    }
    // 错误由 useEffect 监听 datasetsError 处理
  }, [importDatasetFromFile, addToast]);

  const handleExecuteConversion = useCallback(async () => {
    const result = await executeConversion();
    if (result) {
      addToast(t('toasts.formatConversionSuccess', { name: result.meta?.name || t('labels.unnamed') }), 'success');
    }
    // 错误由 useEffect 监听 datasetsError 处理
  }, [executeConversion, addToast]);

  const handleViewDataset = useCallback(async (datasetId) => {
    await loadDatasetDetail(datasetId);
    setShowDatasetDetail(true);
  }, [loadDatasetDetail]);

  const handleSelectCaseFromDataset = useCallback((dataset, caseItem) => {
    setImportedTestCase({
      dataset,
      case: caseItem,
    });
    setShowDatasetDetail(false);
    addToast(t('toasts.caseSelected', { name: caseItem.name || t('labels.unnamed') }), 'success');
  }, [addToast]);

  // 应用导入的测试用例配置到 UI 状态
  const applyImportedTestCase = useCallback(() => {
    if (!importedTestCase?.case) {
      addToast(t('toasts.noTestCaseSelected'), 'error');
      return false;
    }

    const testCase = importedTestCase.case;
    const input = testCase.input;

    if (!input) {
      addToast(t('toasts.testCaseMissingInput'), 'error');
      return false;
    }

    // 应用 LLM 配置
    if (input.llmConfig) {
      const llm = input.llmConfig;
      if (llm.modelId) {
        const modelExists = CONFIG.models.some(m => m.id === llm.modelId);
        if (modelExists) {
          setSelectedModel(llm.modelId);
        }
      }
      if (llm.temperature !== undefined) setLlmTemperature(llm.temperature);
      if (llm.maxTokens !== undefined) setLlmMaxTokens(llm.maxTokens);
      if (llm.topP !== undefined) setLlmTopP(llm.topP);
      if (llm.thinking) {
        setThinkingEnabled(llm.thinking.enabled || false);
        setThinkingBudget(llm.thinking.budgetTokens || 10000);
      }
    }

    // 应用系统提示词
    if (input.systemPrompt?.active) {
      setCustomSystemPrompt(input.systemPrompt.active);
    } else if (input.systemPrompt?.original) {
      setCustomSystemPrompt(input.systemPrompt.original);
    }

    // 应用 payload
    if (input.payload?.displayText) {
      setCustomTestPayload(input.payload.displayText);
    } else if (input.attack?.predefinedPayload?.display) {
      setCustomTestPayload(input.attack.predefinedPayload.display);
    }

    // 应用工具配置
    const tools = input.capabilities?.toolCalling;
    if (tools) {
      setToolsEnabled(tools.enabled || false);
      if (tools.enabledTools) {
        setEnabledTools(tools.enabledTools);
      }
      if (tools.maxCalls) {
        setMaxToolCalls(tools.maxCalls);
      }
    } else {
      setToolsEnabled(false);
    }

    // 应用沙箱配置
    const sandbox = input.capabilities?.sandbox;
    if (sandbox) {
      setSandboxEnabled(sandbox.enabled || false);
      if (sandbox.image) {
        setSandboxImage(sandbox.image);
      }
    } else {
      setSandboxEnabled(false);
    }

    // 应用 RAG 配置
    const rag = input.capabilities?.rag;
    if (rag) {
      setRagEnabled(rag.enabled || false);
      setRagMode(rag.mode || 'mock');
      if (rag.mockKnowledge) {
        setRagKnowledge(rag.mockKnowledge);
      }
    } else {
      setRagEnabled(false);
    }

    // 应用 MCP 配置
    const mcp = input.capabilities?.mcp;
    if (mcp) {
      setMcpEnabled(mcp.parserEnabled || false);
      if (mcp.selectedParsers) {
        setMcpParsers(mcp.selectedParsers);
      }
      setMcpServerEnabled(mcp.serverEnabled || false);
      if (mcp.selectedServer) {
        setSelectedMcpServer(mcp.selectedServer);
      }
    } else {
      setMcpEnabled(false);
      setMcpServerEnabled(false);
    }

    // 清空消息和日志
    setMessages([]);
    setLogs([]);
    setToolCallHistory([]);
    setApiStatus('idle');
    setRealResponse('');
    setLastTestResult(null);

    addToast(t('toasts.caseConfigLoaded', { name: testCase.name || t('labels.unnamed') }), 'success');
    return true;
  }, [
    importedTestCase, addToast,
    setSelectedModel, setLlmTemperature, setLlmMaxTokens, setLlmTopP,
    setThinkingEnabled, setThinkingBudget, setCustomSystemPrompt, setCustomTestPayload,
    setToolsEnabled, setEnabledTools, setMaxToolCalls,
    setSandboxEnabled, setSandboxImage,
    setRagEnabled, setRagMode, setRagKnowledge,
    setMcpEnabled, setMcpParsers, setMcpServerEnabled, setSelectedMcpServer,
    setMessages, setLogs, setToolCallHistory, setApiStatus, setRealResponse, setLastTestResult,
  ]);

  const handleExportCaseFromDataset = useCallback(async (caseId) => {
    if (selectedDataset) {
      await datasets.exportCase(selectedDataset.id || selectedDataset.meta?.datasetId, caseId);
    }
  }, [selectedDataset, datasets]);

  // 下载数据集模板
  const handleDownloadTemplate = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/templates/dataset-template.json';
    link.download = 'dataset-template.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(t('toasts.templateDownloading'), 'info');
  }, [addToast]);

  // ========== 导入/导出测试功能 ==========

  // 导出当前测试配置
  const exportCurrentTest = useCallback(async () => {
    try {
      const tScenario = translatedScenario || currentScenario;
      const tAttack = translatedAttack || currentAttack;
      const input = await buildTestInput({
        // 场景信息
        capabilityLevel: expanded.type,
        scenarioKey: selectedAttack.scenario,
        attackIndex: selectedAttack.index,
        scenario: tScenario,
        attack: tAttack,
        // LLM 配置
        selectedModel,
        modelName: CONFIG.models.find(m => m.id === selectedModel)?.name,
        llmTemperature,
        llmMaxTokens,
        llmTopP,
        thinkingEnabled,
        thinkingBudget,
        // 系统提示词
        originalSystemPrompt: tScenario?.systemPrompt,
        customSystemPrompt,
        // Payload
        payloadSource: customTestPayload !== tAttack?.testPayload ? 'custom_text' : 'predefined',
        displayPayload: customTestPayload || tAttack?.testPayload,
        actualPayload: customTestPayload || tAttack?.realTestPayload || tAttack?.testPayload,
        payloadFile: payloadFiles[0] || null,
        // 能力配置
        toolsEnabled,
        enabledTools,
        maxToolCalls,
        sandboxEnabled,
        sandboxImage,
        ragEnabled,
        ragMode,
        ragKnowledge,
        mcpEnabled,
        mcpParsers,
        mcpServerEnabled,
        selectedMcpServer,
      });

      const filename = `test-input-${tAttack?.name || 'case'}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadAsJSON(input, filename);
      addToast(t('toasts.testConfigExported'), 'success');
    } catch (error) {
      console.error('Export failed:', error);
      addToast(t('toasts.exportFailed', { message: error.message }), 'error');
    }
  }, [
    expanded.type, selectedAttack, currentScenario, currentAttack, translatedScenario, translatedAttack,
    selectedModel, llmTemperature, llmMaxTokens, llmTopP, thinkingEnabled, thinkingBudget,
    customSystemPrompt, customTestPayload, payloadFiles,
    toolsEnabled, enabledTools, maxToolCalls,
    sandboxEnabled, sandboxImage, ragEnabled, ragMode, ragKnowledge,
    mcpEnabled, mcpParsers, mcpServerEnabled, selectedMcpServer, addToast,
  ]);

  // 从文件导入测试
  const importTestFromFile = useCallback(async () => {
    try {
      const data = await importFromFileDialog();
      if (!data) return;

      const { version, type } = detectSchemaVersion(data);

      // 根据类型处理
      if (type === 'Dataset') {
        // 导入数据集
        await importDatasetFromJSON(data);
        addToast(t('toasts.datasetImported', { name: data.meta?.name || t('labels.unnamed'), count: data.cases?.length || 0 }), 'success');
        setActiveTab('risk-items');
      } else if (type === 'TestCase' || type === 'TestInput' || version === '1.0.0') {
        // 导入单个测试用例
        const testCase = type === 'TestInput' ? { input: data, criteria: {} } : data;
        setImportedTestCase({ dataset: null, case: testCase });
        addToast(t('toasts.testCaseImported'), 'success');
      } else if (type === 'PlaybackSequence' || type === 'RecordingSession') {
        // 导入录制数据 - 进入回放模式
        await startPlayback(data);
        addToast(t('toasts.recordingDataLoaded'), 'success');
      } else {
        addToast(t('toasts.unknownFileFormat'), 'error');
      }
    } catch (error) {
      console.error('Import failed:', error);
      addToast(t('toasts.importFailed', { message: error.message }), 'error');
    }
  }, [importDatasetFromJSON, addToast, setActiveTab, startPlayback]);

  // 开始录制
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setLastRecording(null);
    // 清空状态
    setMessages([]);
    setLogs([]);
    setToolCallHistory([]);
    setApiStatus('idle');
    setRealResponse('');
    setLastTestResult(null);
    addToast(t('toasts.recordingStarted'), 'info');
  }, [addToast, t]);

  // 停止录制并生成录制结果
  const stopRecording = useCallback(async () => {
    if (!isRecording) return null;

    setIsRecording(false);

    // 构建录制会话
    const recording = await buildRecordingSession({
      caseId: importedTestCase?.case?.id || `recording-${Date.now()}`,
      states: [{
        timestamp: new Date(recordingStartTime).toISOString(),
        phase: 'completed',
        ui: {
          messages: [...messages],
          logs: [...logs],
        },
        toolCalls: {
          history: [...toolCallHistory],
        },
        result: {
          response: realResponse,
          judgment: lastTestResult?.judgment,
        },
      }],
      result: {
        status: ['high', 'medium'].includes(lastTestResult?.judgment?.riskLevel) ? 'success' : 'completed',
        finalResponse: realResponse,
        judgment: lastTestResult?.judgment,
        timing: {
          totalMs: Date.now() - recordingStartTime,
        },
      },
      startedAt: new Date(recordingStartTime).toISOString(),
      completedAt: new Date().toISOString(),
    });

    setLastRecording(recording);
    addToast(t('toasts.recordingCompleted'), 'success');
    return recording;
  }, [isRecording, recordingStartTime, messages, logs, toolCallHistory, realResponse, lastTestResult, importedTestCase, addToast]);

  // 保存录制结果
  const saveRecordingToFile = useCallback(async (name) => {
    if (!lastRecording) {
      addToast(t('toasts.noRecordingToSave'), 'error');
      return;
    }

    try {
      // 构建完整测试用例（包含录制）
      const tScn = translatedScenario || currentScenario;
      const tAtk = translatedAttack || currentAttack;
      const testCase = createStandaloneTestCase({
        name: name || `${t('toasts.testPrefix')}-${new Date().toISOString().slice(0, 10)}`,
        capability: expanded.type,
        input: await buildTestInput({
          capabilityLevel: expanded.type,
          scenarioKey: selectedAttack.scenario,
          attackIndex: selectedAttack.index,
          scenario: tScn,
          attack: tAtk,
          selectedModel,
          modelName: CONFIG.models.find(m => m.id === selectedModel)?.name,
          llmTemperature, llmMaxTokens, llmTopP, thinkingEnabled, thinkingBudget,
          originalSystemPrompt: tScn?.systemPrompt,
          customSystemPrompt,
          payloadSource: 'custom_text',
          displayPayload: customTestPayload || tAtk?.testPayload,
          actualPayload: customTestPayload || tAtk?.realTestPayload || tAtk?.testPayload,
          toolsEnabled, enabledTools, maxToolCalls,
          sandboxEnabled, sandboxImage, ragEnabled, ragMode, ragKnowledge,
          mcpEnabled, mcpParsers, mcpServerEnabled, selectedMcpServer,
        }),
        criteria: {
          expectedBehavior: tAtk?.description || '',
          riskLevelConditions: {
            high: t('toasts.riskConditionHigh'),
            medium: t('toasts.riskConditionMedium'),
            low: t('toasts.riskConditionLow'),
            safe: t('toasts.riskConditionSafe'),
          },
        },
        recording: lastRecording,
      });

      const filename = `test-recording-${name || 'case'}-${new Date().toISOString().slice(0, 10)}.json`;
      downloadAsJSON(testCase, filename);
      addToast(t('toasts.testRecordingSaved'), 'success');
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Save failed:', error);
      addToast(t('errors.saveFailed', { message: error.message }), 'error');
    }
  }, [
    lastRecording, expanded.type, selectedAttack, currentScenario, currentAttack,
    translatedScenario, translatedAttack,
    selectedModel, llmTemperature, llmMaxTokens, llmTopP, thinkingEnabled, thinkingBudget,
    customSystemPrompt, customTestPayload, toolsEnabled, enabledTools, maxToolCalls,
    sandboxEnabled, sandboxImage, ragEnabled, ragMode, ragKnowledge,
    mcpEnabled, mcpParsers, mcpServerEnabled, selectedMcpServer, addToast,
  ]);

  // 自动滚动
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typingMsg]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  // 单轮测试完成后自动停止录制
  useEffect(() => {
    if (dialogMode === 'single' && isRecording && (apiStatus === 'success' || apiStatus === 'error')) {
      // 延迟一下确保状态更新完成
      const timer = setTimeout(() => {
        stopRecording();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dialogMode, isRecording, apiStatus, stopRecording]);

  // 点击外部关闭导入菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showImportMenu && !e.target.closest('.relative')) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showImportMenu]);

  // API 请求计时器
  useEffect(() => {
    if (apiStatus === 'loading') {
      // 开始计时 - 使用本地变量捕获开始时间
      const startTime = Date.now();
      setApiStartTime(startTime);
      setApiElapsedTime(0);

      // 每 100ms 更新一次显示时间
      const interval = setInterval(() => {
        setApiElapsedTime(Date.now() - startTime);
      }, 100);

      return () => clearInterval(interval);
    } else {
      // 请求结束，重置计时器
      setApiStartTime(null);
      setApiElapsedTime(0);
    }
  }, [apiStatus]);

  // 加载恶意文档说明文件
  useEffect(() => {
    if (!currentAttack) return;
    if (currentAttack.documentReadme) {
      fetch(currentAttack.documentReadme)
        .then(res => res.text())
        .then(setDocumentReadme)
        .catch(() => setDocumentReadme(''));
    } else {
      setDocumentReadme('');
    }
  }, [currentAttack]);

  // Track the last "default" values set by translation, so we can detect user edits
  // even across language changes.
  const lastDefaultPromptRef = useRef('');
  const lastDefaultPayloadRef = useRef('');

  // 切换时重置
  useEffect(() => {
    if (!selectedAttack || !currentScenario || !currentAttack) return;
    abortRef.current = true;
    setMessages([]);
    setLogs([]);
    setExpandedLogs(new Set());
    setTypingMsg(null);
    setIsPlaying(false);
    setRealResponse('');
    setApiStatus('idle');
    setApiError('');
    // 切换场景时重置系统提示词为默认值（使用翻译版本）
    const newPrompt = (translatedScenario || currentScenario).systemPrompt || '';
    setCustomSystemPrompt(newPrompt);
    lastDefaultPromptRef.current = newPrompt;
    // 切换场景时重置测试 payload 为默认值（使用翻译版本）
    const newPayload = (translatedAttack || currentAttack).testPayload || '';
    setCustomTestPayload(newPayload);
    lastDefaultPayloadRef.current = newPayload;
    setIsEditingPayload(false);
    // 重置添加的文件
    setPayloadFiles([]);

    // 场景切换时自动启用所需工具
    if (currentScenario.requiredTools && currentScenario.requiredTools.length > 0) {
      const newEnabledTools = { ...enabledTools };
      currentScenario.requiredTools.forEach(toolName => {
        if (CONFIG.tools.available[toolName]) {
          newEnabledTools[toolName] = true;
        }
      });
      setEnabledTools(newEnabledTools);
    }

  }, [selectedAttack]);

  // When translation namespace finishes loading (or language changes),
  // update the system prompt and test payload if the user hasn't customized them.
  useEffect(() => {
    if (!selectedAttack || !translatedScenario || !translatedAttack) return;
    const newPrompt = translatedScenario.systemPrompt || '';
    const newPayload = translatedAttack.testPayload || '';
    // Update if value matches the raw default, last set default, or is empty
    if (
      customSystemPrompt === currentScenario?.systemPrompt ||
      customSystemPrompt === lastDefaultPromptRef.current ||
      customSystemPrompt === ''
    ) {
      setCustomSystemPrompt(newPrompt);
      lastDefaultPromptRef.current = newPrompt;
    }
    if (
      customTestPayload === currentAttack?.testPayload ||
      customTestPayload === lastDefaultPayloadRef.current ||
      customTestPayload === ''
    ) {
      setCustomTestPayload(newPayload);
      lastDefaultPayloadRef.current = newPayload;
    }
  }, [translatedScenario, translatedAttack]);

  // 获取显示的 Payload（文件名 + 用户输入）
  const getDisplayPayload = () => {
    if (payloadFiles.length === 0) return customTestPayload;
    const fileNames = payloadFiles.map(f => `📎 ${f.name}`).join('\n');
    return `${fileNames}\n\n${customTestPayload}`;
  };

  // 获取实际发送的 Payload（文件内容 + 用户输入）
  const getActualPayload = () => {
    if (payloadFiles.length === 0) return customTestPayload;
    const fileContents = payloadFiles.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n');
    return `${fileContents}\n\n${customTestPayload}`;
  };

  // 构建 thinking 配置
  const buildThinkingConfig = () => {
    if (!thinkingEnabled) return null;
    return { type: 'enabled', budget_tokens: thinkingBudget };
  };

  // 追加 API 交互到最后一条记录
  const appendApiInteraction = (requestInfo, responseRaw) => {
    setApiInteractions(prev => {
      const newList = [...prev];
      for (let i = newList.length - 1; i >= 0; i--) {
        if (newList[i].isStreaming) {
          newList[i] = {
            ...newList[i],
            interactions: [...newList[i].interactions, { request: requestInfo, response: responseRaw }]
          };
          break;
        }
      }
      return newList;
    });
  };

  // 标记 API 交互记录完成
  const finalizeApiInteraction = () => {
    setApiInteractions(prev => {
      const newList = [...prev];
      for (let i = newList.length - 1; i >= 0; i--) {
        if (newList[i].isStreaming) {
          newList[i] = { ...newList[i], isStreaming: false };
          break;
        }
      }
      return newList;
    });
  };

  // Real test hook
  const { runRealTest } = useRealTest({
    currentAttack: translatedAttack || currentAttack,
    currentScenario: translatedScenario || currentScenario,
    setApiStatus, setApiError, setRealResponse, setMessages, setLogs, setExpandedLogs,
    setTestRecords, setExpandedRecords, thinkingIndexRef,
    setThinkingEntries, setApiInteractions, setExpandedThinking, setExpandedApiInteraction,
    setLeftPanelTab, payloadFiles, customTestPayload,
    getActualPayload, getDisplayPayload,
    selectedModel, selectedAgentId, customSystemPrompt,
    ragEnabled, ragMode, ragKnowledge, ragServiceAvailable,
    performRagQuery, formatRAGContext, formatRAGLogs,
    toolsEnabled, sandboxStatus, enabledTools,
    llmTemperature, llmMaxTokens, llmTopP, maxToolCalls,
    sandboxClient, mcpClient, mcpServerConfigs,
    getFileTypeForMcp, mcpParsers,
    addTestRecord, addResponseRecord,
    setLastTestResult, judgeConfig,
  });

  // Conversation engine hook
  const { startConversation, sendUserMessage, stopConversation } = useConversationEngine({
    currentAttack: translatedAttack || currentAttack,
    currentScenario: translatedScenario || currentScenario,
    setApiStatus, setApiError, setRealResponse, setMessages, setLogs, setExpandedLogs,
    setConversationHistory, setConversationMode, conversationHistory,
    setTestRecords, setExpandedRecords, thinkingIndexRef,
    setThinkingEntries, setApiInteractions, setExpandedThinking, setExpandedApiInteraction,
    setLeftPanelTab, payloadFiles, customTestPayload,
    getActualPayload, getDisplayPayload, setInitialPayload, initialPayload,
    selectedModel, selectedAgentId, customSystemPrompt,
    ragEnabled, ragMode, ragKnowledge, ragServiceAvailable,
    performRagQuery, formatRAGContext, formatRAGLogs,
    toolsEnabled, sandboxStatus, enabledTools,
    buildThinkingConfig,
    llmTemperature, llmMaxTokens, llmTopP,
    appendApiInteraction, finalizeApiInteraction,
    sandboxClient, mcpClient, mcpServerConfigs,
    getFileTypeForMcp, mcpParsers,
    addTestRecord, startThinkingRecord, finalizeThinkingRecord, addResponseRecord,
    userInput, setUserInput, apiStatus,
    setLastTestResult, judgeConfig,
  });

  // 加载已保存的测试结果列表
  const loadSavedTestResults = async () => {
    try {
      const results = await listTestResults();
      setSavedTestResults(results);
    } catch (err) {
      console.error('Load test results failed:', err);
    }
  };

  // Batch test hook
  const {
    batchTestQueue, batchTestIndex, batchTestResults, setBatchTestResults,
    batchTestPaused, isBatchTesting,
    handleStartBatchTest, toggleBatchTestPause, cancelBatchTest,
    exportBatchTestReport, saveBatchTestToServer,
  } = useBatchTest({
    selectedModel, judgeConfig,
    thinkingEnabled, thinkingBudget,
    llmTemperature, llmMaxTokens, llmTopP,
    setApiStatus, setApiError, setRealResponse, setMessages, setLogs,
    setExpandedLogs, setExpandedRecords,
    thinkingIndexRef,
    setThinkingEntries, setApiInteractions,
    setExpandedThinking, setExpandedApiInteraction,
    setLeftPanelTab, setTestRecords,
    setCustomSystemPrompt, setCustomTestPayload,
    addTestRecord, updateTestRecord, removeTestRecord,
    addToast, loadSavedTestResults,
  });

  // 查看测试结果详情
  const viewTestResultDetail = async (resultId) => {
    try {
      const detail = await getTestResult(resultId);
      setSelectedTestResult(detail);
      // 保持在 test-results 视图，只更新选中的详情
    } catch (err) {
      addToast(t('toasts.loadFailed', { message: err.message }), 'error');
    }
  };

  // 删除测试结果
  const handleDeleteTestResult = async (resultId) => {
    if (!confirm(t('toasts.confirmDeleteTestResult'))) return;
    try {
      await deleteTestResult(resultId);
      addToast(t('toasts.deleted'), 'success');
      loadSavedTestResults();
      if (selectedTestResult?.id === resultId) {
        setSelectedTestResult(null);
      }
    } catch (err) {
      addToast(t('errors.deleteFailed', { message: err.message }), 'error');
    }
  };

  // 删除单条测试用例
  const handleDeleteTestCase = async (caseIndex) => {
    if (!selectedTestResult?.id) return;
    if (!confirm(t('toasts.confirmDeleteCase'))) return;
    try {
      const result = await deleteTestCase(selectedTestResult.id, caseIndex);
      setSelectedTestResult(result.data);
      addToast(t('toasts.caseDeleted'), 'success');
    } catch (err) {
      addToast(t('errors.deleteFailed', { message: err.message }), 'error');
    }
  };

  // 打开详情弹窗
  const openDetailModal = (caseData) => {
    setDetailModalCase(caseData);
  };

  // 打开评审弹窗
  const openReviewModal = (caseData) => {
    setReviewModalCase(caseData);
  };

  // 保存用例评审
  const handleSaveCaseReview = async (caseIndex, review) => {
    if (!selectedTestResult?.id) return;
    try {
      const result = await updateCaseReview(selectedTestResult.id, caseIndex, review);
      setSelectedTestResult(result.data);
      setReviewModalCase(null);
      addToast(t('toasts.reviewSaved'), 'success');
    } catch (err) {
      addToast(t('errors.saveFailed', { message: err.message }), 'error');
    }
  };

  // LLM 评审单条用例
  const handleLLMReviewCase = async (caseData) => {
    if (!selectedTestResult?.id) return;
    setLlmReviewLoading(true);
    try {
      // 构建评审 prompt
      const prompt = CONFIG.fiveLevelJudgePrompt
        .replace(/\{\{attackName\}\}/g, caseData.caseName || '')
        .replace(/\{\{attackType\}\}/g, caseData.attackType || '')
        .replace(/\{\{attackDescription\}\}/g, caseData.attackDescription || '')
        .replace(/\{\{systemPrompt\}\}/g, caseData.input?.systemPrompt || '')
        .replace(/\{\{payload\}\}/g, caseData.input?.payload || '')
        .replace(/\{\{response\}\}/g, caseData.execution?.response || caseData.response || '');

      const response = await CONFIG.callModel(
        [{ role: 'user', content: prompt }],
        t('toasts.judgeSystemPrompt'),
        CONFIG.judgeModel
      );

      // 解析 JSON 结果
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const reviewResult = JSON.parse(jsonMatch[0]);
        return {
          type: 'llm',
          riskLevel: reviewResult.riskLevel || 'pending',
          reason: reviewResult.reason || t('toasts.noReason'),
        };
      }
      throw new Error(t('toasts.cannotParseReview'));
    } catch (err) {
      addToast(t('toasts.llmReviewFailed', { message: err.message }), 'error');
      return null;
    } finally {
      setLlmReviewLoading(false);
    }
  };

  // 保存报告内容
  const handleSaveReport = async () => {
    if (!selectedTestResult?.id) return;
    setReportSaving(true);
    try {
      const result = await updateReport(selectedTestResult.id, reportContent, 'human');
      setSelectedTestResult(result.data);
      addToast(t('toasts.reportSaved'), 'success');
    } catch (err) {
      addToast(t('errors.saveFailed', { message: err.message }), 'error');
    } finally {
      setReportSaving(false);
    }
  };

  // LLM 生成/优化报告
  const handleLLMGenerateReport = async (instruction) => {
    if (!selectedTestResult) return;
    setReportSaving(true);
    try {
      // 计算统计数据
      const stats = calculateRiskStats(selectedTestResult.results);

      // 构建 prompt
      const pct = (n) => stats.total > 0 ? ((n / stats.total) * 100).toFixed(1) : 0;
      const unknown = t('labels.unknown');
      const prompt = `${t('toasts.reportPromptIntro')}

## ${t('toasts.reportPromptUserInstruction')}
${instruction || t('toasts.reportPromptDefaultInstruction')}

## ${t('toasts.reportPromptTestData')}
- ${t('toasts.reportPromptTestModel')}: ${selectedTestResult.meta?.testModel || unknown}
- ${t('toasts.reportPromptTestDate')}: ${selectedTestResult.savedAt || unknown}
- ${t('toasts.reportPromptTotalCases')}: ${stats.total}
- ${FIVE_LEVEL_RISK.high.label}: ${stats.high} (${pct(stats.high)}%)
- ${FIVE_LEVEL_RISK.medium.label}: ${stats.medium} (${pct(stats.medium)}%)
- ${FIVE_LEVEL_RISK.low.label}: ${stats.low} (${pct(stats.low)}%)
- ${FIVE_LEVEL_RISK.safe.label}: ${stats.safe} (${pct(stats.safe)}%)
- ${FIVE_LEVEL_RISK.pending.label}: ${stats.pending} (${pct(stats.pending)}%)

## ${t('toasts.reportPromptDetailedCases')}
${selectedTestResult.results?.map((r, i) => {
  const level = r.riskLevel || 'pending';
  return `### ${t('toasts.reportPromptCaseN', { n: i + 1 })}: ${r.caseName || t('labels.unnamed')}
- ${t('toasts.reportPromptRiskLevel')}: ${FIVE_LEVEL_RISK[level]?.label || level}
- ${t('toasts.reportPromptAttackType')}: ${r.attackType || unknown}
- ${t('toasts.reportPromptJudgmentReason')}: ${r.judgment?.reason || r.review?.llm?.reason || r.review?.human?.reason || t('labels.none')}`;
}).join('\n\n')}

${reportContent ? `## ${t('toasts.reportPromptCurrentContent')}\n${reportContent}` : ''}

${t('toasts.reportPromptOutputMarkdown')}`;

      const response = await CONFIG.callModel(
        [{ role: 'user', content: prompt }],
        t('toasts.reportSystemPrompt'),
        CONFIG.judgeModel
      );

      setReportContent(response.content);

      // 保存到后端
      const result = await updateReport(selectedTestResult.id, response.content, 'llm');
      setSelectedTestResult(result.data);
      addToast(t('toasts.reportGenerated'), 'success');
    } catch (err) {
      addToast(t('toasts.generateFailed', { message: err.message }), 'error');
    } finally {
      setReportSaving(false);
    }
  };

  // 加载报告模板列表
  const loadReportTemplates = async () => {
    try {
      const templates = await listReportTemplates();
      setReportTemplates(templates);
    } catch (err) {
      console.error('Load report templates failed:', err);
    }
  };

  // 应用报告模板
  const applyReportTemplate = async (templateId) => {
    try {
      const template = await getReportTemplate(templateId);
      if (!selectedTestResult) return;

      // 计算统计数据
      const stats = calculateRiskStats(selectedTestResult.results);
      const total = stats.total || 1;

      // 替换模板变量
      let content = template.content
        .replace(/\{\{date\}\}/g, selectedTestResult.savedAt ? new Date(selectedTestResult.savedAt).toLocaleDateString() : t('labels.unknown'))
        .replace(/\{\{testModel\}\}/g, selectedTestResult.meta?.testModel || t('labels.unknown'))
        .replace(/\{\{judgeModel\}\}/g, selectedTestResult.meta?.judgeModel || t('labels.unknown'))
        .replace(/\{\{total\}\}/g, stats.total)
        .replace(/\{\{high\}\}/g, stats.high)
        .replace(/\{\{medium\}\}/g, stats.medium)
        .replace(/\{\{low\}\}/g, stats.low)
        .replace(/\{\{safe\}\}/g, stats.safe)
        .replace(/\{\{pending\}\}/g, stats.pending)
        .replace(/\{\{highPercent\}\}/g, ((stats.high / total) * 100).toFixed(1))
        .replace(/\{\{mediumPercent\}\}/g, ((stats.medium / total) * 100).toFixed(1))
        .replace(/\{\{lowPercent\}\}/g, ((stats.low / total) * 100).toFixed(1))
        .replace(/\{\{safePercent\}\}/g, ((stats.safe / total) * 100).toFixed(1))
        .replace(/\{\{pendingPercent\}\}/g, ((stats.pending / total) * 100).toFixed(1));

      setReportContent(content);
      addToast(t('toasts.templateApplied'), 'success');
    } catch (err) {
      addToast(t('toasts.applyTemplateFailed', { message: err.message }), 'error');
    }
  };

  // 初始加载测试结果
  useEffect(() => {
    loadSavedTestResults();
    loadReportTemplates();
  }, []);

  // 当选中测试结果变化时，加载报告内容
  useEffect(() => {
    if (selectedTestResult) {
      setReportContent(selectedTestResult.report?.content || '');
    }
  }, [selectedTestResult?.id]);

  // 多轮对话中的文件上传处理
  const handleMultiRoundFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 简化处理：将文件作为文本添加到下一条消息
    let fileContents = [];

    for (const file of files) {
      try {
        // 尝试解析文件
        if (mcpEnabled) {
          const fileType = getFileTypeForMcp(file.name);
          if (fileType && mcpParsers[fileType]?.length > 0) {
            const result = await CONFIG.parseFileToText(file, mcpParsers[fileType]);
            if (result.content) {
              fileContents.push(`[${t('toasts.fileLabel')}: ${file.name}]\n${result.content}`);
              continue;
            }
          }
        }
        // 回退：读取为文本
        const text = await file.text();
        fileContents.push(`[${t('toasts.fileLabel')}: ${file.name}]\n${text}`);
      } catch (err) {
        console.error(`Read file ${file.name} failed:`, err);
        fileContents.push(`[${t('toasts.fileLabel')}: ${file.name}]\n(${t('toasts.readFailed')}: ${err.message})`);
      }
    }

    if (fileContents.length > 0) {
      setUserInput(prev => prev + (prev ? '\n\n' : '') + fileContents.join('\n\n'));
    }

    // 清空 file input
    e.target.value = '';
  };

  const selectAttack = async (scenarioKey, idx) => {
    const scenario = SCENARIOS[scenarioKey];
    const attack = scenario.attacks[idx];
    setSelectedAttack({ scenario: scenarioKey, index: scenario.attacks.findIndex(a => a.id === attack.id) });

    // 如果场景有预置文件且沙箱运行中，自动预置文件
    if (scenario.sandboxFiles && sandboxStatus === 'running') {
      // 先清除现有预置文件
      const existingPresetPaths = sandboxFiles.filter(f => f.preset).map(f => f.path);
      for (const path of existingPresetPaths) {
        await sandboxClient.runCommand(`rm -f "${path}"`);
      }
      setSandboxFiles(prev => prev.filter(f => !f.preset));

      // 预置新场景的文件
      await presetSandboxFiles(scenario.sandboxFiles);
    }
  };

  // 文件解析函数已移至 useFileParsing hook


  return (
    <div className="h-screen bg-canvas text-on-canvas flex text-sm overflow-hidden">
      {/* Toast 通知 */}
      <Toast toasts={toasts} removeToast={removeToast} />

      {/* 滚动条样式已移至 index.css */}

      {/* 左侧 Tab Bar */}
      <LeftSidebar
        activeTab={activeTab} setActiveTab={setActiveTab}
        appMode={appMode} setAppMode={setAppMode}
      />

      {/* 主内容区 - 按 tab 切换 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 配置 tab — v3 self-contained ConfigPage */}
        {activeTab === 'config' && (
          <ConfigPage setActiveTab={setActiveTab} caseId={editingCaseId} onApplyCaseConfig={applyCaseConfig} />
        )}

        {/* 运行 tab */}
        {activeTab === 'run' && (
          <RunPage
            appMode={appMode}
            chatRef={chatRef} logRef={logRef}
            simulator={simulator}
            thinkingEnabled={thinkingEnabled}
            sandboxStatus={sandboxStatus}
            toolCallHistory={toolCallHistory}
            playbackBar={{
              isPlaybackMode, playbackCase,
              isPlaybackPlaying, isPlaybackPaused,
              playbackProgress, playbackTotal,
              pausePlayback, resumePlayback, stopPlayback, skipToEnd,
              startPlayback, exitPlayback,
            }}
            attackHeader={{
              currentAttack: translatedAttack || currentAttack,
              currentScenario: translatedScenario || currentScenario,
              isPlaying, apiStatus, apiElapsedTime,
              attackType, riskLevel, isPlaybackMode,
              isBatchTesting, batchTestIndex, batchTestQueue,
            }}
            attackDetail={{
              currentAttack: translatedAttack || currentAttack,
              showDocument, setShowDocument,
              docTab, setDocTab,
              documentReadme,
            }}
            testControl={{
              // Read-only summary
              providers, selectedProviderId, selectedModel,
              mcpEnabled, mcpParserServiceAvailable, isParsingFile,
              toolsEnabled, sandboxStatus, enabledTools,
              ragEnabled, ragKnowledge,
              mcpServerEnabled, mcpServerConfigs,
              thinkingEnabled,
              simEngine,
              // Batch test
              isBatchTesting, batchTestIndex,
              batchTestQueue, batchTestResults,
              batchTestPaused, toggleBatchTestPause,
              cancelBatchTest, exportBatchTestReport,
              saveBatchTestToServer, setBatchTestResults,
              // Import/export
              showImportMenu, setShowImportMenu,
              importTestFromFile: importFromFile, setShowBatchTestModal,
              handleDownloadTemplate, exportCurrentTest: exportCurrentCase,
              // Recording & execution
              lastRecording, setLastRecording,
              isRecording, startRecording,
              stopRecording, stopConversation,
              dialogMode, conversationMode, startConversation,
              runRealTest, apiStatus, apiElapsedTime,
              setShowSaveDialog, startPlayback,
              setMessages, setLogs,
              // Error
              apiError,
              // Current attack (for disable logic)
              currentAttack: translatedAttack || currentAttack,
              customTestPayload,
            }}
            conversationPanel={{
              leftPanelTab, setLeftPanelTab,
              selectedModel, messages,
              typingMsg, dialogMode, conversationMode,
              apiStatus, userInput, setUserInput,
              sendUserMessage, handleMultiRoundFileUpload,
              isPlaybackMode,
              thinkingEntries, setThinkingEntries,
              expandedThinking, setExpandedThinking,
              thinkingIndexRef,
              apiInteractions, setApiInteractions,
              expandedApiInteraction, setExpandedApiInteraction,
            }}
            rightPanel={{
              rightPanelTab, setRightPanelTab,
              rightSubTab, setRightSubTab,
              testRecords, setTestRecords,
              expandedRecords, setExpandedRecords,
              thinkingIndexRef,
              setAnnotationModal, removeAnnotation,
              setLeftPanelTab, setExpandedThinking,
              chatRef,
              judgeConfig, setJudgeConfig,
              humanJudgment, setHumanJudgment,
              submitHumanJudgment,
            }}
          />
        )}

        {/* 报告 tab */}
        {activeTab === 'report' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ReportEditorPage />
          </div>
        )}

        {/* 风险分类 tab */}
        {activeTab === 'risks' && (
          <div className="flex-1 overflow-y-auto custom-scroll">
            <RisksPage />
          </div>
        )}

        {/* 风险项 tab (legacy) */}
        {activeTab === 'risk-items' && (
          <RiskItemsPage
            appMode={appMode}
            attackSelection={attackSelection}
            selectAttack={selectAttack}
            datasets={datasets}
            importedTestCase={importedTestCase}
            setImportedTestCase={setImportedTestCase}
            handleImportDataset={handleImportDataset}
            handleViewDataset={handleViewDataset}
            handleSelectCaseFromDataset={handleSelectCaseFromDataset}
            handleDownloadTemplate={handleDownloadTemplate}
            applyImportedTestCase={applyImportedTestCase}
            setActiveTab={setActiveTab}
          />
        )}

        {/* 评测 tab */}
        {activeTab === 'eval' && (
          <div className="flex-1 overflow-y-auto custom-scroll">
            {/* Eval sub-navigation */}
            <EvalSubNav active={evalSubPage} onChange={page => { setEvalSubPage(page); setEvalContext({}); }} />

            {evalSubPage === 'agents' && (
              <AgentConfigPage onNavigate={evalNavigate} />
            )}
            {evalSubPage === 'eval-manage' && (
              <EvalManagePage onNavigate={evalNavigate} />
            )}
            {evalSubPage === 'eval-progress' && (
              <EvalProgressPage
                jobId={evalContext.jobId}
                onNavigate={evalNavigate}
              />
            )}
            {evalSubPage === 'eval-results' && (
              <EvalResultsPage
                onNavigate={evalNavigate}
              />
            )}
            {evalSubPage === 'eval-result-detail' && (
              <EvalResultDetailPage
                jobId={evalContext.jobId}
                onNavigate={evalNavigate}
              />
            )}
          </div>
        )}

        {/* 案例 tab */}
        {activeTab === 'cases' && (
          <div className="flex-1 overflow-y-auto custom-scroll">
            <CasesPage setActiveTab={setActiveTab} setEditingCaseId={setEditingCaseId} />
          </div>
        )}

        {/* 文件浏览器 Modal */}
        <FileTreeBrowser
          tag={fileTreeTag}
          isOpen={fileTreeOpen}
          onClose={closeFileTree}
          onDownload={downloadFileWithProgress}
          onUpload={openUploadDialog}
          startFileWatch={startFileWatch}
          stopFileWatch={stopFileWatch}
        />

        {/* 文件上传对话框 */}
        <FileUploadDialog
          isOpen={uploadDialogOpen}
          targetPath={uploadTargetPath}
          onClose={closeUploadDialog}
          onUpload={uploadFilesWithProgress}
        />

        {/* 文件传输进度条 */}
        {transferState && (
          <FileTransferProgress
            type={transferState.type}
            fileName={transferState.fileName}
            loaded={transferState.loaded}
            total={transferState.total}
            onCancel={cancelTransfer}
          />
        )}


        {/* 内联弹窗 - 已提取到 AppModals */}
        <AppModals
          pendingConversion={pendingConversion}
          isConverting={isConverting}
          cancelConversion={cancelConversion}
          handleExecuteConversion={handleExecuteConversion}
          judgeConfigOpen={judgeConfigOpen}
          setJudgeConfigOpen={setJudgeConfigOpen}
          judgeConfig={judgeConfig}
          setJudgeConfig={setJudgeConfig}
          annotationModal={annotationModal}
          setAnnotationModal={setAnnotationModal}
          newAnnotation={newAnnotation}
          setNewAnnotation={setNewAnnotation}
          requestLLMAnnotation={requestLLMAnnotation}
          addAnnotation={addAnnotation}
          showSaveDialog={showSaveDialog}
          setShowSaveDialog={setShowSaveDialog}
          currentAttack={translatedAttack || currentAttack}
          lastRecording={lastRecording}
          messages={messages}
          toolCallHistory={toolCallHistory}
          saveRecordingToFile={saveRecordingToFile}
          detailModalCase={detailModalCase}
          setDetailModalCase={setDetailModalCase}
          reviewModalCase={reviewModalCase}
          setReviewModalCase={setReviewModalCase}
          llmReviewLoading={llmReviewLoading}
          handleLLMReviewCase={handleLLMReviewCase}
          handleSaveCaseReview={handleSaveCaseReview}
        />


        {/* Toast 通知 */}
        <Toast toasts={toasts} removeToast={removeToast} />

        {/* LLM 供应商配置 */}
        <LLMProviderSettings
          open={providerSettingsOpen}
          onClose={() => { setProviderSettingsOpen(false); reloadProviders(); }}
        />
      </div>
    </div>
  );
}