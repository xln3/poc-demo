import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchEvalTemplates,
  createEvalTemplate,
  updateEvalTemplate,
  deleteEvalTemplate,
  copyEvalTemplate,
  fetchRiskHierarchy,
} from '../../api/evalBridgeApi';
import RiskHierarchySelector from '../eval/RiskHierarchySelector';
import EvalRunDialog from '../eval/EvalRunDialog';

/**
 * EvalManagePage — CRUD for reusable evaluation templates
 */
export default function EvalManagePage({ onNavigate }) {
  const { t } = useTranslation('eval');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [runTarget, setRunTarget] = useState(null); // template to run

  const loadTemplates = useCallback(async () => {
    try {
      const data = await fetchEvalTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const handleSave = async (formData) => {
    try {
      if (editing?.id) {
        await updateEvalTemplate(editing.id, formData);
      } else {
        await createEvalTemplate(formData);
      }
      setShowForm(false);
      setEditing(null);
      loadTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('evalManage.deleteConfirm'))) return;
    try {
      await deleteEvalTemplate(id);
      loadTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCopy = async (id) => {
    try {
      await copyEvalTemplate(id);
      loadTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRunStarted = (job) => {
    setRunTarget(null);
    onNavigate?.('eval-progress', { jobId: job.job_id || job.id });
  };

  if (loading) {
    return <div className="p-8 text-center text-on-muted">{t('loading')}</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-on-canvas">{t('evalManage.title')}</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + {t('evalManage.create')}
        </button>
      </div>

      {/* Template form */}
      {showForm && (
        <TemplateForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Template list */}
      {templates.length === 0 ? (
        <div className="text-center text-on-muted py-12">{t('evalManage.noTemplates')}</div>
      ) : (
        <div className="grid gap-4">
          {templates.map(tpl => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => { setEditing(tpl); setShowForm(true); }}
              onDelete={() => handleDelete(tpl.id)}
              onCopy={() => handleCopy(tpl.id)}
              onRun={() => setRunTarget(tpl)}
            />
          ))}
        </div>
      )}

      {/* Run dialog */}
      {runTarget && (
        <EvalRunDialog
          templateId={runTarget.id}
          templateName={runTarget.name}
          onClose={() => setRunTarget(null)}
          onStarted={handleRunStarted}
        />
      )}
    </div>
  );
}


function TemplateCard({ template, onEdit, onDelete, onCopy, onRun }) {
  const { t } = useTranslation('eval');
  const config = template.config_json || {};
  const tasks = config.selected_tasks || [];
  const benchmarks = new Set(tasks.map(t => t.benchmark));
  const riskCategories = config.risk_categories || [];

  return (
    <div className="border border-edge rounded-xl p-4 bg-canvas hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-on-canvas truncate">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-on-muted mt-1 line-clamp-2">{template.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-on-muted flex-wrap">
            <span>{t('evalManage.riskCount', { count: riskCategories.length })}</span>
            <span>{t('evalManage.benchmarkCount', { count: benchmarks.size })}</span>
            <span>{t('evalManage.taskCount', { count: tasks.length })}</span>
            {template.created_at && (
              <span>{new Date(template.created_at).toLocaleDateString()}</span>
            )}
          </div>
          {riskCategories.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {riskCategories.slice(0, 5).map(cat => (
                <span key={cat} className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-500">
                  {cat}
                </span>
              ))}
              {riskCategories.length > 5 && (
                <span className="text-xs text-on-muted">+{riskCategories.length - 5}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRun}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {t('evalManage.run')}
          </button>
          <button
            onClick={onEdit}
            className="px-2 py-1.5 text-sm text-on-muted hover:text-on-canvas hover:bg-surface-hover rounded-lg"
          >
            {t('evalManage.edit')}
          </button>
          <button
            onClick={onCopy}
            className="px-2 py-1.5 text-sm text-on-muted hover:text-on-canvas hover:bg-surface-hover rounded-lg"
          >
            {t('evalManage.copy')}
          </button>
          <button
            onClick={onDelete}
            className="px-2 py-1.5 text-sm text-red-500 hover:text-red-400 hover:bg-surface-hover rounded-lg"
          >
            {t('evalManage.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}


function TemplateForm({ initial, onSave, onCancel }) {
  const { t, i18n } = useTranslation('eval');
  const isZh = i18n.language?.startsWith('zh');
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [selectedTasks, setSelectedTasks] = useState(
    initial?.config_json?.selected_tasks || []
  );
  const [hierarchy, setHierarchy] = useState([]);

  // Load hierarchy for risk category derivation
  useEffect(() => {
    fetchRiskHierarchy().then(setHierarchy).catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Derive denormalized fields
    const benchmarks = [...new Set(selectedTasks.map(t => t.benchmark))];
    const benchmarkSet = new Set(benchmarks);

    // Derive risk categories from hierarchy: find which categories contain selected benchmarks
    const categories = [];
    for (const cat of hierarchy) {
      for (const sub of cat.subcategories || []) {
        for (const bm of sub.benchmarks || []) {
          if (bm.catalog_key && benchmarkSet.has(bm.catalog_key)) {
            const label = isZh ? sub.name : sub.name_en;
            if (!categories.includes(label)) categories.push(label);
          }
        }
      }
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      config_json: {
        selected_tasks: selectedTasks,
        selected_benchmarks: benchmarks,
        risk_categories: categories,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-edge rounded-xl p-6 bg-canvas space-y-4">
      <h3 className="text-lg font-bold text-on-canvas">
        {initial?.id ? t('evalManage.edit') : t('evalManage.create')}
      </h3>

      <div>
        <label className="block text-sm font-medium text-on-canvas mb-1">
          {t('evalManage.name')}
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('evalManage.namePlaceholder')}
          className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-canvas mb-1">
          {t('evalManage.description')}
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={t('evalManage.descriptionPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-edge bg-canvas text-on-canvas resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-on-canvas mb-2">
          {t('evalManage.selectTasks')}
        </label>
        <RiskHierarchySelector
          value={selectedTasks}
          onChange={setSelectedTasks}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-on-muted hover:text-on-canvas"
        >
          {t('evalManage.cancel')}
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {t('evalManage.save')}
        </button>
      </div>
    </form>
  );
}
