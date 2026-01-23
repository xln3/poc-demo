import { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG, ATTACK_TYPES, RISK_LEVELS, LOG_TYPES } from './config';
import { SCENARIOS, SCENARIOS_BY_LEVEL, CapabilityLevelNames } from './scenarios/index.js';
import { sandboxClient, ToolType, TOOL_DESCRIPTIONS } from './sandbox.js';
import { ragClient, formatRAGContext, formatRAGLogs } from './rag.js';
import { saveCaseToServer, listSavedCases, getCaseDetail, deleteCase } from './caseApi.js';
import { mcpClient } from './mcp.js';
import { exportReport, exportHTML } from './utils/index.js';
import { useSandbox, TerminalImage, formatBytes, formatTimeAgo, useRAG, useCases, useMCP, useConversation, useLLMConfig, usePlayback } from './hooks/index.js';

// 能力层级图标
const LEVEL_ICONS = {
  'F1-conversation': '💬',
  'F2-file-injection': '📎',
  'F3-tool-use': '🔧',
  'F4-rag': '🔍',
  'F5-mcp': '🔌'
};

// 按能力层级重组数据
const getGroupedData = () => {
  const grouped = {};
  Object.entries(SCENARIOS_BY_LEVEL).forEach(([levelKey, scenarios]) => {
    const scenarioEntries = Object.entries(scenarios);
    if (scenarioEntries.length === 0) return; // 跳过空层级（如F5-mcp）

    grouped[levelKey] = {
      label: CapabilityLevelNames[levelKey],
      icon: LEVEL_ICONS[levelKey],
      scenarios: {}
    };

    scenarioEntries.forEach(([scenarioKey, scenario]) => {
      grouped[levelKey].scenarios[scenarioKey] = scenario;
    });
  });
  return grouped;
};

