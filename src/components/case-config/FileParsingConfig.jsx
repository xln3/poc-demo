import { useTranslation } from 'react-i18next';
import { CONFIG } from '../../config.js';
import { useCaseConfig } from '../../hooks/useCaseConfig.js';

const FILE_TYPES = ['pdf', 'docx', 'xlsx', 'image'];

export default function FileParsingConfig() {
  const { t } = useTranslation();
  const { config, updateField } = useCaseConfig();
  const fp = config.file_parsing;

  const toggleParser = (fileType, parserId) => {
    const current = fp[fileType] || [];
    const updated = current.includes(parserId)
      ? current.filter((id) => id !== parserId)
      : [...current, parserId];
    updateField(`file_parsing.${fileType}`, updated);
  };

  return (
    <div>
      <label className="text-sm font-medium text-on-canvas mb-2 block">
        {t('caseConfig.fileParsing')}
      </label>
      <p className="text-xs text-on-dim mb-3">{t('caseConfig.fileParsingHint')}</p>
      <div className="grid grid-cols-2 gap-3">
        {FILE_TYPES.map((fileType) => {
          const parserConfig = CONFIG.mcp.parsers[fileType];
          if (!parserConfig) return null;
          const selected = fp[fileType] || [];
          return (
            <div key={fileType} className="border border-edge rounded-lg p-2.5">
              <div className="text-xs font-medium text-on-surface mb-1.5">{parserConfig.label}</div>
              <div className="space-y-1">
                {parserConfig.tools.map((tool) => (
                  <label
                    key={tool.id}
                    className="flex items-start gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(tool.id)}
                      onChange={() => toggleParser(fileType, tool.id)}
                      className="mt-0.5 rounded border-edge"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-on-canvas group-hover:text-blue-500 transition">
                        {tool.name}
                      </span>
                      {tool.hiddenExtract && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 bg-red-500/10 text-red-500 rounded">
                          {t('caseConfig.fileParsingHidden')}
                        </span>
                      )}
                      {tool.requiresDocker && (
                        <span className="ml-1 text-[10px] px-1 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                          Docker
                        </span>
                      )}
                      <p className="text-[10px] text-on-dim leading-tight">{tool.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
