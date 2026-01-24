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

  // File tree browser state
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [fileTreeTag, setFileTreeTag] = useState('');

  // File upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTargetPath, setUploadTargetPath] = useState('/workspace');

  // Transfer progress state
  const [transferState, setTransferState] = useState(null); // { type: 'upload'|'download', fileName, loaded, total }

  // File watch state
  const [fileWatchConnection, setFileWatchConnection] = useState(null);
  const [fileWatchPath, setFileWatchPath] = useState('/workspace');

  // Lock state
  const [lockStatus, setLockStatus] = useState({}); // { [tag]: { locked, holder, isMe } }

  // Refs for intervals
  const terminalPollRef = useRef(null);
  const deletedPollRef = useRef(null);
  const fileWatchRefreshRef = useRef(null);
  const lockHeartbeatRef = useRef(null);

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

  // Fetch terminals list and lock status
  const fetchTerminals = useCallback(async () => {
    try {
      const response = await sandboxClient.listTerminals();
      const terminalList = response.terminals || [];
      setTerminals(terminalList);

      // Fetch lock status for all terminals
      if (terminalList.length > 0) {
        const myUserId = sandboxClient.getUserId();
        const tags = terminalList.map(t => t.tag);
        const locks = await sandboxClient.getAllLockStatus(tags);

        // Add isMe flag
        const lockWithMe = {};
        for (const [tag, status] of Object.entries(locks)) {
          lockWithMe[tag] = {
            ...status,
            isMe: status.holder === myUserId,
          };
        }
        setLockStatus(lockWithMe);
      }

      // If current terminal is gone, clear selection
      if (currentTag && !terminalList.find(t => t.tag === currentTag)) {
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
      // Release lock for current terminal if any
      if (currentTag) {
        await sandboxClient.releaseLock(currentTag).catch(() => {});
        if (lockHeartbeatRef.current) {
          clearInterval(lockHeartbeatRef.current);
          lockHeartbeatRef.current = null;
        }
      }

      const info = await sandboxClient.createTerminal(tag.trim(), image);

      // Acquire lock for new terminal
      try {
        await sandboxClient.acquireLock(info.tag);
      } catch (lockError) {
        console.warn('Failed to acquire lock for new terminal:', lockError);
      }

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

      // Start heartbeat for lock
      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current);
      }
      lockHeartbeatRef.current = setInterval(async () => {
        try {
          await sandboxClient.lockHeartbeat(info.tag);
        } catch (error) {
          console.warn('Lock heartbeat failed:', error);
        }
      }, 30000);

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

  // Release lock for current terminal
  const releaseLock = useCallback(async (tag) => {
    if (!tag) return;
    try {
      await sandboxClient.releaseLock(tag);
    } catch (error) {
      console.warn('Failed to release lock:', error);
    }
    // Stop heartbeat
    if (lockHeartbeatRef.current) {
      clearInterval(lockHeartbeatRef.current);
      lockHeartbeatRef.current = null;
    }
  }, []);

  // Start heartbeat for locked terminal
  const startHeartbeat = useCallback((tag) => {
    // Clear existing heartbeat
    if (lockHeartbeatRef.current) {
      clearInterval(lockHeartbeatRef.current);
    }
    // Send heartbeat every 30 seconds
    lockHeartbeatRef.current = setInterval(async () => {
      try {
        await sandboxClient.lockHeartbeat(tag);
      } catch (error) {
        console.warn('Lock heartbeat failed:', error);
        // Lock lost, clear state
        addLog({
          type: 'error',
          content: `终端 ${tag} 的锁已丢失`,
          status: 'danger',
        });
      }
    }, 30000);
  }, [addLog]);

  // Switch to a terminal (with lock)
  const switchTerminal = useCallback(async (tag) => {
    if (tag === currentTag) return;

    const terminal = terminals.find(t => t.tag === tag);
    if (!terminal) {
      addLog({
        type: 'error',
        content: `终端 '${tag}' 不存在`,
        status: 'danger',
      });
      return;
    }

    // Try to acquire lock
    try {
      const lockResult = await sandboxClient.acquireLock(tag);
      if (!lockResult.success) {
        addLog({
          type: 'error',
          content: `无法选中终端: ${lockResult.message}`,
          status: 'danger',
        });
        return;
      }
    } catch (error) {
      addLog({
        type: 'error',
        content: `获取终端锁失败: ${error.message}`,
        status: 'danger',
      });
      return;
    }

    // Release lock for previous terminal
    if (currentTag) {
      await releaseLock(currentTag);
    }

    // Disconnect from current terminal
    sandboxClient.disconnectLogs();

    // Switch to new terminal
    sandboxClient.switchTerminal(tag, terminal.session_id);
    setCurrentTag(tag);
    setSandboxStatus('running');
    setSandboxEnabled(true);
    setSandboxFiles([]);

    // Start heartbeat
    startHeartbeat(tag);

    // Connect WebSocket for logs
    sandboxClient.connectLogs(handleSandboxLog, (error) => {
      console.error('Sandbox WebSocket error:', error);
    });

    addLog({
      type: 'container',
      content: `已切换到终端: ${tag}`,
      status: 'normal',
    });

    // Refresh files and lock status
    refreshSandboxFiles();
    fetchTerminals();
  }, [currentTag, terminals, handleSandboxLog, addLog, releaseLock, startHeartbeat, fetchTerminals]);

  // Destroy a terminal
  const destroyTerminal = async (tag) => {
    try {
      // Release lock if we hold it
      if (tag === currentTag) {
        await releaseLock(tag);
      }

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
        type: 'toast_tester',
        content: `文件已删除: ${path}`,
        status: 'success'
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

  // Cleanup on unmount - release lock
  useEffect(() => {
    return () => {
      sandboxClient.disconnectLogs();
      // Stop heartbeat
      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current);
        lockHeartbeatRef.current = null;
      }
    };
  }, []);

  // Release lock when page unloads
  useEffect(() => {
    const handleUnload = () => {
      if (currentTag) {
        // Use fetch with keepalive for reliability on page unload
        const userId = sandboxClient.getUserId();
        fetch(
          `/sandbox/terminals/${encodeURIComponent(currentTag)}/lock?user_id=${encodeURIComponent(userId)}`,
          { method: 'DELETE', keepalive: true }
        ).catch(() => {}); // Ignore errors on unload
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [currentTag]);

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

  // ============ File Tree Browser Functions ============

  // Open file tree browser for a terminal
  const openFileTree = useCallback((tag) => {
    setFileTreeTag(tag);
    setFileTreeOpen(true);
  }, []);

  // Close file tree browser
  const closeFileTree = useCallback(() => {
    setFileTreeOpen(false);
    setFileTreeTag('');
  }, []);

  // Open upload dialog
  const openUploadDialog = useCallback((targetPath = '/workspace') => {
    setUploadTargetPath(targetPath);
    setUploadDialogOpen(true);
  }, []);

  // Open upload dialog for a specific terminal
  const openUploadForTerminal = useCallback((tag) => {
    setFileTreeTag(tag);
    setUploadTargetPath('/workspace');
    setUploadDialogOpen(true);
  }, []);

  // Close upload dialog
  const closeUploadDialog = useCallback(() => {
    setUploadDialogOpen(false);
  }, []);

  // ============ Transfer Functions with Progress ============

  // Upload files with progress tracking
  const uploadFilesWithProgress = useCallback(async (files, targetPath = '/workspace') => {
    const tag = fileTreeTag || currentTag;
    if (!tag) {
      addLog({
        type: 'error',
        content: '没有活跃的终端',
        status: 'danger',
      });
      return;
    }

    closeUploadDialog();

    // 检查是否为文件夹上传（有 webkitRelativePath）
    const hasRelativePath = files.some(f => f.webkitRelativePath);

    // 统一使用 targetPath（用户当前浏览的目录）
    const basePath = targetPath;

    if (hasRelativePath) {
      // 文件夹上传：先创建目录结构
      const dirsToCreate = new Set();
      for (const file of files) {
        const relativePath = file.webkitRelativePath;
        if (relativePath) {
          const pathParts = relativePath.split('/');
          for (let i = 1; i < pathParts.length; i++) {
            dirsToCreate.add(pathParts.slice(0, i).join('/'));
          }
        }
      }

      // 按路径长度排序，先创建父目录
      const sortedDirs = Array.from(dirsToCreate).sort((a, b) => a.length - b.length);
      if (sortedDirs.length > 0) {
        // 一次性创建所有目录
        const mkdirCmd = sortedDirs.map(d => `"${basePath}/${d}"`).join(' ');
        try {
          await sandboxClient.executeToolInTerminal(tag, 'run_command', {
            command: `mkdir -p ${mkdirCmd}`
          });
        } catch (error) {
          console.warn('创建目录失败:', error);
        }
      }
    }

    // 上传文件
    for (const file of files) {
      try {
        const relativePath = file.webkitRelativePath || file.name;

        // 计算目标路径
        let actualTargetPath = basePath;
        if (file.webkitRelativePath) {
          // 文件夹上传：webkitRelativePath 包含完整相对路径，取其目录部分
          const pathParts = relativePath.split('/');
          if (pathParts.length > 1) {
            const dirPart = pathParts.slice(0, -1).join('/');
            actualTargetPath = `${basePath}/${dirPart}`;
          }
        }

        setTransferState({
          type: 'upload',
          fileName: file.name,
          loaded: 0,
          total: file.size,
        });

        await sandboxClient.uploadFile(tag, file, actualTargetPath, (progress) => {
          setTransferState(prev => prev ? { ...prev, ...progress } : null);
        });

      } catch (error) {
        if (error.message !== '已取消') {
          addLog({
            type: 'error',
            content: `上传失败 ${file.name}: ${error.message}`,
            status: 'danger',
          });
        }
      } finally {
        setTransferState(null);
      }
    }

    // 上传完成提示
    addLog({
      type: 'toast_tester',
      content: `已上传 ${files.length} 个文件到 ${basePath}`,
      status: 'success',
    });

    // Refresh file list after upload
    refreshSandboxFiles();
  }, [fileTreeTag, currentTag, addLog, refreshSandboxFiles, closeUploadDialog]);

  // Download file with progress tracking
  const downloadFileWithProgress = useCallback(async (filePath, fileName) => {
    const tag = fileTreeTag || currentTag;
    if (!tag) {
      addLog({
        type: 'error',
        content: '没有活跃的终端',
        status: 'danger',
      });
      return;
    }

    try {
      setTransferState({
        type: 'download',
        fileName: fileName || filePath.split('/').pop(),
        loaded: 0,
        total: 0,
      });

      const { blob, fileName: downloadName } = await sandboxClient.downloadFile(
        tag,
        filePath,
        (progress) => {
          setTransferState(prev => prev ? { ...prev, ...progress } : null);
        }
      );

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog({
        type: 'toast_tester',
        content: `已下载: ${downloadName}`,
        status: 'success',
      });

    } catch (error) {
      if (error.message !== '已取消') {
        addLog({
          type: 'error',
          content: `下载失败: ${error.message}`,
          status: 'danger',
        });
      }
    } finally {
      setTransferState(null);
    }
  }, [fileTreeTag, currentTag, addLog]);

  // Cancel current transfer
  const cancelTransfer = useCallback(() => {
    sandboxClient.cancelUpload();
    setTransferState(null);
  }, []);

  // ============ File Watch Functions ============

  // Start file watch for a terminal
  const startFileWatch = useCallback((tag, path = '/workspace', onRefresh = null) => {
    // 停止现有连接
    if (fileWatchConnection) {
      fileWatchConnection.close();
    }

    // 清除之前的刷新防抖定时器
    if (fileWatchRefreshRef.current) {
      clearTimeout(fileWatchRefreshRef.current);
    }

    const conn = sandboxClient.connectFileWatch(
      tag,
      path,
      (event) => {
        // 处理文件变化事件
        if (event.type === 'file_change') {
          console.log('[FileWatch] File changed:', event);

          // 显示 Toast 通知（来源未知 - 无法追踪是谁触发的）
          const eventName = { 'CREATE': '新建', 'DELETE': '删除', 'MODIFY': '修改', 'MOVE': '移动' }[event.event] || event.event;
          const fileName = event.path.split('/').pop();
          addLog({
            type: 'toast_unknown',
            content: `${eventName}: ${fileName}`,
            status: 'normal',
          });

          // 防抖：避免短时间内多次刷新
          if (fileWatchRefreshRef.current) {
            clearTimeout(fileWatchRefreshRef.current);
          }

          fileWatchRefreshRef.current = setTimeout(() => {
            if (onRefresh) {
              onRefresh();
            }
          }, 100);  // 从 300 减小到 100
        } else if (event.type === 'file_changes') {
          // 批量事件摘要
          console.log('[FileWatch] Batch file changes:', event.count);
          addLog({
            type: 'toast_unknown',
            content: `${event.count} 个文件变化`,
            status: 'normal',
          });

          // 刷新文件列表
          if (fileWatchRefreshRef.current) {
            clearTimeout(fileWatchRefreshRef.current);
          }
          fileWatchRefreshRef.current = setTimeout(() => {
            if (onRefresh) {
              onRefresh();
            }
          }, 100);
        } else if (event.type === 'watching') {
          console.log('[FileWatch] Started watching:', event.path);
        }
      },
      (error) => {
        console.warn('[FileWatch] Error:', error);
        // 连接断开时清理状态
        setFileWatchConnection(null);
      }
    );

    setFileWatchConnection(conn);
    setFileWatchPath(path);

    return conn;
  }, [fileWatchConnection]);

  // Stop file watch
  const stopFileWatch = useCallback(() => {
    if (fileWatchConnection) {
      fileWatchConnection.close();
      setFileWatchConnection(null);
    }
    if (fileWatchRefreshRef.current) {
      clearTimeout(fileWatchRefreshRef.current);
      fileWatchRefreshRef.current = null;
    }
  }, [fileWatchConnection]);

  // Check if file watch is active
  const isFileWatchActive = useCallback(() => {
    return fileWatchConnection !== null;
  }, [fileWatchConnection]);

  // Cleanup file watch on unmount
  useEffect(() => {
    return () => {
      if (fileWatchConnection) {
        fileWatchConnection.close();
      }
      if (fileWatchRefreshRef.current) {
        clearTimeout(fileWatchRefreshRef.current);
      }
    };
  }, []);

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
    lockStatus,

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

    // File tree browser state
    fileTreeOpen,
    fileTreeTag,
    uploadDialogOpen,
    uploadTargetPath,
    transferState,

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

    // File tree browser functions
    openFileTree,
    closeFileTree,
    openUploadDialog,
    openUploadForTerminal,
    closeUploadDialog,
    uploadFilesWithProgress,
    downloadFileWithProgress,
    cancelTransfer,

    // File watch functions
    startFileWatch,
    stopFileWatch,
    isFileWatchActive,
    fileWatchPath,

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
