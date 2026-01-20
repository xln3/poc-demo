import { useState, useEffect, useCallback } from 'react';
import { sandboxClient, ImageType } from '../sandbox.js';
import { CONFIG } from '../config';

/**
 * Custom hook for sandbox container management
 * @param {Object} options
 * @param {Function} options.addLog - Function to add log entries
 * @returns {Object} Sandbox state and functions
 */
export const useSandbox = ({ addLog }) => {
  // Sandbox states
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'running' | 'error'
  const [sandboxImage, setSandboxImage] = useState(ImageType.PYTHON);
  const [containerInfo, setContainerInfo] = useState(null);
  const [sandboxAvailable, setSandboxAvailable] = useState(false);
  const [toolCommand, setToolCommand] = useState('');
  const [toolResult, setToolResult] = useState(null);
  const [showSandboxPanel, setShowSandboxPanel] = useState(true);
  const [sandboxFiles, setSandboxFiles] = useState([]); // [{name, path, size, preset?}]
  const [uploadingSandboxFile, setUploadingSandboxFile] = useState(false);

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

  // Start container
  const startContainer = async () => {
    setSandboxStatus('connecting');
    try {
      const info = await sandboxClient.createContainer(sandboxImage);
      setContainerInfo(info);
      setSandboxStatus('running');
      setSandboxEnabled(true);

      // Connect WebSocket for real-time logs
      sandboxClient.connectLogs(handleSandboxLog, (error) => {
        console.error('Sandbox WebSocket error:', error);
      });

      addLog({
        type: 'container',
        content: `容器已启动: ${info.container_id} (${info.image})`,
        status: 'success',
      });

      return info;
    } catch (error) {
      setSandboxStatus('error');
      addLog({
        type: 'error',
        content: `容器启动失败: ${error.message}`,
        status: 'danger',
      });
      throw error;
    }
  };

  // Stop container
  const stopContainer = async () => {
    sandboxClient.disconnectLogs();
    try {
      await sandboxClient.destroyContainer();
      setContainerInfo(null);
      setSandboxStatus('disconnected');
      setSandboxFiles([]);
      addLog({
        type: 'container',
        content: '容器已停止',
        status: 'warning',
      });
    } catch (error) {
      addLog({
        type: 'error',
        content: `容器停止失败: ${error.message}`,
        status: 'danger',
      });
    }
  };

  // Upload files to sandbox (without parsing, direct write to container filesystem)
  const handleUploadToSandbox = async (e) => {
    const files = e.target.files;
    if (!files?.length || sandboxStatus !== 'running') return;

    setUploadingSandboxFile(true);
    try {
      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `/workspace/${safeName}`;

        const response = await fetch(`${CONFIG.sandbox.baseUrl}/sandbox/tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: containerInfo.session_id,
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
          content: `📁 文件已上传到沙箱: ${path}`,
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
        content: `🗑️ 文件已删除: ${path}`,
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
          content: `📁 预置文件: ${path}`,
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

  // Refresh sandbox file list (read from /workspace/ directory)
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

      // Parse ls -la output
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
            name: isDir ? `📁 ${name}` : name,
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
        content: `📥 已下载: ${fileName}`,
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sandboxClient.disconnectLogs();
    };
  }, []);

  // Check if sandbox is available for use
  const isSandboxAvailable = () => {
    return sandboxEnabled && sandboxStatus === 'running' && containerInfo !== null;
  };

  // Check if MCP-tools container is ready
  const isMcpToolsContainerReady = () => {
    return isSandboxAvailable() && containerInfo?.image === 'mcp-tools:latest';
  };

  return {
    // State
    sandboxEnabled,
    setSandboxEnabled,
    sandboxStatus,
    setSandboxStatus,
    sandboxImage,
    setSandboxImage,
    containerInfo,
    setContainerInfo,
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

    // Functions
    startContainer,
    stopContainer,
    handleUploadToSandbox,
    handleRemoveSandboxFile,
    presetSandboxFiles,
    refreshSandboxFiles,
    handleDownloadSandboxFile,
    executeCommand,
    handleSandboxLog,

    // Helper functions
    isSandboxAvailable,
    isMcpToolsContainerReady,
  };
};

export { ImageType };
