import { useState, useEffect, useCallback } from 'react';
import { ragClient } from '../rag.js';
import i18n from '../i18n/index.js';

/**
 * Custom hook for RAG (Retrieval-Augmented Generation) management
 * @param {Object} options
 * @param {Function} options.addLog - Function to add log entries
 * @returns {Object} RAG state and functions
 */
export const useRAG = ({ addLog }) => {
  // RAG states
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragConfigCollapsed, setRagConfigCollapsed] = useState(false);
  const [ragKnowledge, setRagKnowledge] = useState('');
  const [ragKnowledgeEdit, setRagKnowledgeEdit] = useState('');
  const [ragMode, setRagMode] = useState('mock'); // 'mock' | 'real'
  const [ragServiceAvailable, setRagServiceAvailable] = useState(false);
  const [ragDocuments, setRagDocuments] = useState([]);
  const [ragQueryResults, setRagQueryResults] = useState(null);
  const [ragUploading, setRagUploading] = useState(false);
  const [parserContainerAvailable, setParserContainerAvailable] = useState(false);

  // Check RAG service availability - 禁用自动检查，避免阻塞
  // useEffect(() => {
  //   const checkRAG = async () => {
  //     const health = await ragClient.healthCheck();
  //     setRagServiceAvailable(health?.status === 'healthy');
  //     setParserContainerAvailable(health?.parser_available === true);
  //   };
  //   checkRAG();
  //   const interval = setInterval(checkRAG, 30000);
  //   return () => clearInterval(interval);
  // }, []);

  // When RAG mode switches to real, initialize service and refresh documents
  // 禁用自动初始化，避免阻塞
  // useEffect(() => {
  //   if (ragMode === 'real' && ragServiceAvailable) {
  //     ragClient.init().then(() => {
  //       ragClient.healthCheck().then(health => {
  //         setParserContainerAvailable(health?.parser_available === true);
  //       });
  //     }).catch(console.error);
  //     refreshRagDocuments();
  //   }
  // }, [ragMode, ragServiceAvailable]);

  // Refresh RAG document list
  const refreshRagDocuments = async () => {
    try {
      const response = await ragClient.listDocuments();
      setRagDocuments(response.documents || []);
    } catch (error) {
      console.error('Failed to fetch RAG documents:', error);
    }
  };

  // Upload file to RAG
  const handleRagUpload = async (file) => {
    if (!file) return;
    setRagUploading(true);
    try {
      await ragClient.upload(file);
      await refreshRagDocuments();
      addLog({
        type: 'info',
        content: i18n.t('success.ragDocUploaded', { name: file.name }),
        status: 'normal'
      });
    } catch (error) {
      addLog({
        type: 'error',
        content: i18n.t('errors.ragUploadFailed', { message: error.message }),
        status: 'danger'
      });
    } finally {
      setRagUploading(false);
    }
  };

  // Delete RAG document
  const handleRagDelete = async (documentId) => {
    try {
      await ragClient.deleteDocument(documentId);
      await refreshRagDocuments();
    } catch (error) {
      console.error('Failed to delete RAG document:', error);
    }
  };

  // Clear RAG knowledge base
  const handleRagClear = async () => {
    try {
      await ragClient.clear();
      setRagDocuments([]);
      setRagQueryResults(null);
    } catch (error) {
      console.error('Failed to clear RAG:', error);
    }
  };

  // Reset RAG knowledge base to preset data
  const handleRagReset = async () => {
    try {
      await ragClient.reset();
      await refreshRagDocuments();
      setRagQueryResults(null);
    } catch (error) {
      console.error('Failed to reset RAG:', error);
    }
  };

  // Perform RAG query (for testing)
  const performRagQuery = async (queryText) => {
    if (ragMode !== 'real' || !ragServiceAvailable) {
      return null;
    }
    try {
      const response = await ragClient.query(queryText, 3);
      setRagQueryResults(response);
      return response.results || [];
    } catch (error) {
      console.error('RAG query failed:', error);
      return [];
    }
  };

  return {
    // State
    ragEnabled,
    setRagEnabled,
    ragConfigCollapsed,
    setRagConfigCollapsed,
    ragKnowledge,
    setRagKnowledge,
    ragKnowledgeEdit,
    setRagKnowledgeEdit,
    ragMode,
    setRagMode,
    ragServiceAvailable,
    ragDocuments,
    setRagDocuments,
    ragQueryResults,
    setRagQueryResults,
    ragUploading,
    parserContainerAvailable,
    setParserContainerAvailable,

    // Functions
    refreshRagDocuments,
    handleRagUpload,
    handleRagDelete,
    handleRagClear,
    handleRagReset,
    performRagQuery,
  };
};
