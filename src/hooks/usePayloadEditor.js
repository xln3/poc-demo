import { useState } from 'react';

/**
 * Manages payload editing state — custom test payloads and system prompts.
 */
export function usePayloadEditor() {
  const [customTestPayload, setCustomTestPayload] = useState('');
  const [isEditingPayload, setIsEditingPayload] = useState(false);
  const [payloadFiles, setPayloadFiles] = useState([]);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');

  const resetPayloadEditor = () => {
    setCustomTestPayload('');
    setIsEditingPayload(false);
    setPayloadFiles([]);
    setCustomSystemPrompt('');
  };

  return {
    customTestPayload, setCustomTestPayload,
    isEditingPayload, setIsEditingPayload,
    payloadFiles, setPayloadFiles,
    customSystemPrompt, setCustomSystemPrompt,
    resetPayloadEditor,
  };
}
