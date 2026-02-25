import { useTranslation } from 'react-i18next';

/**
 * Hook for translating config.js labels (attack types, risk levels, tools, etc.)
 * Usage: const { getAttackType, getRiskLevel, ... } = useConfigT();
 */
export function useConfigT() {
  const { t } = useTranslation('config');

  return {
    // Attack types: integrity, confidentiality, availability, jailbreak
    getAttackTypeLabel: (key) => t(`attackTypes.${key}.label`, key),
    getAttackTypeDesc: (key) => t(`attackTypes.${key}.desc`, key),

    // Three-level risk: critical, high, medium
    getRiskLevel: (key) => t(`riskLevels.${key}`, key),

    // Five-level risk: high, medium, low, safe, pending
    getFiveRiskLevel: (key) => t(`fiveRiskLevels.${key}`, key),

    // Log types
    getLogType: (key) => t(`logTypes.${key}`, key),

    // Record types
    getRecordType: (key) => t(`recordTypes.${key}`, key),

    // Capability level names
    getCapabilityName: (level) => t(`capabilityLevels.${level}`, level),

    // Tool labels and descriptions
    getToolLabel: (toolName) => t(`tools.${toolName}.label`, toolName),
    getToolDesc: (toolName) => t(`tools.${toolName}.desc`, toolName),
    getToolCategory: (cat) => t(`toolCategories.${cat}.label`, cat),
    getToolCategoryDesc: (cat) => t(`toolCategories.${cat}.desc`, cat),

    // MCP servers
    getMcpServerDesc: (serverId) => t(`mcpServers.${serverId}.desc`, serverId),
    getMcpFieldLabel: (fieldKey) => t(`mcpFields.${fieldKey}`, fieldKey),

    // Parser labels
    getParserGroupLabel: (groupKey) => t(`parsers.${groupKey}.label`, groupKey),
    getParserToolDesc: (toolId) => t(`parsers.tools.${toolId}`, toolId),

    // Raw t function for direct access
    t,
  };
}
