import PlaybackControlBar from '../PlaybackControlBar.jsx';
import AttackHeader from '../AttackHeader.jsx';
import AttackDetailPanel from '../AttackDetailPanel.jsx';
import RealTestControlPanel from '../RealTestControlPanel.jsx';
import ConversationPanel from '../ConversationPanel.jsx';
import RightPanel from '../RightPanel.jsx';

/**
 * RunPage - 运行 tab 主内容
 * 提取自 App.jsx 的 demo 页面区域，接受按子组件分组的 prop bundles
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
}) {
  return (
    <div className="flex-1 p-4 overflow-hidden flex flex-col">
      <PlaybackControlBar {...playbackBar} />
      <AttackHeader {...attackHeader} />
      <AttackDetailPanel {...attackDetail} />
      <RealTestControlPanel appMode={appMode} {...testControl} />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <ConversationPanel ref={chatRef} {...conversationPanel} />
        <RightPanel ref={logRef} {...rightPanel} />
      </div>
    </div>
  );
}
