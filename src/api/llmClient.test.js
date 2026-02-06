import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callLLM } from './llmClient.js';

// Mock CONFIG
vi.mock('../config.js', () => ({
  CONFIG: {
    api: {
      baseUrl: 'https://api.example.com/v1/chat/completions',
      apiKey: 'test-key',
      model: 'test-model',
    },
    llmParams: {
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1.0,
    },
  },
}));

describe('callLLM', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct non-streaming request', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Hello!', thinking: null },
        finish_reason: 'stop',
      }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const result = await callLLM({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'You are helpful.',
    });

    expect(result.content).toBe('Hello!');
    expect(result.timing.totalTime).toBeGreaterThanOrEqual(0);
    expect(result.raw).toEqual(mockResponse);

    // Verify fetch was called with correct body
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('test-model');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe('Hi');
    expect(body.stream).toBeUndefined(); // non-streaming
  });

  it('includes tools when provided', async () => {
    const mockResponse = {
      choices: [{
        message: { content: '', tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'read_file', arguments: '{"path":"/tmp/x"}' } }] },
        finish_reason: 'tool_calls',
      }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
    });

    const tools = [{ name: 'read_file', description: 'Read a file', parameters: { type: 'object', properties: { path: { type: 'string' } } } }];
    const result = await callLLM({
      messages: [{ role: 'user', content: 'Read /tmp/x' }],
      tools,
    });

    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls[0].function.name).toBe('read_file');

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tools).toHaveLength(1);
    expect(body.tool_choice).toBe('auto');
  });

  it('sets stream flag in request body', async () => {
    // Create a minimal ReadableStream mock for streaming
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'),
      encoder.encode('data: [DONE]\n\n'),
    ];
    let chunkIndex = 0;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (chunkIndex < chunks.length) {
              return Promise.resolve({ done: false, value: chunks[chunkIndex++] });
            }
            return Promise.resolve({ done: true });
          },
        }),
      },
    });

    const deltas = [];
    await callLLM({
      messages: [{ role: 'user', content: 'Hi' }],
      stream: true,
      onDelta: (content) => deltas.push(content),
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(deltas).toContain('Hi');
  });

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    await expect(
      callLLM({ messages: [{ role: 'user', content: 'Hi' }] })
    ).rejects.toThrow('API Error: 429');
  });

  it('uses modelId override', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: 'ok' } }] }),
      text: () => Promise.resolve(''),
    });

    await callLLM({
      messages: [{ role: 'user', content: 'Hi' }],
      modelId: 'custom-model',
    });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.model).toBe('custom-model');
  });
});
