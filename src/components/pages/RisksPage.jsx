import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchRiskHierarchy } from '../../api/evalBridgeApi';

/**
 * RisksPage — displays the 4-level risk taxonomy with descriptions,
 * benchmark mapping, and availability status.
 */
export default function RisksPage() {
  const { t, i18n } = useTranslation('eval');
  const { t: tc } = useTranslation();
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const isZh = i18n.language?.startsWith('zh');

  useEffect(() => {
    fetchRiskHierarchy()
      .then(data => {
        setHierarchy(data || []);
        // Expand first category by default
        if (data && data.length > 0) {
          setExpanded(new Set([data[0].id]));
        }
      })
      .catch(() => setHierarchy([]))
      .finally(() => setLoading(false));
  }, []);

  // Pre-filter: only keep available benchmarks, drop empty subcategories/categories
  const availableHierarchy = hierarchy
    .map(cat => {
      const subs = (cat.subcategories || [])
        .map(sub => {
          const bms = (sub.benchmarks || []).filter(bm => bm.available);
          return bms.length > 0 ? { ...sub, benchmarks: bms } : null;
        })
        .filter(Boolean);
      return subs.length > 0 ? { ...cat, subcategories: subs } : null;
    })
    .filter(Boolean);

  const toggleExpand = (id) => {
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
      cat.subcategories?.forEach(sub => {
        all.add(sub.id);
        sub.benchmarks?.forEach(bm => all.add(`bm-${sub.id}-${bm.name}`));
      });
    });
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  // Filter by search
  const matchesSearch = (text) => {
    if (!searchQuery.trim()) return true;
    return text?.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const filteredHierarchy = searchQuery.trim()
    ? availableHierarchy.map(cat => {
        const filteredSubs = cat.subcategories?.map(sub => {
          const filteredBms = sub.benchmarks?.filter(bm =>
            matchesSearch(bm.name) || matchesSearch(bm.catalog_key) ||
            matchesSearch(bm.display_name) || matchesSearch(bm.display_name_en) ||
            bm.tasks?.some(t => matchesSearch(t.name) || matchesSearch(t.display_name) || matchesSearch(t.display_name_en))
          );
          if (filteredBms?.length > 0 ||
              matchesSearch(sub.name) || matchesSearch(sub.name_en) ||
              matchesSearch(sub.description) || matchesSearch(sub.description_en)) {
            return { ...sub, benchmarks: filteredBms?.length > 0 ? filteredBms : sub.benchmarks };
          }
          return null;
        }).filter(Boolean);
        if (filteredSubs?.length > 0 || matchesSearch(isZh ? cat.name : cat.name_en)) {
          return { ...cat, subcategories: filteredSubs };
        }
        return null;
      }).filter(Boolean)
    : availableHierarchy;

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  // Stats — count from available-only hierarchy
  const totalCats = availableHierarchy.length;
  const totalSubs = availableHierarchy.reduce((s, c) => s + (c.subcategories?.length || 0), 0);
  const totalBms = availableHierarchy.reduce((s, c) =>
    s + (c.subcategories?.reduce((ss, sub) =>
      ss + (sub.benchmarks?.length || 0), 0) || 0), 0);
  const totalTasks = availableHierarchy.reduce((s, c) =>
    s + (c.subcategories?.reduce((ss, sub) =>
      ss + (sub.benchmarks?.reduce((bs, bm) =>
        bs + (bm.tasks?.length || 0), 0) || 0), 0) || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-on-canvas">
        {isZh ? '风险分类体系' : 'Risk Taxonomy'}
      </h1>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={isZh ? '风险大类' : 'Categories'} value={totalCats} />
        <StatCard label={isZh ? '风险子类' : 'Subcategories'} value={totalSubs} />
        <StatCard label={isZh ? '风险基准' : 'Risk Benchmarks'} value={totalBms} />
        <StatCard label={isZh ? '任务数' : 'Tasks'} value={totalTasks} />
      </div>

      {/* Search + controls */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={isZh ? '搜索风险类别或 Benchmark...' : 'Search risk categories or benchmarks...'}
          className="flex-1 px-3 py-2 text-sm bg-canvas border border-edge rounded-lg text-on-canvas placeholder:text-on-dim focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={expandAll}
          className="px-3 py-2 text-xs bg-surface border border-edge rounded-lg hover:bg-surface-hover text-on-muted"
        >
          {t('evalManage.expandAll')}
        </button>
        <button
          onClick={collapseAll}
          className="px-3 py-2 text-xs bg-surface border border-edge rounded-lg hover:bg-surface-hover text-on-muted"
        >
          {t('evalManage.collapseAll')}
        </button>
      </div>

      {/* Hierarchy tree */}
      <div className="space-y-2">
        {filteredHierarchy.map(cat => (
          <CategoryNode
            key={cat.id}
            cat={cat}
            isZh={isZh}
            expanded={expanded}
            toggleExpand={toggleExpand}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryNode({ cat, isZh, expanded, toggleExpand, t }) {
  const isExpanded = expanded.has(cat.id);
  return (
    <div className="border border-edge rounded-xl overflow-hidden">
      <button
        onClick={() => toggleExpand(cat.id)}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-surface-hover/50 transition-colors bg-surface"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{isExpanded ? '▾' : '▸'}</span>
          <span className="text-base font-semibold text-on-canvas">
            {isZh ? cat.name : cat.name_en}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-on-dim">
          <span>{cat.subcategories?.reduce((s, sub) => s + (sub.benchmarks?.length || 0), 0)} {isZh ? '个风险基准' : 'risk benchmarks'}</span>
        </div>
      </button>

      {isExpanded && cat.subcategories?.map(sub => (
        <SubcategoryNode
          key={sub.id}
          sub={sub}
          isZh={isZh}
          expanded={expanded}
          toggleExpand={toggleExpand}
          t={t}
        />
      ))}
    </div>
  );
}

function SubcategoryNode({ sub, isZh, expanded, toggleExpand, t }) {
  const isExpanded = expanded.has(sub.id);
  return (
    <div className="border-t border-edge">
      <button
        onClick={() => toggleExpand(sub.id)}
        className="w-full px-5 py-3 pl-10 flex items-center justify-between hover:bg-surface-hover/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{isExpanded ? '▾' : '▸'}</span>
          <span className="text-sm font-medium text-on-canvas">
            {isZh ? sub.name : sub.name_en}
          </span>
        </div>
        <span className="text-xs text-on-dim">
          {sub.benchmarks?.length || 0} {isZh ? '个风险基准' : 'risk benchmarks'}
        </span>
      </button>

      {/* Description */}
      {isExpanded && (sub.description || sub.description_en) && (
        <div className="px-5 pl-14 pb-2">
          <p className="text-xs text-on-muted">{isZh ? sub.description : (sub.description_en || sub.description)}</p>
        </div>
      )}

      {/* Benchmarks */}
      {isExpanded && sub.benchmarks?.map(bm => (
        <BenchmarkNode
          key={bm.name}
          bm={bm}
          parentId={sub.id}
          isZh={isZh}
          expanded={expanded}
          toggleExpand={toggleExpand}
          t={t}
        />
      ))}
    </div>
  );
}

function BenchmarkNode({ bm, parentId, isZh, expanded, toggleExpand, t }) {
  const nodeId = `bm-${parentId}-${bm.name}`;
  const isExpanded = expanded.has(nodeId);
  const hasTasks = bm.tasks && bm.tasks.length > 0;
  const bmDesc = isZh ? bm.description : (bm.description_en || bm.description);

  return (
    <div className="border-t border-edge/50">
      <div className={`w-full px-5 py-2 pl-16 flex items-center justify-between transition-colors ${
        hasTasks ? 'hover:bg-surface-hover/20 cursor-pointer' : 'cursor-default'
      }`}
        onClick={() => hasTasks && toggleExpand(nodeId)}
      >
        <div className="flex items-center gap-2">
          {hasTasks && <span className="text-xs">{isExpanded ? '▾' : '▸'}</span>}
          <span className="text-sm text-on-surface">
            {isZh ? (bm.display_name || bm.name) : (bm.display_name_en || bm.name)}
          </span>
          {bm.reference && (
            <a
              href={bm.reference}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-on-dim hover:text-blue-500 transition-colors flex-shrink-0"
              title={bm.reference}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
        <span className="text-xs text-on-dim">
          {bm.task_count} {isZh ? '个任务' : 'tasks'}
        </span>
      </div>

      {/* Benchmark description + Tasks */}
      {isExpanded && (
        <div className="px-5 pl-20 pb-2">
          {bmDesc && (
            <p className="text-xs text-on-muted mb-2">{bmDesc}</p>
          )}
          {hasTasks && (
            <div className="space-y-1.5">
              {bm.tasks.map(task => {
                const taskDesc = isZh ? task.description : (task.description_en || task.description);
                return (
                  <div key={task.name} className="py-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-px" />
                      <span className="text-xs font-medium text-on-surface">{isZh ? (task.display_name || task.name) : (task.display_name_en || task.name)}</span>
                    </div>
                    {taskDesc && (
                      <p className="text-[11px] text-on-dim ml-[14px] mt-0.5 leading-relaxed">{taskDesc}</p>
                    )}
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

function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-edge rounded-lg p-3 text-center">
      <div className="text-lg font-bold text-on-canvas">{value}</div>
      <div className="text-[11px] text-on-muted">{label}</div>
    </div>
  );
}
