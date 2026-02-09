import { useState, useMemo } from 'react';
import { SCENARIOS } from '../scenarios/index.js';
import { FIVE_LEVEL_RISK, calculateRiskStats } from '../config.js';
import { CAPABILITY_CONFIG } from '../hooks/useDatasets.js';
import { TerminalImage } from '../hooks/useSandbox.js';
import { TerminalItem, DeletedTerminalsPanel } from './sandbox';
import { CapabilityTabs, DatasetList } from './index.js';
import { getRiskTree, CATEGORY_ICONS, ThreatSubcategory, RiskGoal } from '../riskItems/index.js';

/**
 * Left sidebar navigation: view tabs, sandbox control,
 * T1-T4 risk tree, datasets list, and test results list.
 */
export default function LeftSidebar({
  attackSelection,
  sandbox,
  clawdbot,
  datasets,
  viewMode, setViewMode,
  pageMode, setPageMode,
  isAuditor,
  setSelectedCase,
  selectAttack,
  savedTestResults, selectedTestResult,
  viewTestResultDetail, handleDeleteTestResult,
  importedTestCase, setImportedTestCase,
  handleImportDataset, handleViewDataset,
  handleSelectCaseFromDataset, handleDownloadTemplate,
  applyImportedTestCase,
}) {
  // Local UI expansion state
  const [runningTerminalsExpanded, setRunningTerminalsExpanded] = useState(false);
  const [deletedTerminalsExpanded, setDeletedTerminalsExpanded] = useState(false);
  const [clawdbotExpanded, setClawdbotExpanded] = useState(false);

  // Destructure hooks
  const {
    selectedAttack, expanded,
    scenarioListExpanded, setScenarioListExpanded,
    selectedRiskItem, setSelectedRiskItem,
    toggleCategory, toggleSubcategory, toggleRiskItem,
  } = attackSelection;

  const {
    sandboxAvailable, currentTag, terminals, deletedTerminals, deletedTotalSize,
    newTerminalTag, setNewTerminalTag, newTerminalImage, setNewTerminalImage,
    creatingTerminal, createTerminal, switchTerminal, destroyTerminal,
    lockStatus, openFileTree,
    showCleanupConfirm, setShowCleanupConfirm, cleanupDeleted, cleanupAllDeleted,
  } = sandbox;

  const {
    sandbox: clawdbotSandbox,
    error: clawdbotError,
    isRunning: clawdbotRunning,
    isCreating: clawdbotCreating,
    behaviors: clawdbotBehaviors,
    honeypotTriggers,
    serviceStatus: clawdbotServiceStatus,
    configLevels,
    selectedConfigLevel, setSelectedConfigLevel,
    createSandbox: createClawdbotSandbox,
    destroySandbox: destroyClawdbotSandbox,
  } = clawdbot;

  const {
    filteredDatasets,
    selectedDataset, setSelectedDataset,
    selectedCapabilities,
    isLoading: datasetsLoading,
    toggleCapability, clearCapabilityFilter,
    exportDataset, removeDataset,
    formatSize,
  } = datasets;

  // Build risk tree (memoized)
  const riskTree = useMemo(() => getRiskTree(), []);

  return (
    <div className="w-64 bg-slate-800 p-3 overflow-y-auto custom-scroll flex-shrink-0 border-r border-slate-700">
      {/* Page mode tabs: 配置/演示/报告 */}
      <div className="flex gap-1 mb-2">
        {isAuditor && (
          <button
            onClick={() => setPageMode('config')}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
              pageMode === 'config' ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            配置
          </button>
        )}
        <button
          onClick={() => setPageMode('demo')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
            pageMode === 'demo' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          演示
        </button>
        <button
          onClick={() => setPageMode('report')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
            pageMode === 'report' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          报告
        </button>
      </div>

      {/* Sub-view tabs (datasets/test-results) - only in demo mode */}
      {pageMode === 'demo' && (
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => { setViewMode('scenarios'); setSelectedCase(null); }}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
            viewMode === 'scenarios' ? 'bg-blue-600/60' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          🛡️ 测试
        </button>
        <button
          onClick={() => setViewMode('datasets')}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${
            viewMode === 'datasets' ? 'bg-green-600/60' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          📦 数据
        </button>
      </div>
      )}

      {/* Risk tree - shown in config and demo (scenarios sub-view) pages */}
      {(pageMode === 'config' || (pageMode === 'demo' && viewMode === 'scenarios')) && (
      <>
      {/* Sandbox control - demo page only */}
      {pageMode === 'demo' && (
      <div className="mb-3 p-2 bg-slate-700 rounded">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">🐳 终端沙箱</span>
          {!sandboxAvailable ? (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-400">离线</span>
          ) : currentTag ? (
            <button
              onClick={() => openFileTree(currentTag)}
              className="text-xs text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
              title="浏览文件"
            >
              <span>当前:</span>
              <span className="font-mono text-white">{currentTag}</span>
              <span>📂</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500">未连接终端</span>
          )}
        </div>

        {sandboxAvailable ? (
          <>
            {/* Create terminal */}
            <div className="mb-2 flex gap-1">
              <input
                type="text"
                value={newTerminalTag}
                onChange={(e) => setNewTerminalTag(e.target.value)}
                placeholder="tag"
                className="flex-1 min-w-0 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-cyan-500"
                disabled={creatingTerminal}
                onKeyDown={(e) => e.key === 'Enter' && newTerminalTag.trim() && createTerminal(newTerminalTag, newTerminalImage)}
              />
              <select
                value={newTerminalImage}
                onChange={(e) => setNewTerminalImage(e.target.value)}
                className="w-8 bg-slate-700 text-white text-sm py-1 rounded border border-slate-600 focus:outline-none cursor-pointer text-center"
                disabled={creatingTerminal}
                title={newTerminalImage.includes('python') ? 'Python 3.11' : newTerminalImage.includes('ubuntu') ? 'Ubuntu 22.04' : 'Node 20'}
                style={{ appearance: 'none' }}
              >
                <option value={TerminalImage.PYTHON}>🐍</option>
                <option value={TerminalImage.UBUNTU}>🐧</option>
                <option value={TerminalImage.NODE}>⬢</option>
              </select>
              <button
                onClick={() => createTerminal(newTerminalTag, newTerminalImage)}
                disabled={creatingTerminal || !newTerminalTag.trim()}
                className={`px-2 py-1 rounded text-xs transition ${
                  creatingTerminal || !newTerminalTag.trim()
                    ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                }`}
              >
                {creatingTerminal ? '...' : '+'}
              </button>
            </div>

            {/* Running terminals */}
            {terminals.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={() => setRunningTerminalsExpanded(!runningTerminalsExpanded)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 mb-1 w-full"
                >
                  <span className={`transition-transform ${runningTerminalsExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <span>运行中 ({terminals.length})</span>
                </button>
                {runningTerminalsExpanded && (
                  <div className="space-y-1 max-h-32 overflow-y-auto custom-scroll">
                    {terminals.map(t => (
                      <TerminalItem
                        key={t.tag}
                        terminal={t}
                        isSelected={t.tag === currentTag}
                        lockInfo={lockStatus?.[t.tag]}
                        onSelect={switchTerminal}
                        onDestroy={destroyTerminal}
                        onShowFiles={openFileTree}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Deleted terminals */}
            <DeletedTerminalsPanel
              deletedTerminals={deletedTerminals}
              deletedTotalSize={deletedTotalSize}
              showCleanupConfirm={showCleanupConfirm}
              setShowCleanupConfirm={setShowCleanupConfirm}
              onCleanupDeleted={cleanupDeleted}
              onCleanupAllDeleted={cleanupAllDeleted}
              isExpanded={deletedTerminalsExpanded}
              setIsExpanded={setDeletedTerminalsExpanded}
            />

            {/* ClawdBot */}
            <div className="mt-2 pt-2 border-t border-slate-600">
              <button
                onClick={() => setClawdbotExpanded(!clawdbotExpanded)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-400 mb-1 w-full"
              >
                <span className={`transition-transform ${clawdbotExpanded ? 'rotate-90' : ''}`}>▶</span>
                <span>🦞 黑盒 Agent 测试</span>
                {clawdbotRunning && (
                  <span className="ml-auto text-green-400 text-[10px]">● 运行中</span>
                )}
              </button>

              {clawdbotExpanded && (
                <div className="space-y-2 pl-3">
                  {!clawdbotServiceStatus?.available ? (
                    <div className="text-xs text-slate-500">
                      <div>ClawdBot 服务未就绪</div>
                      {!clawdbotServiceStatus?.image_exists && (
                        <div className="text-slate-600 mt-1">
                          运行 build-moltbot-sandbox.sh 构建镜像
                        </div>
                      )}
                    </div>
                  ) : !clawdbotRunning ? (
                    <>
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-slate-500">配置:</span>
                        <select
                          value={selectedConfigLevel}
                          onChange={(e) => setSelectedConfigLevel(e.target.value)}
                          className="flex-1 bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-cyan-500"
                        >
                          {configLevels.map(level => (
                            <option key={level.id} value={level.id}>
                              {level.icon} {level.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {configLevels.find(l => l.id === selectedConfigLevel) && (
                        <div className="text-[10px] text-slate-500">
                          {configLevels.find(l => l.id === selectedConfigLevel)?.description}
                        </div>
                      )}
                      <button
                        onClick={() => createClawdbotSandbox({ config_level: selectedConfigLevel })}
                        disabled={clawdbotCreating}
                        className={`w-full px-2 py-1.5 rounded text-xs transition ${
                          clawdbotCreating
                            ? 'bg-slate-600 cursor-not-allowed text-slate-400'
                            : 'bg-orange-600 hover:bg-orange-500 text-white'
                        }`}
                      >
                        {clawdbotCreating ? '启动中...' : '🦞 启动 ClawdBot'}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">ID:</span>
                          <span className="font-mono text-cyan-400">{clawdbotSandbox?.sandbox_id}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-400">配置:</span>
                          <span className="text-white">
                            {configLevels.find(l => l.id === clawdbotSandbox?.config_level)?.icon}{' '}
                            {configLevels.find(l => l.id === clawdbotSandbox?.config_level)?.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-400">Gateway:</span>
                          <span className="font-mono text-green-400 text-[10px]">
                            :{clawdbotSandbox?.gateway_port}
                          </span>
                        </div>
                      </div>
                      {clawdbotBehaviors.length > 0 && (
                        <div className="text-xs bg-slate-800 rounded p-1.5">
                          <div className="text-slate-400 mb-1">最近行为:</div>
                          <div className="max-h-16 overflow-y-auto custom-scroll space-y-0.5">
                            {clawdbotBehaviors.slice(0, 5).map((b, i) => (
                              <div key={i} className="text-[10px] text-slate-300 truncate">
                                <span className={
                                  b.severity === 'critical' ? 'text-red-400' :
                                  b.severity === 'danger' ? 'text-orange-400' :
                                  b.severity === 'warning' ? 'text-yellow-400' :
                                  'text-slate-400'
                                }>●</span>
                                {' '}{b.description}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {honeypotTriggers.length > 0 && (
                        <div className="text-xs bg-red-900/30 border border-red-700 rounded p-1.5">
                          <div className="text-red-400 font-medium">
                            ⚠️ 蜜罐触发 ({honeypotTriggers.length})
                          </div>
                        </div>
                      )}
                      <button
                        onClick={destroyClawdbotSandbox}
                        className="w-full px-2 py-1 rounded text-xs bg-red-700 hover:bg-red-600 text-white"
                      >
                        停止 ClawdBot
                      </button>
                    </>
                  )}
                  {clawdbotError && (
                    <div className="text-xs text-red-400 bg-red-900/20 rounded p-1.5">
                      {clawdbotError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500 text-center py-2">
            <div>后端服务未运行</div>
            <div className="mt-1 text-slate-600">cd backend && ./run.sh</div>
          </div>
        )}
      </div>
      )}

      {/* T1-T4 Risk Tree */}
      <button
        onClick={() => setScenarioListExpanded(!scenarioListExpanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 mb-2 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600"
      >
        <span>📋 风险测试项 (27)</span>
        <span className="text-slate-400">{scenarioListExpanded ? '−' : '+'}</span>
      </button>

      {scenarioListExpanded && Object.entries(riskTree).map(([catId, cat]) => {
        const subEntries = Object.entries(cat.subcategories);
        const itemCount = subEntries.reduce((sum, [, sub]) => sum + sub.riskItems.length, 0);
        if (itemCount === 0 && subEntries.every(([, sub]) => sub.riskItems.length === 0)) {
          // Skip categories with no risk items at all
        }

        return (
          <div key={catId} className="mb-2">
            {/* Category level: T1, T2, T3, T4 */}
            <button
              onClick={() => toggleCategory(catId)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium ${
                expanded.category === catId ? 'bg-slate-700' : 'hover:bg-slate-700/50'
              }`}
            >
              <span>{CATEGORY_ICONS[catId]} {catId} {cat.label}</span>
              <span className="text-slate-500 flex items-center gap-1">
                <span className="text-[10px] text-slate-600">{itemCount}</span>
                {expanded.category === catId ? '−' : '+'}
              </span>
            </button>

            {expanded.category === catId && (
              <div className="ml-2 mt-1">
                {subEntries.map(([subId, sub]) => {
                  if (sub.riskItems.length === 0) return null;
                  return (
                    <div key={subId} className="mb-1">
                      {/* Subcategory level: T1.1, T1.2, etc. */}
                      <button
                        onClick={() => toggleSubcategory(subId)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
                          expanded.subcategory === subId ? 'bg-slate-600' : 'hover:bg-slate-700/50'
                        }`}
                      >
                        <span className="text-slate-300">{subId} {sub.label}</span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <span className="text-[10px] text-slate-600">{sub.riskItems.length}</span>
                          {expanded.subcategory === subId ? '−' : '+'}
                        </span>
                      </button>

                      {expanded.subcategory === subId && (
                        <div className="ml-3 mt-1 space-y-0.5">
                          {sub.riskItems.map((item) => {
                            const isSelectedRI = selectedRiskItem === item.id;
                            const isExpanded = expanded.riskItem === item.id;
                            return (
                              <div key={item.id}>
                                {/* Risk item level: #1, #3, etc. */}
                                <button
                                  onClick={() => {
                                    setSelectedRiskItem(item.id);
                                    toggleRiskItem(item.id);
                                  }}
                                  className={`w-full text-left px-2 py-1 rounded text-xs ${
                                    isSelectedRI
                                      ? 'bg-blue-600/50 text-white'
                                      : 'hover:bg-slate-700/50 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-500 font-mono text-[10px] w-4 shrink-0">#{item.id}</span>
                                    <span className="truncate">{item.name}</span>
                                    {item.cases.length > 0 && (
                                      <span className="ml-auto text-[10px] text-slate-500 shrink-0">{item.cases.length}</span>
                                    )}
                                  </div>
                                </button>

                                {/* Legacy test cases under risk item */}
                                {isExpanded && item.cases.length > 0 && (
                                  <div className="ml-4 mt-0.5 space-y-0.5">
                                    {item.cases.map((c, ci) => {
                                      const isSelected = selectedAttack?.scenario === c.scenario
                                        && selectedAttack?.index === c.attackIndex;
                                      return (
                                        <button
                                          key={`${c.scenario}-${c.attackIndex}-${ci}`}
                                          onClick={() => selectAttack(c.scenario, c.attackIndex)}
                                          className={`w-full text-left px-2 py-0.5 rounded text-[11px] truncate ${
                                            isSelected
                                              ? 'bg-blue-600 text-white'
                                              : 'hover:bg-slate-700/50 text-slate-400'
                                          }`}
                                          title={`${c.scenarioData.name} - ${c.attack.name}`}
                                        >
                                          {c.attack.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Risk item with no cases */}
                                {isExpanded && item.cases.length === 0 && (
                                  <div className="ml-4 mt-0.5 px-2 py-1 text-[10px] text-slate-600 italic">
                                    暂无测试用例
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </>
      )}

      {/* Datasets view - demo page only */}
      {pageMode === 'demo' && viewMode === 'datasets' && (
        <div className="flex-1">
          <CapabilityTabs
            selectedCapabilities={selectedCapabilities}
            onToggleCapability={toggleCapability}
            onClearFilter={clearCapabilityFilter}
          />
          <DatasetList
            datasets={filteredDatasets}
            selectedDataset={selectedDataset}
            selectedCase={importedTestCase?.case}
            isLoading={datasetsLoading}
            onSelectDataset={(ds) => setSelectedDataset(ds)}
            onSelectCase={handleSelectCaseFromDataset}
            onViewDataset={handleViewDataset}
            onExportDataset={exportDataset}
            onDeleteDataset={removeDataset}
            onImportDataset={handleImportDataset}
            onDownloadTemplate={handleDownloadTemplate}
            formatSize={formatSize}
          />
          {importedTestCase && (
            <div className="mt-3 p-2 bg-green-900/30 border border-green-700/50 rounded text-xs">
              <div className="flex items-center justify-between">
                <span className="text-green-400">已选择用例</span>
                <button
                  onClick={() => setImportedTestCase(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="mt-1 text-slate-300 truncate">
                {importedTestCase.case?.name || '未命名'}
              </div>
              {importedTestCase.case?.capability && (
                <div className="mt-1 text-gray-500 text-[10px]">
                  {CAPABILITY_CONFIG[importedTestCase.case.capability]?.icon} {CAPABILITY_CONFIG[importedTestCase.case.capability]?.label || importedTestCase.case.capability}
                </div>
              )}
              <button
                onClick={() => {
                  if (applyImportedTestCase()) {
                    setViewMode('scenarios');
                  }
                }}
                className="mt-2 w-full py-1.5 bg-green-600 hover:bg-green-500 rounded text-white text-xs"
              >
                ▶️ 开始测试
              </button>
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
            共 {filteredDatasets.length} 个数据集
            {selectedCapabilities.length > 0 && ` (已筛选)`}
          </div>
        </div>
      )}

      {/* Test results view - report page */}
      {pageMode === 'report' && (
        <div className="flex-1">
          <div className="mb-3 text-xs text-slate-400">
            批量测试报告 ({savedTestResults.length})
          </div>
          {savedTestResults.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4">
              暂无测试报告
              <div className="mt-1 text-slate-600">执行批量测试后可保存</div>
            </div>
          ) : (
            <div className="space-y-2">
              {savedTestResults.map((item) => {
                const stats = item.meta?.statistics || {};
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded cursor-pointer transition ${
                      selectedTestResult?.id === item.id ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                    onClick={() => viewTestResultDetail(item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium truncate flex-1">
                        {item.name || '未命名测试'}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTestResult(item.id); }}
                        className="text-xs text-slate-400 hover:text-red-400"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {item.meta?.testModel || '未知模型'} · {stats.total || 0} 用例
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-xs text-red-400" title="高风险">🔴{stats.high || 0}</span>
                      <span className="text-xs text-orange-400" title="中风险">🟠{stats.medium || 0}</span>
                      <span className="text-xs text-yellow-400" title="低风险">🟡{stats.low || 0}</span>
                      <span className="text-xs text-green-400" title="安全">🟢{stats.safe || 0}</span>
                      <span className="text-xs text-gray-400" title="待定">⚪{stats.pending || 0}</span>
                      <span className="text-xs text-slate-500 ml-auto">
                        {item.savedAt ? new Date(item.savedAt).toLocaleString('zh-CN') : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
