import { useState } from 'react';

/**
 * Manages UI panel layout state — which tabs are active in left/right panels.
 */
export function usePanelLayout() {
  const [leftPanelTab, setLeftPanelTab] = useState('conversation'); // 'conversation' | 'thinking' | 'raw'
  const [rightPanelTab, setRightPanelTab] = useState('records'); // 'records' | 'review' | 'examples' | 'report'
  const [rightSubTab, setRightSubTab] = useState('llm'); // 'llm' | 'human'
  const [showDocument, setShowDocument] = useState(true);
  const [docTab, setDocTab] = useState('principle'); // 'principle' | 'hiding' | 'tools' | 'readme' | 'parsing'

  return {
    leftPanelTab, setLeftPanelTab,
    rightPanelTab, setRightPanelTab,
    rightSubTab, setRightSubTab,
    showDocument, setShowDocument,
    docTab, setDocTab,
  };
}
