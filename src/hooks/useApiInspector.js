import { useState, useCallback, useRef } from 'react';

/**
 * Manages API interaction inspector state — tracks LLM API calls and thinking entries.
 */
export function useApiInspector() {
  const [thinkingEntries, setThinkingEntries] = useState([]);
  const [apiInteractions, setApiInteractions] = useState([]);
  const [expandedThinking, setExpandedThinking] = useState(new Set());
  const [expandedApiInteraction, setExpandedApiInteraction] = useState(new Set());

  // Track elapsed time for in-flight API calls
  const [apiStartTime, setApiStartTime] = useState(null);
  const [apiElapsedTime, setApiElapsedTime] = useState(0);

  const addApiInteraction = useCallback((interaction) => {
    setApiInteractions(prev => [...prev, interaction]);
  }, []);

  const addThinkingEntry = useCallback((entry) => {
    setThinkingEntries(prev => [...prev, entry]);
  }, []);

  const toggleThinkingExpanded = useCallback((index) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleApiInteractionExpanded = useCallback((index) => {
    setExpandedApiInteraction(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const resetInspector = useCallback(() => {
    setThinkingEntries([]);
    setApiInteractions([]);
    setExpandedThinking(new Set());
    setExpandedApiInteraction(new Set());
    setApiStartTime(null);
    setApiElapsedTime(0);
  }, []);

  return {
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
  };
}
