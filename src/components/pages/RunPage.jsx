import PlaybackControlBar from '../PlaybackControlBar.jsx';
import AttackHeader from '../AttackHeader.jsx';
import AttackDetailPanel from '../AttackDetailPanel.jsx';
import RealTestControlPanel from '../RealTestControlPanel.jsx';
import ConversationPanel from '../ConversationPanel.jsx';
import RightPanel from '../RightPanel.jsx';
import SimulationViewer from '../SimulationViewer.jsx';

/**
 * RunPage - 运行 tab 主内容
 * Layout: control bar → optional video → panels (2 or 3 columns)
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
  // Simulation
  simulator,
  thinkingEnabled,
}) {
  const hasSimulation = simulator?.sessionId && simulator?.isConnected;

  return (
    <div className="flex-1 p-4 overflow-hidden flex flex-col">
      <PlaybackControlBar {...playbackBar} />
      <AttackHeader {...attackHeader} />
      <AttackDetailPanel {...attackDetail} />
      <RealTestControlPanel appMode={appMode} {...testControl} />

      {/* Simulation viewer — full width, above panels */}
      {hasSimulation && (
        <SimulationViewer simulator={simulator} />
      )}

      {/* Panels: 2-col (default) or 3-col (thinking enabled) */}
      <div className={`flex-1 grid gap-4 min-h-0 ${
        thinkingEnabled ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'
      }`}>
        <ConversationPanel ref={chatRef} {...conversationPanel} />
        <RightPanel ref={logRef} {...rightPanel} />
      </div>
    </div>
  );
}
