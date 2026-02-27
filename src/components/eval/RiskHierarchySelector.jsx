import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRiskHierarchy } from '../../api/evalBridgeApi';

/**
 * RiskHierarchySelector — 4-level collapsible tree for selecting eval tasks
 *
 * Props:
 *   value: array of { benchmark, task, task_args? } — current selection
 *   onChange: (newValue) => void
 *   readOnly: boolean — if true, just display, no interaction
 */
export default function RiskHierarchySelector({ value = [], onChange, readOnly = false }) {
  const { t, i18n } = useTranslation('eval');
  const isZh = i18n.language?.startsWith('zh');

  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchRiskHierarchy()
      .then(data => { if (!cancelled) setHierarchy(data); })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Pre-filter: only keep available benchmarks, drop empty subcategories/categories
  const availableHierarchy = useMemo(() => {
    return hierarchy
      .map(cat => {
        const subs = cat.subcategories
          .map(sub => {
            const bms = sub.benchmarks.filter(bm => bm.available);
            return bms.length > 0 ? { ...sub, benchmarks: bms } : null;
          })
          .filter(Boolean);
        return subs.length > 0 ? { ...cat, subcategories: subs } : null;
      })
      .filter(Boolean);
  }, [hierarchy]);

  // Build a Set of selected "benchmark::task" keys for O(1) lookup
  const selectedSet = useMemo(() => {
    return new Set(value.map(v => `${v.benchmark}::${v.task}`));
  }, [value]);

  const isTaskSelected = useCallback((benchmark, task) => {
    return selectedSet.has(`${benchmark}::${task}`);
  }, [selectedSet]);

  const toggleTask = useCallback((catalogKey, taskName) => {
    if (readOnly) return;
    const key = `${catalogKey}::${taskName}`;
    let next;
    if (selectedSet.has(key)) {
      next = value.filter(v => `${v.benchmark}::${v.task}` !== key);
    } else {
      next = [...value, { benchmark: catalogKey, task: taskName }];
    }
    onChange?.(next);
  }, [readOnly, selectedSet, value, onChange]);

  const toggleBenchmarkAll = useCallback((bm) => {
    if (readOnly) return;
    const catalogKey = bm.catalog_key;
    const bmTasks = bm.tasks.map(t => t.name);
    const allSelected = bmTasks.every(tn => selectedSet.has(`${catalogKey}::${tn}`));

    let next;
    if (allSelected) {
      // Deselect all tasks of this benchmark
      const removeSet = new Set(bmTasks.map(tn => `${catalogKey}::${tn}`));
      next = value.filter(v => !removeSet.has(`${v.benchmark}::${v.task}`));
    } else {
      // Select all tasks of this benchmark (add missing ones)
      const existing = new Set(value.map(v => `${v.benchmark}::${v.task}`));
      const toAdd = bmTasks
        .filter(tn => !existing.has(`${catalogKey}::${tn}`))
        .map(tn => ({ benchmark: catalogKey, task: tn }));
      next = [...value, ...toAdd];
    }
    onChange?.(next);
  }, [readOnly, selectedSet, value, onChange]);

  const toggleSubcategoryAll = useCallback((sub) => {
    if (readOnly) return;
    const allTasks = [];
    for (const bm of sub.benchmarks) {
      for (const t of bm.tasks) {
        allTasks.push({ benchmark: bm.catalog_key, task: t.name });
      }
    }
    const allKeys = new Set(allTasks.map(t => `${t.benchmark}::${t.task}`));
    const allSelected = allTasks.length > 0 && allTasks.every(t => selectedSet.has(`${t.benchmark}::${t.task}`));

    let next;
    if (allSelected) {
      next = value.filter(v => !allKeys.has(`${v.benchmark}::${v.task}`));
    } else {
      const existing = new Set(value.map(v => `${v.benchmark}::${v.task}`));
      const toAdd = allTasks.filter(t => !existing.has(`${t.benchmark}::${t.task}`));
      next = [...value, ...toAdd];
    }
    onChange?.(next);
  }, [readOnly, selectedSet, value, onChange]);

  const toggleCategoryAll = useCallback((cat) => {
    if (readOnly) return;
    const allTasks = [];
    for (const sub of cat.subcategories) {
      for (const bm of sub.benchmarks) {
        for (const t of bm.tasks) {
          allTasks.push({ benchmark: bm.catalog_key, task: t.name });
        }
      }
    }
    const allKeys = new Set(allTasks.map(t => `${t.benchmark}::${t.task}`));
    const allSelected = allTasks.length > 0 && allTasks.every(t => selectedSet.has(`${t.benchmark}::${t.task}`));

    let next;
    if (allSelected) {
      next = value.filter(v => !allKeys.has(`${v.benchmark}::${v.task}`));
    } else {
      const existing = new Set(value.map(v => `${v.benchmark}::${v.task}`));
      const toAdd = allTasks.filter(t => !existing.has(`${t.benchmark}::${t.task}`));
      next = [...value, ...toAdd];
    }
    onChange?.(next);
  }, [readOnly, selectedSet, value, onChange]);

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set();
    availableHierarchy.forEach(cat => {
      all.add(cat.id);
      cat.subcategories.forEach(sub => {
        all.add(sub.id);
        sub.benchmarks.forEach(bm => all.add(`${sub.id}::${bm.name}`));
      });
    });
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  // Filter hierarchy by search
  const filtered = useMemo(() => {
    if (!search.trim()) return availableHierarchy;
    const q = search.toLowerCase();
    return availableHierarchy
      .map(cat => {
        const subs = cat.subcategories
          .map(sub => {
            const bms = sub.benchmarks
              .map(bm => {
                const tasks = bm.tasks.filter(t =>
                  t.name.toLowerCase().includes(q) ||
                  t.display_name?.toLowerCase().includes(q)
                );
                if (
                  bm.name.toLowerCase().includes(q) ||
                  bm.catalog_key?.toLowerCase().includes(q) ||
                  tasks.length > 0
                ) {
                  return { ...bm, tasks: bm.name.toLowerCase().includes(q) ? bm.tasks : tasks };
                }
                return null;
              })
              .filter(Boolean);
            if (
              sub.name.toLowerCase().includes(q) ||
              sub.name_en?.toLowerCase().includes(q) ||
              bms.length > 0
            ) {
              return { ...sub, benchmarks: sub.name.toLowerCase().includes(q) ? sub.benchmarks : bms };
            }
            return null;
          })
          .filter(Boolean);
        if (
          cat.name.toLowerCase().includes(q) ||
          cat.name_en?.toLowerCase().includes(q) ||
          subs.length > 0
        ) {
          return { ...cat, subcategories: cat.name.toLowerCase().includes(q) ? cat.subcategories : subs };
        }
        return null;
      })
      .filter(Boolean);
  }, [hierarchy, search]);

  // Summary
  const summary = useMemo(() => {
    const benchmarks = new Set(value.map(v => v.benchmark));
    return { tasks: value.length, benchmarks: benchmarks.size };
  }, [value]);

  if (loading) {
    return <div className="text-on-muted text-sm py-4">{t('loading')}</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm py-4">{error}</div>;
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {!readOnly && (
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('evalManage.searchPlaceholder')}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
          />
        )}
        <button type="button" onClick={expandAll} className="px-2 py-1 text-xs text-on-muted hover:text-on-canvas">
          {t('evalManage.expandAll')}
        </button>
        <button type="button" onClick={collapseAll} className="px-2 py-1 text-xs text-on-muted hover:text-on-canvas">
          {t('evalManage.collapseAll')}
        </button>
      </div>

      {/* Selection summary */}
      <div className="text-xs text-on-muted">
        {summary.tasks > 0
          ? t('evalManage.selectedSummary', { tasks: summary.tasks, benchmarks: summary.benchmarks })
          : t('evalManage.noSelection')
        }
      </div>

      {/* Tree */}
      <div className="border border-edge rounded-lg overflow-hidden divide-y divide-edge">
        {filtered.map(cat => (
          <CategoryNode
            key={cat.id}
            cat={cat}
            isZh={isZh}
            expanded={expanded}
            toggle={toggle}
            selectedSet={selectedSet}
            isTaskSelected={isTaskSelected}
            toggleTask={toggleTask}
            toggleBenchmarkAll={toggleBenchmarkAll}
            toggleSubcategoryAll={toggleSubcategoryAll}
            toggleCategoryAll={toggleCategoryAll}
            readOnly={readOnly}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}


function CategoryNode({ cat, isZh, expanded, toggle, selectedSet, isTaskSelected, toggleTask, toggleBenchmarkAll, toggleSubcategoryAll, toggleCategoryAll, readOnly, t }) {
  const isOpen = expanded.has(cat.id);

  // Count selected tasks in this category
  let totalAvailable = 0;
  let totalSelected = 0;
  cat.subcategories.forEach(sub => {
    sub.benchmarks.forEach(bm => {
      bm.tasks.forEach(tk => {
        totalAvailable++;
        if (selectedSet.has(`${bm.catalog_key}::${tk.name}`)) totalSelected++;
      });
    });
  });

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 bg-surface-alt hover:bg-surface-hover cursor-pointer select-none"
        onClick={() => toggle(cat.id)}
      >
        <span className="text-xs text-on-muted w-4">{isOpen ? '\u25BC' : '\u25B6'}</span>
        <span className="font-medium text-sm text-on-canvas flex-1">
          {isZh ? cat.name : cat.name_en}
        </span>
        {totalAvailable > 0 && (
          <span className="text-xs text-on-muted">
            {totalSelected}/{totalAvailable}
          </span>
        )}
        {!readOnly && totalAvailable > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleCategoryAll(cat); }}
            className="text-xs text-blue-500 hover:text-blue-400 px-1"
          >
            {totalSelected === totalAvailable ? t('benchmarks.clearAll') : t('benchmarks.selectAll')}
          </button>
        )}
      </div>
      {isOpen && (
        <div className="pl-4">
          {cat.subcategories.map(sub => (
            <SubcategoryNode
              key={sub.id}
              sub={sub}
              isZh={isZh}
              expanded={expanded}
              toggle={toggle}
              selectedSet={selectedSet}
              isTaskSelected={isTaskSelected}
              toggleTask={toggleTask}
              toggleBenchmarkAll={toggleBenchmarkAll}
              toggleSubcategoryAll={toggleSubcategoryAll}
              readOnly={readOnly}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function SubcategoryNode({ sub, isZh, expanded, toggle, selectedSet, isTaskSelected, toggleTask, toggleBenchmarkAll, toggleSubcategoryAll, readOnly, t }) {
  const isOpen = expanded.has(sub.id);

  let totalAvailable = 0;
  let totalSelected = 0;
  sub.benchmarks.forEach(bm => {
    bm.tasks.forEach(tk => {
      totalAvailable++;
      if (selectedSet.has(`${bm.catalog_key}::${tk.name}`)) totalSelected++;
    });
  });

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-hover cursor-pointer select-none"
        onClick={() => toggle(sub.id)}
      >
        <span className="text-xs text-on-muted w-4">{isOpen ? '\u25BC' : '\u25B6'}</span>
        <span className="text-sm text-on-canvas flex-1">
          {isZh ? sub.name : sub.name_en}
        </span>
        {totalAvailable > 0 && (
          <span className="text-xs text-on-muted">
            {totalSelected}/{totalAvailable}
          </span>
        )}
        {!readOnly && totalAvailable > 0 && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleSubcategoryAll(sub); }}
            className="text-xs text-blue-500 hover:text-blue-400 px-1"
          >
            {totalSelected === totalAvailable ? t('benchmarks.clearAll') : t('benchmarks.selectAll')}
          </button>
        )}
      </div>
      {isOpen && (
        <div className="pl-4 text-xs text-on-muted mb-1">{sub.description}</div>
      )}
      {isOpen && (
        <div className="pl-4">
          {sub.benchmarks.map(bm => (
            <BenchmarkNode
              key={`${sub.id}::${bm.name}`}
              bm={bm}
              parentId={sub.id}
              expanded={expanded}
              toggle={toggle}
              selectedSet={selectedSet}
              isTaskSelected={isTaskSelected}
              toggleTask={toggleTask}
              toggleBenchmarkAll={toggleBenchmarkAll}
              readOnly={readOnly}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function BenchmarkNode({ bm, parentId, expanded, toggle, selectedSet, isTaskSelected, toggleTask, toggleBenchmarkAll, readOnly, t }) {
  const nodeId = `${parentId}::${bm.name}`;
  const isOpen = expanded.has(nodeId);
  const hasTasks = bm.tasks.length > 0;

  let selectedCount = 0;
  bm.tasks.forEach(tk => {
    if (selectedSet.has(`${bm.catalog_key}::${tk.name}`)) selectedCount++;
  });

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-1 hover:bg-surface-hover cursor-pointer select-none"
        onClick={() => hasTasks && toggle(nodeId)}
      >
        {hasTasks ? (
          <span className="text-xs text-on-muted w-4">{isOpen ? '\u25BC' : '\u25B6'}</span>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-sm text-on-canvas flex-1">{bm.name}</span>
        {hasTasks && (
          <span className="text-xs text-on-muted ml-1">
            {selectedCount}/{bm.tasks.length}
          </span>
        )}
        {!readOnly && hasTasks && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); toggleBenchmarkAll(bm); }}
            className="text-xs text-blue-500 hover:text-blue-400 px-1"
          >
            {selectedCount === bm.tasks.length ? t('benchmarks.clearAll') : t('benchmarks.selectAll')}
          </button>
        )}
      </div>
      {isOpen && (
        <div className="pl-8 py-1 space-y-0.5">
          {bm.tasks.map(tk => (
            <label
              key={tk.name}
              className={`flex items-center gap-2 px-2 py-0.5 rounded text-sm hover:bg-surface-hover ${
                readOnly ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={isTaskSelected(bm.catalog_key, tk.name)}
                onChange={() => toggleTask(bm.catalog_key, tk.name)}
                disabled={readOnly}
                className="rounded"
              />
              <span className="text-on-canvas">{tk.display_name || tk.name}</span>
              {tk.description && (
                <span className="text-on-muted text-xs truncate max-w-[200px]" title={tk.description}>
                  — {tk.description}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
