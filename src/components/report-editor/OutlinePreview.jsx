import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * OutlinePreview — editable card list showing LLM-generated report outline.
 *
 * Each module as a card: title (editable), description (editable),
 * suggested charts (badges), dependencies (badges).
 * Drag or up/down reordering, add/remove module, approve & generate.
 */
export default function OutlinePreview({
  outline,
  onUpdate,
  onApprove,
  onRegenerate,
  loading,
}) {
  const { t } = useTranslation('reportEditor');
  const modules = outline?.modules || [];
  const [editingIdx, setEditingIdx] = useState(null);

  const updateModule = useCallback((idx, updates) => {
    const newModules = [...modules];
    newModules[idx] = { ...newModules[idx], ...updates };
    onUpdate?.({ ...outline, modules: newModules });
  }, [modules, outline, onUpdate]);

  const removeModule = useCallback((idx) => {
    const newModules = modules.filter((_, i) => i !== idx);
    // Adjust dependency indices
    const adjusted = newModules.map(m => ({
      ...m,
      depends_on_indices: (m.depends_on_indices || [])
        .filter(d => d !== idx)
        .map(d => d > idx ? d - 1 : d),
    }));
    onUpdate?.({ ...outline, modules: adjusted });
  }, [modules, outline, onUpdate]);

  const addModule = useCallback(() => {
    const newModules = [...modules, {
      title: t('outline.newModule', 'New Module'),
      title_en: 'New Module',
      description: '',
      data_keys: [],
      depends_on_indices: [],
      suggested_charts: [],
    }];
    onUpdate?.({ ...outline, modules: newModules });
  }, [modules, outline, onUpdate, t]);

  const moveModule = useCallback((idx, direction) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= modules.length) return;
    const newModules = [...modules];
    [newModules[idx], newModules[newIdx]] = [newModules[newIdx], newModules[idx]];
    // Adjust dependency indices for the swap
    const adjusted = newModules.map(m => ({
      ...m,
      depends_on_indices: (m.depends_on_indices || []).map(d => {
        if (d === idx) return newIdx;
        if (d === newIdx) return idx;
        return d;
      }),
    }));
    onUpdate?.({ ...outline, modules: adjusted });
  }, [modules, outline, onUpdate]);

  const toggleDependency = useCallback((moduleIdx, depIdx) => {
    const mod = modules[moduleIdx];
    const deps = mod.depends_on_indices || [];
    const newDeps = deps.includes(depIdx)
      ? deps.filter(d => d !== depIdx)
      : [...deps, depIdx].sort();
    updateModule(moduleIdx, { depends_on_indices: newDeps });
  }, [modules, updateModule]);

  const CHART_TYPE_COLORS = {
    gauge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    radar: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    bar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    line: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    pie: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    heatmap: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    scatter: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    treemap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    sunburst: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    funnel: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-on-canvas">
            {t('outline.title', 'Report Outline')}
          </h2>
          <p className="text-sm text-on-canvas/60 mt-1">
            {t('outline.subtitle', 'Review and edit the report structure before generating')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded border border-edge text-on-canvas/70 hover:bg-surface disabled:opacity-50"
          >
            {t('outline.regenerate', 'Regenerate')}
          </button>
          <button
            type="button"
            onClick={() => onApprove?.(outline)}
            disabled={loading || modules.length === 0}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? t('outline.generating', 'Generating...')
              : t('outline.approveGenerate', 'Approve & Generate All')}
          </button>
        </div>
      </div>

      {/* Module Cards */}
      <div className="space-y-3">
        {modules.map((mod, idx) => (
          <div
            key={idx}
            className="border border-edge rounded-lg p-4 bg-surface/50 hover:border-blue-400/50 transition-colors"
          >
            {/* Module header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-on-canvas/40">#{idx + 1}</span>
                  {editingIdx === idx ? (
                    <input
                      type="text"
                      value={mod.title}
                      onChange={e => updateModule(idx, { title: e.target.value })}
                      onBlur={() => setEditingIdx(null)}
                      onKeyDown={e => e.key === 'Enter' && setEditingIdx(null)}
                      className="flex-1 px-2 py-0.5 text-sm font-medium border border-blue-400 rounded bg-surface text-on-canvas"
                      autoFocus
                    />
                  ) : (
                    <h3
                      className="text-sm font-medium text-on-canvas cursor-pointer hover:text-blue-500"
                      onClick={() => setEditingIdx(idx)}
                    >
                      {mod.title}
                    </h3>
                  )}
                </div>

                {/* Description */}
                <textarea
                  value={mod.description || ''}
                  onChange={e => updateModule(idx, { description: e.target.value })}
                  placeholder={t('outline.descriptionPlaceholder', 'Module description...')}
                  className="w-full mt-1 px-2 py-1 text-xs border border-edge rounded bg-transparent text-on-canvas/70 resize-none"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => moveModule(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 text-on-canvas/40 hover:text-on-canvas disabled:opacity-30"
                  title={t('block.moveUp', 'Move up')}
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  onClick={() => moveModule(idx, 1)}
                  disabled={idx === modules.length - 1}
                  className="p-1 text-on-canvas/40 hover:text-on-canvas disabled:opacity-30"
                  title={t('block.moveDown', 'Move down')}
                >
                  &#9660;
                </button>
                <button
                  type="button"
                  onClick={() => removeModule(idx)}
                  className="p-1 text-red-400 hover:text-red-600"
                  title={t('outline.removeModule', 'Remove')}
                >
                  &#10005;
                </button>
              </div>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {/* Data keys */}
              {mod.data_keys?.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-on-canvas/40">{t('outline.dataKeys', 'Data')}:</span>
                  {mod.data_keys.map((key, ki) => (
                    <span key={ki} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-on-canvas/60">
                      {key}
                    </span>
                  ))}
                </div>
              )}

              {/* Suggested charts */}
              {mod.suggested_charts?.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-on-canvas/40">{t('outline.charts', 'Charts')}:</span>
                  {mod.suggested_charts.map((chart, ci) => (
                    <span
                      key={ci}
                      className={`text-xs px-1.5 py-0.5 rounded ${CHART_TYPE_COLORS[chart.type] || 'bg-gray-100 text-gray-600'}`}
                      title={chart.description}
                    >
                      {chart.type}
                    </span>
                  ))}
                </div>
              )}

              {/* Dependencies */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-on-canvas/40">{t('outline.dependencies', 'Deps')}:</span>
                {modules.map((_, di) => {
                  if (di === idx) return null;
                  const isDependent = (mod.depends_on_indices || []).includes(di);
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => toggleDependency(idx, di)}
                      className={`text-xs px-1.5 py-0.5 rounded border ${
                        isDependent
                          ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                          : 'border-edge text-on-canvas/30 hover:text-on-canvas/60'
                      }`}
                    >
                      #{di + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Module */}
      <button
        type="button"
        onClick={addModule}
        className="w-full mt-3 py-2 border-2 border-dashed border-edge rounded-lg text-sm text-on-canvas/50 hover:text-on-canvas/70 hover:border-blue-400/50"
      >
        + {t('outline.addModule', 'Add Module')}
      </button>
    </div>
  );
}
