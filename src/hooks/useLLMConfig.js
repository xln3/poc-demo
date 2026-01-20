import { useState } from 'react';
import { CONFIG } from '../config';

/**
 * Custom hook for LLM configuration management
 * @returns {Object} LLM config state and setters
 */
export const useLLMConfig = () => {
  // Model selection
  const [selectedModel, setSelectedModel] = useState(CONFIG.models[0].id);

  // LLM parameters
  const [llmTemperature, setLlmTemperature] = useState(CONFIG.llmParams.temperature);
  const [llmMaxTokens, setLlmMaxTokens] = useState(CONFIG.llmParams.max_tokens);
  const [llmTopP, setLlmTopP] = useState(CONFIG.llmParams.top_p);

  // Thinking mode
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(10000);

  // Tool configuration
  const [enabledTools, setEnabledTools] = useState(() => {
    // Default: enable safe category tools
    const tools = {};
    Object.entries(CONFIG.tools.available).forEach(([name, tool]) => {
      tools[name] = tool.category === 'safe';
    });
    return tools;
  });
  const [maxToolCalls, setMaxToolCalls] = useState(CONFIG.tools.maxCalls);
  const [toolCallHistory, setToolCallHistory] = useState([]);

  // Reset LLM config to defaults
  const resetLLMConfig = () => {
    setLlmTemperature(CONFIG.llmParams.temperature);
    setLlmMaxTokens(CONFIG.llmParams.max_tokens);
    setLlmTopP(CONFIG.llmParams.top_p);
  };

  // Enable all tools
  const enableAllTools = () => {
    const newTools = {};
    Object.keys(enabledTools).forEach(name => { newTools[name] = true; });
    setEnabledTools(newTools);
  };

  // Enable only safe tools
  const enableSafeToolsOnly = () => {
    const newTools = {};
    Object.entries(CONFIG.tools.available).forEach(([name, tool]) => {
      newTools[name] = tool.category === 'safe';
    });
    setEnabledTools(newTools);
  };

  // Disable all tools
  const disableAllTools = () => {
    const newTools = {};
    Object.keys(enabledTools).forEach(name => { newTools[name] = false; });
    setEnabledTools(newTools);
  };

  return {
    // Model
    selectedModel,
    setSelectedModel,

    // LLM parameters
    llmTemperature,
    setLlmTemperature,
    llmMaxTokens,
    setLlmMaxTokens,
    llmTopP,
    setLlmTopP,

    // Thinking mode
    thinkingEnabled,
    setThinkingEnabled,
    thinkingBudget,
    setThinkingBudget,

    // Tools
    enabledTools,
    setEnabledTools,
    maxToolCalls,
    setMaxToolCalls,
    toolCallHistory,
    setToolCallHistory,

    // Functions
    resetLLMConfig,
    enableAllTools,
    enableSafeToolsOnly,
    disableAllTools,
  };
};
