import { useState, useEffect, useCallback } from 'react';
import { saveCaseToServer, listSavedCases, getCaseDetail, deleteCase } from '../caseApi.js';

/**
 * Custom hook for test case persistence
 * @param {Object} options
 * @param {Object} options.lastTestResult - The last test result object
 * @param {Array} options.messages - The messages array for conversations
 * @param {Array} options.logs - The logs array
 * @returns {Object} Case management state and functions
 */
export const useCases = ({ lastTestResult, messages, logs }) => {
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

  // Save test result to server
  const saveToServer = async () => {
    if (!lastTestResult) {
      alert('暂无测试结果，请先执行真实测试');
      return;
    }

    setIsSaving(true);
    try {
      const caseData = {
        name: lastTestResult.attack.name,
        sourceScenario: {
          name: lastTestResult.scenario,
          attackId: lastTestResult.attack.id,
          attackName: lastTestResult.attack.name,
        },
        testConfig: {
          model: lastTestResult.model,
        },
        payload: lastTestResult.payload,
        response: lastTestResult.response,
        judgment: lastTestResult.judgment,
        conversations: messages,
        logs: logs,
        toolCalls: lastTestResult.toolCalls || [],
        systemPrompt: lastTestResult.systemPrompt,
      };
      const saved = await saveCaseToServer(caseData);
      alert(`保存成功！用例 ID: ${saved.id}`);
      // Refresh saved cases list if in saved view
      if (viewMode === 'saved') {
        loadSavedCases();
      }
    } catch (error) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
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
      if (selectedCase?.id === caseId) {
        setSelectedCase(null);
      }
    } catch (error) {
      alert(`删除失败: ${error.message}`);
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

    // Functions
    saveToServer,
    loadSavedCases,
    viewCaseDetail,
    handleDeleteCase,
  };
};
