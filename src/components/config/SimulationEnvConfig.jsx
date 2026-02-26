import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Section from './Section.jsx';
import { benchmarkApi } from '../../benchmarkApi.js';

/**
 * AI2-THOR simulation environment config + SafeAgentBench case browser.
 */

const DATASET_TABS = [
  { key: 'unsafe_detailed', label: 'Unsafe Detailed', count: 299 },
  { key: 'safe_detailed', label: 'Safe Detailed', count: 299 },
  { key: 'abstract', label: 'Abstract', count: 99 },
  { key: 'long_horizon', label: 'Long Horizon', count: 49 },
];

// Normalized risk category colors
const RISK_COLORS = {
  'Fire Hazard': 'bg-red-600',
  'Electrical Hazard': 'bg-yellow-600',
  'Breakage': 'bg-orange-500',
  'Liquid Damage': 'bg-blue-500',
  'Physical Harm': 'bg-red-500',
  'Property Damage': 'bg-amber-600',
  'Poisoning': 'bg-purple-600',
  'Slip Hazard': 'bg-teal-500',
  'Misuse': 'bg-pink-500',
  'Other': 'bg-slate-500',
};

function getRiskColor(category) {
  if (!category) return 'bg-slate-500';
  for (const [key, color] of Object.entries(RISK_COLORS)) {
    if (category.toLowerCase().includes(key.toLowerCase().split(' ')[0].toLowerCase())) return color;
  }
  return 'bg-slate-500';
}

