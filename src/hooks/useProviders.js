import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../auth.js';

/**
 * Manages LLM provider state — fetches from backend and tracks selection.
 * Falls back to CONFIG.models when no providers are configured.
 */
export function useProviders() {
  const [providers, setProviders] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [providerModels, setProviderModels] = useState([]);

  const loadProviders = useCallback(async () => {
    try {
      const res = await authFetch('/api/llm/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
        // Auto-select default or first provider
        if (data.length > 0 && !selectedProviderId) {
          const defaultP = data.find(p => p.is_default) || data[0];
          setSelectedProviderId(defaultP.id);
          setProviderModels(defaultP.models || []);
        }
      }
    } catch (e) {
      console.error('Failed to load providers:', e);
    }
  }, []);

  // Reload providers on mount
  useEffect(() => { loadProviders(); }, [loadProviders]);

  // When provider selection changes, update available models
  const selectProvider = useCallback((providerId) => {
    const id = Number(providerId);
    setSelectedProviderId(id);
    const p = providers.find(p => p.id === id);
    setProviderModels(p?.models || []);
  }, [providers]);

  return {
    providers,
    selectedProviderId,
    setSelectedProviderId: selectProvider,
    providerModels,
    reloadProviders: loadProviders,
  };
}
