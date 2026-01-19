// ============ 类型定义和枚举常量 ============

export const AttackType = {
  INTEGRITY: 'integrity',
  CONFIDENTIALITY: 'confidentiality',
  AVAILABILITY: 'availability',
  JAILBREAK: 'jailbreak'
};

export const RiskLevel = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium'
};

export const ScenarioCategory = {
  BUSINESS: 'business',
  SYSTEM: 'system',
  INDUSTRY: 'industry',
  INDIRECT: 'indirect'
};

export const LogStatus = {
  NORMAL: 'normal',
  WARNING: 'warning',
  BYPASSED: 'bypassed',
  DANGER: 'danger'
};

export const LogType = {
  QUERY: 'query',
  RULE: 'rule',
  TOOL: 'tool',
  DATA: 'data',
  ALERT: 'alert'
};

export const FileType = {
  PDF: 'pdf',
  DOCX: 'docx',
  XLSX: 'xlsx',
  IMAGE: 'image',
  CODE: 'code',
  MARKDOWN: 'markdown',
  HTML: 'html',
  JSON: 'json',
  AUDIO: 'audio',
  VIDEO: 'video',
  PPTX: 'pptx'
};
