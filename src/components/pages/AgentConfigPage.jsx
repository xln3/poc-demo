import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchAgents, createAgent, updateAgent, deleteAgent } from '../../api/evalBridgeApi';

/**
 * AgentConfigPage — CRUD for agent configurations with plugin-style capabilities
 */
export default function AgentConfigPage({ onNavigate }) {
  const { t } = useTranslation('eval');
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null or agent object
  const [showForm, setShowForm] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const data = await fetchAgents();
      setAgents(data);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleSave = async (formData) => {
    try {
      if (editing?.id) {
        await updateAgent(editing.id, formData);
      } else {
        await createAgent(formData);
      }
      setShowForm(false);
      setEditing(null);
      loadAgents();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('agents.deleteConfirm'))) return;
    try {
      await deleteAgent(id);
      loadAgents();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-on-canvas">{t('agents.title')}</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + {t('agents.create')}
        </button>
      </div>

      {/* Agent form modal */}
      {showForm && (
        <AgentForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Agent list */}
      {agents.length === 0 ? (
        <div className="text-center text-on-muted py-12">{t('agents.noAgents')}</div>
      ) : (
        <div className="grid gap-4">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => { setEditing(agent); setShowForm(true); }}
              onDelete={() => handleDelete(agent.id)}
              onEvaluate={() => onNavigate?.('eval-new', { agentId: agent.id, modelId: agent.model_id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete, onEvaluate }) {
  const { t } = useTranslation('eval');
  const caps = [];
  if (agent.tools_enabled) caps.push(t('agents.tools'));
  if (agent.rag_enabled) caps.push(t('agents.rag'));
  if (agent.mcp_enabled) caps.push(t('agents.mcp'));

  return (
    <div className="bg-surface rounded-xl border border-edge p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-on-canvas">{agent.name}</h3>
          <div className="text-sm text-on-muted mt-1 truncate">{agent.model_id}</div>
          <div className="text-xs text-on-dim mt-0.5 truncate">{agent.api_base}</div>
          {caps.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {caps.map(c => (
                <span key={c} className="px-2 py-0.5 bg-surface-raised text-on-muted text-xs rounded-full">{c}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 ml-4 flex-shrink-0">
          <button onClick={onEvaluate} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
            {t('agents.evaluate')}
          </button>
          <button onClick={onEdit} className="px-3 py-1.5 bg-surface-raised text-on-surface text-xs rounded-lg hover:bg-surface-hover">
            {t('agents.edit')}
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 bg-red-600/20 text-red-400 text-xs rounded-lg hover:bg-red-600/30">
            {t('agents.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentForm({ initial, onSave, onCancel }) {
  const { t } = useTranslation('eval');
  const [form, setForm] = useState({
    name: initial?.name || '',
    api_base: initial?.api_base || '',
    api_key: '',
    model_id: initial?.model_id || '',
    system_prompt: initial?.system_prompt || '',
    tools_enabled: initial?.tools_enabled || false,
    enabled_tools: initial?.enabled_tools || [],
    rag_enabled: initial?.rag_enabled || false,
    mcp_enabled: initial?.mcp_enabled || false,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="bg-surface border border-edge rounded-xl p-5 space-y-4">
      <h2 className="text-lg font-semibold text-on-canvas">
        {initial ? t('agents.edit') : t('agents.create')}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('agents.name')}>
            <input value={form.name} onChange={e => update('name', e.target.value)} required
              className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas" />
          </Field>
          <Field label={t('agents.modelId')}>
            <input value={form.model_id} onChange={e => update('model_id', e.target.value)} required
              placeholder="openai/gpt-4o"
              className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas" />
          </Field>
          <Field label={t('agents.apiBase')}>
            <input value={form.api_base} onChange={e => update('api_base', e.target.value)} required
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas" />
          </Field>
          <Field label={t('agents.apiKey')}>
            <input type="password" value={form.api_key} onChange={e => update('api_key', e.target.value)}
              placeholder={initial ? '(unchanged)' : 'sk-...'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas" />
          </Field>
        </div>

        <Field label={t('agents.systemPrompt')}>
          <textarea value={form.system_prompt} onChange={e => update('system_prompt', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas resize-none" />
        </Field>

        {/* Capability toggles */}
        <div className="pt-2">
          <div className="text-sm font-medium text-on-surface mb-2">{t('agents.capabilities')}</div>
          <div className="flex gap-4">
            <Toggle label={t('agents.tools')} checked={form.tools_enabled} onChange={v => update('tools_enabled', v)} />
            <Toggle label={t('agents.rag')} checked={form.rag_enabled} onChange={v => update('rag_enabled', v)} />
            <Toggle label={t('agents.mcp')} checked={form.mcp_enabled} onChange={v => update('mcp_enabled', v)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm bg-surface-raised text-on-muted rounded-lg hover:bg-surface-hover">
            {t('agents.cancel')}
          </button>
          <button type="submit"
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {t('agents.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-on-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-edge accent-blue-600" />
      <span className="text-sm text-on-surface">{label}</span>
    </label>
  );
}
