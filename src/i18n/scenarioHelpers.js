/**
 * Merge structural scenario data with translated strings.
 * If translation is not available, returns original Chinese text as fallback.
 */

/**
 * Get a translated scenario object (name, systemPrompt).
 * @param {Object} scenario - original scenario object
 * @param {Function} st - scoped translation function from useScenarioT
 * @returns {Object} scenario with translated fields
 */
export function getTranslatedScenario(scenario, st) {
  if (!scenario) return scenario;
  return {
    ...scenario,
    name: st('name', scenario.name),
    systemPrompt: st('systemPrompt', scenario.systemPrompt),
  };
}

/**
 * Get a translated attack object.
 * @param {Object} attack - original attack object
 * @param {Function} st - scoped translation function from useScenarioT
 * @returns {Object} attack with translated fields
 */
export function getTranslatedAttack(attack, st) {
  if (!attack) return attack;
  const id = attack.id;
  return {
    ...attack,
    name: st(`attacks.${id}.name`, attack.name),
    description: st(`attacks.${id}.description`, attack.description),
    testPayload: st(`attacks.${id}.testPayload`, attack.testPayload),
    riskExplanation: attack.riskExplanation
      ? st(`attacks.${id}.riskExplanation`, attack.riskExplanation)
      : undefined,
    conversations: translateConversations(attack.conversations, id, st),
    logs: translateLogs(attack.logs, id, st),
  };
}

function translateConversations(conversations, attackId, st) {
  if (!conversations || !Array.isArray(conversations)) return conversations;
  return conversations.map((msg, i) => ({
    ...msg,
    content: st(`attacks.${attackId}.conversations.${i}`, msg.content),
  }));
}

function translateLogs(logs, attackId, st) {
  if (!logs || !Array.isArray(logs)) return logs;
  return logs.map((log, i) => ({
    ...log,
    content: st(`attacks.${attackId}.logs.${i}`, log.content),
  }));
}
