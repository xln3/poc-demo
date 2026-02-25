import { useCallback, useRef } from 'react';
import { CONFIG, FIVE_LEVEL_RISK } from '../config';
import i18n from '../i18n/index.js';

export function useRealTest(deps) {
  const d = useRef(deps);
  d.current = deps;

  const runRealTest = useCallback(async () => {
    const {
      currentAttack, currentScenario,
      setApiStatus, setApiError, setRealResponse, setMessages, setLogs, setExpandedLogs,
      setTestRecords, setExpandedRecords, thinkingIndexRef,
      setThinkingEntries, setApiInteractions, setExpandedThinking, setExpandedApiInteraction,
      setLeftPanelTab, payloadFiles, customTestPayload,
      getActualPayload, getDisplayPayload,
      selectedModel, customSystemPrompt,
      ragEnabled, ragMode, ragKnowledge, ragServiceAvailable,
      performRagQuery, formatRAGContext, formatRAGLogs,
      toolsEnabled, sandboxStatus, enabledTools,
      llmTemperature, llmMaxTokens, llmTopP, maxToolCalls,
      sandboxClient, mcpClient, mcpServerConfigs,
      getFileTypeForMcp, mcpParsers,
      addTestRecord, addResponseRecord,
      setLastTestResult, judgeConfig,
    } = d.current;

    const attack = currentAttack;
    const scenario = currentScenario;

    setApiStatus('loading');
    setApiError('');
    setRealResponse('');
    setMessages([]);
    setLogs([]);
    setExpandedLogs(new Set());

    // 重置测试记录
    setTestRecords([]);
    setExpandedRecords(new Set());
    thinkingIndexRef.current = 0;

    // 重置 thinking 面板
    setThinkingEntries([]);
    setApiInteractions([]);
    setExpandedThinking(new Set());
    setExpandedApiInteraction(new Set());
    setLeftPanelTab('thinking');

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
      { type: 'model', content: i18n.t('labels.model', { name: modelName }), status: 'normal' },
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
        content: i18n.t('labels.filesParsed', { count: payloadFiles.length, size: sizeStr }),
        status: 'normal'
      });

      // 显示每个文件的解析详情
      payloadFiles.forEach(file => {
        if (file.parseError) {
          // 解析失败
          initialLogs.push({
            type: 'alert',
            content: `  ✗ ${file.name}: ${i18n.t('errors.parsingFailed', { status: file.parseError })}`,
            status: 'warning'
          });
        } else if (file.parsedWith && file.parsedWith !== 'fallback (原始文本)') {
          // 解析成功
          const locationText = file.runLocation === 'sandbox' ? '[sandbox]' : '[backend]';
          initialLogs.push({
            type: 'data',
            content: `  ✓ ${file.name}: 使用 ${file.parsedWith} ${locationText}`,
            status: 'normal'
          });
        }
      });
    }
    if (attack.realTestPayload && !hasUserFiles && !hasCustomPayload) {
      initialLogs.push({ type: 'data', content: i18n.t('labels.fileParsed', { name: attack.documentFileName }), status: 'normal' });
      initialLogs.push({ type: 'alert', content: i18n.t('labels.hiddenMalicious'), status: 'warning' });
    }
    initialLogs.push({ type: 'data', content: i18n.t('labels.payloadSent', { count: actualPayload.length }), status: 'normal', expandable: true, fullContent: actualPayload });
    setLogs(initialLogs);

    // 获取实际使用的系统提示词（自定义或默认）
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
              { type: 'alert', content: i18n.t('errors.maxToolCallsReached', { max: maxToolCalls }), status: 'warning' }
            ]);
            finalResponse = response.content || i18n.t('labels.toolCallsInterrupted');
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
              console.error('Tool args JSON parse failed:', parseErr, 'Raw:', rawArgs);
              setLogs(prev => [...prev,
                { type: 'error', content: i18n.t('errors.toolParamParseFailed', { name: toolName }), status: 'danger' },
                { type: 'data', content: `   ${i18n.t('labels.rawParameters', { params: rawArgs.substring(0, 200) })}`, status: 'warning', expandable: true, fullContent: rawArgs }
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
        finalResponse = response.content || i18n.t('labels.noResponse');
        break;
      }

      setRealResponse(finalResponse);

      // 显示模型响应
      const agentMsg = { role: 'agent', content: finalResponse };
      setMessages(prev => [...prev.filter(m => !m.isToolThinking), agentMsg]);

      // 添加日志：收到响应 + timing
      const toolCallSummary = toolCallCount > 0 ? ` (${toolCallCount} ${i18n.t('labels.apiCallCount', { count: toolCallCount })})` : '';
      setLogs(prev => [
        ...prev,
        { type: 'data', content: i18n.t('labels.finalResponseReceived', { count: finalResponse.length, summary: toolCallSummary }), status: 'normal', expandable: true, fullContent: finalResponse },
        { type: 'timing', content: i18n.t('labels.totalApiTiming', { time: totalApiTime }), status: 'normal' },
        { type: 'judge', content: i18n.t('errors.judgingResults', { model: CONFIG.judgeModel }), status: 'normal' }
      ]);

      // 添加回答记录
      addResponseRecord(finalResponse);

      // 添加测试记录：耗时
      addTestRecord({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'timing',
        timestamp: Date.now(),
        summary: i18n.t('labels.apiResponseTiming', { time: totalApiTime }),
        fullContent: i18n.t('labels.totalApiTiming', { time: totalApiTime }),
        meta: { totalMs: totalApiTime },
        annotations: []
      });

      // 调用评判模型（传入实际发送的 payload 和工具调用历史）
      const judgeContext = toolCallCount > 0
        ? `${actualPayload}\n\n[Tool Call Records]\n${allToolCalls.map(tc => `- ${tc.name}: ${JSON.stringify(tc.args)}`).join('\n')}`
        : actualPayload;
      const judgeResult = await CONFIG.judgeAttackSuccess(
        attack, activeSystemPrompt, finalResponse, judgeContext,
        judgeConfig.systemPrompt, judgeConfig.model
      );

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

      // 添加测试记录：评判结果（五态风险等级）
      const judgeRiskLevel = judgeResult.riskLevel || 'pending';
      const judgeRiskConfig = FIVE_LEVEL_RISK[judgeRiskLevel] || FIVE_LEVEL_RISK.pending;
      const judgeStatusText = `${judgeRiskConfig.icon} ${judgeRiskConfig.label}`;
      addTestRecord({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'judge',
        timestamp: Date.now(),
        summary: i18n.t('labels.judgmentSummary', { status: judgeStatusText, reason: (judgeResult.reason || '').slice(0, 20) }),
        fullContent: judgeResult.reason || '',
        meta: { model: judgeConfig.model, riskLevel: judgeRiskLevel, reason: judgeResult.reason },
        annotations: []
      });

      // 根据评判结果添加日志（五态风险等级）
      if (judgeRiskLevel === 'high') {
        setLogs(prev => [
          ...prev,
          { type: 'success', content: i18n.t('risk.highResult', { reason: judgeResult.reason }), status: 'danger' }
        ]);
        // 标记响应为危险
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, isDangerous: true } : msg
        ));
      } else if (judgeRiskLevel === 'medium') {
        setLogs(prev => [
          ...prev,
          { type: 'warning', content: i18n.t('risk.mediumResult', { reason: judgeResult.reason }), status: 'warning' }
        ]);
      } else if (judgeRiskLevel === 'low') {
        setLogs(prev => [
          ...prev,
          { type: 'warning', content: i18n.t('risk.lowResult', { reason: judgeResult.reason }), status: 'warning' }
        ]);
      } else if (judgeRiskLevel === 'safe') {
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

    } catch (error) {
      setApiStatus('error');
      setApiError(error.message);
      setLogs(prev => [
        ...prev,
        { type: 'alert', content: i18n.t('errors.apiError', { message: error.message }), status: 'danger' }
      ]);
      // 添加测试记录：错误
      addTestRecord({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'error',
        timestamp: Date.now(),
        summary: i18n.t('labels.errorSummary', { msg: error.message.slice(0, 30) }),
        fullContent: error.message,
        meta: { message: error.message },
        annotations: []
      });
    }
  }, []);

  return { runRealTest };
}
