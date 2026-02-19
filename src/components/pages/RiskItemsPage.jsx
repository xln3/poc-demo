import { useMemo } from 'react';
import { getRiskTree, CATEGORY_ICONS } from '../../riskItems/index.js';
import { CAPABILITY_CONFIG } from '../../hooks/useDatasets.js';
import { CapabilityTabs, DatasetList } from '../index.js';

/**
 * RiskItemsPage - 风险项 tab 主内容
 * 左右分栏：风险子类别列表(含 benchmarks + legacy cases) + 风险项详情面板
 */
export default function RiskItemsPage({
  appMode,
  // Attack selection
  attackSelection,
  selectAttack,
  // Datasets
  datasets,
  // Imported test case
  importedTestCase,
  setImportedTestCase,
  handleImportDataset,
  handleViewDataset,
  handleSelectCaseFromDataset,
  handleDownloadTemplate,
  applyImportedTestCase,
  // Tab navigation
  setActiveTab,
}) {
  const {
    selectedAttack, expanded,
    scenarioListExpanded, setScenarioListExpanded,
    selectedRiskItem, setSelectedRiskItem,
    currentRiskItemData,
    toggleCategory, toggleSubcategory,
  } = attackSelection;

  const {
    filteredDatasets,
    selectedDataset, setSelectedDataset,
    selectedCapabilities,
    isLoading: datasetsLoading,
    toggleCapability, clearCapabilityFilter,
    exportDataset, removeDataset,
    formatSize,
  } = datasets;

  const isDemo = appMode === 'demo';
  const riskTree = useMemo(() => getRiskTree(), []);

  // Count total subcategories
  const totalSubcategories = useMemo(() =>
    Object.values(riskTree).reduce(
      (sum, cat) => sum + Object.keys(cat.subcategories).length, 0
    ), [riskTree]);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: risk tree + datasets */}
      <div className="w-72 flex-shrink-0 border-r border-slate-700 overflow-y-auto custom-scroll p-3">
        {/* Risk tree header */}
        <button
          onClick={() => setScenarioListExpanded(!scenarioListExpanded)}
          className="w-full flex items-center justify-between px-2 py-1.5 mb-2 rounded text-xs font-medium bg-slate-700 hover:bg-slate-600"
        >
          <span>📋 风险测试项 ({totalSubcategories})</span>
          <span className="text-slate-400">{scenarioListExpanded ? '−' : '+'}</span>
        </button>

        {/* 15-category Risk Tree */}
        {scenarioListExpanded && Object.entries(riskTree).map(([catId, cat]) => {
          const subEntries = Object.entries(cat.subcategories);
          return (
            <div key={catId} className="mb-1">
              <button
                onClick={() => toggleCategory(catId)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium ${
                  expanded.category === catId ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                }`}
              >
                <span className="truncate">{CATEGORY_ICONS[catId]} {cat.name}</span>
                <span className="text-slate-500 flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-600">{subEntries.length}</span>
                  {expanded.category === catId ? '−' : '+'}
                </span>
              </button>

              {expanded.category === catId && (
                <div className="ml-2 mt-1 space-y-0.5">
                  {subEntries.map(([subId, sub]) => {
                    const isSelected = selectedRiskItem === subId;
                    const isExpanded = expanded.subcategory === subId;
                    return (
                      <div key={subId}>
                        <button
                          onClick={() => {
                            setSelectedRiskItem(subId);
                            toggleSubcategory(subId);
                          }}
                          className={`w-full text-left px-2 py-1 rounded text-xs ${
                            isSelected
                              ? 'bg-blue-600/50 text-white'
                              : 'hover:bg-slate-700/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 font-mono text-[10px] shrink-0">{subId}</span>
                            <span className="truncate">{sub.name}</span>
                            {sub.cases.length > 0 && (
                              <span className="ml-auto text-[10px] text-slate-500 shrink-0">{sub.cases.length}</span>
                            )}
                          </div>
                        </button>

                        {isExpanded && sub.cases.length > 0 && (
                          <div className="ml-4 mt-0.5 space-y-0.5">
                            {sub.cases.map((c, ci) => {
                              const isCaseSelected = selectedAttack?.scenario === c.scenario
                                && selectedAttack?.index === c.attackIndex;
                              return (
                                <button
                                  key={`${c.scenario}-${c.attackIndex}-${ci}`}
                                  onClick={() => {
                                    selectAttack(c.scenario, c.attackIndex);
                                    setActiveTab('run');
                                  }}
                                  className={`w-full text-left px-2 py-0.5 rounded text-[11px] truncate ${
                                    isCaseSelected
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

                        {isExpanded && sub.cases.length === 0 && (
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

        {/* Divider */}
        <div className="my-3 border-t border-slate-700" />

        {/* Datasets */}
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
          onDeleteDataset={isDemo ? null : removeDataset}
          onImportDataset={isDemo ? null : handleImportDataset}
          onDownloadTemplate={handleDownloadTemplate}
          formatSize={formatSize}
        />

        {/* Imported test case */}
        {importedTestCase && (
          <div className="mt-3 p-2 bg-green-900/30 border border-green-700/50 rounded text-xs">
            <div className="flex items-center justify-between">
              <span className="text-green-400">已选择用例</span>
              {!isDemo && (
                <button
                  onClick={() => setImportedTestCase(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-1 text-slate-300 truncate">
              {importedTestCase.case?.name || '未命名'}
            </div>
            {importedTestCase.case?.capability && (
              <div className="mt-1 text-gray-500 text-[10px]">
                {CAPABILITY_CONFIG[importedTestCase.case.capability]?.icon} {CAPABILITY_CONFIG[importedTestCase.case.capability]?.label || importedTestCase.case.capability}
              </div>
            )}
            {!isDemo && (
              <button
                onClick={() => {
                  if (applyImportedTestCase()) {
                    setActiveTab('run');
                  }
                }}
                className="mt-2 w-full py-1.5 bg-green-600 hover:bg-green-500 rounded text-white text-xs"
              >
                开始测试
              </button>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
          共 {filteredDatasets.length} 个数据集
          {selectedCapabilities.length > 0 && ` (已筛选)`}
        </div>
      </div>

      {/* Right: risk item detail panel */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {currentRiskItemData ? (
          <div>
            <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 mb-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <span className="text-slate-400">{currentRiskItemData.id}</span>
                <span>{currentRiskItemData.name}</span>
              </div>
              <div className="text-xs text-slate-400 mb-2">
                {currentRiskItemData.categoryName}
              </div>
              <div className="text-xs text-slate-500">
                {currentRiskItemData.description}
              </div>
            </div>

            {/* Benchmarks */}
            {currentRiskItemData.benchmarks?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-400 mb-2">
                  关联 Benchmarks ({currentRiskItemData.benchmarks.length})
                </div>
                <div className="space-y-1">
                  {currentRiskItemData.benchmarks.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        b.source === 'original' ? 'bg-blue-900/50 text-blue-400' : 'bg-amber-900/50 text-amber-400'
                      }`}>
                        {b.source === 'original' ? '原有' : '复现'}
                      </span>
                      <span className="text-slate-300">{b.name}</span>
                      {b.repo && (
                        <a
                          href={b.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-slate-500 hover:text-blue-400 text-[10px]"
                        >
                          repo
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500">
              选择左侧的测试用例，或点击用例直接跳转到运行 tab
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <div>选择左侧的风险项查看详情</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
