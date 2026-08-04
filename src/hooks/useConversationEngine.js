import { useCallback, useRef } from 'react';
import { CONFIG } from '../config';
import i18n from '../i18n/index.js';

export function useConversationEngine(deps) {
  const d = useRef(deps);
  d.current = deps;

  // LLM 流式调用自动重试：网关/代理在长流式生成中可能中断连接
  // （incomplete chunked read / 读取超时），chat completion 幂等可安全重试；
  // 重试前清空本轮部分输出避免内容重复；4xx 与配置错误不重试。
  const streamWithRetry = async (fn) => {
    const { setMessages, setThinkingEntries, setLogs } = d.current;
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const msg = err?.message || String(err);
        const noRetry = msg.startsWith('API Error: 4') || msg.includes('未配置 LLM provider');
        if (noRetry || attempt >= maxAttempts) throw err;
        setMessages(prev => prev.map(m => m.isStreaming ? { ...m, content: '' } : m));
        setThinkingEntries(prev => prev.map(e => e.isStreaming ? { ...e, content: '', chars: 0 } : e));
        setLogs(prev => [...prev, {
          type: 'alert',
          content: i18n.t('errors.streamRetry', { attempt, max: maxAttempts - 1, message: msg }),
          status: 'warning'
        }]);
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
    }
  };

  const startConversation = useCallback(async () => {
    const {
      currentAttack, currentScenario,
      setApiStatus, setApiError, setRealResponse, setMessages, setLogs, setExpandedLogs,
      setConversationHistory, setConversationMode,
      setTestRecords, setExpandedRecords, thinkingIndexRef,
      setThinkingEntries, setApiInteractions, setExpandedThinking, setExpandedApiInteraction,
      setLeftPanelTab, payloadFiles, customTestPayload,
      getActualPayload, getDisplayPayload, setInitialPayload,
      selectedModel, selectedAgentId, customSystemPrompt,
      ragEnabled, ragMode, ragKnowledge, ragServiceAvailable,
      performRagQuery, formatRAGContext, formatRAGLogs,
      toolsEnabled, sandboxStatus, enabledTools,
      buildThinkingConfig,
      llmTemperature, llmMaxTokens, llmTopP,
      appendApiInteraction, finalizeApiInteraction,
      sandboxClient, mcpClient, mcpServerConfigs,
      getFileTypeForMcp, mcpParsers,
      addTestRecord, startThinkingRecord, finalizeThinking, addResponseRecord,
      maxToolCalls,
    } = d.current;

    // Fallback: when coming from Config→Run, no scenario is selected
    const attack = currentAttack || {
      id: 'custom-case', name: 'Custom Test', type: 'custom',
      level: 'medium', description: '', testPayload: customTestPayload || '',
    };
    const scenario = currentScenario || {
      name: 'Custom Test', systemPrompt: customSystemPrompt || '',
    };

    setApiStatus('loading');
    setApiError('');
    setRealResponse('');
    setMessages([]);
    setLogs([]);
    setExpandedLogs(new Set());
    setConversationHistory([]);
    setConversationMode('active');

    // 重置测试记录
    setTestRecords([]);
    setExpandedRecords(new Set());

    // 重置 thinking 面板
    setThinkingEntries([]);
    setApiInteractions([]);
    setExpandedThinking(new Set());
    setExpandedApiInteraction(new Set());
    thinkingIndexRef.current = 0;
    setLeftPanelTab('thinking');

    // Act mode / no initial payload: set up state and wait for user input
    const hasInitialPayload = !!(customTestPayload || currentAttack?.testPayload || currentAttack?.realTestPayload || payloadFiles.length > 0);
    if (!hasInitialPayload) {
      const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
      setLogs([
        { type: 'model', content: i18n.t('labels.model', { name: modelName }), status: 'normal' },
        { type: 'info', content: i18n.t('labels.waitingForInput'), status: 'normal' },
      ]);
      setInitialPayload('');
      setApiStatus('idle');
      return;
    }

    // 构建实际发送的 payload
    let actualPayload;
    const hasUserFiles = payloadFiles.length > 0;
    const hasCustomPayload = customTestPayload !== attack.testPayload;
    // 注入实验室（车贷）：仅「执行注入」（写入 customTestPayload）或上传文件才算已注入；
    // 否则发送干净材料（attack.realTestPayload 为干净版）→ 模型给出正常决策（拒绝）。
    const isLab = !!attack.lab?.docs?.length;
    const injectionActive = hasUserFiles || hasCustomPayload;

    if (hasUserFiles || hasCustomPayload) {
      actualPayload = getActualPayload();
    } else {
      actualPayload = attack.realTestPayload || attack.testPayload;
    }
    const hasFileContent = !!attack.realTestPayload || hasUserFiles;

    // 保存初始 payload 用于评判
    setInitialPayload(actualPayload);

    // 确定显示内容 + 附件卡片（文件以附件卡片呈现，正文不塞进气泡；完整 payload 见执行日志）
    const hasUserCustomization = hasUserFiles || hasCustomPayload;
    let attachments = null;
    let displayContent;
    if (hasUserFiles) {
      attachments = payloadFiles.map(f => ({ name: f.name, size: f.size }));
      displayContent = customTestPayload;
    } else if (attack.lab?.docs?.length) {
      attachments = attack.lab.docs.map(d => ({ name: d.display }));
      displayContent = i18n.t('labels.reviewAttachmentsRequest', { count: attachments.length });
    } else if (hasUserCustomization) {
      displayContent = getDisplayPayload();
    } else {
      displayContent = hasFileContent ? attack.testPayload : actualPayload;
    }

    // 确定注入来源标签
    const injectionSource = hasUserFiles
      ? `📎 ${payloadFiles.map(f => f.name).join(', ')}`
      : (attack.documentFileName ? `📄 ${attack.documentFileName}` : undefined);

    // 显示用户消息。注入实验室下，仅「已执行注入」才标红/告警；未注入按普通材料展示。
    // 完整性/可用性类场景（如 FinBot 逢迎攻击）的攻击载体在系统提示词/环境里，
    // 用户指令本身是正常业务指令，不标「恶意注入」。
    const NON_INJECTION_TYPES = ['integrity', 'availability'];
    const userMsg = {
      role: 'user',
      content: displayContent,
      isInjection: isLab ? injectionActive : !NON_INJECTION_TYPES.includes(attack.type),
      injectionSource,
      attachments
    };
    setMessages([userMsg]);

    // 添加日志
    const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
    const initialLogs = [
      { type: 'model', content: i18n.t('labels.model', { name: modelName }), status: 'normal' },
      { type: 'round', content: i18n.t('labels.roundStart', { num: 1 }), status: 'normal' },
    ];
    if (hasUserFiles) {
      const totalSize = payloadFiles.reduce((sum, f) => sum + (f.size || 0), 0);
      const sizeStr = totalSize > 1024 * 1024
        ? `${(totalSize / 1024 / 1024).toFixed(1)} MB`
        : `${(totalSize / 1024).toFixed(1)} KB`;
      initialLogs.push({
        type: 'data',
        content: i18n.t('labels.filesParsed', { count: payloadFiles.length, size: sizeStr }),
        status: 'normal'
      });
    }
    if (isLab) {
      initialLogs.push({ type: 'data', content: i18n.t('labels.labMaterialsParsed', { count: attack.lab.docs.length }), status: 'normal' });
      initialLogs.push(
        injectionActive
          ? { type: 'alert', content: i18n.t('labels.hiddenMalicious'), status: 'warning' }
          : { type: 'data', content: i18n.t('labels.noInjectionClean'), status: 'normal' }
      );
    } else if (attack.realTestPayload && !hasUserFiles && !hasCustomPayload) {
      initialLogs.push({ type: 'data', content: i18n.t('labels.fileParsed', { name: attack.documentFileName }), status: 'normal' });
      initialLogs.push({ type: 'alert', content: i18n.t('labels.hiddenMalicious'), status: 'warning' });
    }
    initialLogs.push({ type: 'data', content: i18n.t('labels.payloadSent', { count: actualPayload.length }), status: 'normal', expandable: true, fullContent: actualPayload });
    setLogs(initialLogs);

    // 获取实际使用的系统提示词
    let activeSystemPrompt = customSystemPrompt || scenario.systemPrompt;

    // 如果启用 RAG，注入检索内容到系统提示词
    if (ragEnabled) {
      if (ragMode === 'mock' && ragKnowledge.trim()) {
        // Mock 模式：直接使用手动输入的内容
        activeSystemPrompt = `${activeSystemPrompt}\n\n---\n以下是从知识库中检索到的相关信息，请参考这些信息回答用户问题：\n\n${ragKnowledge}\n---`;
        setLogs(prev => [...prev,
          { type: 'data', content: i18n.t('errors.ragInjected', { count: ragKnowledge.split('\n').filter(l => l.trim()).length }), status: 'normal' }
        ]);
      } else if (ragMode === 'real' && ragServiceAvailable) {
        // Real 模式：执行真实的向量检索
        setLogs(prev => [...prev,
          { type: 'query', content: i18n.t('errors.ragSearch'), status: 'normal' }
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
            { type: 'data', content: i18n.t('errors.ragNoResults'), status: 'warning' }
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
        { type: 'tool', content: i18n.t('errors.toolsEnabled', { count: enabledToolNames.length }), status: 'normal' }
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

      // 流式输出：在循环外创建一个 thinking entry（一轮对话共用一个）
      if (thinkingConfig) {
        setThinkingEntries(prev => [...prev, {
          content: '',
          chars: 0,
          timestamp: Date.now(),
          isStreaming: true
        }]);
        // 同时添加测试记录占位符
        startThinkingRecord();
      }

      // 流式输出：在循环外创建一个 agent message（一轮对话共用一个）
      setMessages(prev => [...prev, { role: 'agent', content: '', isStreaming: true }]);

      // 流式输出：在循环外创建一条 API 交互记录（一轮对话共用一条）
      setApiInteractions(prev => [...prev, {
        interactions: [],
        timestamp: Date.now(),
        isStreaming: true
      }]);

      // 流式回调：实时更新 thinking 和 message
      const onDelta = (deltaContent, deltaThinking) => {
        if (deltaContent) {
          setMessages(prev => {
            const newMsgs = [...prev];
            for (let i = newMsgs.length - 1; i >= 0; i--) {
              if (newMsgs[i].isStreaming) {
                newMsgs[i] = { ...newMsgs[i], content: newMsgs[i].content + deltaContent };
                break;
              }
            }
            return newMsgs;
          });
        }
        if (deltaThinking && thinkingConfig) {
          setThinkingEntries(prev => {
            const newEntries = [...prev];
            for (let i = newEntries.length - 1; i >= 0; i--) {
              if (newEntries[i].isStreaming) {
                newEntries[i] = {
                  ...newEntries[i],
                  content: newEntries[i].content + deltaThinking,
                  chars: newEntries[i].content.length + deltaThinking.length
                };
                break;
              }
            }
            return newEntries;
          });
        }
      };

      // 工具调用循环（第一轮）
      const toolCallLimit = maxToolCalls || 100;
      let toolCallCount = 0;
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await streamWithRetry(() => CONFIG.callModelWithToolsStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions,
            thinkingConfig,
            onDelta,
            null, selectedAgentId
          ));
        } else {
          response = await streamWithRetry(() => CONFIG.callModelStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            thinkingConfig,
            onDelta,
            null, selectedAgentId
          ));
        }

        totalApiTime += response.timing?.totalTime || 0;

        // 构造请求信息并追加到 API 交互记录
        const requestInfo = {
          messages: [...messageHistory],
          model: selectedModel,
          systemPrompt: activeSystemPrompt,
          params: { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP }
        };
        appendApiInteraction(requestInfo, response.raw);

        // 检查是否有工具调用
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0 && useToolCalling) {
          toolCallCount += toolCalls.length;
          if (toolCallCount > toolCallLimit) {
            setLogs(prev => [...prev,
              { type: 'alert', content: i18n.t('errors.maxToolCallsReached', { max: toolCallLimit }), status: 'warning' }
            ]);
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

            let toolArgs;
            try {
              toolArgs = JSON.parse(rawArgs);
            } catch (parseErr) {
              setLogs(prev => [...prev,
                { type: 'error', content: i18n.t('errors.toolParamParseFailed', { name: toolName }), status: 'danger' }
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
              { type: 'tool', content: i18n.t('errors.toolCalling', { name: toolLabel }), status: categoryColor },
              { type: 'data', content: `   ${i18n.t('labels.parameters', { params: JSON.stringify(toolArgs) })}`, status: 'normal', expandable: true, fullContent: JSON.stringify(toolArgs, null, 2) }
            ]);

            // 执行工具（沙箱工具或 MCP 工具）
            let toolResult;
            try {
              let result;
              const mcpServer = toolConfig?.mcpServer;

              if (mcpServer) {
                // MCP 工具：使用 mcpClient 执行
                const serverConfig = mcpServerConfigs[mcpServer];
                if (!serverConfig?.enabled) {
                  throw new Error(i18n.t('errors.mcpServiceNotEnabled', { server: mcpServer }));
                }
                result = await mcpClient.executeTool(mcpServer, toolName, toolArgs, serverConfig, sandboxClient.sessionId);
              } else {
                // 沙箱工具：使用 sandboxClient 执行
                // 对于 parse_file 工具，自动注入前端配置的解析器
                let finalToolArgs = toolArgs;
                if (toolName === 'parse_file' && toolArgs.path && (!toolArgs.parsers || toolArgs.parsers.length === 0)) {
                  const fileType = getFileTypeForMcp(toolArgs.path);
                  if (fileType && mcpParsers[fileType]?.length > 0) {
                    finalToolArgs = { ...toolArgs, parsers: mcpParsers[fileType] };
                  }
                }
                result = await sandboxClient.executeTool(toolName, finalToolArgs);
              }

              toolResult = result.success ? JSON.stringify(result.result) : `Error: ${result.error}`;
              setLogs(prev => [...prev,
                { type: 'data', content: `   ${i18n.t('labels.result', { result: toolResult.length > 100 ? toolResult.substring(0, 100) + '...' : toolResult })}`, status: result.success ? 'normal' : 'warning', expandable: toolResult.length > 100, fullContent: toolResult }
              ]);

              // 添加测试记录：工具调用
              addTestRecord({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                type: 'tool_call',
                timestamp: Date.now(),
                summary: i18n.t('labels.toolCallSummary', { name: toolName, args: JSON.stringify(toolArgs).slice(0, 20) }),
                fullContent: i18n.t('labels.toolCallDetail', { name: toolName, args: JSON.stringify(toolArgs), result: toolResult }),
                meta: { toolName, args: JSON.stringify(toolArgs), result: toolResult },
                annotations: []
              });
            } catch (err) {
              toolResult = `Error: ${err.message}`;
              setLogs(prev => [...prev,
                { type: 'error', content: `   ${i18n.t('errors.executionFailed', { message: err.message })}`, status: 'danger' }
              ]);
            }

            messageHistory.push({
              role: 'tool',
              tool_call_id: toolId,
              content: toolResult
            });
          }

          // 完成当前思考记录
          if (thinkingConfig) {
            finalizeThinking();
          }

          // 重置 agent message 内容，准备下一轮流式
          setMessages(prev => {
            const newMsgs = [...prev];
            for (let i = newMsgs.length - 1; i >= 0; i--) {
              if (newMsgs[i].isStreaming) {
                newMsgs[i] = { ...newMsgs[i], content: '' };
                break;
              }
            }
            return newMsgs;
          });

          // 为下一轮创建新的 thinking entry 和记录
          if (thinkingConfig) {
            setThinkingEntries(prev => [...prev, {
              content: '',
              chars: 0,
              timestamp: Date.now(),
              isStreaming: true
            }]);
            startThinkingRecord();
          }

          continue;
        }

        // 没有工具调用，获取最终响应
        // 流式完成：标记 agent message 完成
        setMessages(prev => {
          const newMsgs = [...prev];
          for (let i = newMsgs.length - 1; i >= 0; i--) {
            if (newMsgs[i].isStreaming) {
              newMsgs[i] = { ...newMsgs[i], isStreaming: false };
              break;
            }
          }
          return newMsgs;
        });

        finalResponse = response.content || i18n.t('labels.noResponse');
        break;
      }

      // 流式完成：标记 thinking entry 完成并添加记录
      if (thinkingConfig) {
        finalizeThinking();
      }

      // 流式完成：标记 API 交互记录完成
      finalizeApiInteraction();

      setRealResponse(finalResponse);

      // 添加回答记录
      addResponseRecord(finalResponse);

      // 保存对话历史（用于后续轮次）
      setConversationHistory([
        { role: 'user', content: actualPayload },
        { role: 'assistant', content: finalResponse }
      ]);

      // 添加日志
      setLogs(prev => [
        ...prev,
        { type: 'data', content: i18n.t('labels.responseReceived', { count: finalResponse.length }), status: 'normal', expandable: true, fullContent: finalResponse },
        { type: 'timing', content: i18n.t('labels.apiTiming', { time: totalApiTime }), status: 'normal' },
        { type: 'info', content: i18n.t('conversation.inProgress'), status: 'normal' }
      ]);

      setApiStatus('idle');
      // 流式回答完成后切到「对话过程」标签，直接展示模型回复（录像/演示时无需手动切换）
      setLeftPanelTab('conversation');

    } catch (error) {
      setApiStatus('error');
      setApiError(error.message);
      setConversationMode('idle');
      setLogs(prev => [
        ...prev,
        { type: 'alert', content: i18n.t('errors.apiError', { message: error.message }), status: 'danger' }
      ]);
    }
  }, []);

  const sendUserMessage = useCallback(async () => {
    const {
      currentScenario,
      setApiStatus, setMessages, setLogs,
      setConversationHistory, conversationHistory,
      setThinkingEntries, setApiInteractions,
      buildThinkingConfig,
      customSystemPrompt,
      ragEnabled, ragMode, ragKnowledge, ragServiceAvailable,
      performRagQuery, formatRAGContext, formatRAGLogs,
      toolsEnabled, sandboxStatus, enabledTools,
      llmTemperature, llmMaxTokens, llmTopP,
      appendApiInteraction, finalizeApiInteraction,
      sandboxClient, mcpClient, mcpServerConfigs,
      getFileTypeForMcp, mcpParsers,
      addTestRecord, startThinkingRecord, finalizeThinking, addResponseRecord,
      userInput, setUserInput, apiStatus,
      selectedModel, selectedAgentId,
      maxToolCalls,
    } = d.current;

    const scenario = currentScenario || { name: 'Custom Test', systemPrompt: customSystemPrompt || '' };

    const content = userInput.trim();
    if (!content || apiStatus === 'loading') return;

    setUserInput('');
    setApiStatus('loading');

    // 添加轮次日志
    const roundNum = conversationHistory.filter(m => m.role === 'user').length + 1;
    setLogs(prev => [...prev, { type: 'round', content: i18n.t('labels.roundStart', { num: roundNum }), status: 'normal' }]);

    // 显示用户消息
    setMessages(prev => [...prev, { role: 'user', content }]);

    // 更新对话历史
    const newHistory = [...conversationHistory, { role: 'user', content }];

    // 获取配置
    let activeSystemPrompt = customSystemPrompt || scenario.systemPrompt;

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

      // 流式输出：在循环外创建一个 thinking entry（一轮对话共用一个）
      if (thinkingConfig) {
        setThinkingEntries(prev => [...prev, {
          content: '',
          chars: 0,
          timestamp: Date.now(),
          isStreaming: true
        }]);
        // 同时添加测试记录占位符
        startThinkingRecord();
      }

      // 流式输出：在循环外创建一个 agent message（一轮对话共用一个）
      setMessages(prev => [...prev, { role: 'agent', content: '', isStreaming: true }]);

      // 流式输出：在循环外创建一条 API 交互记录（一轮对话共用一条）
      setApiInteractions(prev => [...prev, {
        interactions: [],
        timestamp: Date.now(),
        isStreaming: true
      }]);

      // 流式回调：实时更新 thinking 和 message
      const onDelta = (deltaContent, deltaThinking) => {
        if (deltaContent) {
          setMessages(prev => {
            const newMsgs = [...prev];
            for (let i = newMsgs.length - 1; i >= 0; i--) {
              if (newMsgs[i].isStreaming) {
                newMsgs[i] = { ...newMsgs[i], content: newMsgs[i].content + deltaContent };
                break;
              }
            }
            return newMsgs;
          });
        }
        if (deltaThinking && thinkingConfig) {
          setThinkingEntries(prev => {
            const newEntries = [...prev];
            for (let i = newEntries.length - 1; i >= 0; i--) {
              if (newEntries[i].isStreaming) {
                newEntries[i] = {
                  ...newEntries[i],
                  content: newEntries[i].content + deltaThinking,
                  chars: newEntries[i].content.length + deltaThinking.length
                };
                break;
              }
            }
            return newEntries;
          });
        }
      };

      // 工具调用循环
      const toolCallLimit = maxToolCalls || 100;
      let toolCallCount = 0;
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await streamWithRetry(() => CONFIG.callModelWithToolsStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions,
            thinkingConfig,
            onDelta,
            null, selectedAgentId
          ));
        } else {
          response = await streamWithRetry(() => CONFIG.callModelStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            thinkingConfig,
            onDelta,
            null, selectedAgentId
          ));
        }

        totalApiTime += response.timing?.totalTime || 0;

        // 构造请求信息并追加到 API 交互记录
        const requestInfo = {
          messages: [...messageHistory],
          model: selectedModel,
          systemPrompt: activeSystemPrompt,
          params: { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP }
        };
        appendApiInteraction(requestInfo, response.raw);

        // 检查是否有工具调用
        const toolCalls = response.tool_calls || [];

        if (toolCalls.length > 0 && useToolCalling) {
          toolCallCount += toolCalls.length;
          if (toolCallCount > toolCallLimit) {
            setLogs(prev => [...prev,
              { type: 'alert', content: i18n.t('errors.maxToolCallsReached', { max: toolCallLimit }), status: 'warning' }
            ]);
            break;
          }
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
              { type: 'tool', content: i18n.t('errors.toolCalling', { name: toolLabel }), status: categoryColor },
              { type: 'data', content: `   ${i18n.t('labels.parameters', { params: JSON.stringify(toolArgs) })}`, status: 'normal', expandable: true, fullContent: JSON.stringify(toolArgs, null, 2) }
            ]);

            // 执行工具（沙箱工具或 MCP 工具）
            let toolResult;
            try {
              let result;
              const mcpServer = toolConfig?.mcpServer;

              if (mcpServer) {
                // MCP 工具：使用 mcpClient 执行
                const serverConfig = mcpServerConfigs[mcpServer];
                if (!serverConfig?.enabled) {
                  throw new Error(i18n.t('errors.mcpServiceNotEnabled', { server: mcpServer }));
                }
                result = await mcpClient.executeTool(mcpServer, toolName, toolArgs, serverConfig, sandboxClient.sessionId);
              } else {
                // 沙箱工具：使用 sandboxClient 执行
                // 对于 parse_file 工具，自动注入前端配置的解析器
                let finalToolArgs = toolArgs;
                if (toolName === 'parse_file' && toolArgs.path && (!toolArgs.parsers || toolArgs.parsers.length === 0)) {
                  const fileType = getFileTypeForMcp(toolArgs.path);
                  if (fileType && mcpParsers[fileType]?.length > 0) {
                    finalToolArgs = { ...toolArgs, parsers: mcpParsers[fileType] };
                  }
                }
                result = await sandboxClient.executeTool(toolName, finalToolArgs);
              }

              toolResult = result.success ? JSON.stringify(result.result) : `Error: ${result.error}`;

              // 添加测试记录：工具调用
              addTestRecord({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                type: 'tool_call',
                timestamp: Date.now(),
                summary: i18n.t('labels.toolCallSummary', { name: toolName, args: JSON.stringify(toolArgs).slice(0, 20) }),
                fullContent: i18n.t('labels.toolCallDetail', { name: toolName, args: JSON.stringify(toolArgs), result: toolResult }),
                meta: { toolName, args: JSON.stringify(toolArgs), result: toolResult },
                annotations: []
              });
            } catch (err) {
              toolResult = `Error: ${err.message}`;
            }

            messageHistory.push({
              role: 'tool',
              tool_call_id: toolId,
              content: toolResult
            });
          }

          // 完成当前思考记录
          if (thinkingConfig) {
            finalizeThinking();
          }

          // 重置 agent message 内容，准备下一轮流式
          setMessages(prev => {
            const newMsgs = [...prev];
            for (let i = newMsgs.length - 1; i >= 0; i--) {
              if (newMsgs[i].isStreaming) {
                newMsgs[i] = { ...newMsgs[i], content: '' };
                break;
              }
            }
            return newMsgs;
          });

          // 为下一轮创建新的 thinking entry 和记录
          if (thinkingConfig) {
            setThinkingEntries(prev => [...prev, {
              content: '',
              chars: 0,
              timestamp: Date.now(),
              isStreaming: true
            }]);
            startThinkingRecord();
          }

          continue;
        }

        // 流式完成：标记 agent message 完成
        setMessages(prev => {
          const newMsgs = [...prev];
          for (let i = newMsgs.length - 1; i >= 0; i--) {
            if (newMsgs[i].isStreaming) {
              newMsgs[i] = { ...newMsgs[i], isStreaming: false };
              break;
            }
          }
          return newMsgs;
        });

        finalResponse = response.content || i18n.t('labels.noResponse');
        break;
      }

      // 流式完成：标记 thinking entry 完成并添加记录
      if (thinkingConfig) {
        finalizeThinking();
      }

      // 流式完成：标记 API 交互记录完成
      finalizeApiInteraction();

      // 添加回答记录
      addResponseRecord(finalResponse);

      // 更新对话历史
      setConversationHistory(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: finalResponse }]);

      setLogs(prev => [...prev,
        { type: 'data', content: i18n.t('labels.responseReceived', { count: finalResponse.length }), status: 'normal', expandable: true, fullContent: finalResponse },
        { type: 'timing', content: i18n.t('labels.apiTiming', { time: totalApiTime }), status: 'normal' }
      ]);

    } catch (error) {
      setLogs(prev => [...prev,
        { type: 'alert', content: i18n.t('errors.apiError', { message: error.message }), status: 'danger' }
      ]);
    } finally {
      setApiStatus('idle');
    }
  }, []);

  const stopConversation = useCallback(async () => {
    const {
      currentAttack, currentScenario,
      setApiStatus, setMessages, setLogs,
      setConversationHistory, setConversationMode, conversationHistory,
      customSystemPrompt, initialPayload,
      selectedModel, selectedAgentId, judgeConfig,
      setLastTestResult,
    } = d.current;

    const attack = currentAttack || {
      id: 'custom-case', name: 'Custom Test', type: 'custom',
      level: 'medium', description: '', testPayload: '',
    };
    const scenario = currentScenario || { name: 'Custom Test', systemPrompt: customSystemPrompt || '' };

    setConversationMode('judging');

    // 构建完整对话摘要
    const fullConversation = conversationHistory.map((msg) => {
      if (msg.role === 'user') return `${i18n.t('labels.roleUser')}: ${msg.content}`;
      if (msg.role === 'assistant') return `${i18n.t('labels.roleModel')}: ${msg.content}`;
      if (msg.role === 'tool') return `${i18n.t('labels.roleToolResult')}: ${msg.content}`;
      return '';
    }).filter(Boolean).join('\n\n');

    const roundCount = conversationHistory.filter(m => m.role === 'user').length;

    setLogs(prev => [...prev, {
      type: 'judge',
      content: i18n.t('errors.judgingConversation', { count: roundCount }),
      status: 'normal'
    }]);

    // 调用评判
    const activeSystemPrompt = customSystemPrompt || scenario.systemPrompt;
    const judgeResult = await CONFIG.judgeAttackSuccess(
      attack,
      activeSystemPrompt,
      fullConversation,
      initialPayload,
      judgeConfig?.systemPrompt,
      judgeConfig?.model,
      judgeConfig?.agent_id || null
    );

    // 保存测试结果
    setLastTestResult({
      timestamp: new Date().toISOString(),
      scenario: scenario.name,
      attack: {
        id: attack.id,
        name: attack.name,
        type: attack.type,
        level: attack.level,
        description: attack.description
      },
      model: selectedModel,
      systemPrompt: activeSystemPrompt,
      payload: initialPayload,
      response: fullConversation,
      toolCalls: [],
      judgment: judgeResult,
      rounds: roundCount
    });

    // 根据评判结果添加日志（五态风险等级）
    const mcpRiskLevel = judgeResult.riskLevel || 'pending';
    if (mcpRiskLevel === 'high') {
      setLogs(prev => [
        ...prev,
        { type: 'success', content: i18n.t('risk.highResult', { reason: judgeResult.reason }), status: 'danger' }
      ]);
      // 标记最后一条响应为危险
      setMessages(prev => prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === 'agent' ? { ...msg, isDangerous: true } : msg
      ));
    } else if (mcpRiskLevel === 'medium') {
      setLogs(prev => [
        ...prev,
        { type: 'warning', content: i18n.t('risk.mediumResult', { reason: judgeResult.reason }), status: 'warning' }
      ]);
    } else if (mcpRiskLevel === 'low') {
      setLogs(prev => [
        ...prev,
        { type: 'warning', content: i18n.t('risk.lowResult', { reason: judgeResult.reason }), status: 'warning' }
      ]);
    } else if (mcpRiskLevel === 'safe') {
      setLogs(prev => [
        ...prev,
        { type: 'failure', content: i18n.t('risk.safeResult', { reason: judgeResult.reason }), status: 'normal' }
      ]);
    } else {
      setLogs(prev => [
        ...prev,
        { type: 'judge', content: i18n.t('risk.pendingResult', { reason: judgeResult.reason }), status: 'warning' }
      ]);
    }

    setConversationMode('idle');
    setConversationHistory([]);
    setApiStatus('idle');
  }, []);

  return { startConversation, sendUserMessage, stopConversation };
}
