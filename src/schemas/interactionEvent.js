// Interaction event types for the unified timeline
export const InteractionType = {
  MESSAGE: 'message',       // Chat message (user/agent)
  TOOL_CALL: 'tool_call',   // Tool invocation + result
  FILE_OP: 'file_op',       // File operation
  RAG_QUERY: 'rag_query',   // RAG retrieval
  MCP_CALL: 'mcp_call',     // MCP tool call
  ENV_CHANGE: 'env_change', // Environment state change
  REASONING: 'reasoning',   // Reasoning/solver trace step
  MEDIA: 'media',           // Media display (PDF, image, audio, video)
};

/**
 * Create an interaction event.
 * @param {string} type - One of InteractionType values
 * @param {object} data - Type-specific data
 * @returns {{ type, timestamp, data }}
 */
export function createEvent(type, data) {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Normalize legacy {role, content} messages to InteractionEvents.
 */
export function normalizeMessages(messages) {
  return messages.map(msg => ({
    type: InteractionType.MESSAGE,
    timestamp: msg.timestamp || new Date().toISOString(),
    data: {
      role: msg.role,
      content: msg.content,
      isInjection: msg.isInjection,
      isDangerous: msg.isDangerous,
      isStreaming: msg.isStreaming,
      isToolThinking: msg.isToolThinking,
    },
  }));
}
