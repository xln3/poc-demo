import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlaybackControlBar from '../PlaybackControlBar.jsx';
import AttackHeader from '../AttackHeader.jsx';
import AttackDetailPanel from '../AttackDetailPanel.jsx';
import RealTestControlPanel from '../RealTestControlPanel.jsx';
import ConversationPanel from '../ConversationPanel.jsx';
import RightPanel from '../RightPanel.jsx';
import SimulationViewer from '../SimulationViewer.jsx';

/**
 * SandboxMonitor — compact panel showing sandbox file system status
 */
function SandboxMonitor({ sandboxStatus, toolCallHistory, t }) {
  const [expanded, setExpanded] = useState(false);
  if (sandboxStatus !== 'running') return null;

  const fileOps = (toolCallHistory || []).filter(tc =>
    ['read_file', 'write_file', 'list_dir', 'run_command'].includes(tc.name)
  );

  return (
    <div className="mb-3 bg-surface border border-edge rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-surface-hover transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <span className="font-medium text-on-canvas">{t('caseConfig.envToolSandbox')}</span>
        <span className="text-on-dim">{t('messages.fileChanges', { count: fileOps.length })}</span>
        <svg className={`w-3 h-3 text-on-dim ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && fileOps.length > 0 && (
        <div className="px-3 pb-2 max-h-[160px] overflow-y-auto space-y-0.5">
          {fileOps.slice(-20).map((tc, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px]">
              <span className={`font-mono px-1 py-0.5 rounded ${
                tc.name === 'write_file' ? 'bg-amber-600/15 text-amber-500'
                : tc.name === 'run_command' ? 'bg-blue-600/15 text-blue-400'
                : 'bg-surface-hover text-on-dim'
              }`}>{tc.name}</span>
              <span className="text-on-dim truncate">{
                tc.args?.path || tc.args?.command || JSON.stringify(tc.args).slice(0, 60)
              }</span>
            </div>
          ))}
        </div>
      )}
      {expanded && fileOps.length === 0 && (
        <p className="px-3 pb-2 text-[10px] text-on-dim italic">{t('simulation.waitingForExecution')}</p>
      )}
    </div>
  );
}

/**
 * RunPage - 运行 tab 主内容
 * Layout: control bar → optional sandbox/sim → panels (2 or 3 columns)
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
  // Sandbox monitoring
  sandboxStatus,
  toolCallHistory,
}) {
  const { t } = useTranslation();
  const hasSimulation = simulator?.sessionId && simulator?.isConnected;

  return (
    <div className="flex-1 p-4 overflow-hidden flex flex-col">
      <PlaybackControlBar {...playbackBar} />
      <AttackHeader {...attackHeader} />
      <AttackDetailPanel {...attackDetail} />
      <RealTestControlPanel appMode={appMode} {...testControl} />

      {/* Sandbox file system monitor — shows when sandbox is running */}
      <SandboxMonitor sandboxStatus={sandboxStatus} toolCallHistory={toolCallHistory} t={t} />

      {/* Simulation viewer — full width, above panels */}
      {hasSimulation && (
        <SimulationViewer simulator={simulator} />
      )}

      {/* Panels: 2-col (default) or 3-col (thinking enabled) */}
      <div className={`flex-1 grid gap-4 min-h-0 ${
        thinkingEnabled ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
      }`}>
        <ConversationPanel ref={chatRef} {...conversationPanel} />
        <RightPanel ref={logRef} {...rightPanel} />
      </div>
    </div>
  );
}
