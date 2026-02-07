import { useState, useCallback } from 'react';

/**
 * Manages test records list and expansion state.
 */
export function useTestRecords() {
  const [testRecords, setTestRecords] = useState([]);
  const [expandedRecords, setExpandedRecords] = useState(new Set());

  const toggleRecord = useCallback((recordId) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }, []);

  const clearRecords = useCallback(() => {
    setTestRecords([]);
    setExpandedRecords(new Set());
  }, []);

  return {
    testRecords, setTestRecords,
    expandedRecords, setExpandedRecords,
    toggleRecord, clearRecords,
  };
}
