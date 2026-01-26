import { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../config';

/**
 * Custom hook for MCP (Model Context Protocol) configuration management
 * Note: Parsing functions are kept in App.jsx due to tight coupling with sandbox
 * @returns {Object} MCP state and setters
 */
export const useMCP = () => {
  // 文件解析状态
  const [mcpEnabled, setMcpEnabled] = useState(true);  // 默认启用
  const [mcpConfigCollapsed, setMcpConfigCollapsed] = useState(true);  // 默认折叠
  const [mcpParserServiceAvailable, setMcpParserServiceAvailable] = useState(false);
  const [mcpParsers, setMcpParsers] = useState(() => {
    // Initialize parser selection state: list of selected tools per file type (by priority)
    const parsers = {};
    Object.entries(CONFIG.mcp.parsers).forEach(([type, config]) => {
      // Default: only select the first parser (fastest)
      parsers[type] = [config.tools[0].id];
    });
    return parsers;
  });
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsingProgress, setParsingProgress] = useState(null);
  const [parsingAbortController, setParsingAbortController] = useState(null);

  // MCP Server states
  const [mcpServerEnabled, setMcpServerEnabled] = useState(false);
  const [mcpServerConfigCollapsed, setMcpServerConfigCollapsed] = useState(false);
  const [selectedMcpServer, setSelectedMcpServer] = useState(null);
  const [mcpServerConfigs, setMcpServerConfigs] = useState(() => {
    const saved = localStorage.getItem('mcpServerConfigs');
    return saved ? JSON.parse(saved) : {};
  });
  const [mcpServerStatus, setMcpServerStatus] = useState({});

  // Helper to get file type from extension
  const getFileType = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap = {
      pdf: 'pdf',
      docx: 'docx',
      doc: 'docx',
      xlsx: 'xlsx',
      xls: 'xlsx',
      jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image'
    };
    return typeMap[ext] || null;
  };

  // Helper to check which parsers require Docker
  const requiresDockerParsers = () => {
    const selected = [];
    Object.entries(mcpParsers).forEach(([fileType, parserIds]) => {
      const config = CONFIG.mcp.parsers[fileType];
      if (!config) return;

      parserIds.forEach(parserId => {
        const tool = config.tools.find(t => t.id === parserId);
        if (tool && tool.requiresDocker) {
          selected.push({ fileType, parserId, toolName: tool.name });
        }
      });
    });
    return selected;
  };

  // Helper to estimate parsing time based on file size and type
  const estimateParsingTime = (fileSize, fileType) => {
    const ratesPerMB = {
      pdf: 8000,    // 8s/MB (OCR is slow)
      docx: 500,    // 0.5s/MB
      xlsx: 300,    // 0.3s/MB
      image: 2000   // 2s/MB (OCR)
    };
    const rate = ratesPerMB[fileType] || 1000;
    const sizeMB = fileSize / (1024 * 1024);
    return Math.max(1000, Math.ceil(sizeMB * rate));  // Minimum 1s
  };

  // Check file parser service health (独立于 MCP)
  const checkMcpParserHealth = useCallback(async () => {
    try {
      const response = await fetch('/file-parser/health');
      if (response.ok) {
        const data = await response.json();
        setMcpParserServiceAvailable(data.container_available === true);
        return data;
      }
    } catch (error) {
      console.warn('File parser health check failed:', error.message);
    }
    setMcpParserServiceAvailable(false);
    return null;
  }, []);

  // Auto-check MCP parser service on mount and periodically
  useEffect(() => {
    checkMcpParserHealth();
    const interval = setInterval(checkMcpParserHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkMcpParserHealth]);

  return {
    // Parser state
    mcpEnabled,
    setMcpEnabled,
    mcpConfigCollapsed,
    setMcpConfigCollapsed,
    mcpParsers,
    setMcpParsers,
    isParsingFile,
    setIsParsingFile,
    parsingProgress,
    setParsingProgress,
    parsingAbortController,
    setParsingAbortController,

    // Parser service health (独立于 MCP Server)
    mcpParserServiceAvailable,
    checkMcpParserHealth,

    // Server state
    mcpServerEnabled,
    setMcpServerEnabled,
    mcpServerConfigCollapsed,
    setMcpServerConfigCollapsed,
    selectedMcpServer,
    setSelectedMcpServer,
    mcpServerConfigs,
    setMcpServerConfigs,
    mcpServerStatus,
    setMcpServerStatus,

    // Helpers
    getFileType,
    requiresDockerParsers,
    estimateParsingTime,
  };
};
