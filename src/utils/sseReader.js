/**
 * Generic SSE ReadableStream consumer.
 * Reads the Response body as a stream and invokes callbacks for each data event.
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
