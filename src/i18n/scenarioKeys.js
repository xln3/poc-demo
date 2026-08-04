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

  // F2 - File Injection (individual sub-scenarios)
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
  'finbotErrata': 'F3-finbotErrata',
  'finbotPurge': 'F3-finbotPurge',
  'finbotExfil': 'F3-finbotExfil',

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
 * Mapping from F2 (indirectInjection) attack IDs to their translation file keys.
 * The indirectInjection scenario is a single SCENARIOS entry containing
 * multiple attacks, each with its own translation namespace.
 */
export const F2_ATTACK_NS_MAP = {
  'I1': 'resume',
  'I2': 'contract',
  'I3': 'bidding',
  'I4': 'phishing',
  'I5': 'expense',
  'I6': 'report',
  'I7': 'codeReview',
  'I8': 'ticket',
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

/**
 * Resolve the scenario namespace key for a given SCENARIOS key + attack.
 * For most scenarios, this is simply SCENARIO_NS_MAP[scenarioKey].
 * For 'indirectInjection', we look up the attack ID in F2_ATTACK_NS_MAP.
 *
 * @param {string} scenarioKey - key in SCENARIOS, e.g. 'loan' or 'indirectInjection'
 * @param {Object} [attack] - the attack object (needed for indirectInjection)
 * @returns {string|null} the SCENARIO_NS_MAP key, e.g. 'loan', 'resume'
 */
export function resolveScenarioNsKey(scenarioKey, attack) {
  if (scenarioKey === 'indirectInjection' && attack) {
    return F2_ATTACK_NS_MAP[attack.id] || null;
  }
  return SCENARIO_NS_MAP[scenarioKey] ? scenarioKey : null;
}
