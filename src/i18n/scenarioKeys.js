/**
 * Mapping from scenario export variable names to translation file keys.
 * Used by useScenarioT to determine which JSON file to load.
 */
export const SCENARIO_NS_MAP = {
  // F1 - Conversation
  'loan': 'F1-loan',
  'service': 'F1-service',
  'promptLeakage': 'F1-promptLeakage',
  'vehicleAssistant': 'F1-vehicleAssistant',
  'autoRepair': 'F1-autoRepair',

  // F2 - File Injection
  'resume': 'F2-resume',
  'phishing': 'F2-phishing',
  'contract': 'F2-contract',
  'expense': 'F2-expense',
  'ticket': 'F2-ticket',
  'report': 'F2-report',
  'bidding': 'F2-bidding',
  'codeReview': 'F2-codeReview',

  // F3 - Tool Use
  'sandbox': 'F3-sandbox',
  'finbot': 'F3-finbot',

  // F4 - RAG
  'rag': 'F4-rag',

  // F5 - MCP
  'mcp': 'F5-mcp',
  'emailPdfAttack': 'F5-emailPdfAttack',

  // F6 - Messaging Agent
  'emailInjection': 'F6-emailInjection',
  'skillPoisoning': 'F6-skillPoisoning',
  'covertToolCall': 'F6-covertToolCall',
  'dmBypass': 'F6-dmBypass',
  'gatewayExposure': 'F6-gatewayExposure',
  'mcpHijacking': 'F6-mcpHijacking',
  'supplyChain': 'F6-supplyChain',
  'tokenTheft': 'F6-tokenTheft',
};

/**
 * Get translation namespace for a given scenario key.
 * @param {string} scenarioKey - e.g. 'loan', 'resume'
 * @returns {string} e.g. 'scenario_F1-loan'
 */
export function getScenarioNs(scenarioKey) {
  const fileKey = SCENARIO_NS_MAP[scenarioKey];
  return fileKey ? `scenario_${fileKey}` : null;
}