export default function App() {
  // 状态
  const [mode, setMode] = useState('real'); // 'mock' | 'real'
  const [selectedAttack, setSelectedAttack] = useState({ scenario: 'finbot', index: 0 });
  const [expanded, setExpanded] = useState({ type: 'F3-tool-use', scenario: 'finbot' });
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState(new Set()); // 跟踪展开的日志索引
  const [isPlaying, setIsPlaying] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [apiError, setApiError] = useState('');
  const [realResponse, setRealResponse] = useState('');
  const [selectedModel, setSelectedModel] = useState(CONFIG.models[0].id);
  const [documentReadme, setDocumentReadme] = useState('');
  const [showDocument, setShowDocument] = useState(true);
  const [docTab, setDocTab] = useState('principle'); // 'principle' | 'hiding' | 'tools' | 'readme' | 'parsing'
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [isEditingLlmConfig, setIsEditingLlmConfig] = useState(false);
  const [customTestPayload, setCustomTestPayload] = useState('');
  const [isEditingPayload, setIsEditingPayload] = useState(false);
  const [payloadFiles, setPayloadFiles] = useState([]);
  const [lastTestResult, setLastTestResult] = useState(null); // 存储最后一次测试结果

  // Thinking 面板状态
  const [thinkingContent, setThinkingContent] = useState('');
  const [rawApiResponse, setRawApiResponse] = useState(null);
  const [thinkingTab, setThinkingTab] = useState('thinking'); // 'thinking' | 'raw'

  // Log helper for hooks
  const addLog = useCallback((log) => {
    setLogs(prev => [...prev, log]);
  }, []);

  // Sandbox hook (multi-terminal)
  const sandbox = useSandbox({ addLog });
  const {
    // Multi-terminal state
    terminals, currentTag, setCurrentTag, newTerminalTag, setNewTerminalTag,
    newTerminalImage, setNewTerminalImage, deletedTerminals, deletedTotalSize,
    creatingTerminal, showCleanupConfirm, setShowCleanupConfirm,
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
    startContainer, stopContainer, isFileParserReady
  } = sandbox;

  // RAG hook
  const rag = useRAG({ addLog });
  const {
    ragEnabled, setRagEnabled, ragConfigCollapsed, setRagConfigCollapsed,
    ragKnowledge, setRagKnowledge, ragKnowledgeEdit, setRagKnowledgeEdit,
    ragMode, setRagMode, ragServiceAvailable, ragDocuments, setRagDocuments,
    ragQueryResults, setRagQueryResults, ragUploading, parserContainerAvailable,
    setParserContainerAvailable, refreshRagDocuments, handleRagUpload,
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
    mcpServerEnabled, setMcpServerEnabled, mcpServerConfigCollapsed, setMcpServerConfigCollapsed,
    selectedMcpServer, setSelectedMcpServer, mcpServerConfigs, setMcpServerConfigs,
    mcpServerStatus, setMcpServerStatus, getFileType, requiresDockerParsers, estimateParsingTime
  } = mcp;

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
  const [promptConfigCollapsed, setPromptConfigCollapsed] = useState(false);

  // API 请求计时器
  const [apiStartTime, setApiStartTime] = useState(null);
  const [apiElapsedTime, setApiElapsedTime] = useState(0);

  const chatRef = useRef(null);
  const logRef = useRef(null);
  const abortRef = useRef(false);

  const groupedData = getGroupedData();
  const currentScenario = SCENARIOS[selectedAttack.scenario];
  const currentAttack = currentScenario.attacks[selectedAttack.index];
  const attackType = ATTACK_TYPES[currentAttack.type];
  const riskLevel = RISK_LEVELS[currentAttack.level];

  // Cases hook - 需要在所有状态定义之后调用
  const cases = useCases({
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
    lastJudgment: lastTestResult?.judgment,
    apiTime: lastTestResult?.apiTime,
  });
  const {
    viewMode, setViewMode, savedCases, setSavedCases, selectedCase, setSelectedCase,
    isSaving, loadingSavedCases, saveToServer, exportCurrentCase, importFromFile,
    loadSavedCases, viewCaseDetail, handleDeleteCase
  } = cases;

  // Playback hook - 回放已保存的测试用例
  const playback = usePlayback({
    setMode,
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
    isPlaybackMode, playbackCase, isPlaying: isPlaybackPlaying,
    playbackProgress, playbackTotal,
    startPlayback, stopPlayback, exitPlayback, skipToEnd
  } = playback;

  // 自动滚动
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typingMsg]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

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
    if (currentAttack.documentReadme) {
      fetch(currentAttack.documentReadme)
        .then(res => res.text())
        .then(setDocumentReadme)
        .catch(() => setDocumentReadme(''));
    } else {
      setDocumentReadme('');
    }
  }, [currentAttack]);

  // 切换时重置
  useEffect(() => {
    abortRef.current = true;
    setMessages([]);
    setLogs([]);
    setExpandedLogs(new Set());
    setTypingMsg(null);
    setIsPlaying(false);
    setRealResponse('');
    setApiStatus('idle');
    setApiError('');
    // 切换场景时重置系统提示词为默认值
    setCustomSystemPrompt(currentScenario.systemPrompt || '');
    setIsEditingLlmConfig(false);
    // 切换场景时重置测试 payload 为默认值
    setCustomTestPayload(currentAttack.testPayload || '');
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

    if (mode === 'mock') {
      const timer = setTimeout(() => {
        abortRef.current = false;
        playMockAttack();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedAttack, mode]);

  // Mock 模式播放
  const playMockAttack = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    const attack = SCENARIOS[selectedAttack.scenario].attacks[selectedAttack.index];
    let logIdx = 0;
    const logsPerMsg = Math.ceil(attack.logs.length / attack.conversations.length);

    for (const conv of attack.conversations) {
      if (abortRef.current) break;
      
      for (let i = 0; i <= conv.content.length; i++) {
        if (abortRef.current) break;
        setTypingMsg({ ...conv, content: conv.content.slice(0, i) });
        await new Promise(r => setTimeout(r, CONFIG.typingSpeed));
      }
      if (abortRef.current) break;
      
      setTypingMsg(null);
      setMessages(prev => [...prev, conv]);
      
      const logsToAdd = attack.logs.slice(logIdx, logIdx + logsPerMsg);
      for (const log of logsToAdd) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, CONFIG.logDelay));
        setLogs(prev => [...prev, log]);
      }
      logIdx += logsPerMsg;
      await new Promise(r => setTimeout(r, CONFIG.stepDelay));
    }
    
    while (logIdx < attack.logs.length && !abortRef.current) {
      await new Promise(r => setTimeout(r, CONFIG.logDelay));
      setLogs(prev => [...prev, attack.logs[logIdx]]);
      logIdx++;
    }
    setIsPlaying(false);
  };

  // 真实 API 测试
  const runRealTest = async () => {
    const attack = currentAttack;
    const scenario = currentScenario;

    setApiStatus('loading');
    setApiError('');
    setRealResponse('');
    setMessages([]);
    setLogs([]);
    setExpandedLogs(new Set());

    // 重置 thinking 面板
    setThinkingContent('');
    setRawApiResponse(null);
    setThinkingTab('thinking');

    // 构建实际发送的 payload
    // 优先级：用户添加的文件 + 自定义 payload > 攻击的 realTestPayload > 攻击的 testPayload
    let actualPayload;
    const hasUserFiles = payloadFiles.length > 0;
    const hasCustomPayload = customTestPayload !== currentAttack.testPayload;

    if (hasUserFiles || hasCustomPayload) {
      // 用户有自定义内容，发送实际文件内容（模拟文档解析后的文本注入）
      actualPayload = getActualPayload();
    } else {
      // 使用攻击原有的 payload
      actualPayload = attack.realTestPayload || attack.testPayload;
    }
    const hasFileContent = !!attack.realTestPayload || hasUserFiles;

    // 判断用户是否有自定义内容
    const hasUserCustomization = hasUserFiles || hasCustomPayload;

    // 确定显示内容
    const displayContent = hasUserCustomization
      ? getDisplayPayload()  // 用户有自定义 → 显示自定义内容
      : (hasFileContent ? attack.testPayload : actualPayload);

    // 确定注入来源标签
    const injectionSource = hasUserFiles
      ? `📎 ${payloadFiles.map(f => f.name).join(', ')}`
      : (attack.documentFileName ? `📄 ${attack.documentFileName}` : undefined);

    // 显示用户消息（显示简化版，但实际发送完整版）
    const userMsg = {
      role: 'user',
      content: displayContent,
      isInjection: true,
      injectionSource
    };
    setMessages([userMsg]);

    // 添加日志
    const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
    const initialLogs = [
      { type: 'model', content: `模型: ${modelName}`, status: 'normal' },
    ];
    if (hasUserFiles) {
      // 计算文件总大小
      const totalSize = payloadFiles.reduce((sum, f) => sum + (f.size || 0), 0);
      const sizeStr = totalSize > 1024 * 1024
        ? `${(totalSize / 1024 / 1024).toFixed(1)} MB`
        : `${(totalSize / 1024).toFixed(1)} KB`;

      // 显示文件列表和总大小
      initialLogs.push({
        type: 'data',
        content: `📎 解析 ${payloadFiles.length} 个文件 (${sizeStr})`,
        status: 'normal'
      });

      // 显示每个文件的解析详情
      payloadFiles.forEach(file => {
        if (file.parseError) {
          // 解析失败
          initialLogs.push({
            type: 'alert',
            content: `  ✗ ${file.name}: 解析失败 - ${file.parseError}`,
            status: 'warning'
          });
        } else if (file.parsedWith && file.parsedWith !== 'fallback (原始文本)') {
          // 解析成功
          const locationText = file.runLocation === 'sandbox' ? '[沙箱]' : '[后端]';
          initialLogs.push({
            type: 'data',
            content: `  ✓ ${file.name}: 使用 ${file.parsedWith} ${locationText}`,
            status: 'normal'
          });
        }
      });
    }
    if (attack.realTestPayload && !hasUserFiles && !hasCustomPayload) {
      initialLogs.push({ type: 'data', content: `解析文件: ${attack.documentFileName}`, status: 'normal' });
      initialLogs.push({ type: 'alert', content: `⚠️ 文件包含隐藏的恶意内容`, status: 'warning' });
    }
    initialLogs.push({ type: 'data', content: `发送 Payload (${actualPayload.length} 字符)`, status: 'normal', expandable: true, fullContent: actualPayload });
    setLogs(initialLogs);

    // 获取实际使用的系统提示词（自定义或默认）
    let activeSystemPrompt = customSystemPrompt || scenario.systemPrompt;

    // 如果启用 RAG，注入检索内容到系统提示词
    if (ragEnabled) {
      if (ragMode === 'mock' && ragKnowledge.trim()) {
        // Mock 模式：直接使用手动输入的内容
        activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragKnowledge}\n---`;
        setLogs(prev => [...prev,
          { type: 'data', content: `📚 RAG 知识库已注入 (Mock模式, ${ragKnowledge.split('\n').filter(l => l.trim()).length} 条)`, status: 'normal' }
        ]);
      } else if (ragMode === 'real' && ragServiceAvailable) {
        // Real 模式：执行真实的向量检索
        setLogs(prev => [...prev,
          { type: 'query', content: `🔍 执行 RAG 向量检索...`, status: 'normal' }
        ]);
        const ragResults = await performRagQuery(displayContent);
        if (ragResults && ragResults.length > 0) {
          const ragContext = formatRAGContext(ragResults);
          activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragContext}\n---`;
          setLogs(prev => [...prev,
            ...formatRAGLogs(ragResults)
          ]);
        } else {
          setLogs(prev => [...prev,
            { type: 'data', content: `📚 RAG 检索无结果`, status: 'warning' }
          ]);
        }
      }
    }

    // 检查是否启用了工具调用
    const useToolCalling = toolsEnabled && sandboxStatus === 'running';
    const enabledToolNames = useToolCalling
      ? Object.entries(enabledTools).filter(([_, enabled]) => enabled).map(([name]) => name)
      : [];

    if (useToolCalling && enabledToolNames.length > 0) {
      setLogs(prev => [...prev,
        { type: 'tool', content: `🔧 工具调用已启用: ${enabledToolNames.length} 个工具`, status: 'normal' }
      ]);
    }

    try {
      // 构建消息历史
      let messageHistory = [{ role: 'user', content: actualPayload }];
      let finalResponse = '';
      let totalApiTime = 0;
      let toolCallCount = 0;
      let allToolCalls = [];

      // 工具调用循环
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          // 使用带工具的 API 调用
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await CONFIG.callModelWithTools(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions
          );
        } else {
          // 普通 API 调用
          response = await CONFIG.callModel(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP }
          );
        }

        totalApiTime += response.timing?.totalTime || 0;

        // 检查是否有工具调用
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0 && useToolCalling) {
          // 有工具调用
          toolCallCount++;

          // 检查是否超过最大调用次数
          if (toolCallCount > maxToolCalls) {
            setLogs(prev => [...prev,
              { type: 'alert', content: `⚠️ 达到最大工具调用次数 (${maxToolCalls})`, status: 'warning' }
            ]);
            finalResponse = response.content || '(工具调用被中断)';
            break;
          }

          // 将 assistant 消息添加到历史
          messageHistory.push({
            role: 'assistant',
            content: response.content || null,
            tool_calls: toolCalls
          });

          // 执行每个工具调用
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name;
            const toolId = toolCall.id;
            const rawArgs = toolCall.function?.arguments || '{}';

            // 解析工具参数（带错误处理）
            let toolArgs;
            try {
              toolArgs = JSON.parse(rawArgs);
            } catch (parseErr) {
              console.error('工具参数 JSON 解析失败:', parseErr, 'Raw:', rawArgs);
              setLogs(prev => [...prev,
                { type: 'error', content: `🔧 工具 ${toolName}: 参数解析失败`, status: 'danger' },
                { type: 'data', content: `   原始参数: ${rawArgs.substring(0, 200)}...`, status: 'warning', expandable: true, fullContent: rawArgs }
              ]);
              // 将解析错误作为工具结果返回给 LLM
              messageHistory.push({
                role: 'tool',
                tool_call_id: toolId,
                content: `Error: Failed to parse tool arguments - ${parseErr.message}`
              });
              continue;
            }

            // 记录工具调用
            allToolCalls.push({ name: toolName, args: toolArgs, id: toolId });

            // 添加日志
            const toolConfig = CONFIG.tools.available[toolName];
            const toolLabel = toolConfig?.label || toolName;
            const toolCategory = toolConfig?.category || 'unknown';
            const categoryColor = toolCategory === 'safe' ? 'normal' : toolCategory === 'risky' ? 'warning' : 'danger';

            setLogs(prev => [...prev,
              { type: 'tool', content: `🔧 调用工具: ${toolLabel}`, status: categoryColor },
              { type: 'data', content: `   参数: ${JSON.stringify(toolArgs)}`, status: 'normal', expandable: true, fullContent: JSON.stringify(toolArgs, null, 2) }
            ]);

            // 在沙箱中执行工具
            let toolResult;
            try {
              const result = await sandboxClient.executeTool(toolName, toolArgs);
              toolResult = result.success ? JSON.stringify(result.result) : `Error: ${result.error}`;

              setLogs(prev => [...prev,
                { type: 'data', content: `   结果: ${toolResult.length > 100 ? toolResult.substring(0, 100) + '...' : toolResult}`, status: result.success ? 'normal' : 'warning', expandable: toolResult.length > 100, fullContent: toolResult }
              ]);
            } catch (err) {
              toolResult = `Error: ${err.message}`;
              setLogs(prev => [...prev,
                { type: 'error', content: `   执行失败: ${err.message}`, status: 'danger' }
              ]);
            }

            // 将工具结果添加到消息历史
            messageHistory.push({
              role: 'tool',
              tool_call_id: toolId,
              content: toolResult
            });
          }

          // 显示中间状态
          if (response.content) {
            setMessages(prev => [...prev, { role: 'agent', content: response.content, isToolThinking: true }]);
          }

          // 继续下一轮
          continue;
        }

        // 没有工具调用，获取最终响应
        finalResponse = response.content || '(无响应)';
        break;
      }

      setRealResponse(finalResponse);

      // 显示模型响应
      const agentMsg = { role: 'agent', content: finalResponse };
      setMessages(prev => [...prev.filter(m => !m.isToolThinking), agentMsg]);

      // 添加日志：收到响应 + timing
      const toolCallSummary = toolCallCount > 0 ? ` (${toolCallCount} 次工具调用)` : '';
      setLogs(prev => [
        ...prev,
        { type: 'data', content: `收到最终响应 (${finalResponse.length} 字符)${toolCallSummary}`, status: 'normal', expandable: true, fullContent: finalResponse },
        { type: 'timing', content: `⏱️ 总 API 耗时: ${totalApiTime}ms`, status: 'normal' },
        { type: 'judge', content: `正在使用 ${CONFIG.judgeModel} 评判攻击结果...`, status: 'normal' }
      ]);

      // 调用评判模型（传入实际发送的 payload 和工具调用历史）
      const judgeContext = toolCallCount > 0
        ? `${actualPayload}\n\n[工具调用记录]\n${allToolCalls.map(tc => `- ${tc.name}: ${JSON.stringify(tc.args)}`).join('\n')}`
        : actualPayload;
      const judgeResult = await CONFIG.judgeAttackSuccess(attack, activeSystemPrompt, finalResponse, judgeContext);

      setApiStatus('success');

      // 保存测试结果
      setLastTestResult({
        timestamp: new Date().toISOString(),
        scenario: currentScenario.name,
        attack: {
          id: attack.id,
          name: attack.name,
          type: attack.type,
          level: attack.level,
          description: attack.description
        },
        model: selectedModel,
        systemPrompt: activeSystemPrompt,
        payload: actualPayload,
        response: finalResponse,
        toolCalls: allToolCalls,
        judgment: judgeResult,
        apiTime: totalApiTime
      });

      // 根据评判结果添加日志
      if (judgeResult.success === true) {
        setLogs(prev => [
          ...prev,
          { type: 'success', content: `🚨 攻击成功！${judgeResult.reason}`, status: 'danger' }
        ]);
        // 标记响应为危险
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, isDangerous: true } : msg
        ));
      } else if (judgeResult.success === false) {
        setLogs(prev => [
          ...prev,
          { type: 'failure', content: `✅ 攻击失败：${judgeResult.reason}`, status: 'normal' }
        ]);
      } else {
        setLogs(prev => [
          ...prev,
          { type: 'judge', content: `⚠️ 评判不确定：${judgeResult.reason}`, status: 'warning' }
        ]);
      }

    } catch (error) {
      setApiStatus('error');
      setApiError(error.message);
      setLogs(prev => [
        ...prev,
        { type: 'alert', content: `🚨 API 错误: ${error.message}`, status: 'danger' }
      ]);
    }
  };

  // ============ 多轮对话模式 ============

  // 构建 thinking 配置
  const buildThinkingConfig = () => {
    if (!thinkingEnabled) return null;
    return { type: 'enabled', budget_tokens: thinkingBudget };
  };

  // 更新 thinking 面板和日志
  const updateThinkingPanel = (response) => {
    // 更新思考内容面板
    if (response.thinking) {
      setThinkingContent(response.thinking);
    }
    // 更新原始响应面板
    if (response.raw) {
      setRawApiResponse(response.raw);
    }
    // 保留日志记录
    if (response.thinking) {
      setLogs(prev => [...prev, {
        type: 'thinking',
        content: `💭 模型思考过程 (${response.thinking.length} 字符)`,
        status: 'normal',
        expandable: true,
        fullContent: response.thinking
      }]);
    }
  };

  // 开始多轮对话
  const startConversation = async () => {
    const attack = currentAttack;
    const scenario = currentScenario;

    setApiStatus('loading');
    setApiError('');
    setRealResponse('');
    setMessages([]);
    setLogs([]);
    setExpandedLogs(new Set());
    setConversationHistory([]);
    setConversationMode('active');

    // 重置 thinking 面板
    setThinkingContent('');
    setRawApiResponse(null);
    setThinkingTab('thinking');

    // 构建实际发送的 payload
    let actualPayload;
    const hasUserFiles = payloadFiles.length > 0;
    const hasCustomPayload = customTestPayload !== currentAttack.testPayload;

    if (hasUserFiles || hasCustomPayload) {
      actualPayload = getActualPayload();
    } else {
      actualPayload = attack.realTestPayload || attack.testPayload;
    }
    const hasFileContent = !!attack.realTestPayload || hasUserFiles;

    // 保存初始 payload 用于评判
    setInitialPayload(actualPayload);

    // 确定显示内容
    const hasUserCustomization = hasUserFiles || hasCustomPayload;
    const displayContent = hasUserCustomization
      ? getDisplayPayload()
      : (hasFileContent ? attack.testPayload : actualPayload);

    // 确定注入来源标签
    const injectionSource = hasUserFiles
      ? `📎 ${payloadFiles.map(f => f.name).join(', ')}`
      : (attack.documentFileName ? `📄 ${attack.documentFileName}` : undefined);

    // 显示用户消息
    const userMsg = {
      role: 'user',
      content: displayContent,
      isInjection: true,
      injectionSource
    };
    setMessages([userMsg]);

    // 添加日志
    const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
    const initialLogs = [
      { type: 'model', content: `模型: ${modelName}`, status: 'normal' },
      { type: 'round', content: `── 第 1 轮对话 ──`, status: 'normal' },
    ];
    if (hasUserFiles) {
      const totalSize = payloadFiles.reduce((sum, f) => sum + (f.size || 0), 0);
      const sizeStr = totalSize > 1024 * 1024
        ? `${(totalSize / 1024 / 1024).toFixed(1)} MB`
        : `${(totalSize / 1024).toFixed(1)} KB`;
      initialLogs.push({
        type: 'data',
        content: `📎 解析 ${payloadFiles.length} 个文件 (${sizeStr})`,
        status: 'normal'
      });
    }
    if (attack.realTestPayload && !hasUserFiles && !hasCustomPayload) {
      initialLogs.push({ type: 'data', content: `解析文件: ${attack.documentFileName}`, status: 'normal' });
      initialLogs.push({ type: 'alert', content: `⚠️ 文件包含隐藏的恶意内容`, status: 'warning' });
    }
    initialLogs.push({ type: 'data', content: `发送 Payload (${actualPayload.length} 字符)`, status: 'normal', expandable: true, fullContent: actualPayload });
    setLogs(initialLogs);

    // 获取实际使用的系统提示词
    let activeSystemPrompt = customSystemPrompt || scenario.systemPrompt;

    // 如果启用 RAG，注入检索内容到系统提示词
    if (ragEnabled) {
      if (ragMode === 'mock' && ragKnowledge.trim()) {
        // Mock 模式：直接使用手动输入的内容
        activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragKnowledge}\n---`;
        setLogs(prev => [...prev,
          { type: 'data', content: `📚 RAG 知识库已注入 (Mock模式, ${ragKnowledge.split('\n').filter(l => l.trim()).length} 条)`, status: 'normal' }
        ]);
      } else if (ragMode === 'real' && ragServiceAvailable) {
        // Real 模式：执行真实的向量检索
        setLogs(prev => [...prev,
          { type: 'query', content: `🔍 执行 RAG 向量检索...`, status: 'normal' }
        ]);
        const ragResults = await performRagQuery(displayContent);
        if (ragResults && ragResults.length > 0) {
          const ragContext = formatRAGContext(ragResults);
          activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragContext}\n---`;
          setLogs(prev => [...prev,
            ...formatRAGLogs(ragResults)
          ]);
        } else {
          setLogs(prev => [...prev,
            { type: 'data', content: `📚 RAG 检索无结果`, status: 'warning' }
          ]);
        }
      }
    }

    // 检查是否启用了工具调用
    const useToolCalling = toolsEnabled && sandboxStatus === 'running';
    const enabledToolNames = useToolCalling
      ? Object.entries(enabledTools).filter(([_, enabled]) => enabled).map(([name]) => name)
      : [];

    if (useToolCalling && enabledToolNames.length > 0) {
      setLogs(prev => [...prev,
        { type: 'tool', content: `🔧 工具调用已启用: ${enabledToolNames.length} 个工具`, status: 'normal' }
      ]);
    }

    // 构建 thinking 配置
    const thinkingConfig = buildThinkingConfig();

    try {
      // 构建消息历史
      let messageHistory = [{ role: 'user', content: actualPayload }];
      let finalResponse = '';
      let totalApiTime = 0;
      let allToolCalls = [];

      // 工具调用循环（第一轮）
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await CONFIG.callModelWithTools(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions,
            thinkingConfig
          );
        } else {
          response = await CONFIG.callModel(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            thinkingConfig
          );
        }

        totalApiTime += response.timing?.totalTime || 0;

        // 显示 thinking（如有）
        updateThinkingPanel(response);

        // 检查是否有工具调用
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0 && useToolCalling) {
          // 将 assistant 消息添加到历史
          messageHistory.push({
            role: 'assistant',
            content: response.content || null,
            tool_calls: toolCalls
          });

          // 执行每个工具调用
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name;
            const toolId = toolCall.id;
            const rawArgs = toolCall.function?.arguments || '{}';

            let toolArgs;
            try {
              toolArgs = JSON.parse(rawArgs);
            } catch (parseErr) {
              setLogs(prev => [...prev,
                { type: 'error', content: `🔧 工具 ${toolName}: 参数解析失败`, status: 'danger' }
              ]);
              messageHistory.push({
                role: 'tool',
                tool_call_id: toolId,
                content: `Error: Failed to parse tool arguments - ${parseErr.message}`
              });
              continue;
            }

            allToolCalls.push({ name: toolName, args: toolArgs, id: toolId });

            const toolConfig = CONFIG.tools.available[toolName];
            const toolLabel = toolConfig?.label || toolName;
            const toolCategory = toolConfig?.category || 'unknown';
            const categoryColor = toolCategory === 'safe' ? 'normal' : toolCategory === 'risky' ? 'warning' : 'danger';

            setLogs(prev => [...prev,
              { type: 'tool', content: `🔧 调用工具: ${toolLabel}`, status: categoryColor },
              { type: 'data', content: `   参数: ${JSON.stringify(toolArgs)}`, status: 'normal', expandable: true, fullContent: JSON.stringify(toolArgs, null, 2) }
            ]);

            let toolResult;
            try {
              const result = await sandboxClient.executeTool(toolName, toolArgs);
              toolResult = result.success ? JSON.stringify(result.result) : `Error: ${result.error}`;
              setLogs(prev => [...prev,
                { type: 'data', content: `   结果: ${toolResult.length > 100 ? toolResult.substring(0, 100) + '...' : toolResult}`, status: result.success ? 'normal' : 'warning', expandable: toolResult.length > 100, fullContent: toolResult }
              ]);
            } catch (err) {
              toolResult = `Error: ${err.message}`;
              setLogs(prev => [...prev,
                { type: 'error', content: `   执行失败: ${err.message}`, status: 'danger' }
              ]);
            }

            messageHistory.push({
              role: 'tool',
              tool_call_id: toolId,
              content: toolResult
            });
          }

          // 显示中间状态
          if (response.content) {
            setMessages(prev => [...prev, { role: 'agent', content: response.content, isToolThinking: true }]);
          }

          continue;
        }

        // 没有工具调用，获取最终响应
        finalResponse = response.content || '(无响应)';
        break;
      }

      setRealResponse(finalResponse);

      // 显示模型响应
      const agentMsg = { role: 'agent', content: finalResponse };
      setMessages(prev => [...prev.filter(m => !m.isToolThinking), agentMsg]);

      // 保存对话历史（用于后续轮次）
      setConversationHistory([
        { role: 'user', content: actualPayload },
        { role: 'assistant', content: finalResponse }
      ]);

      // 添加日志
      setLogs(prev => [
        ...prev,
        { type: 'data', content: `收到响应 (${finalResponse.length} 字符)`, status: 'normal', expandable: true, fullContent: finalResponse },
        { type: 'timing', content: `⏱️ API 耗时: ${totalApiTime}ms`, status: 'normal' },
        { type: 'info', content: `💬 多轮对话进行中 - 可继续发送消息或点击"停止测试"评判`, status: 'normal' }
      ]);

      setApiStatus('idle');

    } catch (error) {
      setApiStatus('error');
      setApiError(error.message);
      setConversationMode('idle');
      setLogs(prev => [
        ...prev,
        { type: 'alert', content: `🚨 API 错误: ${error.message}`, status: 'danger' }
      ]);
    }
  };

  // 发送用户消息（多轮对话中继续对话）
  const sendUserMessage = async () => {
    const content = userInput.trim();
    if (!content || apiStatus === 'loading') return;

    setUserInput('');
    setApiStatus('loading');

    // 添加轮次日志
    const roundNum = conversationHistory.filter(m => m.role === 'user').length + 1;
    setLogs(prev => [...prev, { type: 'round', content: `── 第 ${roundNum} 轮对话 ──`, status: 'normal' }]);

    // 显示用户消息
    setMessages(prev => [...prev, { role: 'user', content }]);

    // 更新对话历史
    const newHistory = [...conversationHistory, { role: 'user', content }];

    // 获取配置
    let activeSystemPrompt = customSystemPrompt || currentScenario.systemPrompt;

    // 如果启用 RAG，注入检索内容到系统提示词
    if (ragEnabled) {
      if (ragMode === 'mock' && ragKnowledge.trim()) {
        // Mock 模式：直接使用手动输入的内容
        activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragKnowledge}\n---`;
      } else if (ragMode === 'real' && ragServiceAvailable) {
        // Real 模式：执行真实的向量检索
        const ragResults = await performRagQuery(content);
        if (ragResults && ragResults.length > 0) {
          const ragContext = formatRAGContext(ragResults);
          activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragContext}\n---`;
          setLogs(prev => [...prev,
            ...formatRAGLogs(ragResults)
          ]);
        }
      }
    }

    const useToolCalling = toolsEnabled && sandboxStatus === 'running';
    const enabledToolNames = useToolCalling
      ? Object.entries(enabledTools).filter(([_, enabled]) => enabled).map(([name]) => name)
      : [];
    const thinkingConfig = buildThinkingConfig();

    try {
      let messageHistory = newHistory.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : m.role,
        content: m.content
      }));
      let finalResponse = '';
      let totalApiTime = 0;

      // 工具调用循环
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await CONFIG.callModelWithTools(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions,
            thinkingConfig
          );
        } else {
          response = await CONFIG.callModel(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            thinkingConfig
          );
        }

        totalApiTime += response.timing?.totalTime || 0;

        // 显示 thinking（如有）
        updateThinkingPanel(response);

        // 检查是否有工具调用
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0 && useToolCalling) {
          messageHistory.push({
            role: 'assistant',
            content: response.content || null,
            tool_calls: toolCalls
          });

          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name;
            const toolId = toolCall.id;
            const rawArgs = toolCall.function?.arguments || '{}';

            let toolArgs;
            try {
              toolArgs = JSON.parse(rawArgs);
            } catch (parseErr) {
              messageHistory.push({
                role: 'tool',
                tool_call_id: toolId,
                content: `Error: Failed to parse tool arguments`
              });
              continue;
            }

            const toolConfig = CONFIG.tools.available[toolName];
            const toolLabel = toolConfig?.label || toolName;
            const categoryColor = toolConfig?.category === 'safe' ? 'normal' : toolConfig?.category === 'risky' ? 'warning' : 'danger';

            setLogs(prev => [...prev,
              { type: 'tool', content: `🔧 调用工具: ${toolLabel}`, status: categoryColor },
              { type: 'data', content: `   参数: ${JSON.stringify(toolArgs)}`, status: 'normal' }
            ]);

            let toolResult;
            try {
              const result = await sandboxClient.executeTool(toolName, toolArgs);
              toolResult = result.success ? JSON.stringify(result.result) : `Error: ${result.error}`;
            } catch (err) {
              toolResult = `Error: ${err.message}`;
            }

            messageHistory.push({
              role: 'tool',
              tool_call_id: toolId,
              content: toolResult
            });
          }

          if (response.content) {
            setMessages(prev => [...prev, { role: 'agent', content: response.content, isToolThinking: true }]);
          }

          continue;
        }

        finalResponse = response.content || '(无响应)';
        break;
      }

      // 更新对话历史
      setConversationHistory(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: finalResponse }]);

      // 显示响应
      setMessages(prev => [...prev.filter(m => !m.isToolThinking), { role: 'agent', content: finalResponse }]);

      setLogs(prev => [...prev,
        { type: 'data', content: `收到响应 (${finalResponse.length} 字符)`, status: 'normal', expandable: true, fullContent: finalResponse },
        { type: 'timing', content: `⏱️ API 耗时: ${totalApiTime}ms`, status: 'normal' }
      ]);

    } catch (error) {
      setLogs(prev => [...prev,
        { type: 'alert', content: `🚨 API 错误: ${error.message}`, status: 'danger' }
      ]);
    } finally {
      setApiStatus('idle');
    }
  };

  // 停止多轮对话并评判
  const stopConversation = async () => {
    setConversationMode('judging');

    // 构建完整对话摘要
    const fullConversation = conversationHistory.map((msg) => {
      if (msg.role === 'user') return `[用户]: ${msg.content}`;
      if (msg.role === 'assistant') return `[模型]: ${msg.content}`;
      if (msg.role === 'tool') return `[工具结果]: ${msg.content}`;
      return '';
    }).filter(Boolean).join('\n\n');

    const roundCount = conversationHistory.filter(m => m.role === 'user').length;

    setLogs(prev => [...prev, {
      type: 'judge',
      content: `正在评判 ${roundCount} 轮对话...`,
      status: 'normal'
    }]);

    // 调用评判
    const activeSystemPrompt = customSystemPrompt || currentScenario.systemPrompt;
    const judgeResult = await CONFIG.judgeAttackSuccess(
      currentAttack,
      activeSystemPrompt,
      fullConversation,
      initialPayload
    );

    // 保存测试结果
    setLastTestResult({
      timestamp: new Date().toISOString(),
      scenario: currentScenario.name,
      attack: {
        id: currentAttack.id,
        name: currentAttack.name,
        type: currentAttack.type,
        level: currentAttack.level,
        description: currentAttack.description
      },
      model: selectedModel,
      systemPrompt: activeSystemPrompt,
      payload: initialPayload,
      response: fullConversation,
      toolCalls: [],
      judgment: judgeResult,
      rounds: roundCount
    });

    // 根据评判结果添加日志
    if (judgeResult.success === true) {
      setLogs(prev => [
        ...prev,
        { type: 'success', content: `🚨 攻击成功！${judgeResult.reason}`, status: 'danger' }
      ]);
      // 标记最后一条响应为危险
      setMessages(prev => prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === 'agent' ? { ...msg, isDangerous: true } : msg
      ));
    } else if (judgeResult.success === false) {
      setLogs(prev => [
        ...prev,
        { type: 'failure', content: `✅ 攻击失败：${judgeResult.reason}`, status: 'normal' }
      ]);
    } else {
      setLogs(prev => [
        ...prev,
        { type: 'judge', content: `⚠️ 评判不确定：${judgeResult.reason}`, status: 'warning' }
      ]);
    }

    setConversationMode('idle');
    setConversationHistory([]);
    setApiStatus('idle');
  };

  // 多轮对话中的文件上传处理
  const handleMultiRoundFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 简化处理：将文件作为文本添加到下一条消息
    let fileContents = [];

    for (const file of files) {
      try {
        // 尝试解析文件（使用 MCP）
        if (mcpEnabled) {
          const fileType = getFileTypeForMcp(file.name);
          if (fileType && mcpParsers[fileType]?.length > 0) {
            const result = await CONFIG.parseMCPFileToText(file, mcpParsers[fileType]);
            if (result.content) {
              fileContents.push(`[文件: ${file.name}]\n${result.content}`);
              continue;
            }
          }
        }
        // 回退：读取为文本
        const text = await file.text();
        fileContents.push(`[文件: ${file.name}]\n${text}`);
      } catch (err) {
        console.error(`读取文件 ${file.name} 失败:`, err);
        fileContents.push(`[文件: ${file.name}]\n(读取失败: ${err.message})`);
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
    // 找到该场景所属的能力层级
    const level = Object.entries(SCENARIOS_BY_LEVEL).find(([_, scenarios]) =>
      Object.keys(scenarios).includes(scenarioKey)
    )?.[0] || 'F1-conversation';
    setExpanded({ type: level, scenario: scenarioKey });
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

  const toggleType = (type) => setExpanded(prev => ({ ...prev, type: prev.type === type ? null : type }));
  const toggleScenario = (scenario) => setExpanded(prev => ({ ...prev, scenario: prev.scenario === scenario ? null : scenario }));

  // ============ 文件解析辅助函数 ============

  // 检测文件类型（用于MCP解析器选择）
  const getFileTypeForMcp = (filename) => {
    const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1];
    const typeMap = {
      'pdf': 'pdf',
      'doc': 'docx', 'docx': 'docx',
      'xls': 'xlsx', 'xlsx': 'xlsx',
      'jpg': 'image', 'jpeg': 'image', 'png': 'image',
      'gif': 'image', 'bmp': 'image', 'webp': 'image'
    };
    return typeMap[ext] || null;
  };

  // 通过MCP后端服务解析文件
  const parseViaMcpBackend = async (file, parsers, abortController) => {
    console.log('🌐 调用MCP后端:', CONFIG.mcp.serverUrl, '解析器:', parsers);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parsers', JSON.stringify(parsers));

    const response = await fetch(`${CONFIG.mcp.serverUrl}/mcp/parse/text`, {
      method: 'POST',
      body: formData,
      signal: abortController?.signal
    });
    console.log('📡 MCP响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP API错误 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('📥 MCP返回结果:', {
      filename: result.filename,
      textLength: result.text?.length || 0,
      parsersUsed: result.parsers_used,
      textPreview: result.text?.substring(0, 200)
    });
    return result.text;
  };

  // 在沙箱容器中解析文件
  const parseInSandbox = async (file, parsers, abortController, containerInfoOverride = null) => {
    const activeContainerInfo = containerInfoOverride || containerInfo;
    if (!activeContainerInfo) {
      throw new Error('沙箱容器未初始化');
    }

    // 1. 上传文件到沙箱
    const fileBytes = await file.arrayBuffer();
    // 分块处理 base64 编码，避免大文件导致调用栈溢出
    const uint8Array = new Uint8Array(fileBytes);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    const fileBase64 = btoa(binary);

    // 使用安全的文件名（避免特殊字符问题）
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `/tmp/${safeFileName}`;

    const uploadResp = await fetch(`${CONFIG.sandbox.baseUrl}/sandbox/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeContainerInfo.session_id,
        tool: 'write_file',
        params: {
          path: filePath,
          content: fileBase64,
          is_base64: true  // 告诉后端这是base64编码的二进制内容
        }
      }),
      signal: abortController?.signal
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      throw new Error(`文件上传失败: ${errText}`);
    }

    // 2. 调用MCP解析器（在容器内执行）
    // 注：需要在容器中安装MCP解析工具
    // 用单引号构造 Python 列表，避免与外层双引号冲突
    const parsersStr = parsers.map(p => `'${p}'`).join(', ');
    const parseCommand = `python3 -c "
import sys
sys.path.append('/app')
from file_parsers import parse_file

results = parse_file(open('${filePath}', 'rb').read(), '${file.name}', [${parsersStr}])

# 从解析结果中提取文本
all_text = []
for r in results:
    if r.get('success'):
        # PDF/图片: pages 数组
        if 'pages' in r:
            for p in r['pages']:
                if p.get('text'):
                    all_text.append(p['text'])
        # DOCX mammoth: text 字段
        elif 'text' in r:
            all_text.append(r['text'])
        # DOCX python-docx: paragraphs 数组
        elif 'paragraphs' in r:
            for p in r['paragraphs']:
                if p.get('text'):
                    all_text.append(p['text'])
        # XLSX: sheets 数组
        elif 'sheets' in r:
            for sheet in r['sheets']:
                for row in sheet.get('rows', []):
                    all_text.append(' | '.join(str(c) if c else '' for c in row))

print('\\n'.join(all_text))
"`;

    const response = await fetch(`${CONFIG.sandbox.baseUrl}/sandbox/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeContainerInfo.session_id,
        tool: 'run_command',
        params: { command: parseCommand }
      }),
      signal: abortController?.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`沙箱解析失败: ${errText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(`解析命令失败: ${result.error || JSON.stringify(result.result)}`);
    }

    // run_command 返回 {exit_code, output}，需要提取 output
    const cmdResult = result.result;
    if (cmdResult.exit_code !== 0) {
      throw new Error(`解析命令执行失败 (exit_code=${cmdResult.exit_code}): ${cmdResult.output}`);
    }

    return String(cmdResult.output || '').trim();
  };

  /**
   * 使用MCP解析文件（支持沙箱隔离和进度显示）
   * @param {File} file - 文件对象
   * @param {string} fileType - 文件类型 (pdf/docx/xlsx/image)
   * @param {AbortController} abortController - 取消控制器
   * @returns {Promise<{content: string, parsedWith: string, runLocation: string}>}
   */
  const parseFileWithMcp = async (file, fileType, abortController) => {
    const startTime = Date.now();

    // 获取用户配置的解析器列表
    const selectedParsers = mcpParsers[fileType] || [];
    if (selectedParsers.length === 0) {
      throw new Error(`未配置${fileType}解析器`);
    }

    // 检查是否有需要Docker的解析器
    const config = CONFIG.mcp.parsers[fileType];
    const requiresDocker = selectedParsers.some(parserId => {
      const tool = config?.tools.find(t => t.id === parserId);
      return tool && tool.requiresDocker;
    });

    // 如果需要Docker，强制使用沙箱且必须是MCP-tools镜像
    let useSandbox;
    let runLocation;

    // 用于存储当前使用的容器信息（可能是新启动的）
    let activeContainerInfo = containerInfo;

    if (requiresDocker) {
      // 自动启动/切换到 File Parser 容器
      if (!isFileParserReady()) {
        setParsingProgress({
          filename: file.name,
          parser: '准备中...',
          startTime,
          elapsedTime: 0,
          estimatedTime: 10000,
          runLocation: '启动 File Parser 容器...'
        });

        // 如果有其他容器在运行，先停止
        if (containerInfo) {
          try {
            await sandboxClient.destroyContainer();
          } catch (e) {
            console.warn('停止旧容器失败:', e);
          }
        }

        // 启动 File Parser 容器
        setSandboxImage(ImageType.FILE_PARSER);
        setSandboxStatus('connecting');
        try {
          const info = await sandboxClient.createContainer(ImageType.FILE_PARSER);
          activeContainerInfo = info; // 保存到局部变量，立即可用
          setContainerInfo(info);
          setSandboxStatus('running');
          setSandboxEnabled(true);
          sandboxClient.connectLogs(handleSandboxLog, (error) => {
            console.error('Sandbox WebSocket error:', error);
          });
          setLogs(prev => [...prev, {
            type: 'container',
            content: `MCP-tools 容器已自动启动: ${info.container_id}`,
            status: 'success',
          }]);
        } catch (error) {
          setSandboxStatus('error');
          throw new Error(`自动启动 MCP-tools 容器失败: ${error.message}`);
        }
      }
      useSandbox = true;
      runLocation = 'sandbox';
    } else {
      // 普通解析器，优先使用沙箱（如果可用）
      useSandbox = isSandboxAvailable();
      runLocation = useSandbox ? 'sandbox' : 'backend';
    }

    // 更新进度状态
    setParsingProgress({
      filename: file.name,
      parser: selectedParsers.join(', '),
      startTime,
      elapsedTime: 0,
      estimatedTime: estimateParsingTime(file.size, fileType),
      runLocation
    });

    // 启动计时器更新已用时间
    const progressTimer = setInterval(() => {
      setParsingProgress(prev => prev ? {
        ...prev,
        elapsedTime: Date.now() - startTime
      } : null);
    }, 100);

    try {
      let text;

      if (useSandbox) {
        // 在沙箱中解析（传递容器信息，避免依赖异步状态更新）
        text = await parseInSandbox(file, selectedParsers, abortController, activeContainerInfo);
      } else {
        // 直接调用MCP后端
        text = await parseViaMcpBackend(file, selectedParsers, abortController);
      }

      clearInterval(progressTimer);
      setParsingProgress(null);

      return {
        content: text,
        parsedWith: selectedParsers.join(', '),
        runLocation
      };

    } catch (error) {
      clearInterval(progressTimer);
      setParsingProgress(null);
      throw error;
    }
  };

  // 文件处理函数 - 解析文件内容作为文本
  // F2 文件注入场景：直接调用后端 /mcp/parse/text API 解析（不依赖 mcpEnabled）
  const handleAddFile = async (e) => {
    const files = Array.from(e.target.files);

    for (const file of files) {
      let content;
      let parsedWith = null;
      let parseError = null;

      // 判断是否是需要解析的二进制文件类型
      const ext = file.name.split('.').pop()?.toLowerCase();
      const needsParsing = ['pdf', 'docx', 'xlsx', 'xls', 'doc', 'pptx', 'ppt', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);

      if (needsParsing) {
        try {
          setIsParsingFile(true);

          // 构建 FormData
          const formData = new FormData();
          formData.append('file', file);

          // 根据文件类型选择默认解析器
          let defaultParsers;
          if (['pdf'].includes(ext)) {
            defaultParsers = ['pymupdf'];
          } else if (['docx', 'doc'].includes(ext)) {
            defaultParsers = ['python-docx'];
          } else if (['xlsx', 'xls'].includes(ext)) {
            defaultParsers = ['openpyxl'];
          } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
            defaultParsers = ['tesseract'];
          } else {
            defaultParsers = ['text'];
          }
          formData.append('parsers', JSON.stringify(defaultParsers));

          // 调用后端解析 API
          const response = await fetch(`${CONFIG.mcp.serverUrl}/mcp/parse/text`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`解析失败: ${response.status}`);
          }

          const result = await response.json();
          content = result.text || '';
          parsedWith = defaultParsers.join(', ');

        } catch (error) {
          console.error('文件解析失败:', error);
          parseError = error.message;
          // 降级：读取原始内容
          content = await file.text();
          parsedWith = 'fallback (原始文本)';
        } finally {
          setIsParsingFile(false);
        }
      } else {
        // 文本文件直接读取
        content = await file.text();
      }

      // 添加到文件列表
      setPayloadFiles(prev => [...prev, {
        name: file.name,
        content,
        size: file.size,
        parsedWith,
        runLocation: 'backend',
        parseError
      }]);
    }

    e.target.value = '';  // 重置input
  };

  const removePayloadFile = (index) => {
    setPayloadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 获取显示的 Payload（文件名 + 用户输入）
  const getDisplayPayload = () => {
    if (payloadFiles.length === 0) return customTestPayload;
    const fileNames = payloadFiles.map(f => `📎 ${f.name}`).join('\n');
    return `${fileNames}\n\n${customTestPayload}`;
  };

  // 获取实际发送的 Payload（文件内容 + 用户输入）
  // 注：这模拟了真实世界中文档被解析后注入到 prompt 的过程
  const getActualPayload = () => {
    if (payloadFiles.length === 0) return customTestPayload;
    const fileContents = payloadFiles.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n');
    return `${fileContents}\n\n${customTestPayload}`;
  };


  return (
    <div className="h-screen bg-slate-900 text-white flex text-sm overflow-hidden">
      {/* 滚动条样式已移至 index.css */}

      {/* 左侧导航 */}
      <div className="w-64 bg-slate-800 p-3 overflow-y-auto custom-scroll flex-shrink-0 border-r border-slate-700">
        {/* 视图切换标签 */}
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => { setViewMode('scenarios'); setSelectedCase(null); }}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
              viewMode === 'scenarios' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            🛡️ 攻击场景
          </button>
          <button
            onClick={() => setViewMode('saved')}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
              viewMode === 'saved' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            📁 已保存
          </button>
        </div>

        {/* 模式切换 - 仅场景视图显示 */}
        {viewMode === 'scenarios' && (
        <div className="mb-3 p-2 bg-slate-700 rounded">
          <div className="text-xs text-slate-400 mb-2">测试模式</div>
          <div className="flex gap-1">
            <button
              onClick={() => setMode('mock')}
              className={`flex-1 py-1.5 rounded text-xs transition ${
                mode === 'mock' ? 'bg-blue-600' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              📺 模拟演示
            </button>
            <button
              onClick={() => setMode('real')}
              className={`flex-1 py-1.5 rounded text-xs transition ${
                mode === 'real' ? 'bg-green-600' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              🔬 真实测试
            </button>
          </div>
        </div>
        )}

        {/* 沙箱控制 - 仅场景视图显示 */}
        {viewMode === 'scenarios' && (
        <>
        <div className="mb-3 p-2 bg-slate-700 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">🐳 终端沙箱</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              !sandboxAvailable ? 'bg-slate-600 text-slate-400' :
              terminals.length > 0 ? 'bg-green-600 text-white' :
              'bg-slate-600 text-slate-300'
            }`}>
              {!sandboxAvailable ? '离线' : `${terminals.length} 运行中`}
            </span>
          </div>

          {sandboxAvailable ? (
            <>
              {/* 创建新终端 */}
              <div className="mb-2 p-2 bg-slate-800 rounded">
                <div className="text-xs text-slate-500 mb-1">创建新终端</div>
                <div className="flex gap-1 mb-1">
                  <input
                    type="text"
                    value={newTerminalTag}
                    onChange={(e) => setNewTerminalTag(e.target.value)}
                    placeholder="输入 tag (如: luna)"
                    className="flex-1 bg-slate-600 text-white text-xs px-2 py-1 rounded border border-slate-500 focus:outline-none focus:border-blue-500"
                    disabled={creatingTerminal}
                  />
                  <select
                    value={newTerminalImage}
                    onChange={(e) => setNewTerminalImage(e.target.value)}
                    className="w-8 bg-slate-600 text-white text-sm text-center py-1 rounded border border-slate-500 focus:outline-none cursor-pointer appearance-none"
                    disabled={creatingTerminal}
                    title={newTerminalImage.includes('python') ? 'Python 3.11' : newTerminalImage.includes('ubuntu') ? 'Ubuntu 22.04' : 'Node 20'}
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value={TerminalImage.PYTHON} title="Python 3.11">🐍</option>
                    <option value={TerminalImage.UBUNTU} title="Ubuntu 22.04">🐧</option>
                    <option value={TerminalImage.NODE} title="Node 20">⬢</option>
                  </select>
                </div>
                <button
                  onClick={() => createTerminal(newTerminalTag, newTerminalImage)}
                  disabled={creatingTerminal || !newTerminalTag.trim()}
                  className={`w-full py-1.5 rounded text-xs transition ${
                    creatingTerminal || !newTerminalTag.trim()
                      ? 'bg-slate-600 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {creatingTerminal ? '⏳ 创建中...' : '➕ 创建终端'}
                </button>
              </div>

              {/* 运行中的终端列表 */}
              {terminals.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-slate-500 mb-1">运行中 ({terminals.length})</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {terminals.map(t => (
                      <div
                        key={t.tag}
                        className={`flex items-center text-xs px-2 py-1.5 rounded cursor-pointer ${
                          t.tag === currentTag
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                        onClick={() => switchTerminal(t.tag)}
                      >
                        <span className="mr-1.5">
                          {t.image.includes('python') ? '🐍' :
                           t.image.includes('ubuntu') ? '🐧' : '📦'}
                        </span>
                        <span className="flex-1 truncate font-mono">{t.tag}</span>
                        <span className="text-xs opacity-70 mr-2">
                          {formatTimeAgo(t.created_at)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); destroyTerminal(t.tag); }}
                          className="text-red-400 hover:text-red-300"
                          title="销毁终端"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 已删除终端列表 */}
              {deletedTerminals.length > 0 && (
                <div className="mb-2 p-2 bg-slate-800 rounded">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>已删除 ({deletedTerminals.length}) {formatBytes(deletedTotalSize)}</span>
                    <button
                      onClick={() => setShowCleanupConfirm(true)}
                      className="text-red-400 hover:text-red-300 text-xs"
                      title="清理全部"
                    >
                      清理全部
                    </button>
                  </div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {deletedTerminals.map(d => {
                      const name = `${d.original_tag}-${d.deleted_at.replace(/[-:T]/g, '').slice(0, 14)}`;
                      return (
                        <div key={d.path} className="flex items-center text-xs text-slate-400">
                          <span className="flex-1 truncate font-mono">{d.original_tag}</span>
                          <span className="mr-2">{formatBytes(d.size_bytes)}</span>
                          <button
                            onClick={() => cleanupDeleted(name)}
                            className="text-red-400 hover:text-red-300"
                            title="清理"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 清理确认对话框 */}
              {showCleanupConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-slate-800 p-4 rounded-lg max-w-sm mx-4">
                    <div className="text-sm font-medium mb-2">确认永久删除？</div>
                    <div className="text-xs text-slate-400 mb-4">
                      将删除所有已删除终端的文件（不可恢复）
                      <br />共 {deletedTerminals.length} 个，{formatBytes(deletedTotalSize)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCleanupConfirm(false)}
                        className="flex-1 py-1.5 rounded text-xs bg-slate-600 hover:bg-slate-500"
                      >
                        取消
                      </button>
                      <button
                        onClick={cleanupAllDeleted}
                        className="flex-1 py-1.5 rounded text-xs bg-red-600 hover:bg-red-500"
                      >
                        确认清理
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 当前终端操作区 */}
              {currentTag && sandboxStatus === 'running' && (
                <>
                  <div className="mt-2 pt-2 border-t border-slate-600">
                    <div className="text-xs text-slate-500 mb-1">当前: <span className="font-mono text-white">{currentTag}</span></div>

                    {/* 上传文件 */}
                    <input
                      type="file"
                      id="sandbox-file-input"
                      className="hidden"
                      multiple
                      onChange={handleUploadToSandbox}
                    />
                    <div className="flex gap-1 mb-2">
                      <button
                        onClick={() => document.getElementById('sandbox-file-input').click()}
                        disabled={uploadingSandboxFile}
                        className="flex-1 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 transition"
                        title="上传文件到沙箱容器的 /workspace 目录"
                      >
                        {uploadingSandboxFile ? '⏳ 上传中...' : '📤 上传'}
                      </button>
                      <button
                        onClick={refreshSandboxFiles}
                        className="px-3 py-1.5 rounded text-xs bg-slate-600 hover:bg-slate-500 transition"
                        title="刷新文件列表"
                      >
                        🔄
                      </button>
                    </div>

                    {/* 文件列表 */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>文件 ({sandboxFiles.length})</span>
                      </div>
                      {sandboxFiles.length === 0 ? (
                        <div className="text-xs text-slate-600 text-center py-2">
                          点击 🔄 刷新文件列表
                        </div>
                      ) : (
                        sandboxFiles.map(f => (
                          <div key={f.path} className="flex items-center text-xs bg-slate-600 px-2 py-1 rounded group">
                            <span className="truncate flex-1" title={f.path}>
                              {f.preset && <span className="text-emerald-400 mr-1">⚙️</span>}
                              {f.isDir ? `📁 ${f.name}` : f.name}
                            </span>
                            <div className="flex gap-1 ml-1 flex-shrink-0">
                              {!f.isDir && (
                                <button
                                  onClick={() => handleDownloadSandboxFile(f.path, f.name)}
                                  className="text-blue-400 hover:text-blue-300 opacity-60 group-hover:opacity-100"
                                  title="下载文件"
                                >
                                  📥
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveSandboxFile(f.path)}
                                className="text-red-400 hover:text-red-300 opacity-60 group-hover:opacity-100"
                                title="删除文件"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500 text-center py-2">
              <div>后端服务未运行</div>
              <div className="mt-1 text-slate-600">cd backend && ./run.sh</div>
            </div>
          )}
        </div>

        {/* 解析容器状态 */}
        <div className="mb-3 p-2 bg-slate-700 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">📦 服务引擎</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              parserContainerAvailable
                ? 'bg-green-600 text-white'
                : 'bg-slate-600 text-slate-400'
            }`}>
              {parserContainerAvailable ? '运行中' : '未启动'}
            </span>
          </div>
          {parserContainerAvailable && (
            <div className="mt-1 text-xs text-slate-500">
              支持 PDF/DOCX/XLSX/图片OCR 解析
            </div>
          )}
        </div>

        {/* 导出按钮 */}
        <div className="mb-3">
          <button
            onClick={() => setShowExport(!showExport)}
            className="w-full text-xs px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded"
          >
            📤 导出功能
          </button>
          {showExport && (
            <div className="mt-2 p-2 bg-slate-700 rounded text-xs space-y-2">
              <button onClick={exportReport} className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded">
                📄 场景列表 (JSON)
              </button>
              <button onClick={() => exportHTML({ attack: currentAttack, scenario: currentScenario, attackType, riskLevel })} className="w-full py-1.5 bg-green-600 hover:bg-green-500 rounded">
                🎬 当前演示 (HTML)
              </button>
              <button
                onClick={exportCurrentCase}
                disabled={apiStatus !== 'success'}
                className={`w-full py-1.5 rounded ${apiStatus === 'success' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-600 cursor-not-allowed'}`}
              >
                📊 测试结果 (JSON) {apiStatus === 'success' ? '✓' : ''}
              </button>
              <button
                onClick={saveToServer}
                disabled={apiStatus !== 'success' || isSaving}
                className={`w-full py-1.5 rounded ${apiStatus === 'success' && !isSaving ? 'bg-orange-600 hover:bg-orange-500' : 'bg-slate-600 cursor-not-allowed'}`}
              >
                {isSaving ? '⏳ 保存中...' : '💾 保存到服务器'} {apiStatus === 'success' && !isSaving ? '' : ''}
              </button>
            </div>
          )}
        </div>

        {/* 层级列表 */}
        {Object.entries(groupedData).map(([typeKey, typeData]) => (
          <div key={typeKey} className="mb-2">
            <button
              onClick={() => toggleType(typeKey)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium ${
                expanded.type === typeKey ? 'bg-slate-700' : 'hover:bg-slate-700/50'
              }`}
            >
              <span>{typeData.icon} {typeData.label}</span>
              <span className="text-slate-500">{expanded.type === typeKey ? '−' : '+'}</span>
            </button>

            {expanded.type === typeKey && (
              <div className="ml-2 mt-1">
                {Object.entries(typeData.scenarios).map(([scenarioKey, scenario]) => (
                  <div key={scenarioKey} className="mb-1">
                    <button
                      onClick={() => toggleScenario(scenarioKey)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
                        expanded.scenario === scenarioKey ? 'bg-slate-600' : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{scenario.icon} {scenario.name}</span>
                      <span className="text-slate-500">{expanded.scenario === scenarioKey ? '−' : '+'}</span>
                    </button>

                    {expanded.scenario === scenarioKey && (
                      <div className="ml-3 mt-1 space-y-0.5">
                        {scenario.attacks.map((attack) => {
                          const originalIdx = SCENARIOS[scenarioKey].attacks.findIndex(a => a.id === attack.id);
                          const isSelected = selectedAttack.scenario === scenarioKey && selectedAttack.index === originalIdx;
                          return (
                            <button
                              key={attack.id}
                              onClick={() => selectAttack(scenarioKey, originalIdx)}
                              className={`w-full text-left px-2 py-1 rounded text-xs truncate ${
                                isSelected ? 'bg-blue-600' : 'hover:bg-slate-700/50 text-slate-300'
                              }`}
                            >
                              {attack.id} {attack.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
          共 {Object.values(SCENARIOS).reduce((a, s) => a + s.attacks.length, 0)} 个场景
        </div>
        </>
        )}

        {/* 已保存用例列表 - 仅在 saved 视图显示 */}
        {viewMode === 'saved' && (
          <div className="flex-1">
            <div className="mb-3 text-xs text-slate-400">
              已保存的测试用例 ({savedCases.length})
            </div>
            {loadingSavedCases ? (
              <div className="text-xs text-slate-500 text-center py-4">加载中...</div>
            ) : savedCases.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">
                暂无保存的用例
                <div className="mt-1 text-slate-600">执行真实测试后可保存</div>
              </div>
            ) : (
              <div className="space-y-2">
                {savedCases.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded cursor-pointer transition ${
                      selectedCase?.id === item.id ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    onClick={() => viewCaseDetail(item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium truncate flex-1">
                        {item.name || item.attackName || '未命名'}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const detail = await getCaseDetail(item.id);
                            startPlayback(detail);
                            setViewMode('scenarios');
                          }}
                          className="text-xs text-slate-400 hover:text-cyan-400"
                          title="回放"
                        >
                          ▶️
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCase(item.id); }}
                          className="text-xs text-slate-400 hover:text-red-400"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {item.scenarioName || item.sourceScenario?.name} · {item.modelId || item.testConfig?.model}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        item.judgmentSuccess === true ? 'bg-red-600' :
                        item.judgmentSuccess === false ? 'bg-green-600' :
                        'bg-yellow-600'
                      }`}>
                        {item.judgmentSuccess === true ? '攻击成功' :
                         item.judgmentSuccess === false ? '攻击失败' : '不确定'}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.savedAt ? new Date(item.savedAt).toLocaleString('zh-CN') : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右侧主区域 */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {/* 已保存用例详情视图 */}
        {viewMode === 'saved' && selectedCase ? (
          <div className="h-full flex flex-col">
            {/* 标题区 */}
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-bold">
                  {selectedCase.meta?.name || selectedCase.source?.attack?.name || selectedCase.name || selectedCase.sourceScenario?.attackName}
                </h2>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  (selectedCase.result?.judgment?.success ?? selectedCase.judgment?.success) === true ? 'bg-red-600' :
                  (selectedCase.result?.judgment?.success ?? selectedCase.judgment?.success) === false ? 'bg-green-600' :
                  'bg-yellow-600'
                }`}>
                  {(selectedCase.result?.judgment?.success ?? selectedCase.judgment?.success) === true ? '攻击成功' :
                   (selectedCase.result?.judgment?.success ?? selectedCase.judgment?.success) === false ? '攻击失败' : '不确定'}
                </span>
                <button
                  onClick={() => {
                    startPlayback(selectedCase);
                    setViewMode('scenarios');
                  }}
                  className="px-2 py-0.5 text-xs bg-cyan-600 hover:bg-cyan-500 rounded transition"
                >
                  ▶️ 回放
                </button>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                场景: {selectedCase.source?.scenarioName || selectedCase.sourceScenario?.name} · 模型: {selectedCase.environment?.llm?.modelId || selectedCase.testConfig?.model}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                保存时间: {(selectedCase.meta?.createdAt || selectedCase.savedAt) ? new Date(selectedCase.meta?.createdAt || selectedCase.savedAt).toLocaleString('zh-CN') : '未知'}
                {selectedCase.source?.capabilityLevel && (
                  <span className="ml-2">· 能力层级: {selectedCase.source.capabilityLevel}</span>
                )}
              </div>
            </div>

            {/* 内容区 - 双栏布局 */}
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
              {/* 左栏：对话记录 */}
              <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
                <div className="text-xs text-slate-400 mb-2 pb-2 border-b border-slate-700">
                  💬 对话记录
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll space-y-2">
                  {(selectedCase.execution?.messages || selectedCase.conversations || []).map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        msg.role === 'user'
                          ? 'bg-blue-600 ml-4'
                          : 'bg-slate-700 mr-4'
                      } ${msg.isInjection ? 'border border-red-500' : ''} ${msg.isDangerous ? 'border border-orange-500' : ''}`}
                    >
                      <div className="text-slate-400 mb-1">{msg.role === 'user' ? '用户' : '智能体'}</div>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右栏：测试详情 */}
              <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
                <div className="text-xs text-slate-400 mb-2 pb-2 border-b border-slate-700">
                  📋 测试详情
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll space-y-3 text-xs">
                  {/* 判定理由 */}
                  <div>
                    <div className="text-slate-400 mb-1">判定理由</div>
                    <div className="p-2 bg-slate-700 rounded">
                      {selectedCase.result?.judgment?.reason || selectedCase.judgment?.reason || '无'}
                    </div>
                  </div>

                  {/* 测试载荷 */}
                  <div>
                    <div className="text-slate-400 mb-1">测试载荷</div>
                    <div className="p-2 bg-slate-700 rounded whitespace-pre-wrap max-h-32 overflow-y-auto custom-scroll">
                      {selectedCase.execution?.payload?.display || selectedCase.payload || '无'}
                    </div>
                  </div>

                  {/* LLM 响应 */}
                  <div>
                    <div className="text-slate-400 mb-1">LLM 响应</div>
                    <div className="p-2 bg-slate-700 rounded whitespace-pre-wrap max-h-40 overflow-y-auto custom-scroll">
                      {selectedCase.result?.response || selectedCase.response || '无'}
                    </div>
                  </div>

                  {/* 工具调用记录 */}
                  {((selectedCase.execution?.toolCalls || selectedCase.toolCalls)?.length > 0) && (
                    <div>
                      <div className="text-slate-400 mb-1">
                        🔧 工具调用 ({(selectedCase.execution?.toolCalls || selectedCase.toolCalls).length})
                      </div>
                      <div className="space-y-1">
                        {(selectedCase.execution?.toolCalls || selectedCase.toolCalls).map((tc, idx) => (
                          <div
                            key={idx}
                            className={`p-1.5 rounded text-xs ${
                              tc.category === 'dangerous' ? 'bg-red-900/30 border-l-2 border-red-500' :
                              tc.category === 'risky' ? 'bg-yellow-900/30 border-l-2 border-yellow-500' :
                              'bg-slate-700'
                            }`}
                          >
                            <span className="text-cyan-400">{tc.name}</span>
                            <span className="text-slate-500 ml-1">({JSON.stringify(tc.args).slice(0, 50)}...)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 系统日志 */}
                  {((selectedCase.execution?.logs || selectedCase.logs)?.length > 0) && (
                    <div>
                      <div className="text-slate-400 mb-1">
                        系统日志 ({(selectedCase.execution?.logs || selectedCase.logs).length})
                      </div>
                      <div className="space-y-1">
                        {(selectedCase.execution?.logs || selectedCase.logs).slice(0, 10).map((log, idx) => (
                          <div
                            key={idx}
                            className={`p-1.5 rounded text-xs ${
                              log.status === 'danger' ? 'bg-red-900/30 border-l-2 border-red-500' :
                              log.status === 'warning' ? 'bg-yellow-900/30 border-l-2 border-yellow-500' :
                              log.status === 'success' ? 'bg-green-900/30 border-l-2 border-green-500' :
                              'bg-slate-700'
                            }`}
                          >
                            {log.content}
                          </div>
                        ))}
                        {(selectedCase.execution?.logs || selectedCase.logs).length > 10 && (
                          <div className="text-slate-500">
                            ...还有 {(selectedCase.execution?.logs || selectedCase.logs).length - 10} 条日志
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === 'saved' ? (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="text-4xl mb-4">📁</div>
              <div>选择左侧的用例查看详情</div>
            </div>
          </div>
        ) : (
        <>
        {/* 回放模式控制条 */}
        {isPlaybackMode && (
          <div className="mb-4 p-3 bg-cyan-900/30 border border-cyan-600 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-medium">▶️ 回放模式</span>
                <span className="text-xs text-slate-400">
                  {playbackCase?.meta?.name || playbackCase?.source?.attack?.name || '未命名用例'}
                </span>
                {isPlaybackPlaying && (
                  <span className="text-xs text-cyan-400 animate-pulse">
                    ● 播放中 ({playbackProgress}/{playbackTotal})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isPlaybackPlaying ? (
                  <>
                    <button
                      onClick={stopPlayback}
                      className="px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded"
                    >
                      ⏸️ 暂停
                    </button>
                    <button
                      onClick={skipToEnd}
                      className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded"
                    >
                      ⏭️ 跳过
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => playbackCase && startPlayback(playbackCase)}
                    className="px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded"
                    disabled={!playbackCase}
                  >
                    ▶️ 重新播放
                  </button>
                )}
                <button
                  onClick={exitPlayback}
                  className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded"
                >
                  ✕ 退出回放
                </button>
              </div>
            </div>
            {playbackTotal > 0 && (
              <div className="mt-2">
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div
                    className="bg-cyan-500 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${(playbackProgress / playbackTotal) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 标题区 */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-bold">{currentAttack.name}—{currentScenario.name}</h2>
            {mode === 'real' && !isPlaybackMode && (
              <span className="px-2 py-0.5 bg-green-600 rounded text-xs">🔬 真实测试模式</span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{currentAttack.description}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs text-white ${attackType.color}`}>
              {attackType.icon} {attackType.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs ${riskLevel.color}`}>
              危害等级：{riskLevel.label}
            </span>
            {mode === 'mock' && isPlaying && !isPlaybackMode && (
              <span className="text-xs text-green-400 animate-pulse">● 演示中</span>
            )}
            {mode === 'real' && apiStatus === 'loading' && !isPlaybackMode && (
              <span className="text-xs text-yellow-400 animate-pulse">● 请求中... {(apiElapsedTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>

        {/* 攻击方法详解 - 仅间接注入攻击显示 */}
        {currentAttack.documentFile && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
            {/* 标题栏：文件名 + 下载按钮 + 折叠按钮 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-300">
                  🎯 攻击方法详解
                </span>
                <a
                  href={currentAttack.documentFile}
                  download={currentAttack.documentFileName}
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded transition flex items-center gap-1"
                >
                  ⬇️ 恶意样本: {currentAttack.documentFileName}
                </a>
              </div>
              <button
                onClick={() => setShowDocument(!showDocument)}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
              >
                {showDocument ? '▼ 收起' : '▶ 展开'}
              </button>
            </div>

            {showDocument && (
              <div className="space-y-3">
                {/* Tab 切换 */}
                <div className="flex gap-1 mb-3 flex-wrap">
                  <button
                    onClick={() => setDocTab('principle')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      docTab === 'principle' ? 'bg-orange-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    ⚠️ 攻击原理
                  </button>
                  <button
                    onClick={() => setDocTab('hiding')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      docTab === 'hiding' ? 'bg-red-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    🔧 隐藏技术
                  </button>
                  <button
                    onClick={() => setDocTab('tools')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      docTab === 'tools' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    🛠️ 编辑工具
                  </button>
                  <button
                    onClick={() => setDocTab('readme')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      docTab === 'readme' ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    📋 攻击详情
                  </button>
                  <button
                    onClick={() => setDocTab('parsing')}
                    className={`px-2 py-1 text-xs rounded transition ${
                      docTab === 'parsing' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    📎 附件处理
                  </button>
                </div>

                {/* 内容区域固定高度 */}
                <div className="h-72 overflow-y-auto custom-scroll">
                  {/* 攻击原理 Tab */}
                  {docTab === 'principle' && (
                    <div className="space-y-3">
                      <div className="bg-orange-900/20 p-3 rounded border border-orange-500/30">
                        <div className="text-xs text-orange-400 font-medium mb-2">⚠️ 此攻击的原理</div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {currentAttack.riskExplanation || '暂无攻击原理说明'}
                        </p>
                      </div>

                      <div className="bg-slate-900 p-3 rounded">
                        <div className="text-xs text-slate-400 font-medium mb-2">🎯 间接提示注入攻击流程</div>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="px-2 py-1 bg-slate-700 rounded">📄 恶意文件</span>
                          <span className="text-slate-500">→</span>
                          <span className="px-2 py-1 bg-orange-900/50 border border-orange-500/30 rounded">🔧 文件解析</span>
                          <span className="text-slate-500">→</span>
                          <span className="px-2 py-1 bg-red-900/50 border border-red-500/30 rounded">📝 提取文本</span>
                          <span className="text-slate-500">→</span>
                          <span className="px-2 py-1 bg-purple-900/50 border border-purple-500/30 rounded">💬 注入 Prompt</span>
                          <span className="text-slate-500">→</span>
                          <span className="px-2 py-1 bg-blue-900/50 border border-blue-500/30 rounded">🤖 LLM 执行</span>
                        </div>
                      </div>

                      <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                        <div className="text-xs text-red-400 font-medium mb-2">💥 为什么会成功？</div>
                        <ul className="text-xs text-slate-300 ml-4 list-disc space-y-1">
                          <li>LLM <strong className="text-red-300">无法区分</strong>用户指令和文件中的伪造指令</li>
                          <li>文件解析器会提取<strong className="text-orange-300">所有文本</strong>，包括隐藏内容</li>
                          <li>攻击者可以伪造<strong className="text-blue-300">系统提示词</strong>来覆盖原有指令</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 隐藏技术 Tab */}
                  {docTab === 'hiding' && (
                    <div className="space-y-3">
                      <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                        <div className="text-xs text-red-400 font-medium mb-2">🔧 此攻击使用的隐藏技术</div>
                        <div className="flex flex-wrap gap-2">
                          {currentAttack.hidingTechniques?.length > 0 ? (
                            currentAttack.hidingTechniques.map((tech, i) => (
                              <span key={i} className="px-2 py-1 text-xs bg-red-900/50 border border-red-500/30 rounded">
                                {tech}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-500">此攻击未使用文件隐藏技术</span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded">
                        <div className="text-xs text-slate-400 font-medium mb-2">📚 常见隐藏技术一览</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-800 p-2 rounded">
                            <div className="text-orange-400 font-medium">PDF</div>
                            <ul className="text-slate-400 mt-1 space-y-0.5">
                              <li>• 白色/透明文字层</li>
                              <li>• 元数据注入 (Author/Title)</li>
                              <li>• 隐藏注释 (Annotations)</li>
                              <li>• 超小字体 (0.1pt)</li>
                            </ul>
                          </div>
                          <div className="bg-slate-800 p-2 rounded">
                            <div className="text-blue-400 font-medium">DOCX</div>
                            <ul className="text-slate-400 mt-1 space-y-0.5">
                              <li>• 隐藏文本属性</li>
                              <li>• 白色字体</li>
                              <li>• 批注/修订内容</li>
                              <li>• 文档属性字段</li>
                            </ul>
                          </div>
                          <div className="bg-slate-800 p-2 rounded">
                            <div className="text-green-400 font-medium">XLSX</div>
                            <ul className="text-slate-400 mt-1 space-y-0.5">
                              <li>• veryHidden 工作表</li>
                              <li>• 白色单元格文字</li>
                              <li>• 单元格批注</li>
                              <li>• 命名范围</li>
                            </ul>
                          </div>
                          <div className="bg-slate-800 p-2 rounded">
                            <div className="text-purple-400 font-medium">图片</div>
                            <ul className="text-slate-400 mt-1 space-y-0.5">
                              <li>• EXIF 元数据</li>
                              <li>• 图片注释段</li>
                              <li>• 隐写术 (LSB)</li>
                              <li>• OCR 可识别小字</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 编辑工具 Tab */}
                  {docTab === 'tools' && (
                    <div className="space-y-3">
                      <div className="bg-purple-900/20 p-3 rounded border border-purple-500/30">
                        <div className="text-xs text-purple-400 font-medium mb-2">🛠️ 制作恶意文件的工具</div>
                        <p className="text-xs text-slate-400 mb-2">以下工具可用于在文件中嵌入隐藏的恶意指令：</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900 p-3 rounded">
                          <div className="text-orange-400 font-medium mb-2">📄 PDF 编辑</div>
                          <ul className="text-slate-400 space-y-1">
                            <li><code className="text-orange-300">Adobe Acrobat Pro</code> - 添加隐藏文字层</li>
                            <li><code className="text-orange-300">qpdf</code> - 命令行 PDF 操作</li>
                            <li><code className="text-orange-300">PyMuPDF</code> - Python 编辑库</li>
                            <li><code className="text-orange-300">exiftool</code> - 修改元数据</li>
                          </ul>
                        </div>
                        <div className="bg-slate-900 p-3 rounded">
                          <div className="text-blue-400 font-medium mb-2">📝 DOCX 编辑</div>
                          <ul className="text-slate-400 space-y-1">
                            <li><code className="text-blue-300">Microsoft Word</code> - 隐藏文本格式</li>
                            <li><code className="text-blue-300">python-docx</code> - Python 编辑库</li>
                            <li><code className="text-blue-300">解压+文本编辑器</code> - 直接改 XML</li>
                          </ul>
                        </div>
                        <div className="bg-slate-900 p-3 rounded">
                          <div className="text-green-400 font-medium mb-2">📊 XLSX 编辑</div>
                          <ul className="text-slate-400 space-y-1">
                            <li><code className="text-green-300">Excel + VBA</code> - 设置 veryHidden</li>
                            <li><code className="text-green-300">openpyxl</code> - Python 编辑库</li>
                            <li><code className="text-green-300">解压+文本编辑器</code> - 改 workbook.xml</li>
                          </ul>
                        </div>
                        <div className="bg-slate-900 p-3 rounded">
                          <div className="text-purple-400 font-medium mb-2">🖼️ 图片编辑</div>
                          <ul className="text-slate-400 space-y-1">
                            <li><code className="text-purple-300">exiftool</code> - 修改 EXIF/注释</li>
                            <li><code className="text-purple-300">Pillow</code> - Python 图片库</li>
                            <li><code className="text-purple-300">十六进制编辑器</code> - 直接改字节</li>
                          </ul>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 p-3 rounded border border-dashed border-slate-600">
                        <div className="text-xs text-slate-400">
                          💡 <strong>查看隐藏内容：</strong>下载上方的恶意文件样本，使用以下方式查看：
                        </div>
                        <ul className="text-xs text-slate-500 mt-2 ml-4 list-disc space-y-1">
                          <li>PDF：<code>pdftotext -layout file.pdf -</code> 或用文本编辑器打开</li>
                          <li>DOCX：解压后查看 <code>word/document.xml</code></li>
                          <li>XLSX：Excel VBA 编辑器查看工作表属性</li>
                          <li>图片：<code>exiftool -a image.jpg</code></li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 攻击详情 Tab (readme) */}
                  {docTab === 'readme' && (
                    <div className="space-y-3">
                      <div className="bg-green-900/20 p-3 rounded border border-green-500/30">
                        <div className="text-xs text-green-400 font-medium mb-1">📋 此攻击样本的具体内容</div>
                        <p className="text-xs text-slate-500">以下是恶意文件中嵌入的具体恶意指令和手脚：</p>
                      </div>
                      <pre className="text-xs bg-slate-900 p-3 rounded overflow-auto max-h-48 custom-scroll whitespace-pre-wrap leading-relaxed">
                        {documentReadme ? documentReadme.split('\n').map((line, i) => {
                          if (line.startsWith('===') || line.startsWith('【')) {
                            return <span key={i} className="text-orange-400">{line}{'\n'}</span>;
                          }
                          if (line.includes('🔴') || line.includes('❌') || line.includes('SYSTEM') || line.includes('AI指令') || line.includes('AI-REVIEW')) {
                            return <span key={i} className="text-red-400">{line}{'\n'}</span>;
                          }
                          if (line.startsWith('-') || line.startsWith('•')) {
                            return <span key={i} className="text-slate-400">{line}{'\n'}</span>;
                          }
                          return <span key={i} className="text-slate-300">{line}{'\n'}</span>;
                        }) : <span className="text-slate-500">暂无详细文档，请下载文件样本查看</span>}
                      </pre>
                    </div>
                  )}

                  {/* 附件处理 Tab */}
                  {docTab === 'parsing' && (
                    <div className="space-y-3">
                      <div className="bg-blue-900/20 p-3 rounded border border-blue-500/30">
                        <div className="text-xs text-blue-400 font-medium mb-2">📎 LLM 如何处理附件？</div>
                        <p className="text-xs text-slate-300 leading-relaxed mb-2">
                          大多数 LLM API <strong className="text-blue-300">只接受纯文本输入</strong>。
                          文件需要先被解析为文本，再发送给模型：
                        </p>
                        <ol className="text-xs text-slate-400 ml-4 list-decimal space-y-1">
                          <li>用户上传文件 → 服务端接收</li>
                          <li>调用<strong className="text-orange-300">文件解析服务</strong>提取文本</li>
                          <li>文本被<strong className="text-red-300">注入到 Prompt</strong></li>
                          <li>LLM 处理纯文本，无法区分来源</li>
                        </ol>
                      </div>

                      <div className="bg-slate-900 p-3 rounded">
                        <div className="text-xs text-slate-400 font-medium mb-2">🔧 常见文件解析工具</div>
                        <p className="text-xs text-slate-500 mb-2">不同工具对隐藏内容的提取能力不同，影响攻击成功率：</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-700">
                                <th className="text-left py-1 text-slate-400">文件类型</th>
                                <th className="text-left py-1 text-slate-400">解析工具</th>
                                <th className="text-left py-1 text-slate-400">隐藏内容提取</th>
                              </tr>
                            </thead>
                            <tbody className="text-slate-300">
                              <tr className="border-b border-slate-800">
                                <td className="py-1">PDF</td>
                                <td><code className="text-orange-300">PyMuPDF</code>, <code className="text-orange-300">pdfplumber</code></td>
                                <td className="text-green-400">✓ 提取所有文字层</td>
                              </tr>
                              <tr className="border-b border-slate-800">
                                <td className="py-1">PDF</td>
                                <td><code className="text-orange-300">pdf2image + OCR</code></td>
                                <td className="text-yellow-400">△ 仅识别可见内容</td>
                              </tr>
                              <tr className="border-b border-slate-800">
                                <td className="py-1">DOCX</td>
                                <td><code className="text-blue-300">python-docx</code></td>
                                <td className="text-green-400">✓ 包含隐藏文本</td>
                              </tr>
                              <tr className="border-b border-slate-800">
                                <td className="py-1">XLSX</td>
                                <td><code className="text-green-300">openpyxl</code></td>
                                <td className="text-red-400">✗ 默认不读 veryHidden</td>
                              </tr>
                              <tr>
                                <td className="py-1">图片</td>
                                <td><code className="text-purple-300">pytesseract</code></td>
                                <td className="text-yellow-400">△ 取决于字体大小</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 p-3 rounded border border-dashed border-slate-600">
                        <div className="text-xs text-slate-400">
                          💡 <strong>本平台的测试方式：</strong>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          本平台模拟文件解析后的文本注入场景。未来可通过 MCP 集成真实解析工具，
                          测试不同解析器对隐藏内容的处理差异。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 真实测试模式控制面板 */}
        {mode === 'real' && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg">
            {/* 模型选择、MCP配置和执行按钮 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                {/* 模型选择 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">选择模型：</span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                  >
                    {CONFIG.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* MCP 开关 */}
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-1.5 cursor-pointer"
                    title="启用后，上传的文件将被解析提取文本内容"
                  >
                    <input
                      type="checkbox"
                      checked={mcpEnabled}
                      onChange={(e) => setMcpEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-400">文件解析</span>
                  </label>
                  {mcpEnabled && (
                    <span className="text-xs text-purple-400">
                      ({Object.values(mcpParsers).flat().length} 工具)
                    </span>
                  )}
                </div>
                {/* 工具调用开关 */}
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-1.5 cursor-pointer"
                    title="启用后，LLM 可调用沙箱中的工具执行操作"
                  >
                    <input
                      type="checkbox"
                      checked={toolsEnabled}
                      onChange={(e) => setToolsEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-400">工具调用</span>
                  </label>
                  {toolsEnabled && (
                    sandboxStatus === 'running' ? (
                      <span className="text-xs text-cyan-400">
                        ({Object.values(enabledTools).filter(Boolean).length} 个)
                      </span>
                    ) : (
                      <span className="text-xs text-yellow-400 animate-pulse">
                        ⚠️ 需启动沙箱
                      </span>
                    )
                  )}
                </div>
                {/* RAG 开关 */}
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-1.5 cursor-pointer"
                    title="启用后，将知识库内容注入到上下文中进行 RAG 测试"
                  >
                    <input
                      type="checkbox"
                      checked={ragEnabled}
                      onChange={(e) => setRagEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-400">RAG</span>
                  </label>
                  {ragEnabled && ragKnowledge && (
                    <span className="text-xs text-amber-400">
                      ({ragKnowledge.split('\n').filter(l => l.trim()).length} 条)
                    </span>
                  )}
                </div>
                {/* MCP Server 开关 */}
                <div className="flex items-center gap-2">
                  <label
                    className="flex items-center gap-1.5 cursor-pointer"
                    title="启用后，可配置 MCP 服务器进行工具调用测试"
                  >
                    <input
                      type="checkbox"
                      checked={mcpServerEnabled}
                      onChange={(e) => setMcpServerEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-400">MCP</span>
                  </label>
                  {mcpServerEnabled && (
                    <span className="text-xs text-emerald-400">
                      ({Object.values(mcpServerConfigs).filter(c => c?.enabled).length} 已连接)
                    </span>
                  )}
                </div>
              </div>
              {/* 执行按钮区域 - 根据对话模式显示不同按钮 */}
              {dialogMode === 'single' ? (
                // 单轮模式：保持原有行为
                <button
                  onClick={runRealTest}
                  disabled={apiStatus === 'loading'}
                  className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                    apiStatus === 'loading'
                      ? 'bg-slate-600 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  {apiStatus === 'loading' ? `⏳ 请求中... ${(apiElapsedTime / 1000).toFixed(1)}s` : '▶️ 执行测试'}
                </button>
              ) : (
                // 多轮模式：开始/停止切换
                conversationMode === 'idle' ? (
                  <button
                    onClick={startConversation}
                    disabled={apiStatus === 'loading'}
                    className="px-4 py-1.5 rounded text-xs font-medium transition bg-green-600 hover:bg-green-500"
                  >
                    ▶️ 开始测试
                  </button>
                ) : conversationMode === 'active' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={stopConversation}
                      className="px-4 py-1.5 rounded text-xs font-medium transition bg-red-600 hover:bg-red-500"
                    >
                      ⏹️ 停止测试
                    </button>
                    {apiStatus === 'loading' && (
                      <span className="text-xs text-slate-400 animate-pulse">⏳ 处理中...</span>
                    )}
                  </div>
                ) : (
                  <span className="px-4 py-1.5 text-xs text-violet-400 animate-pulse">🔍 评判中...</span>
                )
              )}
            </div>

            {/* MCP 解析器配置面板 */}
            {mcpEnabled && (
              <div className="mb-3 p-2 bg-slate-900 rounded border border-purple-900/50">
                <div className="text-xs text-purple-400 flex items-center justify-between">
                  <button
                    onClick={() => setMcpConfigCollapsed(!mcpConfigCollapsed)}
                    className="flex items-center gap-2 hover:text-purple-300 transition"
                  >
                    <span>{mcpConfigCollapsed ? '▶' : '▼'}</span>
                    <span>🔧 文件解析器配置</span>
                  </button>
                  <span className="text-slate-500 text-[10px]">
                    勾选启用，取消勾选禁用
                    {payloadFiles.length > 0 && <span className="text-yellow-500 ml-2">| 修改后需重新上传文件</span>}
                  </span>
                </div>
                {!mcpConfigCollapsed && (
                  <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
                  {Object.entries(CONFIG.mcp.parsers).map(([fileType, config]) => (
                    <div key={fileType} className="bg-slate-800 rounded p-2">
                      <div className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1">
                        <span>{fileType === 'pdf' ? '📄' : fileType === 'docx' ? '📝' : fileType === 'xlsx' ? '📊' : '🖼️'}</span>
                        <span>{config.label}</span>
                      </div>
                      <div className="space-y-1">
                        {config.tools.map((tool, idx) => {
                          const isSelected = mcpParsers[fileType]?.includes(tool.id);
                          const priority = mcpParsers[fileType]?.indexOf(tool.id);
                          return (
                            <label
                              key={tool.id}
                              className={`flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded transition ${
                                isSelected ? 'bg-purple-900/30' : 'hover:bg-slate-700'
                              }`}
                              title={tool.desc}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  setMcpParsers(prev => {
                                    const updated = { ...prev };
                                    if (e.target.checked) {
                                      updated[fileType] = [...(prev[fileType] || []), tool.id];
                                    } else {
                                      updated[fileType] = (prev[fileType] || []).filter(id => id !== tool.id);
                                    }
                                    return updated;
                                  });
                                }}
                                className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-purple-500"
                              />
                              <span className={isSelected ? 'text-slate-200' : 'text-slate-400'}>
                                {tool.name}
                              </span>
                              {isSelected && priority >= 0 && (
                                <span className="ml-auto text-purple-400 text-[10px]">#{priority + 1}</span>
                              )}
                              {tool.hiddenExtract && (
                                <span className="text-yellow-500 text-[10px]" title="可提取隐藏内容">⚠</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-3">
                  <span>⚠ = 可提取隐藏文本层</span>
                  <span>数字 = 解析优先级</span>
                  <span className="text-slate-600">服务端点: {CONFIG.mcp.serverUrl}</span>
                </div>
                  </>
                )}
              </div>
            )}

            {/* 工具调用配置面板 */}
            {toolsEnabled && (
              <div className="mb-3 p-2 bg-slate-900 rounded border border-cyan-900/50">
                <div className="text-xs text-cyan-400 flex items-center justify-between">
                  <button
                    onClick={() => setToolsConfigCollapsed(!toolsConfigCollapsed)}
                    className="flex items-center gap-2 hover:text-cyan-300 transition"
                  >
                    <span>{toolsConfigCollapsed ? '▶' : '▼'}</span>
                    <span>🔧 工具调用配置</span>
                  </button>
                  <span className="text-slate-500 text-[10px]">
                    已启用 {Object.values(enabledTools).filter(Boolean).length} / {Object.keys(enabledTools).length} 个工具
                  </span>
                </div>
                {!toolsConfigCollapsed && (
                  <>
                    <div className="mt-2 mb-2 flex items-center gap-4 text-xs">
                      <span className="text-slate-400">最大调用次数:</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={maxToolCalls}
                        onChange={(e) => setMaxToolCalls(parseInt(e.target.value) || 10)}
                        className="w-16 bg-slate-800 border border-slate-600 rounded px-1 text-cyan-400 font-mono text-xs"
                      />
                      <div className="flex gap-2 ml-auto">
                        <button
                          onClick={() => {
                            const newTools = {};
                            Object.keys(enabledTools).forEach(name => { newTools[name] = true; });
                            setEnabledTools(newTools);
                          }}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                        >
                          全选
                        </button>
                        <button
                          onClick={() => {
                            const newTools = {};
                            Object.entries(CONFIG.tools.available).forEach(([name, tool]) => {
                              newTools[name] = tool.category === 'safe';
                            });
                            setEnabledTools(newTools);
                          }}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                        >
                          仅安全
                        </button>
                        <button
                          onClick={() => {
                            const newTools = {};
                            Object.keys(enabledTools).forEach(name => { newTools[name] = false; });
                            setEnabledTools(newTools);
                          }}
                          className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                        >
                          全不选
                        </button>
                      </div>
                    </div>
                    {/* 按类别显示工具 */}
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(CONFIG.tools.categories).map(([category, catConfig]) => (
                        <div key={category} className={`bg-slate-800 rounded p-2 border-l-2 ${
                          category === 'safe' ? 'border-green-500' :
                          category === 'risky' ? 'border-orange-500' : 'border-red-500'
                        }`}>
                          <div className={`text-xs font-medium mb-1.5 ${
                            category === 'safe' ? 'text-green-400' :
                            category === 'risky' ? 'text-orange-400' : 'text-red-400'
                          }`}>
                            {catConfig.label}
                          </div>
                          <div className="space-y-1">
                            {Object.entries(CONFIG.tools.available)
                              .filter(([_, tool]) => tool.category === category)
                              .map(([name, tool]) => (
                                <label
                                  key={name}
                                  className={`flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded transition ${
                                    enabledTools[name] ? 'bg-slate-700/50' : 'hover:bg-slate-700/30'
                                  }`}
                                  title={tool.description}
                                >
                                  <input
                                    type="checkbox"
                                    checked={enabledTools[name] || false}
                                    onChange={(e) => {
                                      setEnabledTools(prev => ({
                                        ...prev,
                                        [name]: e.target.checked
                                      }));
                                    }}
                                    className="w-3 h-3 rounded border-slate-500 bg-slate-700 text-cyan-500"
                                  />
                                  <span className={enabledTools[name] ? 'text-slate-200' : 'text-slate-400'}>
                                    {tool.label}
                                  </span>
                                </label>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500">
                      启用工具后，LLM 可在测试中调用这些工具。工具将在沙箱中执行。
                    </div>
                  </>
                )}
              </div>
            )}

            {/* RAG 配置面板 */}
            {ragEnabled && (
              <div className="mb-3 p-2 bg-slate-900 rounded border border-amber-900/50">
                <div className="text-xs text-amber-400 flex items-center justify-between">
                  <button
                    onClick={() => setRagConfigCollapsed(!ragConfigCollapsed)}
                    className="flex items-center gap-2 hover:text-amber-300 transition"
                  >
                    <span>{ragConfigCollapsed ? '▶' : '▼'}</span>
                    <span>📚 RAG 知识库配置</span>
                  </button>
                  <div className="flex items-center gap-3">
                    {/* 模式切换 */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        onClick={() => setRagMode('mock')}
                        className={`px-2 py-0.5 rounded transition ${
                          ragMode === 'mock'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        Mock
                      </button>
                      <button
                        onClick={() => setRagMode('real')}
                        className={`px-2 py-0.5 rounded transition ${
                          ragMode === 'real'
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                        disabled={!ragServiceAvailable}
                        title={ragServiceAvailable ? '使用真实 RAG 服务' : 'RAG 服务不可用，请启动后端'}
                      >
                        Real {!ragServiceAvailable && '(不可用)'}
                      </button>
                    </div>
                  </div>
                </div>
                {!ragConfigCollapsed && (
                  <>
                    {ragMode === 'mock' ? (
                      /* Mock 模式：手动输入 */
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        {/* 左栏：显示知识库 */}
                        <div className="flex flex-col">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                            <span>当前知识库</span>
                            <span className="text-slate-500">
                              {ragKnowledge ? `${ragKnowledge.split('\n').filter(l => l.trim()).length} 条` : '空'}
                            </span>
                          </div>
                          <div
                            className="flex-1 bg-slate-800 rounded p-2 text-xs text-slate-300 font-mono overflow-auto border border-slate-700"
                            style={{ maxHeight: '300px', minHeight: '120px' }}
                          >
                            {ragKnowledge ? (
                              <pre className="whitespace-pre-wrap">{ragKnowledge}</pre>
                            ) : (
                              <span className="text-slate-500 italic">暂无知识库内容，请在右侧编辑区添加</span>
                            )}
                          </div>
                        </div>
                        {/* 右栏：编辑知识库 */}
                        <div className="flex flex-col">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                            <span>编辑知识库</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setRagKnowledge(ragKnowledgeEdit);
                                }}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px]"
                              >
                                应用
                              </button>
                              <button
                                onClick={() => {
                                  setRagKnowledgeEdit(ragKnowledge);
                                }}
                                className="px-2 py-0.5 bg-slate-600 hover:bg-slate-500 rounded text-white text-[10px]"
                              >
                                重置
                              </button>
                              <button
                                onClick={() => {
                                  setRagKnowledgeEdit('');
                                  setRagKnowledge('');
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                              >
                                清空
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={ragKnowledgeEdit}
                            onChange={(e) => setRagKnowledgeEdit(e.target.value)}
                            placeholder="每行输入一条知识条目，例如：&#10;- 用户张三的账号余额为 10000 元&#10;- 最新促销活动：满 1000 减 200&#10;- 公司内部通讯录：CEO 手机 138xxxx&#10;&#10;也可以输入恶意内容测试 RAG 投毒攻击"
                            className="flex-1 bg-slate-800 rounded p-2 text-xs text-slate-300 font-mono border border-slate-600 focus:border-amber-500 focus:outline-none resize-none"
                            style={{ maxHeight: '300px', minHeight: '120px' }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Real 模式：真实 RAG 服务 */
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        {/* 左栏：文档列表 */}
                        <div className="flex flex-col">
                          <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                            <span>知识库文档</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">{ragDocuments.length} 个</span>
                              <button
                                onClick={handleRagReset}
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 rounded text-white text-[10px]"
                                title="重置为预置测试数据"
                              >
                                重置
                              </button>
                              <button
                                onClick={handleRagClear}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                                disabled={ragDocuments.length === 0}
                              >
                                清空
                              </button>
                            </div>
                          </div>
                          <div
                            className="flex-1 bg-slate-800 rounded p-2 text-xs text-slate-300 overflow-auto border border-slate-700"
                            style={{ maxHeight: '300px', minHeight: '120px' }}
                          >
                            {ragDocuments.length > 0 ? (
                              <div className="space-y-1">
                                {ragDocuments.map((doc) => (
                                  <div
                                    key={doc.document_id}
                                    className="flex items-center justify-between p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span>{ragClient.getDocumentTypeIcon(doc.document_type)}</span>
                                      <span className="truncate">{doc.source_name}</span>
                                      <span className="text-slate-500 text-[10px]">({doc.chunk_count} 块)</span>
                                    </div>
                                    <button
                                      onClick={() => handleRagDelete(doc.document_id)}
                                      className="text-red-400 hover:text-red-300 px-1"
                                      title="删除"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">暂无文档，请上传文件</span>
                            )}
                          </div>
                        </div>
                        {/* 右栏：上传和检索结果 */}
                        <div className="flex flex-col gap-2">
                          {/* 文件上传区 */}
                          <div className="text-xs text-slate-400 mb-1">上传文档</div>
                          <label
                            className={`flex-1 flex flex-col items-center justify-center p-4 bg-slate-800 rounded border-2 border-dashed cursor-pointer transition ${
                              ragUploading
                                ? 'border-amber-500 bg-amber-900/20'
                                : 'border-slate-600 hover:border-amber-500'
                            }`}
                            style={{ minHeight: '80px' }}
                          >
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.docx,.xlsx,.txt,.md,.json,.csv,.jpg,.jpeg,.png"
                              onChange={(e) => handleRagUpload(e.target.files[0])}
                              disabled={ragUploading}
                            />
                            {ragUploading ? (
                              <>
                                <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mb-2" />
                                <span className="text-amber-400">上传中...</span>
                              </>
                            ) : (
                              <>
                                <span className="text-2xl mb-1">📤</span>
                                <span className="text-slate-400">拖拽上传</span>
                                <span className="text-slate-500 text-[10px] mt-1">
                                  支持 PDF, DOCX, XLSX, TXT, 图片
                                </span>
                              </>
                            )}
                          </label>
                          {/* 最近检索结果 */}
                          {ragQueryResults && ragQueryResults.results && ragQueryResults.results.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-slate-400 mb-1">最近检索结果</div>
                              <div className="bg-slate-800 rounded p-2 text-xs space-y-1 max-h-32 overflow-auto">
                                {ragQueryResults.results.slice(0, 3).map((result, i) => (
                                  <div key={i} className="flex items-start gap-2 text-slate-300">
                                    <span className="text-green-400 font-mono">
                                      {ragClient.formatScore(result.score)}
                                    </span>
                                    <span className="truncate flex-1">{result.content.slice(0, 100)}...</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="mt-2 text-[10px] text-slate-500">
                  {ragMode === 'mock'
                    ? 'Mock 模式：手动输入内容作为检索结果注入。可用于测试知识库投毒、数据泄露等攻击场景。'
                    : 'Real 模式：使用真实向量检索。上传文档后，系统将自动分块、嵌入，并在测试时执行语义检索。'
                  }
                </div>
              </div>
            )}

            {/* MCP Server 配置面板 */}
            {mcpServerEnabled && (
              <div className="mb-3 p-2 bg-slate-900 rounded border border-emerald-900/50">
                <div className="text-xs text-emerald-400 flex items-center justify-between">
                  <button
                    onClick={() => setMcpServerConfigCollapsed(!mcpServerConfigCollapsed)}
                    className="flex items-center gap-2 hover:text-emerald-300 transition"
                  >
                    <span>{mcpServerConfigCollapsed ? '▶' : '▼'}</span>
                    <span>🔌 MCP Server 配置</span>
                  </button>
                  <span className="text-slate-500 text-[10px]">
                    选择并配置外部服务
                  </span>
                </div>
                {!mcpServerConfigCollapsed && (
                  <div className="mt-2 grid grid-cols-3 gap-3" style={{ minHeight: '200px' }}>
                    {/* 左栏：MCP 服务列表 */}
                    <div className="flex flex-col">
                      <div className="text-xs text-slate-400 mb-1">可用服务</div>
                      <div className="flex-1 bg-slate-800 rounded p-2 space-y-1">
                        {Object.values(CONFIG.mcpServers.available).map((server) => {
                          const config = mcpServerConfigs[server.id];
                          const isEnabled = config?.enabled;
                          const status = mcpServerStatus[server.id];
                          return (
                            <button
                              key={server.id}
                              onClick={() => setSelectedMcpServer(server.id)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center justify-between ${
                                selectedMcpServer === server.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>{server.icon}</span>
                                <span>{server.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {status === 'testing' && (
                                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="测试中" />
                                )}
                                {status === 'connected' && (
                                  <span className="w-2 h-2 rounded-full bg-green-400" title="已连接" />
                                )}
                                {status === 'error' && (
                                  <span className="w-2 h-2 rounded-full bg-red-400" title="连接失败" />
                                )}
                                {isEnabled && !status && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" title="已启用" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* 右栏：配置表单 */}
                    <div className="col-span-2 flex flex-col">
                      {selectedMcpServer ? (
                        (() => {
                          const server = CONFIG.mcpServers.available[selectedMcpServer];
                          const config = mcpServerConfigs[selectedMcpServer] || {};
                          const status = mcpServerStatus[selectedMcpServer];
                          return (
                            <>
                              <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
                                <span>{server.icon} {server.name} 配置</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      console.log('[MCP] Testing connection for:', selectedMcpServer, config);
                                      setMcpServerStatus(prev => ({ ...prev, [selectedMcpServer]: 'testing' }));
                                      try {
                                        const result = await mcpClient.testConnection(selectedMcpServer, config);
                                        console.log('[MCP] Test result:', result);
                                        setMcpServerStatus(prev => ({
                                          ...prev,
                                          [selectedMcpServer]: result.success ? 'connected' : 'error'
                                        }));
                                        if (!result.success) {
                                          alert(`连接失败: ${result.error || '未知错误'}`);
                                        }
                                      } catch (e) {
                                        console.error('[MCP] Test connection error:', e);
                                        setMcpServerStatus(prev => ({ ...prev, [selectedMcpServer]: 'error' }));
                                        alert(`连接测试失败: ${e.message}`);
                                      }
                                    }}
                                    disabled={status === 'testing'}
                                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-[10px] disabled:opacity-50"
                                  >
                                    {status === 'testing' ? '测试中...' : '测试连接'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      console.log('[MCP] Toggle enabled for:', selectedMcpServer, 'current:', config.enabled);
                                      const updated = {
                                        ...mcpServerConfigs,
                                        [selectedMcpServer]: { ...config, enabled: !config.enabled }
                                      };
                                      setMcpServerConfigs(updated);
                                      localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
                                      console.log('[MCP] Updated configs:', updated);
                                    }}
                                    className={`px-2 py-0.5 rounded text-white text-[10px] ${
                                      config.enabled
                                        ? 'bg-red-600 hover:bg-red-500'
                                        : 'bg-emerald-600 hover:bg-emerald-500'
                                    }`}
                                  >
                                    {config.enabled ? '禁用' : '启用'}
                                  </button>
                                </div>
                              </div>
                              <div className="text-xs text-slate-500 mb-2">{server.description}</div>
                              <div className="flex-1 bg-slate-800 rounded p-2 overflow-auto">
                                <div className="space-y-2">
                                  {server.fields.map((field) => (
                                    <div key={field.key} className="flex flex-col gap-1">
                                      <label className="text-xs text-slate-400 flex items-center gap-1">
                                        {field.label}
                                        {field.required && <span className="text-red-400">*</span>}
                                      </label>
                                      {field.type === 'checkbox' ? (
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={config[field.key] ?? field.default ?? false}
                                            onChange={(e) => {
                                              const updated = {
                                                ...mcpServerConfigs,
                                                [selectedMcpServer]: { ...config, [field.key]: e.target.checked }
                                              };
                                              setMcpServerConfigs(updated);
                                              localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-emerald-500"
                                          />
                                          <span className="text-xs text-slate-300">
                                            {config[field.key] ? '是' : '否'}
                                          </span>
                                        </label>
                                      ) : (
                                        <input
                                          type={field.type}
                                          value={config[field.key] ?? field.default ?? ''}
                                          placeholder={field.placeholder}
                                          onChange={(e) => {
                                            const value = field.type === 'number' ? Number(e.target.value) : e.target.value;
                                            const updated = {
                                              ...mcpServerConfigs,
                                              [selectedMcpServer]: { ...config, [field.key]: value }
                                            };
                                            setMcpServerConfigs(updated);
                                            localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
                                          }}
                                          className="w-full px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200 focus:border-emerald-500 focus:outline-none"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {/* 可用工具列表 */}
                                <div className="mt-3 pt-2 border-t border-slate-700">
                                  <div className="text-xs text-slate-400 mb-1">提供的工具</div>
                                  <div className="flex flex-wrap gap-1">
                                    {server.tools.map((tool) => (
                                      <span
                                        key={tool}
                                        className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-300"
                                      >
                                        {tool}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                          ← 选择一个 MCP 服务进行配置
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-2 text-[10px] text-slate-500">
                  MCP (Model Context Protocol) 服务提供外部工具能力。配置后可在攻击测试中调用这些工具。
                </div>
              </div>
            )}

            {/* 解析进度指示器 */}
            {isParsingFile && parsingProgress && (
              <div className="mb-2 p-3 bg-slate-800 rounded border border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <span className="text-xs text-blue-400 font-medium">
                      正在使用 {parsingProgress.parser} 解析
                    </span>
                    <span className="text-xs text-slate-400">
                      ({parsingProgress.runLocation === 'sandbox' ? '沙箱隔离' : 'MCP后端'})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (parsingAbortController) {
                        parsingAbortController.abort();
                      }
                    }}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded transition"
                  >
                    取消
                  </button>
                </div>

                <div className="text-xs text-slate-300">
                  <div>📄 {parsingProgress.filename}</div>
                  <div className="mt-1 flex gap-4">
                    <span>已用时间: {(parsingProgress.elapsedTime / 1000).toFixed(1)}s</span>
                    <span>预估剩余: {Math.max(0, (parsingProgress.estimatedTime - parsingProgress.elapsedTime) / 1000).toFixed(1)}s</span>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mt-2 w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (parsingProgress.elapsedTime / parsingProgress.estimatedTime) * 100)}%`
                    }}
                  />
                </div>
              </div>
            )}

            {/* 模型配置区域 - 可折叠 */}
            <div className="mb-3 bg-slate-900 rounded border border-slate-700">
              {/* 折叠标题栏 */}
              <div className="flex items-center justify-between p-2 border-b border-slate-700">
                <button
                  onClick={() => setPromptConfigCollapsed(!promptConfigCollapsed)}
                  className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 transition"
                >
                  <span>{promptConfigCollapsed ? '▶' : '▼'}</span>
                  <span className="font-medium">⚙️ 模型配置</span>
                  {(customSystemPrompt !== currentScenario.systemPrompt || customTestPayload !== currentAttack.testPayload || payloadFiles.length > 0) && (
                    <span className="text-yellow-400">(已修改)</span>
                  )}
                </button>
                <div className="flex items-center gap-4 text-xs">
                  {/* 思考模式开关 */}
                  <label className="flex items-center gap-1.5 cursor-pointer" title="启用后，模型响应将包含思考过程">
                    <input
                      type="checkbox"
                      checked={thinkingEnabled}
                      onChange={(e) => setThinkingEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-pink-500 focus:ring-pink-500 focus:ring-offset-0"
                    />
                    <span className="text-slate-400">💭 思考模式</span>
                  </label>
                  {thinkingEnabled && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 text-[10px]">budget:</span>
                      <input
                        type="number"
                        min="1000"
                        max="100000"
                        step="1000"
                        value={thinkingBudget}
                        onChange={(e) => setThinkingBudget(parseInt(e.target.value) || 10000)}
                        className="w-16 bg-slate-700 border border-slate-600 rounded px-1 text-pink-400 font-mono text-[10px]"
                      />
                    </div>
                  )}

                  {/* 对话模式切换 */}
                  <div className="flex items-center gap-1 bg-slate-800 rounded p-0.5">
                    <button
                      onClick={() => setDialogMode('single')}
                      disabled={conversationMode !== 'idle'}
                      className={`px-2 py-0.5 rounded text-[10px] transition ${
                        dialogMode === 'single'
                          ? 'bg-slate-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      单轮
                    </button>
                    <button
                      onClick={() => setDialogMode('multi')}
                      disabled={conversationMode !== 'idle'}
                      className={`px-2 py-0.5 rounded text-[10px] transition ${
                        dialogMode === 'multi'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      } ${conversationMode !== 'idle' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      多轮
                    </button>
                  </div>
                </div>
              </div>

              {/* 可折叠内容 */}
              {!promptConfigCollapsed && (
                <div className="p-2">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* LLM 配置模块 */}
                    <div className="bg-slate-800 rounded border border-slate-600 flex flex-col">
                      {/* 标题栏 - 参数显示在标题行 */}
                      <div className="flex items-center justify-between p-2 border-b border-slate-600">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-slate-400 font-medium">系统提示词</span>
                          {/* LLM 参数内联显示/编辑 */}
                          <span className="text-slate-500">Temp</span>
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={llmTemperature}
                            onChange={(e) => setLlmTemperature(parseFloat(e.target.value) || 0)}
                            disabled={!isEditingLlmConfig}
                            className={`w-12 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                              isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                            }`}
                          />
                          <span className="text-slate-500">MaxTok</span>
                          <input
                            type="number"
                            min="256"
                            max="131072"
                            step="1024"
                            value={llmMaxTokens}
                            onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || 256)}
                            disabled={!isEditingLlmConfig}
                            className={`w-16 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                              isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                            }`}
                          />
                          <span className="text-slate-500">TopP</span>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            value={llmTopP}
                            onChange={(e) => setLlmTopP(parseFloat(e.target.value) || 0)}
                            disabled={!isEditingLlmConfig}
                            className={`w-12 bg-slate-700 border rounded px-1 text-cyan-400 font-mono text-xs ${
                              isEditingLlmConfig ? 'border-blue-500' : 'border-slate-500'
                            }`}
                          />
                          {customSystemPrompt !== currentScenario.systemPrompt && (
                            <span className="text-yellow-400 text-[10px]">(改)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isEditingLlmConfig ? (
                            <>
                              <button
                                onClick={() => setIsEditingLlmConfig(false)}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => {
                                  setCustomSystemPrompt(currentScenario.systemPrompt || '');
                                  setLlmTemperature(CONFIG.llmParams.temperature);
                                  setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                                  setLlmTopP(CONFIG.llmParams.top_p);
                                  setIsEditingLlmConfig(false);
                                }}
                                className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setIsEditingLlmConfig(true)}
                                className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  setCustomSystemPrompt(currentScenario.systemPrompt || '');
                                  setLlmTemperature(CONFIG.llmParams.temperature);
                                  setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                                  setLlmTopP(CONFIG.llmParams.top_p);
                                }}
                                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                              >
                                重置
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* 内容区 - 系统提示词 */}
                      <div className="p-2 flex-1">
                        {isEditingLlmConfig ? (
                          <textarea
                            value={customSystemPrompt}
                            onChange={(e) => setCustomSystemPrompt(e.target.value)}
                            className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-slate-700 p-2 rounded border border-blue-500 text-cyan-300 font-mono resize-none focus:outline-none custom-scroll"
                            placeholder="输入系统提示词..."
                          />
                        ) : (
                          <pre className="text-xs bg-slate-700 p-2 rounded overflow-auto max-h-[8rem] custom-scroll text-cyan-300 whitespace-pre-wrap">
                            {customSystemPrompt || '(无系统提示词)'}
                          </pre>
                        )}
                      </div>
                    </div>

                    {/* 用户提示词模块 */}
                    <div className="bg-slate-800 rounded border border-slate-600 flex flex-col">
                      {/* 标题栏 */}
                      <div className="flex items-center justify-between p-2 border-b border-slate-600">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-medium">用户提示词</span>
                          {(customTestPayload !== currentAttack.testPayload || payloadFiles.length > 0) && (
                            <span className="text-yellow-400 text-[10px]">(改)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {isEditingPayload && (
                            <label
                              className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded cursor-pointer transition"
                              title="添加文件作为用户输入，文件内容将被解析后注入提示词"
                            >
                              添加文件
                              <input type="file" className="hidden" onChange={handleAddFile} multiple />
                            </label>
                          )}
                          {isEditingPayload ? (
                            <>
                              <button
                                onClick={() => setIsEditingPayload(false)}
                                className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => {
                                  setCustomTestPayload(currentAttack.testPayload || '');
                                  setPayloadFiles([]);
                                  setIsEditingPayload(false);
                                }}
                                className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setIsEditingPayload(true)}
                                className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  setCustomTestPayload(currentAttack.testPayload || '');
                                  setPayloadFiles([]);
                                }}
                                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                              >
                                重置
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* 文件列表（如果有） */}
                      {payloadFiles.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-2 pt-2">
                          {payloadFiles.map((file, i) => (
                            <span key={i} className="text-xs bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
                              📄 {file.name}
                              {isEditingPayload && (
                                <button
                                  onClick={() => removePayloadFile(i)}
                                  className="text-red-400 hover:text-red-300 ml-1"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* 内容区 - Payload 文本 */}
                      <div className="p-2 flex-1">
                        {isEditingPayload ? (
                          <textarea
                            value={customTestPayload}
                            onChange={(e) => setCustomTestPayload(e.target.value)}
                            className="w-full h-full min-h-[8rem] max-h-[8rem] text-xs bg-slate-700 p-2 rounded border border-blue-500 text-orange-300 font-mono resize-none focus:outline-none custom-scroll break-all"
                            placeholder="输入用户提示词..."
                          />
                        ) : (
                          <pre className="text-xs bg-slate-700 p-2 rounded overflow-y-auto overflow-x-hidden max-h-[8rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
                            {getDisplayPayload() || '(无用户提示词)'}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {apiError && (
              <div className="mt-2 text-xs text-red-400">❌ {apiError}</div>
            )}
          </div>
        )}

        {/* 主面板 */}
        <div className={`flex-1 grid grid-cols-1 ${thinkingEnabled ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4 min-h-0`}>
          {/* 对话面板 */}
          <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
              <span className="text-xs text-slate-400">🤖 被测模型：</span>
              <span className="text-xs font-mono text-blue-400">
                {mode === 'real'
                  ? (CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel)
                  : CONFIG.api.model}
              </span>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto custom-scroll space-y-2 pr-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? msg.isInjection ? 'bg-red-900/50 border border-red-500/40' : 'bg-blue-600'
                      : msg.isDangerous ? 'bg-orange-900/50 border border-orange-500/40' : 'bg-slate-700'
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                    {msg.isInjection && <div className="mt-1 text-red-300 text-xs">⚠️ 恶意注入</div>}
                    {msg.isDangerous && <div className="mt-1 text-orange-300 text-xs">⚠️ 危险输出</div>}
                  </div>
                </div>
              ))}
              {typingMsg && (
                <div className={`flex ${typingMsg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                    typingMsg.role === 'user'
                      ? typingMsg.isInjection ? 'bg-red-900/30 border border-red-500/30' : 'bg-blue-600/70'
                      : 'bg-slate-700/70'
                  }`}>
                    <span className="whitespace-pre-wrap font-sans leading-relaxed">{typingMsg.content}<span className="animate-pulse">▋</span></span>
                  </div>
                </div>
              )}
              {messages.length === 0 && !typingMsg && (
                <div className="text-slate-500 text-center py-8">
                  {mode === 'mock' ? '等待演示开始...' :
                    dialogMode === 'multi' ? '点击「开始测试」发送 Payload' : '点击「执行测试」发送 Payload'}
                </div>
              )}
            </div>

            {/* 多轮对话输入框 */}
            {mode === 'real' && dialogMode === 'multi' && conversationMode === 'active' && (
              <div className="border-t border-slate-700 pt-2 mt-2 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendUserMessage();
                      }
                    }}
                    placeholder="输入消息继续对话..."
                    disabled={apiStatus === 'loading'}
                    className={`flex-1 bg-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                      apiStatus === 'loading' ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <button
                    onClick={sendUserMessage}
                    disabled={apiStatus === 'loading' || !userInput.trim()}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                      apiStatus === 'loading' || !userInput.trim()
                        ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    发送
                  </button>
                  {/* 文件上传按钮 */}
                  <label className={`cursor-pointer px-2 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-xs transition ${
                    apiStatus === 'loading' ? 'opacity-50 pointer-events-none' : ''
                  }`}>
                    <input
                      type="file"
                      multiple
                      onChange={handleMultiRoundFileUpload}
                      disabled={apiStatus === 'loading'}
                      className="hidden"
                    />
                    📎
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 思考面板 - 仅在 thinking 启用时显示 */}
          {thinkingEnabled && (
            <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
              {/* 标题栏 + Tab 切换 */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {/* Tab 按钮 */}
                  <button
                    onClick={() => setThinkingTab('thinking')}
                    className={`text-xs px-2 py-1 rounded transition ${
                      thinkingTab === 'thinking' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    思考过程
                  </button>
                  <button
                    onClick={() => setThinkingTab('raw')}
                    className={`text-xs px-2 py-1 rounded transition ${
                      thinkingTab === 'raw' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    原始响应
                  </button>
                </div>
                <button
                  onClick={() => { setThinkingContent(''); setRawApiResponse(null); }}
                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded transition"
                >
                  清空
                </button>
              </div>

              {/* 内容区 */}
              <div className="flex-1 overflow-y-auto custom-scroll font-mono text-xs pr-1">
                {thinkingTab === 'thinking' ? (
                  thinkingContent ? (
                    <pre className="whitespace-pre-wrap text-purple-300/80 leading-relaxed">
                      {thinkingContent}
                    </pre>
                  ) : (
                    <div className="text-slate-500 text-center py-8">
                      {apiStatus === 'loading' ? '等待模型思考...' : '暂无思考内容'}
                    </div>
                  )
                ) : (
                  rawApiResponse ? (
                    <pre className="whitespace-pre-wrap text-blue-300/80 leading-relaxed">
                      {JSON.stringify(rawApiResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-slate-500 text-center py-8">
                      {apiStatus === 'loading' ? '等待 API 响应...' : '暂无 API 响应'}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* 日志面板 */}
          <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">🖥️ 系统后台日志</span>
                <span className="text-xs text-slate-500">({logs.length})</span>
              </div>
              <button
                onClick={() => { setLogs([]); setExpandedLogs(new Set()); }}
                className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded transition"
              >
                清空
              </button>
            </div>

            {/* 沙箱命令执行区 */}
            {sandboxStatus === 'running' && (
              <div className="mb-2 p-2 bg-slate-900 rounded border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-emerald-400">⚡ 沙箱命令</span>
                  <span className="text-xs text-slate-500 font-mono">{containerInfo?.image}</span>
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={toolCommand}
                    onChange={(e) => setToolCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        executeCommand();
                      }
                    }}
                    placeholder="输入命令，如: ls -la, python --version"
                    className="flex-1 text-xs bg-slate-800 px-2 py-1 rounded border border-slate-600 text-green-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={executeCommand}
                    disabled={!toolCommand.trim()}
                    className={`px-3 py-1 text-xs rounded transition ${
                      toolCommand.trim()
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-slate-700 cursor-not-allowed'
                    }`}
                  >
                    ▶️ 执行
                  </button>
                </div>
                {toolResult && (
                  <div className="mt-2 p-2 bg-slate-800 rounded text-xs font-mono">
                    <div className="text-slate-500 mb-1">
                      Exit: {toolResult.success ? toolResult.result?.exit_code : 'error'} |
                      {toolResult.execution_time_ms}ms
                    </div>
                    <pre className="text-green-300 whitespace-pre-wrap max-h-32 overflow-auto custom-scroll">
                      {toolResult.success
                        ? toolResult.result?.output || '(无输出)'
                        : toolResult.error}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div ref={logRef} className="flex-1 overflow-y-auto custom-scroll space-y-1 font-mono text-xs pr-1">
              {logs.map((log, i) => {
                const isExpanded = expandedLogs.has(i);
                const toggleExpand = () => {
                  setExpandedLogs(prev => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  });
                };
                return (
                  <div
                    key={i}
                    className={`p-2 rounded border-l-2 ${
                      log.status === 'normal' ? 'bg-slate-700/50 border-slate-500' :
                      log.status === 'success' ? 'bg-emerald-900/30 border-emerald-500' :
                      log.status === 'warning' ? 'bg-yellow-900/30 border-yellow-500' :
                      log.status === 'bypassed' ? 'bg-orange-900/30 border-orange-500' :
                      log.status === 'danger' ? 'bg-red-900/30 border-red-500' :
                      'bg-slate-700/50 border-slate-500'
                    }`}
                  >
                    <div className="flex items-start">
                      <span className={`inline-block w-12 flex-shrink-0 ${LOG_TYPES[log.type]?.color || 'text-slate-400'}`}>
                        [{LOG_TYPES[log.type]?.label || log.type}]
                      </span>
                      <div className="flex-1 min-w-0">
                        {log.expandable ? (
                          <span
                            onClick={toggleExpand}
                            className="text-slate-300 cursor-pointer hover:text-white transition"
                          >
                            <span className="text-slate-400 mr-1">{isExpanded ? '▼' : '▶'}</span>
                            {log.content}
                            <span className="text-slate-500 ml-1">(点击{isExpanded ? '折叠' : '展开'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 break-all">{log.content}</span>
                        )}
                        {log.expandable && isExpanded && (
                          <pre className="mt-2 p-2 bg-slate-900/50 rounded text-slate-400 text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto custom-scroll">
                            {log.fullContent}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-slate-500 text-center py-8">等待日志...</div>
              )}
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}