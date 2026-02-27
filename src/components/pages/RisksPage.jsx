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
    hierarchy.forEach(cat => {
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
    ? hierarchy.map(cat => {
        const filteredSubs = cat.subcategories?.map(sub => {
          const filteredBms = sub.benchmarks?.filter(bm =>
            matchesSearch(bm.name) || matchesSearch(bm.catalog_key) ||
            bm.tasks?.some(t => matchesSearch(t.name) || matchesSearch(t.display_name))
          );
          if (filteredBms?.length > 0 ||
              matchesSearch(isZh ? sub.name : sub.name_en) ||
              matchesSearch(sub.description)) {
            return { ...sub, benchmarks: filteredBms?.length > 0 ? filteredBms : sub.benchmarks };
          }
          return null;
        }).filter(Boolean);
        if (filteredSubs?.length > 0 || matchesSearch(isZh ? cat.name : cat.name_en)) {
          return { ...cat, subcategories: filteredSubs };
        }
        return null;
      }).filter(Boolean)
    : hierarchy;

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  // Stats
  const totalCats = hierarchy.length;
  const totalSubs = hierarchy.reduce((s, c) => s + (c.subcategories?.length || 0), 0);
  const totalBms = hierarchy.reduce((s, c) =>
    s + (c.subcategories?.reduce((ss, sub) => ss + (sub.benchmarks?.length || 0), 0) || 0), 0);
  const availableBms = hierarchy.reduce((s, c) =>
    s + (c.subcategories?.reduce((ss, sub) =>
      ss + (sub.benchmarks?.filter(b => b.available).length || 0), 0) || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <h1 className="text-xl font-bold text-on-canvas">
        {isZh ? '风险分类体系' : 'Risk Taxonomy'}
      </h1>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={isZh ? '风险大类' : 'Categories'} value={totalCats} />
        <StatCard label={isZh ? '风险子类' : 'Subcategories'} value={totalSubs} />
        <StatCard label={isZh ? 'Benchmarks' : 'Benchmarks'} value={totalBms} />
        <StatCard label={isZh ? '可用' : 'Available'} value={`${availableBms}/${totalBms}`} />
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
          <span>{cat.available_count}/{cat.total} {isZh ? '可用' : 'available'}</span>
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
          {sub.available_count}/{sub.total}
        </span>
      </button>

      {/* Description */}
      {isExpanded && sub.description && (
        <div className="px-5 pl-14 pb-2">
          <p className="text-xs text-on-muted">{sub.description}</p>
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

  return (
    <div className="border-t border-edge/50">
      <button
        onClick={() => hasTasks && toggleExpand(nodeId)}
        className={`w-full px-5 py-2 pl-16 flex items-center justify-between transition-colors ${
          hasTasks ? 'hover:bg-surface-hover/20 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-2">
          {hasTasks && <span className="text-xs">{isExpanded ? '▾' : '▸'}</span>}
          <span className={`text-sm ${bm.available ? 'text-on-surface' : 'text-on-dim'}`}>
            {bm.name}
          </span>
          <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
            bm.available
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}>
            {bm.available ? (t('evalManage.available')) : (t('evalManage.unavailable'))}
          </span>
        </div>
        <span className="text-xs text-on-dim">
          {bm.task_count} {isZh ? '个任务' : 'tasks'}
        </span>
      </button>

      {/* Tasks */}
      {isExpanded && hasTasks && (
        <div className="px-5 pl-20 pb-2 space-y-1">
          {bm.tasks.map(task => (
            <div key={task.name} className="flex items-center gap-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-xs text-on-surface">{task.display_name || task.name}</span>
              {task.description && (
                <span className="text-[10px] text-on-dim truncate max-w-[300px]">— {task.description}</span>
              )}
            </div>
          ))}
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
