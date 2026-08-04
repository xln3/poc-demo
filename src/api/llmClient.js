/**
 * Unified LLM API client.
 *
 * Routes requests through the backend proxy (/api/llm/chat) so that
 * API keys stay server-side. Falls back to direct API call when no
 * providerId is given (legacy / mock mode).
 */

import { authFetch } from '../auth.js';
import { CONFIG } from '../config.js';

/**
 * Parse an SSE stream and accumulate content, thinking, and tool calls.
 *
 * 带停滞看门狗：网关/代理可能保持连接但长时间不下发任何 chunk
 * （表现为"卡死"）。超过 INACTIVITY_MS 无任何数据即中止并抛错，
 * 由上层 streamWithRetry 重试。
 */
const INACTIVITY_MS = 90000;

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

  let watchdog = null;
  const readWithWatchdog = () => {
    clearTimeout(watchdog);
    return Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        watchdog = setTimeout(() => {
          reader.cancel().catch(() => {});
          reject(new Error(`流式响应 ${INACTIVITY_MS / 1000}s 无数据（连接停滞）`));
        }, INACTIVITY_MS);
      }),
    ]);
  };

  try {
    while (true) {
      const { done, value } = await readWithWatchdog();
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
  } finally {
    clearTimeout(watchdog);
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
 * Unified LLM API call.
 *
 * When providerId is given, routes through backend proxy (/api/llm/chat).
 * Otherwise falls back to direct API call (legacy / mock mode).
 *
 * @param {Object} opts
 * @param {Array} opts.messages - Chat messages array
 * @param {string} [opts.systemPrompt] - System prompt
 * @param {string} [opts.modelId] - Model ID
 * @param {number} [opts.providerId] - Backend provider ID (enables proxy mode)
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
  providerId = null,
  agentId = null,
  llmParams = {},
  thinkingConfig = null,
  stream = false,
  tools = null,
  onDelta = null,
} = {}) {
  const startTime = Date.now();
  const params = { ...CONFIG.llmParams, ...llmParams };

  // kimi-k3 服务端硬性要求 temperature=1 / top_p=0.95，其它取值会 400
  if (modelId && modelId.includes('kimi-k3')) {
    params.temperature = 1;
    params.top_p = 0.95;
  }

  // --- Backend proxy mode (providerId or agentId given) ---
  if (providerId || agentId) {
    const body = {
      messages,
      system_prompt: systemPrompt || '',
      ...(providerId ? { provider_id: providerId } : { agent_id: agentId }),
      ...(modelId ? { model: modelId } : agentId ? {} : { model: CONFIG.api.model }),
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      stream,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    if (thinkingConfig && thinkingConfig.type !== 'disabled') {
      body.thinking = thinkingConfig;
    }

    // 响应头阶段超时：网关排队/停滞时快速失败交给上层重试。
    // 流式拿到响应头后由 consumeSSEStream 的停滞看门狗接管；非流式给足 300s 读完整响应。
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), stream ? 90000 : 300000);
    let response;
    try {
      response = await authFetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      if (stream) clearTimeout(timer);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const totalTime = () => Date.now() - startTime;

    if (stream) {
      const result = await consumeSSEStream(response, onDelta);
      return { ...result, timing: { totalTime: totalTime() } };
    }

    const data = await response.json();
    clearTimeout(timer);
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

  // --- No provider configured ---
  throw new Error(
    '未配置 LLM provider。请在设置中添加 API 提供商后重试。'
  );
}
