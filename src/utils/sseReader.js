/**
 * Generic SSE ReadableStream consumer.
 * Reads the Response body as a stream and invokes callbacks for each data event.
 *
 * For legacy report generation (simple content chunks).
 */
export async function consumeSSE(response, { onContent, onError, onDone }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();

        if (data === '[DONE]') {
          onDone?.();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            onError?.(parsed.error);
          } else if (parsed.content) {
            onContent?.(parsed.content);
          }
        } catch {
          // Ignore unparseable chunks
        }
      }
    }
    onDone?.();
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.();
    } else {
      onError?.(err.message);
    }
  }
}


/**
 * Typed SSE consumer for modular V2 events.
 *
 * Each SSE data line is a JSON object with a "type" field.
 * Dispatches to type-specific handlers.
 *
 * Event types:
 * - outline_chunk, outline_complete
 * - module_start, module_chunk, module_complete, module_error
 * - all_complete
 * - error
 */
export async function consumeTypedSSE(response, handlers = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();

        if (data === '[DONE]') {
          handlers.onDone?.();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const type = parsed.type;

          // Dispatch by type
          switch (type) {
            case 'outline_chunk':
              handlers.onOutlineChunk?.(parsed.content);
              break;
            case 'outline_complete':
              handlers.onOutlineComplete?.(parsed.outline);
              break;
            case 'module_start':
              handlers.onModuleStart?.(parsed);
              break;
            case 'module_chunk':
              handlers.onModuleChunk?.(parsed);
              break;
            case 'module_complete':
              handlers.onModuleComplete?.(parsed);
              break;
            case 'module_error':
              handlers.onModuleError?.(parsed);
              break;
            case 'all_complete':
              handlers.onAllComplete?.(parsed);
              break;
            case 'error':
              handlers.onError?.(parsed.error);
              break;
            default:
              // Fallback: call generic handler
              handlers.onEvent?.(parsed);
          }
        } catch {
          // Ignore unparseable chunks
        }
      }
    }
    handlers.onDone?.();
  } catch (err) {
    if (err.name === 'AbortError') {
      handlers.onDone?.();
    } else {
      handlers.onError?.(err.message);
    }
  }
}
