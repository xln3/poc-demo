import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

const ALL_TOOLS = [
  { key: 'read_file', icon: '\u{1F4D6}', labelKey: 'Read File' },
  { key: 'write_file', icon: '\u{1F4DD}', labelKey: 'Write File' },
  { key: 'run_command', icon: '\u26A1', labelKey: 'Run Command' },
  { key: 'http_request', icon: '\u{1F310}', labelKey: 'HTTP Request' },
  { key: 'list_dir', icon: '\u{1F4C1}', labelKey: 'List Directory' },
  { key: 'parse_file', icon: '\u{1F50D}', labelKey: 'Parse File' },
];

const MAX_PRESET_FILES = 10;

function NullableNumberInput({ label, value, onChange, placeholder, min, max, step }) {
  const isSet = value !== null && value !== undefined;
  return (
    <div className="flex-1 min-w-0">
      <label className="text-xs text-on-dim mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={isSet ? value : ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? null : Number(v));
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-7"
        />
        {isSet && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-on-dim hover:text-on-canvas text-xs"
            title="Reset to default"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

export default function ToolSandboxConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const sandbox = config.act_config.tool_sandbox;

  const [filesExpanded, setFilesExpanded] = useState(false);
  const [limitsExpanded, setLimitsExpanded] = useState(false);
  const [expandedFileIdx, setExpandedFileIdx] = useState(null);

  const updateSandbox = (key, value) => {
    updateField(`act_config.tool_sandbox.${key}`, value);
  };

  // --- Tool toggles ---
  const toggleTool = (toolKey) => {
    const current = sandbox.enabled_tools;
    const next = current.includes(toolKey)
      ? current.filter((k) => k !== toolKey)
      : [...current, toolKey];
    updateSandbox('enabled_tools', next);
  };

  const allSelected = sandbox.enabled_tools.length === ALL_TOOLS.length;

  const handleSelectToggle = () => {
    updateSandbox('enabled_tools', allSelected ? [] : ALL_TOOLS.map((t) => t.key));
  };

  // --- Preset files ---
  const addFile = () => {
    if (sandbox.preset_files.length >= MAX_PRESET_FILES) return;
    const newFiles = [...sandbox.preset_files, { path: '', content: '' }];
    updateSandbox('preset_files', newFiles);
    setExpandedFileIdx(newFiles.length - 1);
    if (!filesExpanded) setFilesExpanded(true);
  };

  const removeFile = (idx) => {
    const newFiles = sandbox.preset_files.filter((_, i) => i !== idx);
    updateSandbox('preset_files', newFiles);
    if (expandedFileIdx === idx) setExpandedFileIdx(null);
    else if (expandedFileIdx !== null && expandedFileIdx > idx) {
      setExpandedFileIdx(expandedFileIdx - 1);
    }
  };

  const updateFile = (idx, field, value) => {
    const newFiles = sandbox.preset_files.map((f, i) =>
      i === idx ? { ...f, [field]: value } : f
    );
    updateSandbox('preset_files', newFiles);
  };

  // --- Resource limits ---
  const updateLimit = (key, value) => {
    updateField(`act_config.tool_sandbox.resource_limits.${key}`, value);
  };

  return (
    <div className="space-y-3">
      {/* Container Image */}
      <div>
        <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.sandboxImage')}</label>
        <select
          value={sandbox.image}
          onChange={(e) => updateSandbox('image', e.target.value)}
          className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="terminal-python:3.11">Python 3.11</option>
          <option value="terminal-ubuntu:22.04">Ubuntu 22.04</option>
          <option value="terminal-node:20">Node.js 20</option>
        </select>
      </div>

      {/* Enabled Tools */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-on-dim">{t('caseConfig.sandboxEnabledTools')}</label>
          <button
            type="button"
            onClick={handleSelectToggle}
            className="text-xs text-cyan-600 hover:text-cyan-500 transition-colors"
          >
            {allSelected ? t('actions.deselectAll', 'Deselect All') : t('actions.selectAll')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {ALL_TOOLS.map(({ key, icon, labelKey }) => {
            const isActive = sandbox.enabled_tools.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleTool(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
                }`}
              >
                <span>{icon}</span>
                <span className="truncate">{labelKey}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preset Files (collapsible) */}
      <div className="border border-edge rounded-lg">
        <button
          type="button"
          onClick={() => setFilesExpanded(!filesExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-on-canvas hover:bg-surface-hover rounded-lg transition-colors"
        >
          <span>
            {t('caseConfig.sandboxPresetFiles')}
            {sandbox.preset_files.length > 0 && (
              <span className="ml-1.5 text-on-dim">({sandbox.preset_files.length})</span>
            )}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-on-dim transition-transform ${filesExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {filesExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {sandbox.preset_files.map((file, idx) => (
              <div key={idx} className="border border-edge rounded-lg p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={file.path}
                    onChange={(e) => updateFile(idx, 'path', e.target.value)}
                    placeholder={t('caseConfig.sandboxFilePathPlaceholder')}
                    className="flex-1 px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                               placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setExpandedFileIdx(expandedFileIdx === idx ? null : idx)}
                    className="px-2 py-1.5 text-xs text-on-dim hover:text-on-canvas border border-edge rounded-lg
                               hover:bg-surface-hover transition-colors"
                    title={t('caseConfig.sandboxFileContent')}
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${expandedFileIdx === idx ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="px-2 py-1.5 text-xs text-red-500 hover:text-red-400 border border-edge rounded-lg
                               hover:bg-surface-hover transition-colors"
                    title={t('actions.delete')}
                  >
                    &times;
                  </button>
                </div>
                {expandedFileIdx === idx && (
                  <div>
                    <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.sandboxFileContent')}</label>
                    <textarea
                      value={file.content}
                      onChange={(e) => updateFile(idx, 'content', e.target.value)}
                      rows={4}
                      className="w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                                 font-mono placeholder:text-on-dim/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                    />
                  </div>
                )}
              </div>
            ))}

            {sandbox.preset_files.length < MAX_PRESET_FILES && (
              <button
                type="button"
                onClick={addFile}
                className="w-full px-3 py-1.5 text-xs text-cyan-600 border border-dashed border-edge rounded-lg
                           hover:bg-surface-hover transition-colors"
              >
                + {t('caseConfig.sandboxAddFile')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resource Limits (collapsible) */}
      <div className="border border-edge rounded-lg">
        <button
          type="button"
          onClick={() => setLimitsExpanded(!limitsExpanded)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-on-canvas hover:bg-surface-hover rounded-lg transition-colors"
        >
          <span>{t('caseConfig.sandboxResourceLimits')}</span>
          <svg
            className={`w-3.5 h-3.5 text-on-dim transition-transform ${limitsExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {limitsExpanded && (
          <div className="px-3 pb-3">
            <div className="flex gap-3">
              <NullableNumberInput
                label={t('caseConfig.sandboxCpu')}
                value={sandbox.resource_limits.cpu}
                onChange={(v) => updateLimit('cpu', v)}
                placeholder={t('labels.default', 'default')}
                min={0.1} max={8} step={0.1}
              />
              <NullableNumberInput
                label={t('caseConfig.sandboxMemory')}
                value={sandbox.resource_limits.memory}
                onChange={(v) => updateLimit('memory', v)}
                placeholder={t('labels.default', 'default')}
                min={64} max={8192} step={64}
              />
              <NullableNumberInput
                label={t('caseConfig.sandboxTimeout')}
                value={sandbox.resource_limits.timeout}
                onChange={(v) => updateLimit('timeout', v)}
                placeholder={t('labels.default', 'default')}
                min={5} max={3600} step={5}
              />
            </div>
            <p className="text-xs text-on-dim mt-1.5">{t('caseConfig.sandboxResourceHint')}</p>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <p className="text-xs text-on-dim">{t('caseConfig.sandboxHint')}</p>
    </div>
  );
}
