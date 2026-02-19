/**
 * LeftSidebar - 垂直 tab bar 导航
 * 包含测试/演示模式切换 + 4 个 tab 按钮
 */
export default function LeftSidebar({
  activeTab, setActiveTab,
  appMode, setAppMode,
}) {
  const tabs = [
    { id: 'config', label: '配置', icon: '\u2699\uFE0F' },
    { id: 'run', label: '运行', icon: '\u25B6\uFE0F' },
    { id: 'report', label: '报告', icon: '\uD83D\uDCCA' },
    { id: 'risk-items', label: '风险项', icon: '\uD83D\uDEE1\uFE0F' },
  ];

  return (
    <div className="w-[72px] bg-slate-800 flex flex-col items-center py-3 flex-shrink-0 border-r border-slate-700">
      {/* Mode toggle: 测试 / 演示 */}
      <div className="flex flex-col gap-1 w-full px-2 mb-3">
        <button
          onClick={() => setAppMode('test')}
          className={`py-1.5 rounded text-[10px] font-medium transition ${
            appMode === 'test' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          测试
        </button>
        <button
          onClick={() => setAppMode('demo')}
          className={`py-1.5 rounded text-[10px] font-medium transition ${
            appMode === 'demo' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          演示
        </button>
      </div>

      <div className="w-8 h-px bg-slate-700 mb-3" />

      {/* Tab buttons */}
      <div className="flex flex-col gap-0.5 w-full">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 mx-1 rounded-lg transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
