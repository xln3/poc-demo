import React from 'react';
import { useTranslation } from 'react-i18next';
import { TerminalItem } from './TerminalItem.jsx';
import { TerminalImage } from '../../sandbox.js';

// 镜像选项
const IMAGE_OPTIONS = [
  { value: TerminalImage.PYTHON, label: 'Python 3.11', icon: '\u{1F40D}' },
  { value: TerminalImage.UBUNTU, label: 'Ubuntu 22.04', icon: '\u{1F427}' },
  { value: TerminalImage.NODE, label: 'Node.js 20', icon: '\u{1F4E6}' },
];

export const TerminalListPanel = ({
  terminals,
  currentTag,
  lockStatus, // { [tag]: { locked, holder, isMe } }
  newTerminalTag,
  setNewTerminalTag,
  newTerminalImage,
  setNewTerminalImage,
  creatingTerminal,
  onCreateTerminal,
  onSwitchTerminal,
  onDestroyTerminal,
  onShowFiles,
}) => {
  const { t } = useTranslation();

  const handleCreate = () => {
    if (newTerminalTag.trim()) {
      onCreateTerminal(newTerminalTag.trim(), newTerminalImage);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && newTerminalTag.trim()) {
      handleCreate();
    }
  };

  return (
    <div className="space-y-3">
      {/* 创建新终端 */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTerminalTag}
            onChange={(e) => setNewTerminalTag(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('sandbox.terminalTagPlaceholder')}
            className="flex-1 px-2 py-1.5 bg-surface-raised border border-edge-strong rounded text-sm text-on-canvas placeholder-on-muted focus:outline-none focus:border-cyan-500"
            disabled={creatingTerminal}
          />
          <button
            onClick={handleCreate}
            disabled={!newTerminalTag.trim() || creatingTerminal}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-surface-hover disabled:cursor-not-allowed rounded text-sm text-white transition-colors"
          >
            {creatingTerminal ? '...' : '+'}
          </button>
        </div>

        {/* 镜像选择 */}
        <select
          value={newTerminalImage}
          onChange={(e) => setNewTerminalImage(e.target.value)}
          className="w-full px-2 py-1.5 bg-surface-raised border border-edge-strong rounded text-sm text-on-canvas focus:outline-none focus:border-cyan-500"
          disabled={creatingTerminal}
        >
          {IMAGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 终端列表 */}
      <div className="space-y-1">
        {terminals.length === 0 ? (
          <div className="text-sm text-on-muted text-center py-4">
            {t('sandbox.noRunningTerminals')}
          </div>
        ) : (
          terminals.map(terminal => (
            <TerminalItem
              key={terminal.tag}
              terminal={terminal}
              isSelected={terminal.tag === currentTag}
              lockInfo={lockStatus?.[terminal.tag]}
              onSelect={onSwitchTerminal}
              onDestroy={onDestroyTerminal}
              onShowFiles={onShowFiles}
            />
          ))
        )}
      </div>
    </div>
  );
};
