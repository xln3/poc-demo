import { CONFIG } from '../../config.js';

/**
 * Collapsible file parser grid — configure which parsers to use per file type.
 */
export default function McpParserConfig({
  mcpConfigCollapsed, setMcpConfigCollapsed,
  mcpParsers, setMcpParsers, payloadFiles,
}) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-purple-900/50">
      <div className="text-xs text-purple-400 flex items-center justify-between">
        <button
          onClick={() => setMcpConfigCollapsed(!mcpConfigCollapsed)}
          className="flex items-center gap-2 hover:text-purple-300 transition"
        >
          <span>{mcpConfigCollapsed ? '▶' : '▼'}</span>
          <span>文件解析器配置</span>
        </button>
        <div className="flex items-center gap-2">
          {payloadFiles.length > 0 && (
            <span className="text-yellow-500 text-[10px]">修改后需重新上传文件</span>
          )}
          {mcpConfigCollapsed && (
            <span className="text-[10px] text-on-muted truncate max-w-[300px]">
              {(() => {
                const enabledByType = Object.entries(mcpParsers)
                  .filter(([_, ids]) => ids && ids.length > 0)
                  .map(([fileType, ids]) => {
                    const config = CONFIG.mcp.parsers[fileType];
                    if (!config) return null;
                    const names = ids.map(id => {
                      const tool = config.tools.find(t => t.id === id);
                      return tool ? tool.name : id;
                    });
                    return names.join(', ');
                  })
                  .filter(Boolean);
                return enabledByType.join(' | ') || '无';
              })()}
            </span>
          )}
        </div>
      </div>
      {!mcpConfigCollapsed && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
            {Object.entries(CONFIG.mcp.parsers).map(([fileType, config]) => (
              <div key={fileType} className="bg-surface-muted/50 rounded p-2">
                <div className="text-xs font-medium text-on-surface mb-1.5 flex items-center gap-1">
                  <span>{fileType === 'pdf' ? '📄' : fileType === 'docx' ? '📝' : fileType === 'xlsx' ? '📊' : '🖼️'}</span>
                  <span>{config.label}</span>
                </div>
                <div className="space-y-1">
                  {config.tools.map((tool) => {
                    const isSelected = mcpParsers[fileType]?.includes(tool.id);
                    const priority = mcpParsers[fileType]?.indexOf(tool.id);
                    return (
                      <label
                        key={tool.id}
                        className={`flex items-center gap-1.5 text-xs cursor-pointer p-1 rounded transition ${
                          isSelected ? 'bg-purple-900/30' : 'hover:bg-surface-hover'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setMcpParsers(prev => {
                              const updated = { ...prev };
                              if (e.target.checked) {
                                updated[fileType] = [...(prev[fileType] || []), tool.id];
                              } else {
                                updated[fileType] = (prev[fileType] || []).filter(id => id !== tool.id);
                              }
                              return updated;
                            });
                          }}
                          className="w-3 h-3 rounded border-edge-strong bg-surface-raised text-purple-500"
                        />
                        <span className={isSelected ? 'text-on-canvas' : 'text-on-muted'}>
                          {tool.name}
                        </span>
                        {isSelected && priority >= 0 && (
                          <span className="ml-auto text-purple-400 text-[10px]">#{priority + 1}</span>
                        )}
                        <span className="text-blue-400 text-[10px] cursor-help" title={tool.desc}>i</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-on-dim">
            <span>数字 = 解析优先级</span>
          </div>
        </>
      )}
    </div>
  );
}
