import { useCallback, useRef } from 'react';
import { CONFIG } from '../config';

export function useConversationEngine(deps) {
  const d = useRef(deps);
  d.current = deps;

  const startConversation = useCallback(async () => {
    const {
      currentAttack, currentScenario,
      setApiStatus, setApiError, setRealResponse, setMessages, setLogs, setExpandedLogs,
      setConversationHistory, setConversationMode,
      setTestRecords, setExpandedRecords, thinkingIndexRef,
      setThinkingEntries, setApiInteractions, setExpandedThinking, setExpandedApiInteraction,
      setLeftPanelTab, payloadFiles, customTestPayload,
      getActualPayload, getDisplayPayload, setInitialPayload,
      selectedModel, customSystemPrompt,
      ragEnabled, ragMode, ragKnowledge, ragServiceAvailable,
      performRagQuery, formatRAGContext, formatRAGLogs,
      toolsEnabled, sandboxStatus, enabledTools,
      buildThinkingConfig,
      llmTemperature, llmMaxTokens, llmTopP,
      appendApiInteraction, finalizeApiInteraction,
      sandboxClient, mcpClient, mcpServerConfigs,
      getFileTypeForMcp, mcpParsers,
      addTestRecord, startThinkingRecord, finalizeThinking, addResponseRecord,
    } = d.current;

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
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await CONFIG.callModelWithToolsStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions,
            thinkingConfig,
            onDelta
          );
        } else {
          response = await CONFIG.callModelStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            thinkingConfig,
            onDelta
          );
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

            // 执行工具（沙箱工具或 MCP 工具）
            let toolResult;
            try {
              let result;
              const mcpServer = toolConfig?.mcpServer;

              if (mcpServer) {
                // MCP 工具：使用 mcpClient 执行
                const serverConfig = mcpServerConfigs[mcpServer];
                if (!serverConfig?.enabled) {
                  throw new Error(`MCP 服务 ${mcpServer} 未启用，请先在 MCP 配置中启用并测试连接`);
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
                { type: 'data', content: `   结果: ${toolResult.length > 100 ? toolResult.substring(0, 100) + '...' : toolResult}`, status: result.success ? 'normal' : 'warning', expandable: toolResult.length > 100, fullContent: toolResult }
              ]);

              // 添加测试记录：工具调用
              addTestRecord({
                id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
                type: 'tool_call',
                timestamp: Date.now(),
                summary: `工具：${toolName}(${JSON.stringify(toolArgs).slice(0, 20)}...)`,
                fullContent: `调用: ${toolName}(${JSON.stringify(toolArgs)})\n结果: ${toolResult}`,
                meta: { toolName, args: JSON.stringify(toolArgs), result: toolResult },
                annotations: []
              });
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

        finalResponse = response.content || '(无响应)';
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
      selectedModel,
    } = d.current;

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
      while (true) {
        let response;

        if (useToolCalling && enabledToolNames.length > 0) {
          const toolDefinitions = CONFIG.buildToolDefinitions(enabledToolNames);
          response = await CONFIG.callModelWithToolsStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            toolDefinitions,
            thinkingConfig,
            onDelta
          );
        } else {
          response = await CONFIG.callModelStream(
            messageHistory,
            activeSystemPrompt,
            selectedModel,
            { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
            thinkingConfig,
            onDelta
          );
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

            // 执行工具（沙箱工具或 MCP 工具）
            let toolResult;
            try {
              let result;
              const mcpServer = toolConfig?.mcpServer;

              if (mcpServer) {
                // MCP 工具：使用 mcpClient 执行
                const serverConfig = mcpServerConfigs[mcpServer];
                if (!serverConfig?.enabled) {
                  throw new Error(`MCP 服务 ${mcpServer} 未启用，请先在 MCP 配置中启用并测试连接`);
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
                summary: `工具：${toolName}(${JSON.stringify(toolArgs).slice(0, 20)}...)`,
                fullContent: `调用: ${toolName}(${JSON.stringify(toolArgs)})\n结果: ${toolResult}`,
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

        finalResponse = response.content || '(无响应)';
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
  }, []);

  const stopConversation = useCallback(async () => {
    const {
      currentAttack, currentScenario,
      setApiStatus, setMessages, setLogs,
      setConversationHistory, setConversationMode, conversationHistory,
      customSystemPrompt, initialPayload,
      selectedModel,
      setLastTestResult,
    } = d.current;

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

    // 根据评判结果添加日志（五态风险等级）
    const mcpRiskLevel = judgeResult.riskLevel || 'pending';
    if (mcpRiskLevel === 'high') {
      setLogs(prev => [
        ...prev,
        { type: 'success', content: `🔴 高风险！${judgeResult.reason}`, status: 'danger' }
      ]);
      // 标记最后一条响应为危险
      setMessages(prev => prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === 'agent' ? { ...msg, isDangerous: true } : msg
      ));
    } else if (mcpRiskLevel === 'medium') {
      setLogs(prev => [
        ...prev,
        { type: 'warning', content: `🟠 中风险：${judgeResult.reason}`, status: 'warning' }
      ]);
    } else if (mcpRiskLevel === 'low') {
      setLogs(prev => [
        ...prev,
        { type: 'warning', content: `🟡 低风险：${judgeResult.reason}`, status: 'warning' }
      ]);
    } else if (mcpRiskLevel === 'safe') {
      setLogs(prev => [
        ...prev,
        { type: 'failure', content: `🟢 安全：${judgeResult.reason}`, status: 'normal' }
      ]);
    } else {
      setLogs(prev => [
        ...prev,
        { type: 'judge', content: `⚪ 待定：${judgeResult.reason}`, status: 'warning' }
      ]);
    }

    setConversationMode('idle');
    setConversationHistory([]);
    setApiStatus('idle');
  }, []);

  return { startConversation, sendUserMessage, stopConversation };
}
