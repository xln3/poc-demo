import { useState, useEffect } from 'react';
import { authFetch } from '../auth';

const PROVIDER_PRESETS = [
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  { name: 'Anthropic (via proxy)', base_url: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'] },
  { name: '智谱 AI', base_url: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4', 'glm-4-flash'] },
  { name: '通义千问', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo'] },
  { name: 'AiHubMix', base_url: 'https://aihubmix.com/v1', models: [] },
];

export default function LLMProviderSettings({ open, onClose }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ provider_name: '', base_url: '', api_key: '', models: '', is_default: false });
  const [testStatus, setTestStatus] = useState(null);

  useEffect(() => {
    if (open) loadProviders();
  }, [open]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/llm/providers');
      if (res.ok) setProviders(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ provider_name: '', base_url: '', api_key: '', models: '', is_default: false });
    setEditingId(null);
    setTestStatus(null);
  };

  const applyPreset = (preset) => {
    setForm({
      provider_name: preset.name,
      base_url: preset.base_url,
      api_key: '',
      models: preset.models.join(', '),
      is_default: false,
    });
  };

  const saveProvider = async () => {
    const body = {
      provider_name: form.provider_name,
      base_url: form.base_url,
      api_key: form.api_key,
      models: form.models.split(',').map(m => m.trim()).filter(Boolean),
      is_default: form.is_default,
    };

    try {
      const url = editingId ? `/api/llm/providers/${editingId}` : '/api/llm/providers';
      const method = editingId ? 'PUT' : 'POST';
      // Don't send empty api_key on update
      if (editingId && !body.api_key) delete body.api_key;

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        loadProviders();
      }
    } catch (e) { console.error(e); }
  };

  const deleteProvider = async (id) => {
    if (!confirm('确定删除此供应商？')) return;
    await authFetch(`/api/llm/providers/${id}`, { method: 'DELETE' });
    loadProviders();
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      // Quick test — send a minimal request
      const res = await authFetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
          provider_id: editingId || providers[0]?.id,
          model: form.models.split(',')[0]?.trim() || 'gpt-4o-mini',
          max_tokens: 5,
        }),
      });
      setTestStatus(res.ok ? 'success' : 'error');
    } catch {
      setTestStatus('error');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">LLM 供应商配置</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Existing providers */}
          {providers.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm text-slate-400 font-medium">已配置的供应商</h3>
              {providers.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2">
                  <div>
                    <span className="text-white text-sm font-medium">{p.provider_name}</span>
                    {p.is_default && <span className="ml-2 text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white">默认</span>}
                    <div className="text-slate-400 text-xs">{p.base_url} | Key: {p.api_key_masked}</div>
                    <div className="text-slate-500 text-xs">模型: {p.models.join(', ') || '未配置'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(p.id);
                        setForm({
                          provider_name: p.provider_name,
                          base_url: p.base_url,
                          api_key: '',
                          models: p.models.join(', '),
                          is_default: p.is_default,
                        });
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >编辑</button>
                    <button onClick={() => deleteProvider(p.id)} className="text-xs text-red-400 hover:text-red-300">删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div className="border border-slate-700 rounded-lg p-4 space-y-3">
            <h3 className="text-sm text-slate-300 font-medium">
              {editingId ? '编辑供应商' : '添加供应商'}
            </h3>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {PROVIDER_PRESETS.map(p => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                >{p.name}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="供应商名称"
                value={form.provider_name}
                onChange={e => setForm({ ...form, provider_name: e.target.value })}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
              />
              <input
                placeholder="Base URL"
                value={form.base_url}
                onChange={e => setForm({ ...form, base_url: e.target.value })}
                className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
              />
            </div>
            <input
              type="password"
              placeholder={editingId ? "API Key（留空不修改）" : "API Key"}
              value={form.api_key}
              onChange={e => setForm({ ...form, api_key: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
            />
            <input
              placeholder="模型列表（逗号分隔）"
              value={form.models}
              onChange={e => setForm({ ...form, models: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white"
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={e => setForm({ ...form, is_default: e.target.checked })}
              />
              设为默认供应商
            </label>

            <div className="flex gap-2">
              <button
                onClick={saveProvider}
                disabled={!form.provider_name || !form.base_url || (!editingId && !form.api_key)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white text-sm rounded"
              >{editingId ? '更新' : '添加'}</button>
              {editingId && (
                <button onClick={resetForm} className="px-4 py-1.5 bg-slate-700 text-slate-300 text-sm rounded">
                  取消
                </button>
              )}
              {editingId && (
                <button onClick={testConnection} className="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded">
                  {testStatus === 'testing' ? '测试中...' : testStatus === 'success' ? '连接成功' : testStatus === 'error' ? '连接失败' : '测试连接'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
