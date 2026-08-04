import PlaybackControlBar from '../PlaybackControlBar.jsx';
import AttackHeader from '../AttackHeader.jsx';
import AttackDetailPanel from '../AttackDetailPanel.jsx';
import RealTestControlPanel from '../RealTestControlPanel.jsx';
import ConversationPanel from '../ConversationPanel.jsx';
import RightPanel from '../RightPanel.jsx';
import RunLogPanel from '../RunLogPanel.jsx';
import SimulationViewer from '../SimulationViewer.jsx';
import { DEMO_THINKING_LAYOUT } from '../interaction/demoLayout.js';

/**
 * RunPage - 运行 tab 主内容
 * Layout: control bar → optional sim → panels (2 or 3 columns)
 * TEMP demo: 工具沙箱框在运行日志列（第三列）顶端。
 */
export default function RunPage({
  appMode,
  chatRef, logRef,
  playbackBar,
  attackHeader,
  attackDetail,
  testControl,
  conversationPanel,
  rightPanel,
  sandboxPanel,
  // Simulation
  simulator,
  thinkingEnabled,
}) {
  const hasSimulation = simulator?.sessionId && simulator?.isConnected;

  return (
    <div className="flex-1 p-4 overflow-y-auto custom-scroll flex flex-col">
      <PlaybackControlBar {...playbackBar} />
      <AttackHeader {...attackHeader} />
      <AttackDetailPanel {...attackDetail} />
      <RealTestControlPanel appMode={appMode} {...testControl} />

      {/* Simulation viewer — full width, above panels */}
      {hasSimulation && (
        <SimulationViewer simulator={simulator} />
      )}

      {/* Panels: 2-col (default) or 3-col (thinking enabled).
          min-h keeps the panels usable when the (tall) attack-lab above pushes them down —
          the page then scrolls (root overflow-y-auto) instead of clipping the conversation.
          TEMP demo: three columns — 多轮对话 / 智能体思考过程 / 运行日志. */}
      <div className={`flex-1 grid gap-4 min-h-[30rem] ${
        DEMO_THINKING_LAYOUT ? 'grid-cols-1 md:grid-cols-3'
        : thinkingEnabled ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2'
      }`}>
        <ConversationPanel ref={chatRef} {...conversationPanel} />
        <RightPanel ref={DEMO_THINKING_LAYOUT ? undefined : logRef} {...rightPanel} />
        {DEMO_THINKING_LAYOUT && (
          <RunLogPanel ref={logRef} {...rightPanel} {...sandboxPanel} />
        )}
      </div>
    </div>
  );
}
