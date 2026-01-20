import { useState, useCallback } from 'react';

/**
 * Custom hook for conversation state management
 * Note: Complex dialog logic is kept in App.jsx due to dependencies
 * @returns {Object} Conversation state and setters
 */
export const useConversation = () => {
  // Conversation mode states
  const [dialogMode, setDialogMode] = useState('single'); // 'single' | 'multi'
  const [conversationMode, setConversationMode] = useState('idle'); // 'idle' | 'active' | 'judging'
  const [userInput, setUserInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]); // API message history
  const [initialPayload, setInitialPayload] = useState(''); // Store initial payload for judgment

  // Reset conversation state
  const resetConversation = useCallback(() => {
    setConversationMode('idle');
    setUserInput('');
    setConversationHistory([]);
    setInitialPayload('');
  }, []);

  // Add message to history
  const addToHistory = useCallback((message) => {
    setConversationHistory(prev => [...prev, message]);
  }, []);

  // Clear conversation history
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);

  return {
    // State
    dialogMode,
    setDialogMode,
    conversationMode,
    setConversationMode,
    userInput,
    setUserInput,
    conversationHistory,
    setConversationHistory,
    initialPayload,
    setInitialPayload,

    // Functions
    resetConversation,
    addToHistory,
    clearHistory,
  };
};
