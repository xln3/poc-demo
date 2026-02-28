import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAgents } from '../../api/evalBridgeApi.js';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

export default function AgentSelector() {
  const { t } = useTranslation();
  const { config, loadAgent } = useCaseConfig();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAgents()
      .then((data) => {
        setAgents(Array.isArray(data) ? data : data.items || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (e) => {
    const agentId = e.target.value;
    if (!agentId) return;
    const agent = agents.find((a) => a.id === agentId);
    if (agent) loadAgent(agent);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-on-canvas">
        {t('caseConfig.agent')}
      </label>
      <select
        value={config.agent.agent_id || ''}
        onChange={handleSelect}
        className="w-full px-3 py-2 bg-surface border border-edge rounded-lg text-sm text-on-canvas
                   focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        <option value="">{loading ? t('batchTest.loading') : t('caseConfig.selectAgent')}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} {a.model_id ? `(${a.model_id})` : ''}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {config.agent.agent_id && (
        <div className="flex gap-3 text-xs text-on-dim">
          {config.agent.model_id && <span>{t('caseConfig.model')}: {config.agent.model_id}</span>}
          {config.agent.api_base && <span>{t('caseConfig.apiBase')}: {config.agent.api_base}</span>}
        </div>
      )}
    </div>
  );
}
