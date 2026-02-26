import { useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { CONFIG, FIVE_LEVEL_RISK, calculateRiskStats } from '../config';
import { saveTestResult } from '../testResultsApi.js';
import i18n from '../i18n/index.js';

/**
 * Batch test execution hook.
 *
 * Manages the full lifecycle of batch testing: queue management,
 * sequential execution, pause/resume, result collection, export, and
 * server persistence.
 *
 * Uses deps ref pattern for stable callback identity.
 */
export function useBatchTest(deps) {
  const d = useRef(deps);
  d.current = deps;

  // Batch test state (owned by this hook)
  const [batchTestQueue, setBatchTestQueue] = useState([]);
  const [batchTestIndex, setBatchTestIndex] = useState(-1);
  const [batchTestResults, setBatchTestResults] = useState([]);
  const [batchTestPaused, setBatchTestPaused] = useState(false);
  const batchTestStopRef = useRef(false);
  const batchTestPausedRef = useRef(false);

  const isBatchTesting = batchTestIndex >= 0;

  // Internal: execute a single batch test case
  const executeBatchTestCase = useCallback(async (cases, index) => {
    const {
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
    } = d.current;

    if (index >= cases.length || batchTestStopRef.current) {
      setBatchTestIndex(-1);
      return;
    }

    // Wait for pause to end
    while (batchTestPausedRef.current && !batchTestStopRef.current) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (batchTestStopRef.current) {
      setBatchTestIndex(-1);
      return;
    }

    setBatchTestIndex(index);
    const caseData = cases[index];
    const input = caseData.input || {};
    const attack = input.attack || caseData.source?.attack || {};

    // Extract payload and system prompt
    const displayPayload = input.payload?.displayText || attack.predefinedPayload?.display || attack.testPayload || '';
    const actualPayload = input.payload?.actualText || attack.predefinedPayload?.actual || displayPayload;
    const systemPrompt = input.systemPrompt?.active || input.systemPrompt?.original || caseData.environment?.systemPrompt || '';

    // Reset UI state
    setApiStatus('loading');
    setApiError('');
    setRealResponse('');
    setMessages([]);
    setExpandedLogs(new Set());
    setExpandedRecords(new Set());
    thinkingIndexRef.current = 0;
    setThinkingEntries([]);
    setApiInteractions([]);
    setExpandedThinking(new Set());
    setExpandedApiInteraction(new Set());
    setLeftPanelTab('conversation');

    setCustomSystemPrompt(systemPrompt);
    setCustomTestPayload(actualPayload);

    // Show user message
    const userMsg = {
      role: 'user',
      content: actualPayload,
      isInjection: actualPayload !== displayPayload,
      injectionSource: attack.documentFileName ? `📄 ${attack.documentFileName}` : undefined
    };
    setMessages([userMsg]);

    // Logs
    const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
    const initialLogs = [
      { type: 'model', content: i18n.t('labels.model', { name: modelName }), status: 'normal' },
      { type: 'info', content: i18n.t('batchTest.caseLabel', { index: index + 1, total: cases.length, name: caseData.name || attack.attackName || i18n.t('batchTest.unnamed') }), status: 'normal' },
    ];

    if (actualPayload !== displayPayload) {
      initialLogs.push({ type: 'alert', content: i18n.t('errors.payloadContainsHidden'), status: 'warning' });
    }
    initialLogs.push({
      type: 'data',
      content: i18n.t('labels.payloadSent', { count: actualPayload.length }),
      status: 'normal',
      expandable: true,
      fullContent: actualPayload
    });
    setLogs(initialLogs);

    // Reset test records synchronously
    flushSync(() => {
      setTestRecords([]);
    });

    addTestRecord({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      type: 'info',
      timestamp: Date.now(),
      summary: i18n.t('messages.startTestCase', { name: caseData.name || attack.attackName || i18n.t('batchTest.unnamed') }),
      fullContent: i18n.t('messages.batchTestDetail', { index: index + 1, total: cases.length, scenario: attack.scenarioName || i18n.t('labels.unknown'), type: attack.attackType || i18n.t('labels.unknown') }),
      meta: { caseId: caseData.id, index },
      annotations: []
    });

    const startTime = Date.now();

    try {
      const thinkingConfig = thinkingEnabled ? { type: 'enabled', budget_tokens: thinkingBudget } : null;

      // Streaming placeholders
      if (thinkingConfig) {
        setThinkingEntries([{
          content: '',
          chars: 0,
          timestamp: Date.now(),
          isStreaming: true
        }]);
        addTestRecord({
          id: 'thinking-0',
          type: 'thinking',
          timestamp: Date.now(),
          summary: '思考中...',
          fullContent: null,
          meta: { chars: 0, thinkingIndex: 0, isStreaming: true },
          annotations: []
        });
        setLeftPanelTab('thinking');
      }

      setMessages(prev => [...prev, { role: 'agent', content: '', isStreaming: true }]);

      setApiInteractions([{
        id: Date.now().toString(),
        timestamp: Date.now(),
        isStreaming: true,
        interactions: []
      }]);

      // Streaming callbacks
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

      // Call streaming API
      const response = await CONFIG.callModelStream(
        [{ role: 'user', content: actualPayload }],
        systemPrompt,
        selectedModel,
        { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP },
        thinkingConfig,
        onDelta
      );

      const apiTime = Date.now() - startTime;
      const responseContent = typeof response === 'object' ? response.content : response;

      // Finalize thinking
      if (response.thinking) {
        setThinkingEntries(prev => {
          const newEntries = [...prev];
          for (let i = newEntries.length - 1; i >= 0; i--) {
            if (newEntries[i].isStreaming) {
              newEntries[i] = { ...newEntries[i], isStreaming: false };
              break;
            }
          }
          return newEntries;
        });

        updateTestRecord('thinking-0', {
          summary: `思考：${response.thinking.slice(0, 30).replace(/\n/g, ' ')}...`,
          fullContent: response.thinking,
          meta: { chars: response.thinking.length, thinkingIndex: 0, isStreaming: false }
        });
      } else if (thinkingConfig) {
        removeTestRecord('thinking-0');
        setThinkingEntries([]);
      }

      // Finalize agent message
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

      // Finalize API interactions
      setApiInteractions(prev => {
        const newInteractions = [...prev];
        for (let i = newInteractions.length - 1; i >= 0; i--) {
          if (newInteractions[i].isStreaming) {
            newInteractions[i] = {
              ...newInteractions[i],
              isStreaming: false,
              interactions: [{
                request: {
                  model: selectedModel,
                  messages: [{ role: 'user', content: actualPayload }],
                  system: systemPrompt
                },
                response: response.raw || response
              }]
            };
            break;
          }
        }
        return newInteractions;
      });

      setRealResponse(responseContent);

      setLogs(prev => [
        ...prev,
        { type: 'data', content: i18n.t('labels.responseReceived', { count: responseContent.length }), status: 'normal', expandable: true, fullContent: responseContent },
        { type: 'timing', content: i18n.t('labels.apiTiming', { time: apiTime }), status: 'normal' },
        { type: 'judge', content: i18n.t('errors.judgingResults', { model: judgeConfig.model }), status: 'normal' }
      ]);

      addTestRecord({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'response',
        timestamp: Date.now(),
        summary: i18n.t('labels.responseSummary', { text: responseContent.slice(0, 30).replace(/\n/g, ' ') }),
        fullContent: responseContent,
        meta: { model: selectedModel, apiTime, chars: responseContent.length },
        annotations: []
      });

      // Judge
      const attackInfo = {
        name: attack.attackName || attack.name || caseData.name || '',
        type: attack.attackType || attack.type || '',
        level: attack.riskLevel || 'medium',
        description: attack.description || '',
      };

      const judgment = await CONFIG.judgeAttackSuccess(
        attackInfo,
        systemPrompt,
        responseContent,
        actualPayload,
        judgeConfig.systemPrompt,
        judgeConfig.model
      );

      setApiStatus('success');

      const riskLevel = judgment.riskLevel || 'pending';
      const riskConfig = FIVE_LEVEL_RISK[riskLevel] || FIVE_LEVEL_RISK.pending;
      const judgeStatusText = `${riskConfig.icon} ${riskConfig.label}`;
      addTestRecord({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'judge',
        timestamp: Date.now(),
        summary: i18n.t('labels.judgmentSummary', { status: judgeStatusText, reason: '' }),
        fullContent: judgment.reason || '',
        meta: { model: judgeConfig.model, riskLevel, reason: judgment.reason },
        annotations: []
      });

      // Judgment logs
      if (riskLevel === 'high') {
        setLogs(prev => [...prev,
          { type: 'success', content: i18n.t('risk.highResult', { reason: judgment.reason }), status: 'danger' }
        ]);
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, isDangerous: true } : msg
        ));
      } else if (riskLevel === 'medium') {
        setLogs(prev => [...prev,
          { type: 'warning', content: i18n.t('risk.mediumResult', { reason: judgment.reason }), status: 'warning' }
        ]);
      } else if (riskLevel === 'low') {
        setLogs(prev => [...prev,
          { type: 'warning', content: i18n.t('risk.lowResult', { reason: judgment.reason }), status: 'warning' }
        ]);
      } else if (riskLevel === 'safe') {
        setLogs(prev => [...prev,
          { type: 'failure', content: i18n.t('risk.safeResult', { reason: judgment.reason }), status: 'normal' }
        ]);
      } else {
        setLogs(prev => [...prev,
          { type: 'judge', content: i18n.t('risk.pendingResult', { reason: judgment.reason }), status: 'warning' }
        ]);
      }

      setBatchTestResults(prev => [...prev, {
        caseId: caseData.id,
        caseName: caseData.name || attack.attackName || i18n.t('batchTest.unnamed'),
        attackType: attack.attackType || attack.type || '',
        attackDescription: attack.description || '',
        systemPrompt: systemPrompt,
        payload: actualPayload,
        thinking: response.thinking || null,
        response: responseContent,
        judgment: {
          model: judgeConfig.model,
          riskLevel: judgment.riskLevel || 'pending',
          reason: judgment.reason,
        },
        riskLevel: judgment.riskLevel || 'pending',
        model: selectedModel,
        apiTime,
        timestamp: new Date().toISOString(),
        error: null,
      }]);

    } catch (error) {
      setApiStatus('error');
      setApiError(error.message);
      setLogs(prev => [...prev,
        { type: 'alert', content: i18n.t('errors.apiError', { message: error.message }), status: 'danger' }
      ]);

      addTestRecord({
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        type: 'error',
        timestamp: Date.now(),
        summary: i18n.t('labels.errorSummary', { msg: error.message.slice(0, 30) }),
        fullContent: error.message,
        meta: { message: error.message },
        annotations: []
      });

      setBatchTestResults(prev => [...prev, {
        caseId: caseData.id,
        caseName: caseData.name || '未命名',
        attackType: attack.attackType || attack.type || '',
        systemPrompt: systemPrompt,
        payload: actualPayload,
        thinking: null,
        response: null,
        judgment: { model: judgeConfig.model, riskLevel: 'pending', reason: error.message },
        riskLevel: 'pending',
        model: selectedModel,
        apiTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message,
      }]);
    }

    // Delay then execute next
    if (index < cases.length - 1 && !batchTestStopRef.current) {
      await new Promise(r => setTimeout(r, 1500));
      await executeBatchTestCase(cases, index + 1);
    } else {
      setBatchTestIndex(-1);
    }
  }, []);

  const handleStartBatchTest = useCallback(async (cases) => {
    if (cases.length === 0) return;

    setBatchTestQueue(cases);
    setBatchTestIndex(0);
    setBatchTestResults([]);
    batchTestStopRef.current = false;
    batchTestPausedRef.current = false;
    setBatchTestPaused(false);

    await executeBatchTestCase(cases, 0);
  }, [executeBatchTestCase]);

  const toggleBatchTestPause = useCallback(() => {
    setBatchTestPaused(prev => {
      batchTestPausedRef.current = !prev;
      return !prev;
    });
  }, []);

  const cancelBatchTest = useCallback(() => {
    batchTestStopRef.current = true;
    batchTestPausedRef.current = false;
    setBatchTestPaused(false);
    setBatchTestIndex(-1);
  }, []);

  const exportBatchTestReport = useCallback(() => {
    const { selectedModel: model, judgeConfig: jc } = d.current;

    const riskStats = calculateRiskStats(batchTestResults);
    const stats = {
      total: batchTestResults.length,
      high: riskStats.high,
      medium: riskStats.medium,
      low: riskStats.low,
      safe: riskStats.safe,
      pending: riskStats.pending,
      errors: batchTestResults.filter(r => r.error).length,
    };

    const report = {
      meta: {
        schemaVersion: '1.0.0',
        type: 'BatchTestReport',
        exportedAt: new Date().toISOString(),
        testModel: model,
        judgeModel: jc.model,
        statistics: stats,
      },
      results: batchTestResults.map((r, index) => ({
        index: index + 1,
        caseId: r.caseId,
        caseName: r.caseName,
        attackType: r.attackType,
        attackDescription: r.attackDescription,
        input: {
          systemPrompt: r.systemPrompt,
          payload: r.payload,
        },
        execution: {
          model: r.model,
          thinking: r.thinking,
          response: r.response,
          apiTime: r.apiTime,
          timestamp: r.timestamp,
          error: r.error,
        },
        riskLevel: r.riskLevel || 'pending',
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-test-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [batchTestResults]);

  const saveBatchTestToServer = useCallback(async (name) => {
    if (batchTestResults.length === 0) return;

    const { selectedModel: model, judgeConfig: jc, addToast, loadSavedTestResults } = d.current;

    const riskStats = calculateRiskStats(batchTestResults);
    const stats = {
      total: batchTestResults.length,
      high: riskStats.high,
      medium: riskStats.medium,
      low: riskStats.low,
      safe: riskStats.safe,
      pending: riskStats.pending,
      errors: batchTestResults.filter(r => r.error).length,
    };

    const data = {
      name: name || i18n.t('batchTest.defaultName', { date: new Date().toLocaleString() }),
      meta: {
        schemaVersion: '1.0.0',
        type: 'BatchTestReport',
        exportedAt: new Date().toISOString(),
        testModel: model,
        judgeModel: jc.model,
        statistics: stats,
      },
      results: batchTestResults.map((r, index) => ({
        index: index + 1,
        caseId: r.caseId,
        caseName: r.caseName,
        attackType: r.attackType,
        attackDescription: r.attackDescription,
        input: { systemPrompt: r.systemPrompt, payload: r.payload },
        execution: { model: r.model, thinking: r.thinking, response: r.response, apiTime: r.apiTime, timestamp: r.timestamp, error: r.error },
        riskLevel: r.riskLevel || 'pending',
      })),
    };

    try {
      await saveTestResult(data);
      addToast(i18n.t('success.caseSaved', { id: '' }), 'success');
      loadSavedTestResults();
    } catch (err) {
      addToast(i18n.t('errors.saveFailed', { message: err.message }), 'error');
    }
  }, [batchTestResults]);

  return {
    // State
    batchTestQueue,
    batchTestIndex,
    batchTestResults,
    setBatchTestResults,
    batchTestPaused,
    isBatchTesting,

    // Actions
    handleStartBatchTest,
    toggleBatchTestPause,
    cancelBatchTest,
    exportBatchTestReport,
    saveBatchTestToServer,
  };
}
