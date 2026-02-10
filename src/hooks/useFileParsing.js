import { useCallback, useRef } from 'react';
import { CONFIG } from '../config';
import { sandboxClient, ToolType } from '../sandbox.js';
import { TerminalImage } from './useSandbox.js';

/**
 * File parsing logic extracted from App.jsx.
 *
 * Handles file type detection, parsing via MCP backend or sandbox,
 * and the file upload UI flow.
 */
export function useFileParsing(deps) {
  const d = useRef(deps);
  d.current = deps;

  const getFileTypeForMcp = useCallback((filename) => {
    const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1];
    const typeMap = {
      'pdf': 'pdf',
      'doc': 'docx', 'docx': 'docx',
      'xls': 'xlsx', 'xlsx': 'xlsx',
      'jpg': 'image', 'jpeg': 'image', 'png': 'image',
      'gif': 'image', 'bmp': 'image', 'webp': 'image'
    };
    return typeMap[ext] || null;
  }, []);

  const parseViaMcpBackend = useCallback(async (file, parsers, abortController) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('parsers', JSON.stringify(parsers));

    const response = await fetch('/file-parser/parse/text', {
      method: 'POST',
      body: formData,
      signal: abortController?.signal
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP API错误 (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return result.text;
  }, []);

  const parseInSandbox = useCallback(async (file, parsers, abortController, containerInfoOverride = null) => {
    const activeContainerInfo = containerInfoOverride || d.current.containerInfo;
    if (!activeContainerInfo) {
      throw new Error('沙箱容器未初始化');
    }

    // Upload file to sandbox
    const fileBytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBytes);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    const fileBase64 = btoa(binary);

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `/tmp/${safeFileName}`;

    const uploadResp = await fetch(`${CONFIG.sandbox.baseUrl}/sandbox/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeContainerInfo.session_id,
        tool: 'write_file',
        params: {
          path: filePath,
          content: fileBase64,
          is_base64: true
        }
      }),
      signal: abortController?.signal
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      throw new Error(`文件上传失败: ${errText}`);
    }

    // Run MCP parser in container
    const parsersStr = parsers.map(p => `'${p}'`).join(', ');
    const parseCommand = `python3 -c "
import sys
sys.path.append('/app')
from file_parsers import parse_file

results = parse_file(open('${filePath}', 'rb').read(), '${file.name}', [${parsersStr}])

# 从解析结果中提取文本
all_text = []
for r in results:
    if r.get('success'):
        # PDF/图片: pages 数组
        if 'pages' in r:
            for p in r['pages']:
                if p.get('text'):
                    all_text.append(p['text'])
        # DOCX mammoth: text 字段
        elif 'text' in r:
            all_text.append(r['text'])
        # DOCX python-docx: paragraphs 数组
        elif 'paragraphs' in r:
            for p in r['paragraphs']:
                if p.get('text'):
                    all_text.append(p['text'])
        # XLSX: sheets 数组
        elif 'sheets' in r:
            for sheet in r['sheets']:
                for row in sheet.get('rows', []):
                    all_text.append(' | '.join(str(c) if c else '' for c in row))

print('\\\\n'.join(all_text))
"`;

    const response = await fetch(`${CONFIG.sandbox.baseUrl}/sandbox/tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: activeContainerInfo.session_id,
        tool: 'run_command',
        params: { command: parseCommand }
      }),
      signal: abortController?.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`沙箱解析失败: ${errText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(`解析命令失败: ${result.error || JSON.stringify(result.result)}`);
    }

    const cmdResult = result.result;
    if (cmdResult.exit_code !== 0) {
      throw new Error(`解析命令执行失败 (exit_code=${cmdResult.exit_code}): ${cmdResult.output}`);
    }

    return String(cmdResult.output || '').trim();
  }, []);

  const parseFileWithMcp = useCallback(async (file, fileType, abortController) => {
    const {
      mcpParsers, containerInfo, isFileParserReady, isSandboxAvailable,
      setParsingProgress, setSandboxImage, setSandboxStatus, setContainerInfo,
      setSandboxEnabled, setLogs, handleSandboxLog, estimateParsingTime,
    } = d.current;

    const startTime = Date.now();

    const selectedParsers = mcpParsers[fileType] || [];
    if (selectedParsers.length === 0) {
      throw new Error(`未配置${fileType}解析器`);
    }

    const config = CONFIG.mcp.parsers[fileType];
    const requiresDocker = selectedParsers.some(parserId => {
      const tool = config?.tools.find(t => t.id === parserId);
      return tool && tool.requiresDocker;
    });

    let useSandboxMode;
    let runLocation;
    let activeContainerInfo = containerInfo;

    if (requiresDocker) {
      if (!isFileParserReady()) {
        setParsingProgress({
          filename: file.name,
          parser: '准备中...',
          startTime,
          elapsedTime: 0,
          estimatedTime: 10000,
          runLocation: '启动 File Parser 容器...'
        });

        if (containerInfo) {
          try {
            await sandboxClient.destroyContainer();
          } catch (e) {
            console.warn('停止旧容器失败:', e);
          }
        }

        setSandboxImage(TerminalImage.FILE_PARSER);
        setSandboxStatus('connecting');
        try {
          const info = await sandboxClient.createContainer(TerminalImage.FILE_PARSER);
          activeContainerInfo = info;
          setContainerInfo(info);
          setSandboxStatus('running');
          setSandboxEnabled(true);
          sandboxClient.connectLogs(handleSandboxLog, (error) => {
            console.error('Sandbox WebSocket error:', error);
          });
          setLogs(prev => [...prev, {
            type: 'container',
            content: `MCP-tools 容器已自动启动: ${info.container_id}`,
            status: 'success',
          }]);
        } catch (error) {
          setSandboxStatus('error');
          throw new Error(`自动启动 MCP-tools 容器失败: ${error.message}`);
        }
      }
      useSandboxMode = true;
      runLocation = 'sandbox';
    } else {
      useSandboxMode = isSandboxAvailable();
      runLocation = useSandboxMode ? 'sandbox' : 'backend';
    }

    setParsingProgress({
      filename: file.name,
      parser: selectedParsers.join(', '),
      startTime,
      elapsedTime: 0,
      estimatedTime: estimateParsingTime(file.size, fileType),
      runLocation
    });

    const progressTimer = setInterval(() => {
      setParsingProgress(prev => prev ? {
        ...prev,
        elapsedTime: Date.now() - startTime
      } : null);
    }, 100);

    try {
      let text;
      if (useSandboxMode) {
        text = await parseInSandbox(file, selectedParsers, abortController, activeContainerInfo);
      } else {
        text = await parseViaMcpBackend(file, selectedParsers, abortController);
      }

      clearInterval(progressTimer);
      setParsingProgress(null);

      return {
        content: text,
        parsedWith: selectedParsers.join(', '),
        runLocation
      };
    } catch (error) {
      clearInterval(progressTimer);
      setParsingProgress(null);
      throw error;
    }
  }, [parseInSandbox, parseViaMcpBackend]);

  const handleAddFile = useCallback(async (e) => {
    const {
      mcpParsers, setIsParsingFile, setParsingProgress, setPayloadFiles, estimateParsingTime,
    } = d.current;

    const files = Array.from(e.target.files);

    for (const file of files) {
      let content;
      let parsedWith = null;
      let parseError = null;

      const ext = file.name.split('.').pop()?.toLowerCase();
      const needsParsing = ['pdf', 'docx', 'xlsx', 'xls', 'doc', 'pptx', 'ppt', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);

      if (needsParsing) {
        const startTime = Date.now();
        let progressTimer = null;

        try {
          setIsParsingFile(true);

          const parserTypeMap = {
            'pdf': 'pdf',
            'docx': 'docx', 'doc': 'docx',
            'xlsx': 'xlsx', 'xls': 'xlsx',
            'pptx': 'pptx', 'ppt': 'pptx',
            'jpg': 'image', 'jpeg': 'image', 'png': 'image',
            'gif': 'image', 'bmp': 'image', 'webp': 'image'
          };
          const parserType = parserTypeMap[ext];

          let selectedParsers = parserType ? mcpParsers[parserType] : [];

          if (!selectedParsers || selectedParsers.length === 0) {
            const defaults = {
              'pdf': ['pymupdf'],
              'docx': ['python-docx'],
              'xlsx': ['openpyxl'],
              'pptx': ['python-pptx'],
              'image': ['pytesseract']
            };
            selectedParsers = defaults[parserType] || ['text'];
          }

          setParsingProgress({
            filename: file.name,
            parser: selectedParsers.join(', '),
            startTime,
            elapsedTime: 0,
            estimatedTime: estimateParsingTime(file.size, parserType || 'text'),
            runLocation: 'backend'
          });

          progressTimer = setInterval(() => {
            setParsingProgress(prev => prev ? {
              ...prev,
              elapsedTime: Date.now() - startTime
            } : null);
          }, 100);

          const formData = new FormData();
          formData.append('file', file);
          formData.append('parsers', JSON.stringify(selectedParsers));

          const response = await fetch('/file-parser/parse/text', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`解析失败: ${response.status}`);
          }

          const result = await response.json();
          content = result.text || '';
          parsedWith = selectedParsers.join(', ');

        } catch (error) {
          console.error('文件解析失败:', error);
          parseError = error.message;
          content = await file.text();
          parsedWith = 'fallback (原始文本)';
        } finally {
          if (progressTimer) clearInterval(progressTimer);
          setParsingProgress(null);
          setIsParsingFile(false);
        }
      } else {
        content = await file.text();
      }

      setPayloadFiles(prev => [...prev, {
        name: file.name,
        content,
        size: file.size,
        parsedWith,
        runLocation: 'backend',
        parseError
      }]);
    }

    e.target.value = '';
  }, []);

  const removePayloadFile = useCallback((index) => {
    d.current.setPayloadFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  return {
    getFileTypeForMcp,
    parseViaMcpBackend,
    parseInSandbox,
    parseFileWithMcp,
    handleAddFile,
    removePayloadFile,
  };
}
