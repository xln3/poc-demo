/**
 * Unified LLM API client.
 *
 * Replaces the four separate methods (callModel, callModelStream,
 * callModelWithTools, callModelWithToolsStream) with a single callLLM().
 */

import { CONFIG } from '../config.js';

/**
 * Parse an SSE stream and accumulate content, thinking, and tool calls.
 */
async function consumeSSEStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  let accumulatedContent = '';
  let accumulatedThinking = '';
  let rawChunks = [];
  let finishReason = null;

  // Tool call accumulator — streamed tool_calls are grouped by index
  const toolCallsMap = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        rawChunks.push(json);

        const choice = json.choices?.[0];
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }

        const delta = choice?.delta;
        if (delta) {
          const deltaContent = delta.content || '';
          const deltaThinking = delta.thinking || delta.reasoning_content || '';

          accumulatedContent += deltaContent;
          accumulatedThinking += deltaThinking;

          if (onDelta && (deltaContent || deltaThinking)) {
            onDelta(deltaContent, deltaThinking);
          }

          // Tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, {
                  id: tc.id || '',
                  type: 'function',
                  function: { name: '', arguments: '' }
                });
              }
              const entry = toolCallsMap.get(idx);
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.function.name += tc.function.name;
              if (tc.function?.arguments) entry.function.arguments += tc.function.arguments;
            }
          }
        }
      } catch (e) {
        // parse failure — skip
      }
    }
  }

  const toolCalls = Array.from(toolCallsMap.values()).filter(tc => tc.function.name);

  return {
    content: accumulatedContent || (toolCalls.length ? '' : '(无响应)'),
    thinking: accumulatedThinking || null,
    tool_calls: toolCalls,
    finish_reason: finishReason,
    raw: { chunks: rawChunks, stream: true },
  };
}

/**
 * Build the common request body for LLM calls.
 */
function buildRequestBody({ messages, systemPrompt, modelId, llmParams, thinkingConfig, stream, tools }) {
  const params = { ...CONFIG.llmParams, ...llmParams };
  const body = {
    model: modelId || CONFIG.api.model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages,
    ],
    temperature: params.temperature,
    max_tokens: params.max_tokens,
    top_p: params.top_p,
    thinking: thinkingConfig || { type: 'disabled' },
  };

  if (stream) {
    body.stream = true;
  }

  if (tools && tools.length > 0) {
    body.tools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    body.tool_choice = 'auto';
  }

  return body;
}

/**
 * Unified LLM API call.
 *
 * @param {Object} opts
 * @param {Array} opts.messages - Chat messages array
 * @param {string} [opts.systemPrompt] - System prompt
 * @param {string} [opts.modelId] - Override model ID
 * @param {Object} [opts.llmParams] - Override LLM parameters (temperature, etc.)
 * @param {Object} [opts.thinkingConfig] - Thinking/reasoning config
 * @param {boolean} [opts.stream] - Enable SSE streaming
 * @param {Array} [opts.tools] - Tool definitions for function calling
 * @param {Function} [opts.onDelta] - Streaming callback: (deltaContent, deltaThinking) => void
 *
 * @returns {Promise<{content, thinking, timing, raw, tool_calls?, finish_reason?}>}
 */
export async function callLLM({
  messages,
  systemPrompt = '',
  modelId = null,
  llmParams = {},
  thinkingConfig = null,
  stream = false,
  tools = null,
  onDelta = null,
} = {}) {
  const startTime = Date.now();
  const requestBody = buildRequestBody({
    messages, systemPrompt, modelId, llmParams, thinkingConfig, stream, tools,
  });

  const response = await fetch(CONFIG.api.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.api.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  const totalTime = () => Date.now() - startTime;

  if (stream) {
    const result = await consumeSSEStream(response, onDelta);
    return { ...result, timing: { totalTime: totalTime() } };
  }

  // Non-streaming path
  const data = await response.json();
  const message = data.choices?.[0]?.message;
  const finishReason = data.choices?.[0]?.finish_reason;

  return {
    content: message?.content || '(无响应)',
    thinking: message?.thinking || message?.reasoning_content || null,
    tool_calls: message?.tool_calls || [],
    finish_reason: finishReason,
    timing: { totalTime: totalTime() },
    raw: data,
  };
}
