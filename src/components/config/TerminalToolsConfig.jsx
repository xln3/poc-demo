import { useTranslation } from 'react-i18next';
import { CONFIG } from '../../config.js';

/**
 * Collapsible tool selection grid + max tool call count.
 */
export default function TerminalToolsConfig({
  toolsConfigCollapsed, setToolsConfigCollapsed,
  enabledTools, setEnabledTools, maxToolCalls, setMaxToolCalls,
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-surface rounded-lg p-3 border border-cyan-900/50">
      <div className="text-xs text-cyan-400 flex items-center justify-between">
        <button
          onClick={() => setToolsConfigCollapsed(!toolsConfigCollapsed)}
          className="flex items-center gap-2 hover:text-cyan-300 transition"
        >
          <span>{toolsConfigCollapsed ? '▶' : '▼'}</span>
          <span>{t('configPage.terminalToolsConfig')}</span>
        </button>
        {toolsConfigCollapsed && (
          <span className="text-[10px] text-on-muted truncate max-w-[300px]">
            {Object.entries(enabledTools).filter(([_, enabled]) => enabled).map(([name]) => name).join(' | ') || t('labels.none')}
          </span>
        )}
      </div>
      {!toolsConfigCollapsed && (
        <>
          <div className="mt-2 mb-2 flex items-center gap-4 text-xs">
            <span className="text-on-muted">{t('configPage.maxCallCount')}:</span>
            <input
              type="number"
              min="1"
              max="500"
              value={maxToolCalls}
              onChange={(e) => setMaxToolCalls(parseInt(e.target.value) || 10)}
              className="w-16 bg-surface-raised border border-edge-strong rounded px-1 text-cyan-400 font-mono text-xs"
            />
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => {
                  const newTools = {};
                  Object.keys(enabledTools).forEach(name => { newTools[name] = true; });
                  setEnabledTools(newTools);
                }}
                className="px-2 py-0.5 bg-surface-raised hover:bg-surface-hover rounded text-on-surface"
              >
                {t('buttons.selectAll')}
              </button>
              <button
                onClick={() => {
                  const newTools = {};
                  Object.entries(CONFIG.tools.available).forEach(([name, tool]) => {
                    newTools[name] = tool.category === 'safe';
                  });
                  setEnabledTools(newTools);
                }}
                className="px-2 py-0.5 bg-surface-raised hover:bg-surface-hover rounded text-on-surface"
              >
                {t('configPage.safeOnly')}
              </button>
              <button
                onClick={() => {
                  const newTools = {};
                  Object.keys(enabledTools).forEach(name => { newTools[name] = false; });
                  setEnabledTools(newTools);
                }}
                className="px-2 py-0.5 bg-surface-raised hover:bg-surface-hover rounded text-on-surface"
              >
                {t('configPage.selectNone')}
              </button>
            </div>
          </div>
          {/* Tool grid by category */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(CONFIG.tools.categories).map(([category, catConfig]) => (
              <div key={category} className={`bg-surface-muted/50 rounded p-2 border-l-2 ${
                category === 'safe' ? 'border-green-500' :
                category === 'risky' ? 'border-orange-500' : 'border-red-500'
              }`}>
                <div className={`text-xs font-medium mb-1.5 ${
                  category === 'safe' ? 'text-green-400' :
                  category === 'risky' ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {catConfig.label}
                </div>
                <div className="space-y-1">
                  {Object.entries(CONFIG.tools.available)
                    .filter(([_, tool]) => tool.category === category)
                    .map(([name, tool]) => (
                      <label
                        key={name}
                        className={`flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded transition ${
                          enabledTools[name] ? 'bg-surface-hover/50' : 'hover:bg-surface-hover/30'
                        }`}
                        title={tool.description}
                      >
                        <input
                          type="checkbox"
                          checked={enabledTools[name] || false}
                          onChange={(e) => {
                            setEnabledTools(prev => ({
                              ...prev,
                              [name]: e.target.checked
                            }));
                          }}
                          className="w-3 h-3 rounded border-edge-strong bg-surface-raised text-cyan-500"
                        />
                        <span className={enabledTools[name] ? 'text-on-canvas' : 'text-on-muted'}>
                          {tool.label}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-on-dim">
            {t('configPage.toolsDescription')}
          </div>
        </>
      )}
    </div>
  );
}
