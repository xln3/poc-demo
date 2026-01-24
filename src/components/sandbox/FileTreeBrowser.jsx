import React, { useState, useEffect, useCallback } from 'react';
import { SANDBOX_CONFIG, formatBytes } from '../../sandbox.js';

// 允许的根目录
const ALLOWED_ROOTS = ['/workspace', '/tmp'];

// 检查路径是否在允许的根目录下
const isPathAllowed = (path) => {
  return ALLOWED_ROOTS.some(root => path === root || path.startsWith(root + '/'));
};

// 获取路径的允许根目录
const getAllowedRoot = (path) => {
  return ALLOWED_ROOTS.find(root => path === root || path.startsWith(root + '/'));
};

export const FileTreeBrowser = ({
  tag,
  isOpen,
  onClose,
  onDownload,
  onUpload,
  startFileWatch,
  stopFileWatch,
}) => {
  const [currentPath, setCurrentPath] = useState('/workspace');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 加载目录内容
  const loadDirectory = useCallback(async (path) => {
    if (!tag) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${SANDBOX_CONFIG.baseUrl}/sandbox/terminals/${encodeURIComponent(tag)}/files?path=${encodeURIComponent(path)}`
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || response.statusText);
      }

      const data = await response.json();
      setFiles(data.entries || []);
    } catch (err) {
      // 如果目录不存在（被删除），回退到根目录
      // 检查各种可能的错误消息格式
      const errMsg = err.message.toLowerCase();
      const isNotFound = errMsg.includes('not found') ||
                         errMsg.includes('no such') ||
                         errMsg.includes('不存在') ||
                         errMsg.includes('failed to list directory') ||
                         errMsg.includes('internal server error');

      if (isNotFound && path !== '/workspace') {
        console.log(`[FileTreeBrowser] Directory not found, falling back to /workspace: ${path}`);
        setCurrentPath('/workspace');
        setLoading(false);
        return; // 会触发 useEffect 重新加载
      }
      setError(err.message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  // 初始加载和路径变化时加载
  useEffect(() => {
    if (isOpen && tag) {
      loadDirectory(currentPath);
    }
  }, [isOpen, tag, currentPath, loadDirectory]);

  // 文件监视：打开浏览器时启动，关闭时停止
  useEffect(() => {
    if (isOpen && tag && startFileWatch) {
      // 启动文件监视，传入当前路径和刷新回调
      startFileWatch(tag, currentPath, () => {
        loadDirectory(currentPath);
      });
    }

    return () => {
      // 关闭时停止监视
      if (stopFileWatch) {
        stopFileWatch();
      }
    };
  }, [isOpen, tag, currentPath, startFileWatch, stopFileWatch, loadDirectory]);

  // 重置状态当关闭时
  useEffect(() => {
    if (!isOpen) {
      setCurrentPath('/workspace');
      setFiles([]);
      setError(null);
    }
  }, [isOpen]);

  // 进入目录
  const enterDir = (path) => {
    // 只允许进入允许的路径
    if (isPathAllowed(path)) {
      setCurrentPath(path);
    }
  };

  // 返回上级
  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    const root = getAllowedRoot(currentPath);
    // 只能返回到允许的根目录，不能更上层
    if (root && (parent === root || parent.startsWith(root + '/'))) {
      setCurrentPath(parent);
    }
    // 如果已经在根目录，不做任何操作
  };

  // 检查是否可以返回上级
  const canGoUp = () => {
    const root = getAllowedRoot(currentPath);
    return root && currentPath !== root;
  };

  // 文件类型图标
  const getFileIcon = (file) => {
    if (file.type === 'directory') return '📁';
    if (file.type === 'symlink') return '🔗';

    // 根据扩展名返回图标
    const ext = file.name.split('.').pop()?.toLowerCase();
    const iconMap = {
      'py': '🐍',
      'js': '🟡',
      'ts': '🔵',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'pdf': '📕',
      'jpg': '🖼',
      'jpeg': '🖼',
      'png': '🖼',
      'gif': '🖼',
      'sh': '📜',
      'zip': '📦',
      'tar': '📦',
      'gz': '📦',
    };
    return iconMap[ext] || '📄';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">
            文件浏览器 - {tag}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* 路径导航 */}
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50">
          <button
            onClick={goUp}
            disabled={!canGoUp()}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            ↑
          </button>
          {/* 快速切换目录 */}
          <div className="flex gap-1">
            {ALLOWED_ROOTS.map(root => (
              <button
                key={root}
                onClick={() => setCurrentPath(root)}
                className={`px-2 py-0.5 rounded text-xs ${
                  currentPath.startsWith(root)
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                }`}
              >
                {root}
              </button>
            ))}
          </div>
          <span className="font-mono text-sm text-cyan-400 flex-1 truncate">
            {currentPath}
          </span>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
            title="刷新"
          >
            🔄
          </button>
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-auto p-2 min-h-[200px]">
          {loading ? (
            <div className="text-center text-slate-400 py-8">加载中...</div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">{error}</div>
          ) : files.length === 0 ? (
            <div className="text-center text-slate-400 py-8">目录为空</div>
          ) : (
            <div className="space-y-1">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700/50 cursor-pointer group"
                  onClick={() => {
                    if (file.type === 'directory') {
                      enterDir(file.path);
                    }
                  }}
                >
                  {/* 图标 */}
                  <span className="w-5 text-center flex-shrink-0">
                    {getFileIcon(file)}
                  </span>

                  {/* 文件名 */}
                  <span
                    className="flex-1 font-mono text-sm text-white truncate"
                    title={file.name}
                  >
                    {file.name}
                  </span>

                  {/* 大小 */}
                  <span className="text-xs text-slate-400 w-20 text-right flex-shrink-0">
                    {file.type === 'file' ? formatBytes(file.size) : '-'}
                  </span>

                  {/* 权限 */}
                  <span className="text-xs text-slate-500 w-24 font-mono flex-shrink-0 hidden sm:block">
                    {file.permissions}
                  </span>

                  {/* 操作按钮 */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0">
                    {file.type === 'file' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(file.path, file.name);
                        }}
                        className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-xs text-white"
                        title="下载"
                      >
                        ⬇
                      </button>
                    )}
                    {file.type === 'directory' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownload(file.path, `${file.name}.tar`);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-xs text-white"
                        title="下载为 tar"
                      >
                        ⬇
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
          <span className="text-sm text-slate-400">
            {files.length} 个项目
          </span>
          <button
            onClick={() => onUpload(currentPath)}
            className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm"
          >
            上传文件
          </button>
        </div>
      </div>
    </div>
  );
};
