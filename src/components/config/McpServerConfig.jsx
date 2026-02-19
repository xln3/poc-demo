import { CONFIG } from '../../config.js';
import { mcpClient } from '../../mcp.js';

/**
 * Collapsible MCP server configuration — server list + config form.
 */
export default function McpServerConfig({
  mcpServerConfigCollapsed, setMcpServerConfigCollapsed,
  mcpServerConfigs, setMcpServerConfigs,
  mcpServerStatus, setMcpServerStatus,
  selectedMcpServer, setSelectedMcpServer,
}) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 border border-emerald-900/50">
      <div className="text-xs text-emerald-400 flex items-center justify-between">
        <button
          onClick={() => setMcpServerConfigCollapsed(!mcpServerConfigCollapsed)}
          className="flex items-center gap-2 hover:text-emerald-300 transition"
        >
          <span>{mcpServerConfigCollapsed ? '▶' : '▼'}</span>
          <span>MCP Server 配置</span>
        </button>
        <span className="text-slate-500 text-[10px]">选择并配置外部服务</span>
      </div>
      {!mcpServerConfigCollapsed && (
        <div className="mt-2 grid grid-cols-3 gap-3" style={{ minHeight: '200px' }}>
          {/* Left: server list */}
          <div className="flex flex-col">
            <div className="text-xs text-slate-400 mb-1">可用服务</div>
            <div className="flex-1 bg-slate-700/50 rounded p-2 space-y-1">
              {Object.values(CONFIG.mcpServers.available).map((server) => {
                const config = mcpServerConfigs[server.id];
                const isEnabled = config?.enabled;
                const status = mcpServerStatus[server.id];
                return (
                  <button
                    key={server.id}
                    onClick={() => setSelectedMcpServer(server.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center justify-between ${
                      selectedMcpServer === server.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-600/50 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{server.icon}</span>
                      <span>{server.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === 'testing' && (
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="测试中" />
                      )}
                      {status === 'connected' && (
                        <span className="w-2 h-2 rounded-full bg-green-400" title="已连接" />
                      )}
                      {status === 'error' && (
                        <span className="w-2 h-2 rounded-full bg-red-400" title="连接失败" />
                      )}
                      {isEnabled && !status && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="已启用" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Right: config form */}
          <div className="col-span-2 flex flex-col">
            {selectedMcpServer ? (
              <ServerConfigForm
                server={CONFIG.mcpServers.available[selectedMcpServer]}
                config={mcpServerConfigs[selectedMcpServer] || {}}
                status={mcpServerStatus[selectedMcpServer]}
                mcpServerConfigs={mcpServerConfigs}
                setMcpServerConfigs={setMcpServerConfigs}
                mcpServerStatus={mcpServerStatus}
                setMcpServerStatus={setMcpServerStatus}
                selectedMcpServer={selectedMcpServer}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                ← 选择一个 MCP 服务进行配置
              </div>
            )}
          </div>
        </div>
      )}
      <div className="mt-2 text-[10px] text-slate-500">
        MCP (Model Context Protocol) 服务提供外部工具能力。配置后可在攻击测试中调用这些工具。
      </div>
    </div>
  );
}

function ServerConfigForm({
  server, config, status,
  mcpServerConfigs, setMcpServerConfigs,
  mcpServerStatus, setMcpServerStatus,
  selectedMcpServer,
}) {
  const updateConfig = (patch) => {
    const updated = {
      ...mcpServerConfigs,
      [selectedMcpServer]: { ...config, ...patch }
    };
    setMcpServerConfigs(updated);
    localStorage.setItem('mcpServerConfigs', JSON.stringify(updated));
  };

  return (
    <>
      <div className="text-xs text-slate-400 mb-1 flex items-center justify-between">
        <span>{server.icon} {server.name} 配置</span>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              setMcpServerStatus(prev => ({ ...prev, [selectedMcpServer]: 'testing' }));
              try {
                const result = await mcpClient.testConnection(selectedMcpServer, config);
                setMcpServerStatus(prev => ({
                  ...prev,
                  [selectedMcpServer]: result.success ? 'connected' : 'error'
                }));
                if (!result.success) {
                  alert(`连接失败: ${result.error || '未知错误'}`);
                }
              } catch (e) {
                console.error('[MCP] Test connection error:', e);
                setMcpServerStatus(prev => ({ ...prev, [selectedMcpServer]: 'error' }));
                alert(`连接测试失败: ${e.message}`);
              }
            }}
            disabled={status === 'testing'}
            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-[10px] disabled:opacity-50"
          >
            {status === 'testing' ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={() => updateConfig({ enabled: !config.enabled })}
            className={`px-2 py-0.5 rounded text-white text-[10px] ${
              config.enabled
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {config.enabled ? '禁用' : '启用'}
          </button>
        </div>
      </div>
      <div className="text-xs text-slate-500 mb-2">{server.description}</div>
      <div className="flex-1 bg-slate-700/50 rounded p-2 overflow-auto">
        <div className="space-y-2">
          {server.fields.map((field) => (
            <div key={field.key} className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                {field.label}
                {field.required && <span className="text-red-400">*</span>}
              </label>
              {field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config[field.key] ?? field.default ?? false}
                    onChange={(e) => updateConfig({ [field.key]: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-emerald-500"
                  />
                  <span className="text-xs text-slate-300">
                    {config[field.key] ? '是' : '否'}
                  </span>
                </label>
              ) : (
                <input
                  type={field.type}
                  value={config[field.key] ?? field.default ?? ''}
                  placeholder={field.placeholder}
                  onChange={(e) => {
                    const value = field.type === 'number' ? Number(e.target.value) : e.target.value;
                    updateConfig({ [field.key]: value });
                  }}
                  className="w-full px-2 py-1 text-xs bg-slate-600 border border-slate-500 rounded text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>
        {/* Available tools list */}
        <div className="mt-3 pt-2 border-t border-slate-600">
          <div className="text-xs text-slate-400 mb-1">提供的工具</div>
          <div className="flex flex-wrap gap-1">
            {server.tools.map((tool) => (
              <span
                key={tool}
                className="px-1.5 py-0.5 bg-slate-600 rounded text-[10px] text-slate-300"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
