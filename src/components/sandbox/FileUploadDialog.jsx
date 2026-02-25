import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIG } from '../../config.js';

export const FileUploadDialog = ({
  isOpen,
  targetPath,
  onClose,
  onUpload,
}) => {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer?.items;
    if (items) {
      // 使用 DataTransferItemList 处理拖放（支持文件夹）
      const filePromises = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            filePromises.push(traverseFileTree(entry, ''));
          } else {
            // 降级：直接获取文件
            const file = item.getAsFile();
            if (file) filePromises.push(Promise.resolve([file]));
          }
        }
      }
      Promise.all(filePromises).then(results => {
        const allFiles = results.flat();
        if (allFiles.length > 0) {
          onUpload(allFiles, targetPath);
        }
      });
    }
  };

  // 递归遍历文件树
  const traverseFileTree = (entry, path) => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file(file => {
          // 给文件添加相对路径
          Object.defineProperty(file, 'webkitRelativePath', {
            value: path ? `${path}/${file.name}` : file.name,
            writable: false,
          });
          resolve([file]);
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const dirPath = path ? `${path}/${entry.name}` : entry.name;

        // readEntries 可能分批返回条目，需要循环调用直到返回空数组
        const allEntries = [];
        const readBatch = () => {
          dirReader.readEntries(entries => {
            if (entries.length === 0) {
              // 所有条目已读取完毕
              Promise.all(
                allEntries.map(e => traverseFileTree(e, dirPath))
              ).then(results => resolve(results.flat()));
            } else {
              // 收集这批条目，继续读取下一批
              allEntries.push(...entries);
              readBatch();
            }
          });
        };
        readBatch();
      } else {
        resolve([]);
      }
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const maxSizeMB = CONFIG.sandbox.transfer?.maxFileSize
    ? CONFIG.sandbox.transfer.maxFileSize / (1024 * 1024)
    : 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-lg shadow-xl w-[400px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-on-canvas">{t('sandbox.uploadFiles')}</h3>
          <button
            onClick={onClose}
            className="text-on-muted hover:text-on-canvas text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="text-sm text-on-muted mb-4">
          {t('sandbox.targetPath')}: <span className="text-cyan-400 font-mono">{targetPath}</span>
        </div>

        {/* 拖放区域 */}
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
            ${dragOver
              ? 'border-cyan-500 bg-cyan-900/20'
              : 'border-edge-strong hover:border-edge-strong'}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-4xl mb-2">📂</div>
          <p className="text-on-surface mb-1">
            {t('sandbox.dragDropHint')}
          </p>
          <p className="text-on-dim text-xs">
            {t('sandbox.maxFileSize', { size: maxSizeMB })}
          </p>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-surface-raised hover:bg-surface-hover text-white text-sm"
          >
            {t('buttons.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
