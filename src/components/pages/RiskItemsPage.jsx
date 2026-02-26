import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getRiskTree, CATEGORY_ICONS } from '../../riskItems/index.js';
import { CAPABILITY_CONFIG } from '../../hooks/useDatasets.js';
import { CapabilityTabs, DatasetList } from '../index.js';
import RiskTreeAttackButton from '../RiskTreeAttackButton.jsx';

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

  const { t } = useTranslation();
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
      <div className="w-72 flex-shrink-0 border-r border-edge overflow-y-auto custom-scroll p-3">
        {/* Risk tree header */}
        <button
          onClick={() => setScenarioListExpanded(!scenarioListExpanded)}
          className="w-full flex items-center justify-between px-2 py-1.5 mb-2 rounded text-xs font-medium bg-surface-raised hover:bg-surface-hover"
        >
          <span>📋 {t('riskItemsPage.riskTestItems')} ({totalSubcategories})</span>
          <span className="text-on-muted">{scenarioListExpanded ? '−' : '+'}</span>
        </button>

        {/* 15-category Risk Tree */}
        {scenarioListExpanded && Object.entries(riskTree).map(([catId, cat]) => {
          const subEntries = Object.entries(cat.subcategories);
          return (
            <div key={catId} className="mb-1">
              <button
                onClick={() => toggleCategory(catId)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium ${
                  expanded.category === catId ? 'bg-surface-raised' : 'hover:bg-surface-muted/50'
                }`}
              >
                <span className="truncate">{CATEGORY_ICONS[catId]} {cat.name}</span>
                <span className="text-on-dim flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-on-dim">{subEntries.length}</span>
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
                              : 'hover:bg-surface-muted/50 text-on-surface'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-on-dim font-mono text-[10px] shrink-0">{subId}</span>
                            <span className="truncate">{sub.name}</span>
                            {sub.cases.length > 0 && (
                              <span className="ml-auto text-[10px] text-on-dim shrink-0">{sub.cases.length}</span>
                            )}
                          </div>
                        </button>

                        {isExpanded && sub.cases.length > 0 && (
                          <div className="ml-4 mt-0.5 space-y-0.5">
                            {sub.cases.map((c, ci) => {
                              const isCaseSelected = selectedAttack?.scenario === c.scenario
                                && selectedAttack?.index === c.attackIndex;
                              return (
                                <RiskTreeAttackButton
                                  key={`${c.scenario}-${c.attackIndex}-${ci}`}
                                  caseRef={c}
                                  isSelected={isCaseSelected}
                                  onSelect={() => {
                                    selectAttack(c.scenario, c.attackIndex);
                                    setActiveTab('run');
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}

                        {isExpanded && sub.cases.length === 0 && (
                          <div className="ml-4 mt-0.5 px-2 py-1 text-[10px] text-on-dim italic">
                            {t('riskItemsPage.noTestCases')}
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
        <div className="my-3 border-t border-edge" />

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
              <span className="text-green-400">{t('riskItemsPage.caseSelected')}</span>
              {!isDemo && (
                <button
                  onClick={() => setImportedTestCase(null)}
                  className="text-on-muted hover:text-on-canvas"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-1 text-on-surface truncate">
              {importedTestCase.case?.name || t('labels.unnamed')}
            </div>
            {importedTestCase.case?.capability && (
              <div className="mt-1 text-on-dim text-[10px]">
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
                {t('config.startTest')}
              </button>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-edge text-xs text-on-dim">
          {t('riskItemsPage.totalDatasets', { count: filteredDatasets.length })}
          {selectedCapabilities.length > 0 && ` (${t('riskItemsPage.filtered')})`}
        </div>
      </div>

      {/* Right: risk item detail panel */}
      <div className="flex-1 overflow-hidden flex flex-col p-4">
        {currentRiskItemData ? (
          <div>
            <div className="bg-surface-muted/50 rounded-lg p-4 border border-edge-strong mb-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <span className="text-on-muted">{currentRiskItemData.id}</span>
                <span>{currentRiskItemData.name}</span>
              </div>
              <div className="text-xs text-on-muted mb-2">
                {currentRiskItemData.categoryName}
              </div>
              <div className="text-xs text-on-dim">
                {currentRiskItemData.description}
              </div>
            </div>

            {/* Benchmarks */}
            {currentRiskItemData.benchmarks?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-on-muted mb-2">
                  {t('riskItemsPage.relatedBenchmarks')} ({currentRiskItemData.benchmarks.length})
                </div>
                <div className="space-y-1">
                  {currentRiskItemData.benchmarks.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        b.source === 'original' ? 'bg-blue-900/50 text-blue-400' : 'bg-amber-900/50 text-amber-400'
                      }`}>
                        {b.source === 'original' ? t('riskItemsPage.original') : t('riskItemsPage.reproduced')}
                      </span>
                      <span className="text-on-surface">{b.name}</span>
                      {b.repo && (
                        <a
                          href={b.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-on-dim hover:text-blue-400 text-[10px]"
                        >
                          repo
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-on-dim">
              {t('riskItemsPage.selectCaseHint')}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-on-dim">
            <div className="text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <div>{t('riskItemsPage.selectRiskItemHint')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
