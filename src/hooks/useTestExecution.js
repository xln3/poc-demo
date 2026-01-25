import { useState, useCallback, useRef } from 'react';
import {
  buildRecordingSession,
  createStandaloneTestCase,
  downloadAsJSON,
} from '../schemas/testCase.js';
import { addCaseToDataset } from '../datasetApi.js';

/**
 * 执行模式
 */
export const ExecutionMode = {
  IDLE: 'idle',               // 空闲
  SINGLE_RECORDING: 'single_recording', // 单个用例录制中
  BATCH_RUNNING: 'batch_running',       // 批量执行中
};

/**
 * 批量测试结果状态
 */
export const BatchResultStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

/**
 * 测试执行 Hook
 *
 * 管理单个测试录制和批量测试执行
 */
export const useTestExecution = ({
  onStartTest,       // 开始单个测试的回调
  onStopTest,        // 停止测试的回调
  stateCollector,    // 状态收集器实例
}) => {
  // 执行模式
  const [executionMode, setExecutionMode] = useState(ExecutionMode.IDLE);

  // 当前测试用例
  const [currentCase, setCurrentCase] = useState(null);

  // 当前数据集（批量测试时）
  const [currentDataset, setCurrentDataset] = useState(null);

  // 批量队列
  const [batchQueue, setBatchQueue] = useState([]);

  // 批量进度
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    results: [], // { caseId, status, recording }
  });

  // 录制状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [lastRecording, setLastRecording] = useState(null);

  // 批量执行控制
  const batchAbortRef = useRef(false);

  /**
   * 开始单个测试（录制模式）
   */
  const startSingleTest = useCallback(async (testCase) => {
    if (executionMode !== ExecutionMode.IDLE) {
      console.warn('已有测试在执行中');
      return false;
    }

    setExecutionMode(ExecutionMode.SINGLE_RECORDING);
    setCurrentCase(testCase);
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    setLastRecording(null);

    // 启动状态收集
    if (stateCollector) {
      stateCollector.startCollecting();
    }

    // 调用外部开始测试回调
    if (onStartTest) {
      await onStartTest(testCase);
    }

    return true;
  }, [executionMode, stateCollector, onStartTest]);

  /**
   * 结束单个测试录制
   */
  const stopSingleTest = useCallback(async (result) => {
    if (executionMode !== ExecutionMode.SINGLE_RECORDING) {
      return null;
    }

    // 停止状态收集
    if (stateCollector) {
      stateCollector.stopCollecting();
    }

    // 构建录制会话
    const recording = await buildRecordingSession({
      caseId: currentCase?.id || currentCase?.meta?.caseId,
      states: stateCollector?.states || [],
      result: result || {},
      startedAt: new Date(recordingStartTime).toISOString(),
      completedAt: new Date().toISOString(),
    });

    setLastRecording(recording);
    setIsRecording(false);
    setExecutionMode(ExecutionMode.IDLE);

    // 调用外部停止测试回调
    if (onStopTest) {
      await onStopTest(result);
    }

    return recording;
  }, [executionMode, currentCase, stateCollector, recordingStartTime, onStopTest]);

  /**
   * 开始批量测试
   */
  const startBatchTest = useCallback(async (dataset, cases) => {
    if (executionMode !== ExecutionMode.IDLE) {
      console.warn('已有测试在执行中');
      return false;
    }

    const queue = cases || dataset?.cases || [];
    if (queue.length === 0) {
      console.warn('测试队列为空');
      return false;
    }

    setExecutionMode(ExecutionMode.BATCH_RUNNING);
    setCurrentDataset(dataset);
    setBatchQueue(queue);
    setBatchProgress({
      current: 0,
      total: queue.length,
      results: queue.map(c => ({
        caseId: c.id,
        caseName: c.name,
        status: BatchResultStatus.PENDING,
        recording: null,
      })),
    });
    batchAbortRef.current = false;

    // 开始执行队列（异步）
    executeBatchQueue(queue, dataset);

    return true;
  }, [executionMode]);

  /**
   * 执行批量队列（内部函数）
   */
  const executeBatchQueue = useCallback(async (queue, dataset) => {
    for (let i = 0; i < queue.length; i++) {
      if (batchAbortRef.current) {
        // 标记剩余为跳过
        setBatchProgress(prev => ({
          ...prev,
          results: prev.results.map((r, idx) =>
            idx >= i ? { ...r, status: BatchResultStatus.SKIPPED } : r
          ),
        }));
        break;
      }

      const testCase = queue[i];

      // 更新进度为运行中
      setBatchProgress(prev => ({
        ...prev,
        current: i + 1,
        results: prev.results.map((r, idx) =>
          idx === i ? { ...r, status: BatchResultStatus.RUNNING } : r
        ),
      }));

      // 执行单个测试
      try {
        // 启动状态收集
        if (stateCollector) {
          stateCollector.startCollecting();
        }

        const startTime = Date.now();

        // 调用外部开始测试
        if (onStartTest) {
          await onStartTest(testCase, true); // true 表示是批量模式
        }

        // 等待测试完成（这里需要外部告知完成）
        // 实际实现中，onStartTest 应该是一个 Promise，完成时 resolve

        // 停止状态收集
        if (stateCollector) {
          stateCollector.stopCollecting();
        }

        // 构建录制
        const recording = await buildRecordingSession({
          caseId: testCase.id,
          states: stateCollector?.states || [],
          result: {},
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });

        // 更新结果为成功
        setBatchProgress(prev => ({
          ...prev,
          results: prev.results.map((r, idx) =>
            idx === i ? { ...r, status: BatchResultStatus.SUCCESS, recording } : r
          ),
        }));
      } catch (error) {
        console.error(`批量测试第 ${i + 1} 个用例失败:`, error);

        // 更新结果为失败
        setBatchProgress(prev => ({
          ...prev,
          results: prev.results.map((r, idx) =>
            idx === i ? { ...r, status: BatchResultStatus.FAILED, error: error.message } : r
          ),
        }));
      }
    }

    // 批量执行完成
    setExecutionMode(ExecutionMode.IDLE);
    setCurrentCase(null);
  }, [stateCollector, onStartTest]);

  /**
   * 停止批量测试
   */
  const stopBatchTest = useCallback(() => {
    batchAbortRef.current = true;
  }, []);

  /**
   * 保存录制结果
   */
  const saveRecording = useCallback(async ({
    name,
    targetDatasetId,
    downloadLocal = true,
    saveToServer = true,
  }) => {
    if (!lastRecording && !currentCase) {
      console.warn('没有可保存的录制');
      return false;
    }

    setIsSaving(true);

    try {
      // 构建独立测试用例
      const testCase = createStandaloneTestCase({
        name: name || currentCase?.name || '未命名测试',
        capability: currentCase?.capability || currentCase?.input?.attack?.capabilityLevel,
        input: currentCase?.input,
        criteria: currentCase?.criteria,
        recording: lastRecording,
      });

      // 保存到服务器（添加到数据集）
      if (saveToServer && targetDatasetId) {
        await addCaseToDataset(targetDatasetId, {
          id: testCase.meta.caseId,
          name: testCase.meta.name,
          capability: testCase.meta.capability,
          input: testCase.input,
          criteria: testCase.criteria,
          recording: testCase.recording,
        });
      }

      // 下载本地文件
      if (downloadLocal) {
        const filename = `test-${name || 'case'}-${new Date().toISOString().slice(0, 10)}.json`;
        downloadAsJSON(testCase, filename);
      }

      return true;
    } catch (error) {
      console.error('保存录制失败:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [lastRecording, currentCase]);

  /**
   * 重置执行状态
   */
  const reset = useCallback(() => {
    setExecutionMode(ExecutionMode.IDLE);
    setCurrentCase(null);
    setCurrentDataset(null);
    setBatchQueue([]);
    setBatchProgress({ current: 0, total: 0, results: [] });
    setIsRecording(false);
    setRecordingStartTime(null);
    setLastRecording(null);
    batchAbortRef.current = false;

    if (stateCollector) {
      stateCollector.reset();
    }
  }, [stateCollector]);

  /**
   * 检查是否可以开始新测试
   */
  const canStartTest = executionMode === ExecutionMode.IDLE;

  /**
   * 检查是否有录制可保存
   */
  const hasRecordingToSave = lastRecording !== null || (isRecording && stateCollector?.states?.length > 0);

  return {
    // 状态
    executionMode,
    currentCase,
    currentDataset,
    batchQueue,
    batchProgress,
    isRecording,
    isSaving,
    lastRecording,

    // 单个测试操作
    startSingleTest,
    stopSingleTest,

    // 批量测试操作
    startBatchTest,
    stopBatchTest,

    // 保存操作
    saveRecording,

    // 工具
    reset,
    canStartTest,
    hasRecordingToSave,

    // 常量
    ExecutionMode,
    BatchResultStatus,
  };
};

export default useTestExecution;
