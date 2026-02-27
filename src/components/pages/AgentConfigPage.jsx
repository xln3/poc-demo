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
  const feats = agent.features || {};
  const tags = [];
  if (feats.thinking?.enabled) tags.push(t('agents.feat.thinking'));
  ['web', 'tools', 'function_calling', 'structured_outputs', 'vision', 'video'].forEach(k => {
    if (feats[k]) tags.push(t(`agents.feat.${k}`));
  });

  return (
    <div className="bg-surface rounded-xl border border-edge p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-on-canvas">{agent.name}</h3>
          <div className="text-sm text-on-muted mt-1 truncate">{agent.model_id}</div>
          <div className="text-xs text-on-dim mt-0.5 truncate">{agent.api_base}</div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(c => (
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

const DEFAULT_FEATURES = {
  thinking: { enabled: false, mode: 'auto', budget: null },
  web: false,
  tools: false,
  function_calling: false,
  structured_outputs: false,
  vision: false,
  video: false,
};

function AgentForm({ initial, onSave, onCancel }) {
  const { t } = useTranslation('eval');
  const [showApiKey, setShowApiKey] = useState(false);
  const initFeatures = { ...DEFAULT_FEATURES, ...initial?.features };
  if (initial?.features?.thinking) {
    initFeatures.thinking = { ...DEFAULT_FEATURES.thinking, ...initial.features.thinking };
  }
  const [form, setForm] = useState({
    name: initial?.name || '',
    api_base: initial?.api_base || '',
    api_key: '',
    model_id: initial?.model_id || '',
    system_prompt: initial?.system_prompt || '',
    features: initFeatures,
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateFeature = (key, value) => setForm(prev => ({
    ...prev,
    features: { ...prev.features, [key]: value },
  }));
  const updateThinking = (key, value) => setForm(prev => ({
    ...prev,
    features: {
      ...prev.features,
      thinking: { ...prev.features.thinking, [key]: value },
    },
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const SIMPLE_FEATURES = ['web', 'tools', 'function_calling', 'structured_outputs', 'vision', 'video'];

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
          <Field label={t('agents.modelId')} hint={t('agents.modelIdHint')}>
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
            <div className="relative">
              <input type={showApiKey ? 'text' : 'password'} value={form.api_key} onChange={e => update('api_key', e.target.value)}
                placeholder={initial ? '(unchanged)' : 'sk-...'}
                className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-edge bg-canvas text-on-canvas" />
              <button type="button" onClick={() => setShowApiKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-on-muted hover:text-on-canvas transition-colors"
                title={showApiKey ? t('agents.hideApiKey') : t('agents.showApiKey')}>
                {showApiKey ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </Field>
        </div>

        <Field label={t('agents.systemPrompt')}>
          <textarea value={form.system_prompt} onChange={e => update('system_prompt', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas resize-none" />
        </Field>

        {/* Features */}
        <div className="pt-2">
          <div className="text-sm font-medium text-on-surface mb-2">{t('agents.features')}</div>

          {/* Thinking — with sub-options */}
          <div className="mb-3">
            <Toggle label={t('agents.feat.thinking')}
              checked={form.features.thinking?.enabled || false}
              onChange={v => updateThinking('enabled', v)} />
            {form.features.thinking?.enabled && (
              <div className="ml-6 mt-2 flex flex-wrap gap-x-6 gap-y-2 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-muted">{t('agents.feat.thinkingMode')}:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="thinkingMode" value="on"
                      checked={form.features.thinking.mode === 'on'}
                      onChange={() => updateThinking('mode', 'on')}
                      className="accent-blue-600" />
                    <span className="text-xs text-on-surface">{t('agents.feat.thinkingOn')}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="radio" name="thinkingMode" value="auto"
                      checked={form.features.thinking.mode === 'auto'}
                      onChange={() => updateThinking('mode', 'auto')}
                      className="accent-blue-600" />
                    <span className="text-xs text-on-surface">{t('agents.feat.thinkingAuto')}</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-muted">{t('agents.feat.thinkingBudget')}:</span>
                  <input type="number" min="0"
                    value={form.features.thinking.budget ?? ''}
                    onChange={e => updateThinking('budget', e.target.value ? Number(e.target.value) : null)}
                    placeholder={t('agents.feat.thinkingBudgetPlaceholder')}
                    className="w-32 px-2 py-1 text-xs rounded border border-edge bg-canvas text-on-canvas" />
                </div>
              </div>
            )}
          </div>

          {/* Simple feature toggles */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SIMPLE_FEATURES.map(key => (
              <Toggle key={key} label={t(`agents.feat.${key}`)}
                checked={form.features[key] || false}
                onChange={v => updateFeature(key, v)} />
            ))}
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

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-on-muted mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-on-dim mt-1">{hint}</p>}
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
