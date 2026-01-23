import { useState, useEffect, useCallback, useRef } from 'react';
import { sandboxClient, TerminalImage, formatBytes, formatTimeAgo } from '../sandbox.js';

/**
 * Custom hook for multi-terminal sandbox management
 * @param {Object} options
 * @param {Function} options.addLog - Function to add log entries
 * @returns {Object} Sandbox state and functions
 */
export const useSandbox = ({ addLog }) => {
  // Multi-terminal state
  const [terminals, setTerminals] = useState([]); // List of running terminals
  const [currentTag, setCurrentTag] = useState(''); // Currently selected terminal tag
  const [newTerminalTag, setNewTerminalTag] = useState(''); // Input for new terminal tag
  const [newTerminalImage, setNewTerminalImage] = useState(TerminalImage.PYTHON);

  // Deleted terminals state
  const [deletedTerminals, setDeletedTerminals] = useState([]);
  const [deletedTotalSize, setDeletedTotalSize] = useState(0);

  // UI state
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'running' | 'error'
  const [sandboxAvailable, setSandboxAvailable] = useState(false);
  const [toolCommand, setToolCommand] = useState('');
  const [toolResult, setToolResult] = useState(null);
  const [showSandboxPanel, setShowSandboxPanel] = useState(true);
  const [sandboxFiles, setSandboxFiles] = useState([]);
  const [uploadingSandboxFile, setUploadingSandboxFile] = useState(false);
  const [creatingTerminal, setCreatingTerminal] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

  // Refs for intervals
  const terminalPollRef = useRef(null);
  const deletedPollRef = useRef(null);

  // Check sandbox service availability
  useEffect(() => {
    const checkSandbox = async () => {
      const available = await sandboxClient.healthCheck();
      setSandboxAvailable(available);
    };
    checkSandbox();
    const interval = setInterval(checkSandbox, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch terminals list
  const fetchTerminals = useCallback(async () => {
    try {
      const response = await sandboxClient.listTerminals();
      setTerminals(response.terminals || []);

      // If current terminal is gone, clear selection
      if (currentTag && !response.terminals.find(t => t.tag === currentTag)) {
        setCurrentTag('');
        setSandboxStatus('disconnected');
        setSandboxEnabled(false);
        sandboxClient.disconnectLogs();
      }
    } catch (error) {
      console.error('Failed to fetch terminals:', error);
    }
  }, [currentTag]);

  // Fetch deleted terminals list
  const fetchDeletedTerminals = useCallback(async () => {
    try {
      const response = await sandboxClient.listDeletedTerminals();
      setDeletedTerminals(response.terminals || []);
      setDeletedTotalSize(response.total_size_bytes || 0);
    } catch (error) {
      console.error('Failed to fetch deleted terminals:', error);
    }
  }, []);

  // Poll for terminals
  useEffect(() => {
    fetchTerminals();
    terminalPollRef.current = setInterval(fetchTerminals, 10000);
    return () => {
      if (terminalPollRef.current) {
        clearInterval(terminalPollRef.current);
      }
    };
  }, [fetchTerminals]);

  // Poll for deleted terminals (less frequent)
  useEffect(() => {
    fetchDeletedTerminals();
    deletedPollRef.current = setInterval(fetchDeletedTerminals, 30000);
    return () => {
      if (deletedPollRef.current) {
        clearInterval(deletedPollRef.current);
      }
    };
  }, [fetchDeletedTerminals]);

  // Sandbox WebSocket log callback
  const handleSandboxLog = useCallback((log) => {
    addLog({
      type: log.type,
      content: log.content,
      status: log.status,
      timestamp: log.timestamp,
      details: log.details,
    });
  }, [addLog]);

  // Create new terminal
  const createTerminal = async (tag, image = TerminalImage.PYTHON) => {
    if (!tag || tag.trim() === '') {
      addLog({
        type: 'error',
        content: '请输入终端标识（tag）',
        status: 'danger',
      });
      return null;
    }

    setCreatingTerminal(true);
    try {
      const info = await sandboxClient.createTerminal(tag.trim(), image);

      addLog({
        type: 'container',
        content: `终端已创建: ${info.tag} (${info.image})`,
        status: 'success',
      });

      // Switch to the new terminal
      setCurrentTag(info.tag);
      setSandboxStatus('running');
      setSandboxEnabled(true);
      setNewTerminalTag('');

      // Connect WebSocket for logs
      sandboxClient.connectLogs(handleSandboxLog, (error) => {
        console.error('Sandbox WebSocket error:', error);
      });

      // Refresh terminal list
      await fetchTerminals();

      return info;
    } catch (error) {
      addLog({
        type: 'error',
        content: `创建终端失败: ${error.message}`,
        status: 'danger',
      });
      return null;
    } finally {
      setCreatingTerminal(false);
    }
  };

  // Switch to a terminal
  const switchTerminal = useCallback(async (tag) => {
    if (tag === currentTag) return;

    // Disconnect from current terminal
    sandboxClient.disconnectLogs();

    const terminal = terminals.find(t => t.tag === tag);
    if (!terminal) {
      addLog({
        type: 'error',
        content: `终端 '${tag}' 不存在`,
        status: 'danger',
      });
      return;
    }

    // Switch to new terminal
    sandboxClient.switchTerminal(tag, terminal.session_id);
    setCurrentTag(tag);
    setSandboxStatus('running');
    setSandboxEnabled(true);
    setSandboxFiles([]);

    // Connect WebSocket for logs
    sandboxClient.connectLogs(handleSandboxLog, (error) => {
      console.error('Sandbox WebSocket error:', error);
    });

    addLog({
      type: 'container',
      content: `已切换到终端: ${tag}`,
      status: 'normal',
    });

    // Refresh files
    refreshSandboxFiles();
  }, [currentTag, terminals, handleSandboxLog, addLog]);

  // Destroy a terminal
  const destroyTerminal = async (tag) => {
    try {
      await sandboxClient.destroyTerminal(tag);

      addLog({
        type: 'container',
        content: `终端已销毁: ${tag}`,
        status: 'warning',
      });

      if (tag === currentTag) {
        setCurrentTag('');
        setSandboxStatus('disconnected');
        setSandboxEnabled(false);
        setSandboxFiles([]);
      }

      // Refresh lists
      await fetchTerminals();
      await fetchDeletedTerminals();
    } catch (error) {
      addLog({
        type: 'error',
        content: `销毁终端失败: ${error.message}`,
        status: 'danger',
      });
    }
  };

  // Cleanup single deleted terminal
  const cleanupDeleted = async (name) => {
    try {
      const result = await sandboxClient.cleanupDeletedTerminal(name);

      addLog({
        type: 'container',
        content: `已清理: ${name} (释放 ${formatBytes(result.freed_bytes)})`,
        status: 'success',
      });

      await fetchDeletedTerminals();
    } catch (error) {
      addLog({
        type: 'error',
        content: `清理失败: ${error.message}`,
        status: 'danger',
      });
    }
  };

  // Cleanup all deleted terminals
  const cleanupAllDeleted = async () => {
    try {
      const result = await sandboxClient.cleanupAllDeleted();

      addLog({
        type: 'container',
        content: `已清理 ${result.cleaned_count} 个终端 (释放 ${formatBytes(result.freed_bytes)})`,
        status: 'success',
      });

      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(err => {
          addLog({
            type: 'error',
            content: err,
            status: 'danger',
          });
        });
      }

      setShowCleanupConfirm(false);
      await fetchDeletedTerminals();
    } catch (error) {
      addLog({
        type: 'error',
        content: `清理失败: ${error.message}`,
        status: 'danger',
      });
    }
  };

  // Upload files to sandbox
  const handleUploadToSandbox = async (e) => {
    const files = e.target.files;
    if (!files?.length || sandboxStatus !== 'running' || !currentTag) return;

    setUploadingSandboxFile(true);
    try {
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const uint8Array = new Uint8Array(bytes);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `/workspace/${safeName}`;

        const response = await fetch(`/sandbox/tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sandboxClient.sessionId,
            tool: 'write_file',
            params: { path, content: base64, is_base64: true }
          })
        });

        if (!response.ok) {
          throw new Error(`上传失败: ${response.status}`);
        }

        setSandboxFiles(prev => [...prev, { name: file.name, path, size: file.size }]);

        addLog({
          type: 'data',
          content: `文件已上传到沙箱: ${path}`,
          status: 'normal'
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        content: `文件上传失败: ${error.message}`,
        status: 'danger'
      });
    } finally {
      setUploadingSandboxFile(false);
      e.target.value = '';
    }
  };

  // Remove file from sandbox
  const handleRemoveSandboxFile = async (path) => {
    try {
      await sandboxClient.runCommand(`rm -f "${path}"`);
      setSandboxFiles(prev => prev.filter(f => f.path !== path));
      addLog({
        type: 'data',
        content: `文件已删除: ${path}`,
        status: 'normal'
      });
    } catch (error) {
      addLog({
        type: 'error',
        content: `删除失败: ${error.message}`,
        status: 'danger'
      });
    }
  };

  // Preset scenario files to sandbox
  const presetSandboxFiles = async (filesMap) => {
    if (!filesMap || sandboxStatus !== 'running') return;

    for (const [path, content] of Object.entries(filesMap)) {
      try {
        await sandboxClient.writeFile(path, content);
        const fileName = path.split('/').pop();
        setSandboxFiles(prev => [...prev, {
          name: fileName,
          path,
          size: content.length,
          preset: true
        }]);
        addLog({
          type: 'data',
          content: `预置文件: ${path}`,
          status: 'normal'
        });
      } catch (error) {
        addLog({
          type: 'error',
          content: `预置文件失败 ${path}: ${error.message}`,
          status: 'danger'
        });
      }
    }
  };

  // Refresh sandbox file list
  const refreshSandboxFiles = async () => {
    if (sandboxStatus !== 'running') return;

    try {
      const result = await sandboxClient.runCommand('ls -la /workspace/ 2>/dev/null || echo "empty"');
      if (!result.success) return;

      const output = result.result?.output || '';
      if (output.trim() === 'empty' || !output.trim()) {
        setSandboxFiles([]);
        return;
      }

      const lines = output.split('\n').filter(line => line.trim() && !line.startsWith('total'));
      const files = [];
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 9) {
          const perms = parts[0];
          const size = parseInt(parts[4]) || 0;
          const name = parts.slice(8).join(' ');
          if (name === '.' || name === '..') continue;
          const isDir = perms.startsWith('d');
          files.push({
            name,
            path: `/workspace/${name}`,
            size,
            isDir
          });
        }
      }
      setSandboxFiles(files);
    } catch (error) {
      console.error('刷新文件列表失败:', error);
    }
  };

  // Download file from sandbox
  const handleDownloadSandboxFile = async (filePath, fileName) => {
    if (sandboxStatus !== 'running') return;

    try {
      const result = await sandboxClient.readFile(filePath);
      if (!result.success) {
        throw new Error(result.error || '读取失败');
      }

      const content = result.result;
      const blob = new Blob([content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || filePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog({
        type: 'data',
        content: `已下载: ${fileName}`,
        status: 'normal'
      });
    } catch (error) {
      addLog({
        type: 'error',
        content: `下载失败: ${error.message}`,
        status: 'danger'
      });
    }
  };

  // Execute shell command
  const executeCommand = async () => {
    if (!toolCommand.trim() || sandboxStatus !== 'running') return;

    setToolResult(null);
    addLog({
      type: 'tool',
      content: `执行命令: ${toolCommand}`,
      status: 'normal',
    });

    try {
      const result = await sandboxClient.runCommand(toolCommand);
      setToolResult(result);

      if (result.success) {
        const output = result.result;
        addLog({
          type: 'tool',
          content: `命令完成 (exit: ${output.exit_code})`,
          status: output.exit_code === 0 ? 'success' : 'warning',
        });
      } else {
        addLog({
          type: 'error',
          content: `命令失败: ${result.error}`,
          status: 'danger',
        });
      }
    } catch (error) {
      addLog({
        type: 'error',
        content: `执行错误: ${error.message}`,
        status: 'danger',
      });
    }
  };

  // Get current terminal info
  const getCurrentTerminal = useCallback(() => {
    return terminals.find(t => t.tag === currentTag) || null;
  }, [terminals, currentTag]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sandboxClient.disconnectLogs();
    };
  }, []);

  // Check if sandbox is available for use
  const isSandboxAvailable = () => {
    return sandboxEnabled && sandboxStatus === 'running' && currentTag !== '';
  };

  // Get current container info (compatibility with old API)
  const containerInfo = getCurrentTerminal();

  // Get current sandbox image (compatibility with old API)
  const sandboxImage = containerInfo?.image || newTerminalImage;

  // Check if file-parser container is ready (legacy - always false in new system)
  const isFileParserReady = () => false;

  // Legacy start/stop container functions (create/destroy current terminal)
  const startContainer = async () => {
    const tag = newTerminalTag || `terminal-${Date.now()}`;
    return createTerminal(tag, newTerminalImage);
  };

  const stopContainer = async () => {
    if (currentTag) {
      return destroyTerminal(currentTag);
    }
  };

  // Set sandbox image (updates newTerminalImage)
  const setSandboxImage = setNewTerminalImage;

  // Set container info (no-op for compatibility)
  const setContainerInfo = () => {};

  return {
    // Multi-terminal state
    terminals,
    currentTag,
    setCurrentTag,
    newTerminalTag,
    setNewTerminalTag,
    newTerminalImage,
    setNewTerminalImage,
    deletedTerminals,
    deletedTotalSize,
    creatingTerminal,
    showCleanupConfirm,
    setShowCleanupConfirm,

    // UI state
    sandboxEnabled,
    setSandboxEnabled,
    sandboxStatus,
    setSandboxStatus,
    sandboxAvailable,
    toolCommand,
    setToolCommand,
    toolResult,
    setToolResult,
    showSandboxPanel,
    setShowSandboxPanel,
    sandboxFiles,
    setSandboxFiles,
    uploadingSandboxFile,

    // Multi-terminal functions
    createTerminal,
    switchTerminal,
    destroyTerminal,
    fetchTerminals,
    fetchDeletedTerminals,
    cleanupDeleted,
    cleanupAllDeleted,
    getCurrentTerminal,

    // File functions
    handleUploadToSandbox,
    handleRemoveSandboxFile,
    presetSandboxFiles,
    refreshSandboxFiles,
    handleDownloadSandboxFile,
    executeCommand,
    handleSandboxLog,

    // Helper functions
    isSandboxAvailable,

    // Legacy compatibility (for useCases and other code)
    sandboxImage,
    setSandboxImage,
    containerInfo,
    setContainerInfo,
    startContainer,
    stopContainer,
    isFileParserReady,
  };
};

export { TerminalImage, formatBytes, formatTimeAgo };
