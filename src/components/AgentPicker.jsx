import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../auth.js';

/**
 * AgentPicker — compact inline 智能体(模型) selector for the attack view.
 *
 * Self-fetches configured agents (GET /agents) and lets the user pick which
 * agent the 真机测试 will call. On selection it sets BOTH the agent id and the
 * agent's model, so the backend proxy routes to the right endpoint/model.
 * Auto-selects a preferred agent (车贷/deepseek/inferera) on first load.
 */
export default function AgentPicker({ selectedAgentId, onSelect, disabled, preferMatch = /车贷|deepseek|inferera/i }) {
  const { t } = useTranslation();
  const [agents, setAgents] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/agents');
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.agents || data.items || []);
      setAgents(list);
      // Auto-select once, if nothing chosen yet
      if (list.length && !selectedAgentId) {
        const pref = list.find((a) =>
          preferMatch.test(`${a.name || ''} ${a.model_id || ''} ${a.api_base || ''}`)
        ) || list[0];
        onSelect?.(pref.id, pref.model_id);
      }
    } catch (e) {
      /* ignore */
    }
  }, [selectedAgentId, onSelect, preferMatch]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!agents.length) return null;

  return (
    <label className="flex items-center gap-1 text-xs text-on-muted">
      <span className="text-[10px]">{t('injectionLab.agentLabel')}</span>
      <select
        value={selectedAgentId || ''}
        onChange={(e) => {
          const a = agents.find((x) => String(x.id) === e.target.value);
          if (a) onSelect?.(a.id, a.model_id);
        }}
        disabled={disabled}
        className="bg-surface-raised text-on-surface text-xs px-2 py-1 rounded border border-edge-strong focus:outline-none focus:border-blue-500 disabled:opacity-50 max-w-[240px]"
      >
        <option value="" disabled>{t('injectionLab.agentPlaceholder')}</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}{a.model_id ? ` · ${a.model_id}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
