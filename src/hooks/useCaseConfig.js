import { useCallback } from 'react';
import { useCaseConfigContext } from '../contexts/CaseConfigContext.jsx';

/**
 * Thin wrapper around CaseConfigContext providing convenience methods.
 */
export function useCaseConfig() {
  const { config, dispatch } = useCaseConfigContext();

  const updateField = useCallback((path, value) => {
    dispatch({ type: 'SET_FIELD', path, value });
  }, [dispatch]);

  const loadAgent = useCallback((agent) => {
    dispatch({ type: 'LOAD_AGENT', agent });
  }, [dispatch]);

  const loadSample = useCallback((sample, meta) => {
    dispatch({ type: 'LOAD_SAMPLE', sample, meta });
  }, [dispatch]);

  const loadCase = useCallback((caseData) => {
    dispatch({ type: 'LOAD_CASE', caseData });
  }, [dispatch]);

  const setTestMode = useCallback((mode) => {
    dispatch({ type: 'SET_TEST_MODE', mode });
  }, [dispatch]);

  const addMessage = useCallback(() => {
    dispatch({ type: 'ADD_MESSAGE' });
  }, [dispatch]);

  const removeMessage = useCallback((messageId) => {
    dispatch({ type: 'REMOVE_MESSAGE', messageId });
  }, [dispatch]);

  const updateMessage = useCallback((messageId, updates) => {
    dispatch({ type: 'UPDATE_MESSAGE', messageId, updates });
  }, [dispatch]);

  const reorderMessage = useCallback((fromIndex, toIndex) => {
    dispatch({ type: 'REORDER_MESSAGE', fromIndex, toIndex });
  }, [dispatch]);

  const resetConfig = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const toSavePayload = useCallback(() => {
    return {
      schema_version: '3.0.0',
      ...config,
    };
  }, [config]);

  return {
    config,
    dispatch,
    updateField,
    loadAgent,
    loadSample,
    loadCase,
    setTestMode,
    addMessage,
    removeMessage,
    updateMessage,
    reorderMessage,
    resetConfig,
    toSavePayload,
  };
}
