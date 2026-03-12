import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';
import { CONFIG } from '../../config.js';

const available = CONFIG.mcpServers.available;

function ServerField({ field, value, onChange }) {
  const inputCls =
    'w-full px-2 py-1 text-xs bg-surface-hover border border-edge-strong rounded text-on-canvas ' +
    'focus:border-emerald-500 focus:outline-none';

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-xs text-on-canvas cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-emerald-600"
        />
        {field.label}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <select value={value ?? field.default ?? ''} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {(field.options || []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      type={field.type || 'text'}
      value={value ?? ''}
      onChange={(e) => {
        const v = field.type === 'number' ? Number(e.target.value) : e.target.value;
        onChange(v);
      }}
      placeholder={field.placeholder || ''}
      className={inputCls}
    />
  );
}

export default function MCPConnectionConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const mcp = config.act_config.mcp_connection;
  const servers = mcp.servers || {};
  const selectedId = mcp.selected_server;
  const selectedCatalog = selectedId ? available[selectedId] : null;
  const selectedConfig = selectedId ? servers[selectedId] : null;

  const enabledCount = useMemo(
    () => Object.values(servers).filter((s) => s && s.enabled).length,
    [servers],
  );

  const handleSelect = (id) => {
    updateField('act_config.mcp_connection.selected_server', id);
  };

  const handleToggle = () => {
    if (!selectedId) return;
    const existing = servers[selectedId] || {};
    const updated = { ...existing, enabled: !existing.enabled };
    updateField('act_config.mcp_connection.servers', { ...servers, [selectedId]: updated });
  };

  const handleFieldChange = (fieldKey, value) => {
    if (!selectedId) return;
    const existing = servers[selectedId] || {};
    const updated = { ...existing, [fieldKey]: value };
    updateField('act_config.mcp_connection.servers', { ...servers, [selectedId]: updated });
  };

  const serverIds = Object.keys(available);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredServerIds = useMemo(() => {
    if (!searchQuery.trim()) return serverIds;
    const q = searchQuery.trim().toLowerCase();
    return serverIds.filter((id) => {
      const srv = available[id];
      return (
        (srv.name && srv.name.toLowerCase().includes(q)) ||
        (srv.description && srv.description.toLowerCase().includes(q))
      );
    });
  }, [serverIds, searchQuery]);

  return (
    <div className="grid grid-cols-3 gap-2" style={{ minHeight: 160 }}>
      {/* Left column: server list */}
      <div className="col-span-1 flex flex-col">
        <h4 className="text-[11px] font-medium text-on-canvas mb-1">
          {t('caseConfig.mcpAvailableServers')}
        </h4>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('caseConfig.mcpSearch')}
          className="w-full px-1.5 py-0.5 mb-1 text-[11px] bg-surface-hover border border-edge-strong rounded text-on-canvas focus:border-emerald-500 focus:outline-none"
        />
        <div className="max-h-[180px] overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
          {filteredServerIds.map((id) => {
            const srv = available[id];
            const isEnabled = servers[id]?.enabled;
            const isSelected = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelect(id)}
                className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] text-left transition-colors ${
                  isSelected
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface-hover/50 hover:bg-surface-hover text-on-surface'
                }`}
              >
                <span className="text-sm leading-none">{srv.icon}</span>
                <span className="flex-1 truncate">{srv.name}</span>
                {isEnabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-on-muted mt-1">
          {t('caseConfig.mcpEnabledCount', { count: enabledCount })}
        </p>
      </div>

      {/* Right columns: config form */}
      <div className="col-span-2 flex flex-col">
        {selectedCatalog ? (
          <>
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base leading-none">{selectedCatalog.icon}</span>
              <span className="text-sm font-medium text-on-canvas flex-1 truncate">
                {selectedCatalog.name}
              </span>
              <button
                type="button"
                onClick={handleToggle}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  selectedConfig?.enabled
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {selectedConfig?.enabled
                  ? t('caseConfig.mcpDisable')
                  : t('caseConfig.mcpEnable')}
              </button>
            </div>

            {/* Description */}
            <p className="text-[11px] text-on-muted mb-2">{selectedCatalog.description}</p>

            {/* Config fields */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {(selectedCatalog.fields || []).map((field) => {
                if (field.type === 'checkbox') {
                  return (
                    <ServerField
                      key={field.key}
                      field={field}
                      value={selectedConfig?.[field.key] ?? field.default}
                      onChange={(v) => handleFieldChange(field.key, v)}
                    />
                  );
                }
                return (
                  <div key={field.key}>
                    <label className="text-xs text-on-muted mb-0.5 block">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    <ServerField
                      field={field}
                      value={selectedConfig?.[field.key] ?? field.default}
                      onChange={(v) => handleFieldChange(field.key, v)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Tools section */}
            {selectedCatalog.tools && selectedCatalog.tools.length > 0 && (
              <div className="border-t border-edge mt-2 pt-2">
                <span className="text-xs text-on-muted block mb-1">
                  {t('caseConfig.mcpProvidedTools')}
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedCatalog.tools.map((tool) => (
                    <span
                      key={tool}
                      className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-on-muted">{t('caseConfig.mcpNoServerSelected')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
