import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CaseConfigProvider } from '../../contexts/CaseConfigContext.jsx';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';
import {
  ConfigPageHeader,
  AgentSelector,
  LLMParamsSection,
  ThinkingSection,
  SystemPromptEditor,
  TestModeSelector,
  MultiModeEditor,
  InteractModeEditor,
  LLMJudgerConfig,
  FileParsingConfig,
  ImportFromEvalDialog,
} from '../case-config/index.js';
import { saveCaseToServer, getCaseDetail, updateCase } from '../../caseApi.js';

/**
 * ConfigPage — v4 self-contained case config page.
 * Wraps all components in CaseConfigProvider.
 */
export default function ConfigPage({ setActiveTab, caseId, onApplyCaseConfig }) {
  return (
    <CaseConfigProvider>
      <ConfigPageInner setActiveTab={setActiveTab} caseId={caseId} onApplyCaseConfig={onApplyCaseConfig} />
    </CaseConfigProvider>
  );
}

function ConfigPageInner({ setActiveTab, caseId, onApplyCaseConfig }) {
  const { t } = useTranslation();
  const { config, loadCase, toSavePayload } = useCaseConfig();
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState(null);

  // Load existing case if editing
  useEffect(() => {
    if (!caseId) return;
    getCaseDetail(caseId)
      .then((data) => {
        if (data.schema_version === '3.0.0' || data.schema_version === '4.0.0' || data.test_mode) {
          loadCase(data);
        }
      })
      .catch((e) => setToast({ type: 'error', msg: e.message }));
  }, [caseId, loadCase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = toSavePayload();
      if (caseId) {
        await updateCase(caseId, payload);
      } else {
        await saveCaseToServer(payload);
      }
      setToast({ type: 'success', msg: t('success.caseSaved', { id: config.meta.case_id }) });
      return true;
    } catch (e) {
      setToast({ type: 'error', msg: e.message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const modeEditors = {
    chat: MultiModeEditor,
    act: InteractModeEditor,
  };
  const ModeEditor = modeEditors[config.test_mode] || MultiModeEditor;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Toast */}
        {toast && (
          <div className={`px-4 py-2 rounded-lg text-sm ${
            toast.type === 'error'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
          }`}>
            {toast.msg}
          </div>
        )}

        <ConfigPageHeader
          onSave={handleSave}
          onImportFromEval={() => setShowImport(true)}
          saving={saving}
        />

        <hr className="border-edge" />

        {/* Agent + LLM Params + Thinking — compact single row */}
        <div className="grid grid-cols-[3fr_4fr_2fr] gap-4 items-start">
          <AgentSelector />
          <LLMParamsSection />
          <ThinkingSection />
        </div>
        <SystemPromptEditor />
        <FileParsingConfig />

        <hr className="border-edge" />

        {/* LLM Judger — standalone section */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-on-canvas">
            {t('caseConfig.envLLMJudger')}
          </label>
          <div className="border border-edge rounded-lg p-3">
            <LLMJudgerConfig />
          </div>
        </div>

        <hr className="border-edge" />

        <TestModeSelector />
        <ModeEditor />

        {/* Action bar */}
        <div className="flex gap-3 pt-4 border-t border-edge">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('buttons.saving') : t('buttons.save')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await handleSave();
              if (ok) {
                onApplyCaseConfig?.(config);
                setActiveTab?.('run');
              }
            }}
            disabled={saving}
            className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('caseConfig.saveAndRun')}
          </button>
        </div>
      </div>

      <ImportFromEvalDialog open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
