import Section from './Section.jsx';

/**
 * Feature toggle checkboxes: file parsing, tools, RAG, MCP server.
 * Includes status badges for each feature.
 */
export default function FeatureToggles({
  isDemo,
  mcpEnabled, setMcpEnabled, mcpParserServiceAvailable, isParsingFile,
  toolsEnabled, setToolsEnabled, sandboxStatus, enabledTools,
  ragEnabled, setRagEnabled, ragKnowledge,
  mcpServerEnabled, setMcpServerEnabled, mcpServerConfigs,
}) {
  return (
    <Section title="功能开关">
      <div className="flex flex-wrap items-center gap-4">
        {/* 文件解析 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={mcpEnabled}
              onChange={(e) => setMcpEnabled(e.target.checked)}
              disabled={isDemo}
              className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-400">文件解析</span>
          </label>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isParsingFile
              ? 'bg-yellow-600 text-white'
              : mcpParserServiceAvailable
                ? 'bg-green-600 text-white'
                : 'bg-slate-600 text-slate-400'
          }`}>
            {isParsingFile ? '解析中' : mcpParserServiceAvailable ? '运行中' : '未运行'}
          </span>
        </div>

        {/* 工具调用 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={toolsEnabled}
              onChange={(e) => setToolsEnabled(e.target.checked)}
              disabled={isDemo}
              className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-400">工具调用</span>
          </label>
          {toolsEnabled && (
            sandboxStatus === 'running' ? (
              <span className="text-xs text-cyan-400">
                ({Object.values(enabledTools).filter(Boolean).length} 个)
              </span>
            ) : (
              <span className="text-xs text-yellow-400 animate-pulse">
                需启动沙箱
              </span>
            )
          )}
        </div>

        {/* RAG */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ragEnabled}
              onChange={(e) => setRagEnabled(e.target.checked)}
              disabled={isDemo}
              className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-400">RAG</span>
          </label>
          {ragEnabled && ragKnowledge && (
            <span className="text-xs text-amber-400">
              ({ragKnowledge.split('\n').filter(l => l.trim()).length} 条)
            </span>
          )}
        </div>

        {/* MCP Server */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={mcpServerEnabled}
              onChange={(e) => setMcpServerEnabled(e.target.checked)}
              disabled={isDemo}
              className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
            />
            <span className="text-xs text-slate-400">MCP</span>
          </label>
          {mcpServerEnabled && (
            <span className="text-xs text-emerald-400">
              ({Object.values(mcpServerConfigs).filter(c => c?.enabled).length} 已连接)
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}