export default function SimulationEnvConfig({
  isDemo,
  simulator,          // useSimulator() return value
  safeAgentBenchCase, setSafeAgentBenchCase,
  onApplyTestCase,    // callback: (testCase) => void — fills systemPrompt + payload
}) {
  const { t } = useTranslation();
  const [meta, setMeta] = useState(null);
  const [activeDataset, setActiveDataset] = useState('unsafe_detailed');
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [riskFilter, setRiskFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [loadError, setLoadError] = useState(null);
  const LIMIT = 50;

  // Fetch metadata on mount
  useEffect(() => {
    benchmarkApi.getMeta()
      .then(data => { setMeta(data); setLoadError(null); })
      .catch(e => setLoadError(e.message));
  }, []);

  // Fetch cases when dataset/filter/offset changes
  const loadCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const data = await benchmarkApi.getCases({
        dataset: activeDataset,
        risk_category: riskFilter || undefined,
        offset,
        limit: LIMIT,
      });
      setCases(data.cases || []);
    } catch (e) {
      console.error('[SafeAgentBench] Failed to load cases:', e);
    } finally {
      setCasesLoading(false);
    }
  }, [activeDataset, riskFilter, offset]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Reset offset when dataset/filter changes
  useEffect(() => {
    setOffset(0);
    setSelectedCase(null);
  }, [activeDataset, riskFilter]);

  const riskCategories = meta?.risk_categories || [];

  return (
    <Section title={t('configPage.simulationEnv')}>
      {loadError && !meta ? (
        <div className="text-xs text-yellow-500 py-2">
          {t('configPage.safeAgentBenchLoadFailed')} — {loadError}
          <button onClick={() => { setLoadError(null); benchmarkApi.getMeta().then(data => { setMeta(data); setLoadError(null); }).catch(e => setLoadError(e.message)); }}
            className="ml-2 text-blue-400 hover:text-blue-300 underline">{t('configPage.retry')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Engine status */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-on-muted">{t('configPage.ai2thorEngine')}</span>
              {simulator?.sessionId ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-green-400">{t('configPage.running')}</span>
                  <span className="text-on-dim">({simulator.engineName})</span>
                  <button
                    onClick={() => simulator.stopSession()}
                    disabled={isDemo}
                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px] disabled:opacity-50"
                  >
                    {t('buttons.stopButton')}
                  </button>
                </div>
              ) : simulator?.loading ? (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-yellow-400">{t('configPage.starting')}</span>
                  <button
                    onClick={() => simulator.cancelStart()}
                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
                  >
                    {t('buttons.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-on-dim">{t('configPage.notStarted')}</span>
                  <button
                    onClick={() => simulator.startSession('ai2thor', {})}
                    disabled={isDemo}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-[10px] disabled:opacity-50"
                  >
                    {t('configPage.start')}
                  </button>
                </div>
              )}
              {simulator?.error && (
                <span className="text-red-400 text-[10px]">{simulator.error}</span>
              )}
            </div>
            {/* Progress bar during startup */}
            {simulator?.loading && (
              <div className="space-y-1">
                <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${simulator.startProgress || 0}%` }}
                  />
                </div>
                <div className="text-[10px] text-on-muted">
                  {simulator.startMessage || t('messages.preparing')} ({simulator.startProgress || 0}%)
                </div>
              </div>
            )}
          </div>

          {/* Dataset tabs */}
          <div className="flex gap-1">
            {DATASET_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveDataset(tab.key)}
                className={`px-2 py-1 rounded text-[10px] transition ${
                  activeDataset === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-raised text-on-muted hover:bg-surface-hover'
                }`}
              >
                {tab.label} ({meta?.datasets?.[tab.key]?.count || tab.count})
              </button>
            ))}
          </div>

          {/* Risk category filter */}
          {riskCategories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setRiskFilter('')}
                className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                  !riskFilter ? 'bg-surface-hover text-white' : 'bg-surface-muted/50 text-on-muted hover:bg-surface-hover'
                }`}
              >
                {t('configPage.all')}
              </button>
              {riskCategories.slice(0, 12).map(cat => (
                <button
                  key={cat}
                  onClick={() => setRiskFilter(riskFilter === cat ? '' : cat)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                    riskFilter === cat
                      ? `${getRiskColor(cat)} text-white`
                      : 'bg-surface-muted/50 text-on-muted hover:bg-surface-hover'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Case list + detail */}
          <div className="grid grid-cols-2 gap-3" style={{ minHeight: '240px' }}>
            {/* Left: case list */}
            <div className="flex flex-col">
              <div className="text-[10px] text-on-dim mb-1">
                {casesLoading ? t('batchTest.loading') : t('configPage.caseCount', { count: cases.length })}
              </div>
              <div className="flex-1 bg-surface-muted/50 rounded p-1 overflow-y-auto space-y-0.5" style={{ maxHeight: '300px' }}>
                {cases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
                      selectedCase?.id === c.id
                        ? 'bg-blue-600/30 border border-blue-500/50'
                        : 'hover:bg-surface-hover/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-on-dim text-[10px] font-mono w-8 shrink-0">{c.id}</span>
                      <span className="text-on-surface truncate flex-1">
                        {typeof c.instruction === 'string' ? c.instruction : c.instruction?.[0]}
                      </span>
                      {c.risk_category && (
                        <span className={`${getRiskColor(c.risk_category)} text-white px-1 py-0.5 rounded text-[9px] shrink-0`}>
                          {c.risk_category}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {cases.length === 0 && !casesLoading && (
                  <div className="text-xs text-on-dim text-center py-4">{t('configPage.noMatchingCases')}</div>
                )}
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between mt-1 text-[10px]">
                <button
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                  disabled={offset === 0}
                  className="px-2 py-0.5 bg-surface-raised rounded text-on-muted disabled:opacity-30"
                >
                  {t('configPage.prevPage')}
                </button>
                <span className="text-on-dim">{offset + 1} - {offset + cases.length}</span>
                <button
                  onClick={() => setOffset(offset + LIMIT)}
                  disabled={cases.length < LIMIT}
                  className="px-2 py-0.5 bg-surface-raised rounded text-on-muted disabled:opacity-30"
                >
                  {t('configPage.nextPage')}
                </button>
              </div>
            </div>

            {/* Right: case detail */}
            <div className="flex flex-col">
              {selectedCase ? (
                <div className="flex-1 bg-surface-muted/50 rounded p-2 overflow-y-auto space-y-2" style={{ maxHeight: '340px' }}>
                  {/* Instruction */}
                  <div>
                    <div className="text-[10px] text-on-dim mb-0.5">Instruction</div>
                    <div className="text-xs text-on-canvas">
                      {typeof selectedCase.instruction === 'string'
                        ? selectedCase.instruction
                        : selectedCase.instruction?.map((inst, i) => (
                            <div key={i} className={i === 0 ? 'font-medium' : 'text-on-muted ml-2'}>
                              {i === 0 ? inst : `- ${inst}`}
                            </div>
                          ))
                      }
                    </div>
                  </div>
                  {/* Risk instruction (safe dataset) */}
                  {selectedCase.risk_instruction && (
                    <div>
                      <div className="text-[10px] text-red-400 mb-0.5">Risk Instruction</div>
                      <div className="text-xs text-red-300">{selectedCase.risk_instruction}</div>
                    </div>
                  )}
                  {/* Risk category */}
                  {selectedCase.risk_category && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-on-dim">Risk:</span>
                      <span className={`${getRiskColor(selectedCase.risk_category)} text-white px-1.5 py-0.5 rounded text-[10px]`}>
                        {selectedCase.risk_category}
                      </span>
                    </div>
                  )}
                  {/* Scene */}
                  {selectedCase.scene_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-on-dim">Scene:</span>
                      <span className="text-xs text-cyan-400 font-mono">{selectedCase.scene_name}</span>
                    </div>
                  )}
                  {/* Steps */}
                  {selectedCase.step && selectedCase.step.length > 0 && (
                    <div>
                      <div className="text-[10px] text-on-dim mb-0.5">Steps ({selectedCase.step.length})</div>
                      <div className="space-y-0.5">
                        {selectedCase.step.map((s, i) => (
                          <div key={i} className="text-xs text-on-surface flex gap-2">
                            <span className="text-on-dim font-mono w-4">{i + 1}</span>
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Objects */}
                  {selectedCase.objects && selectedCase.objects.length > 0 && (
                    <div>
                      <div className="text-[10px] text-on-dim mb-0.5">Objects</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedCase.objects.map((obj, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-surface-hover rounded text-[10px] text-on-surface">{obj}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Final state */}
                  {selectedCase.final_state && (
                    <div>
                      <div className="text-[10px] text-on-dim mb-0.5">Final State</div>
                      <pre className="text-[10px] text-green-400 bg-surface rounded p-1.5 overflow-auto max-h-24 font-mono">
                        {JSON.stringify(selectedCase.final_state, null, 2)}
                      </pre>
                    </div>
                  )}
                  {/* Apply button */}
                  <button
                    onClick={() => {
                      setSafeAgentBenchCase(selectedCase);
                      if (onApplyTestCase) onApplyTestCase(selectedCase);
                    }}
                    disabled={isDemo}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-medium transition disabled:opacity-50"
                  >
                    {t('configPage.loadAsTestCase')}
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-on-dim">
                  {t('configPage.selectCaseHint')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
