import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

const SOURCE_TYPES = ['text', 'document', 'file', 'db'];

const SOURCE_TYPE_I18N = {
  text: 'caseConfig.ragModeText',
  document: 'caseConfig.ragModeDocument',
  file: 'caseConfig.ragModeFile',
  db: 'caseConfig.ragModeDB',
};

const SOURCE_TYPE_HINT = {
  text: 'caseConfig.ragTextHint',
  document: 'caseConfig.ragDocumentHint',
  file: 'caseConfig.ragLocalFileHint',
  db: 'caseConfig.ragDBHint',
};

const SOURCE_TYPE_COLORS = {
  text: 'bg-amber-600 text-white border-amber-600',
  document: 'bg-green-600 text-white border-green-600',
  file: 'bg-blue-600 text-white border-blue-600',
  db: 'bg-purple-600 text-white border-purple-600',
};

const DB_TYPES = ['postgresql', 'mysql', 'sqlite'];

const DEFAULT_PORTS = {
  postgresql: 5432,
  mysql: 3306,
  sqlite: '',
};

export default function RAGDataConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const rag = config.act_config.rag_data;

  const sourceType = rag.source_type || 'text';
  const [queryOpen, setQueryOpen] = useState(false);

  // Local state for add-document form
  const [docForm, setDocForm] = useState({
    name: '',
    source: 'url',
    url: '',
    content: '',
  });

  const entryCount = rag.knowledge
    ? rag.knowledge.split('\n').filter((line) => line.trim().length > 0).length
    : 0;

  const setSourceType = useCallback(
    (type) => {
      updateField('act_config.rag_data.source_type', type);
    },
    [updateField]
  );

  const handleAddDocument = () => {
    if (!docForm.name.trim()) return;
    if (docForm.source === 'url' && !docForm.url.trim()) return;
    if (docForm.source === 'text' && !docForm.content.trim()) return;

    const newDoc = {
      id: crypto.randomUUID?.() || 'doc-' + Date.now(),
      name: docForm.name.trim(),
      source: docForm.source,
      content: docForm.source === 'text' ? docForm.content : '',
      url: docForm.source === 'url' ? docForm.url : '',
    };

    updateField('act_config.rag_data.documents', [...(rag.documents || []), newDoc]);
    setDocForm({ name: '', source: 'url', url: '', content: '' });
  };

  const handleRemoveDocument = (id) => {
    updateField(
      'act_config.rag_data.documents',
      (rag.documents || []).filter((d) => d.id !== id)
    );
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateField('act_config.rag_data.file_content', ev.target.result);
      updateField('act_config.rag_data.file_name', file.name);
    };
    reader.readAsText(file);
  };

  const dbConn = rag.db_connection || {};
  const updateDBField = useCallback(
    (field, value) => {
      updateField('act_config.rag_data.db_connection', {
        ...dbConn,
        [field]: value,
      });
    },
    [updateField, dbConn]
  );

  const inputCls =
    'w-full px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm text-on-canvas ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/40';

  return (
    <div className="space-y-3">
      {/* Source Type Selector */}
      <div>
        <label className="text-xs text-on-dim mb-1.5 block">{t('caseConfig.ragSourceType')}</label>
        <div className="flex gap-2">
          {SOURCE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSourceType(type)}
              className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                sourceType === type
                  ? SOURCE_TYPE_COLORS[type]
                  : 'bg-surface text-on-surface border-edge hover:bg-surface-hover'
              }`}
            >
              {t(SOURCE_TYPE_I18N[type])}
            </button>
          ))}
        </div>
      </div>

      {/* Text Mode (formerly Mock) */}
      {sourceType === 'text' && (
        <div className="grid grid-cols-2 gap-3">
          {/* Left: Knowledge Preview */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">
              {t('caseConfig.ragKnowledgePreview')}
              <span className="ml-1.5 text-amber-600">
                {entryCount > 0
                  ? t('caseConfig.ragEntryCount', { count: entryCount })
                  : t('caseConfig.ragEmpty')}
              </span>
            </label>
            <pre
              className="w-full px-2.5 py-1.5 bg-surface-muted/50 border border-edge rounded-lg text-sm text-on-canvas
                         max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words"
            >
              {rag.knowledge ? (
                rag.knowledge
              ) : (
                <span className="italic text-on-dim/50">
                  {t('caseConfig.ragKnowledgePlaceholder')}
                </span>
              )}
            </pre>
          </div>

          {/* Right: Knowledge Editor */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">
              {t('caseConfig.ragEditKnowledge')}
            </label>
            <textarea
              value={rag.knowledge}
              onChange={(e) => updateField('act_config.rag_data.knowledge', e.target.value)}
              className={`${inputCls} placeholder:text-on-dim/50 resize-y max-h-[200px]`}
              rows={4}
              placeholder={t('caseConfig.ragKnowledgePlaceholder')}
            />
          </div>
        </div>
      )}

      {/* Document Mode (formerly Real) */}
      {sourceType === 'document' && (
        <div className="space-y-3">
          {/* Document List */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">
              {t('caseConfig.ragDocuments')}
            </label>
            {(rag.documents || []).length === 0 ? (
              <p className="text-sm text-on-dim italic px-2.5 py-2">
                {t('caseConfig.ragEmpty')}
              </p>
            ) : (
              <div className="space-y-1">
                {(rag.documents || []).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 bg-surface border border-edge rounded-lg text-sm"
                  >
                    <span className="text-on-canvas flex-1 truncate">{doc.name}</span>
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded ${
                        doc.source === 'url'
                          ? 'bg-blue-600/15 text-blue-600'
                          : 'bg-amber-600/15 text-amber-600'
                      }`}
                    >
                      {doc.source === 'url'
                        ? t('caseConfig.ragDocSourceUrl')
                        : t('caseConfig.ragDocSourceText')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="text-on-dim hover:text-red-500 text-sm px-1"
                      title={t('caseConfig.ragRemoveDocument')}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Document Form */}
          <div className="border border-edge rounded-lg p-3 space-y-2">
            <label className="text-xs font-medium text-on-canvas block">
              {t('caseConfig.ragAddDocument')}
            </label>

            {/* Source type selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-on-dim">{t('caseConfig.ragDocSource')}:</label>
              <label className="flex items-center gap-1 text-xs text-on-canvas cursor-pointer">
                <input
                  type="radio"
                  name="rag-doc-source"
                  checked={docForm.source === 'url'}
                  onChange={() => setDocForm((f) => ({ ...f, source: 'url' }))}
                  className="accent-amber-600"
                />
                {t('caseConfig.ragDocSourceUrl')}
              </label>
              <label className="flex items-center gap-1 text-xs text-on-canvas cursor-pointer">
                <input
                  type="radio"
                  name="rag-doc-source"
                  checked={docForm.source === 'text'}
                  onChange={() => setDocForm((f) => ({ ...f, source: 'text' }))}
                  className="accent-amber-600"
                />
                {t('caseConfig.ragDocSourceText')}
              </label>
            </div>

            {/* Name input */}
            <div>
              <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.ragDocName')}</label>
              <input
                type="text"
                value={docForm.name}
                onChange={(e) => setDocForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder={t('caseConfig.ragDocName')}
              />
            </div>

            {/* URL or Content input */}
            {docForm.source === 'url' ? (
              <div>
                <label className="text-xs text-on-dim mb-1 block">
                  {t('caseConfig.ragDocUrl')}
                </label>
                <input
                  type="text"
                  value={docForm.url}
                  onChange={(e) => setDocForm((f) => ({ ...f, url: e.target.value }))}
                  className={inputCls}
                  placeholder={t('caseConfig.ragDocUrlPlaceholder')}
                />
              </div>
            ) : (
              <div>
                <label className="text-xs text-on-dim mb-1 block">
                  {t('caseConfig.ragDocContent')}
                </label>
                <textarea
                  value={docForm.content}
                  onChange={(e) => setDocForm((f) => ({ ...f, content: e.target.value }))}
                  rows={3}
                  className={`${inputCls} placeholder:text-on-dim/50 resize-y`}
                  placeholder={t('caseConfig.ragDocContentPlaceholder')}
                />
              </div>
            )}

            {/* Add button */}
            <button
              type="button"
              onClick={handleAddDocument}
              className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              {t('caseConfig.ragAddDocument')}
            </button>
          </div>
        </div>
      )}

      {/* Local File Mode */}
      {sourceType === 'file' && (
        <div className="space-y-2">
          <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.ragModeFile')}</label>
          <div
            className="border-2 border-dashed border-edge rounded-lg p-4 text-center
                       hover:border-blue-500/50 transition-colors"
          >
            {rag.file_name ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-on-canvas">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-medium">{rag.file_name}</span>
                </div>
                <p className="text-xs text-on-dim">
                  {(rag.file_content || '').length.toLocaleString()} chars
                </p>
                <div className="flex justify-center gap-2">
                  <label className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".txt,.md,.csv,.json,.xml,.yaml,.yml"
                    />
                    {t('caseConfig.ragModeFile')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      updateField('act_config.rag_data.file_content', '');
                      updateField('act_config.rag_data.file_name', '');
                    }}
                    className="px-3 py-1 text-xs rounded-lg border border-edge text-on-dim hover:text-red-500 hover:border-red-500/50 transition-colors"
                  >
                    {t('caseConfig.ragRemoveDocument')}
                  </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block space-y-2">
                <svg
                  className="w-8 h-8 mx-auto text-on-dim/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm text-on-dim">{t('caseConfig.ragLocalFileHint')}</p>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".txt,.md,.csv,.json,.xml,.yaml,.yml"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* Database Mode */}
      {sourceType === 'db' && (
        <div className="space-y-3">
          {/* DB Type */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.ragDBType')}</label>
            <select
              value={dbConn.db_type || 'postgresql'}
              onChange={(e) => {
                const newType = e.target.value;
                updateField('act_config.rag_data.db_connection', {
                  ...dbConn,
                  db_type: newType,
                  port: DEFAULT_PORTS[newType] || '',
                });
              }}
              className={inputCls}
            >
              {DB_TYPES.map((dbType) => (
                <option key={dbType} value={dbType}>
                  {dbType.charAt(0).toUpperCase() + dbType.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Connection fields - hide host/port/user/pass for sqlite */}
          {(dbConn.db_type || 'postgresql') !== 'sqlite' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-on-dim mb-1 block">
                  {t('caseConfig.ragDBHost')}
                </label>
                <input
                  type="text"
                  value={dbConn.host || ''}
                  onChange={(e) => updateDBField('host', e.target.value)}
                  className={inputCls}
                  placeholder="127.0.0.1"
                />
              </div>
              <div>
                <label className="text-xs text-on-dim mb-1 block">
                  {t('caseConfig.ragDBPort')}
                </label>
                <input
                  type="number"
                  value={dbConn.port ?? ''}
                  onChange={(e) =>
                    updateDBField('port', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className={inputCls}
                  placeholder={String(DEFAULT_PORTS[dbConn.db_type || 'postgresql'] || '')}
                />
              </div>
              <div>
                <label className="text-xs text-on-dim mb-1 block">
                  {t('caseConfig.ragDBUser')}
                </label>
                <input
                  type="text"
                  value={dbConn.username || ''}
                  onChange={(e) => updateDBField('username', e.target.value)}
                  className={inputCls}
                  placeholder={t('caseConfig.ragDBUser')}
                />
              </div>
              <div>
                <label className="text-xs text-on-dim mb-1 block">
                  {t('caseConfig.ragDBPassword')}
                </label>
                <input
                  type="password"
                  value={dbConn.password || ''}
                  onChange={(e) => updateDBField('password', e.target.value)}
                  className={inputCls}
                  placeholder="********"
                />
              </div>
            </div>
          )}

          {/* Database Name */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.ragDBName')}</label>
            <input
              type="text"
              value={dbConn.database || ''}
              onChange={(e) => updateDBField('database', e.target.value)}
              className={inputCls}
              placeholder={
                (dbConn.db_type || 'postgresql') === 'sqlite'
                  ? '/path/to/database.db'
                  : t('caseConfig.ragDBName')
              }
            />
          </div>

          {/* Query */}
          <div>
            <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.ragDBQuery')}</label>
            <textarea
              value={dbConn.query || ''}
              onChange={(e) => updateDBField('query', e.target.value)}
              rows={3}
              className={`${inputCls} placeholder:text-on-dim/50 resize-y font-mono text-xs`}
              placeholder="SELECT * FROM knowledge_base WHERE ..."
            />
          </div>
        </div>
      )}

      {/* Query Configuration (collapsible, always visible) */}
      <div className="border border-edge rounded-lg">
        <button
          type="button"
          onClick={() => setQueryOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-on-canvas
                     hover:bg-surface-hover rounded-lg transition-colors"
        >
          <span>{t('caseConfig.ragQueryConfig')}</span>
          <svg
            className={`w-3.5 h-3.5 text-on-dim transition-transform ${queryOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {queryOpen && (
          <div className="px-3 pb-3 flex gap-3">
            {/* Top K */}
            <div className="flex-1 min-w-0">
              <label className="text-xs text-on-dim mb-1 block">{t('caseConfig.ragTopK')}</label>
              <input
                type="number"
                value={rag.query_config.top_k}
                onChange={(e) =>
                  updateField('act_config.rag_data.query_config.top_k', Number(e.target.value))
                }
                min={1}
                max={20}
                className={inputCls}
              />
            </div>

            {/* Score Threshold */}
            <div className="flex-1 min-w-0">
              <label className="text-xs text-on-dim mb-1 block">
                {t('caseConfig.ragScoreThreshold')}
              </label>
              <input
                type="number"
                value={rag.query_config.score_threshold ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  updateField(
                    'act_config.rag_data.query_config.score_threshold',
                    v === '' ? null : Number(v)
                  );
                }}
                min={0}
                max={1}
                step={0.1}
                placeholder="-"
                className={`${inputCls} placeholder:text-on-dim/50`}
              />
            </div>

            {/* Chunk Size */}
            <div className="flex-1 min-w-0">
              <label className="text-xs text-on-dim mb-1 block">
                {t('caseConfig.ragChunkSize')}
              </label>
              <input
                type="number"
                value={rag.query_config.chunk_size}
                onChange={(e) =>
                  updateField(
                    'act_config.rag_data.query_config.chunk_size',
                    Number(e.target.value)
                  )
                }
                min={100}
                max={2000}
                className={inputCls}
              />
            </div>

            {/* Overlap */}
            <div className="flex-1 min-w-0">
              <label className="text-xs text-on-dim mb-1 block">
                {t('caseConfig.ragOverlap')}
              </label>
              <input
                type="number"
                value={rag.query_config.overlap}
                onChange={(e) =>
                  updateField('act_config.rag_data.query_config.overlap', Number(e.target.value))
                }
                min={0}
                max={500}
                className={inputCls}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <p className="text-xs text-on-dim">{t(SOURCE_TYPE_HINT[sourceType])}</p>
    </div>
  );
}
