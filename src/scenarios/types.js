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

// 新增: 能力层级枚举（按复杂度递进）
export const CapabilityLevel = {
  CONVERSATION: 'F1-conversation',
  FILE_INJECTION: 'F2-file-injection',
  TOOL_USE: 'F3-tool-use',
  RAG: 'F4-rag',
  MCP: 'F5-mcp'
};

// 能力层级中文名（前端显示用）
export const CapabilityLevelNames = {
  'F1-conversation': '文字对话',
  'F2-file-injection': '文件解析',
  'F3-tool-use': '终端运行',
  'F4-rag': 'RAG知识',
  'F5-mcp': 'MCP连接'
};

// @deprecated 旧枚举，保留向后兼容
export const ScenarioCategory = {
  BUSINESS: 'business',      // → F1-conversation
  SYSTEM: 'system',          // → F3-tool-use
  INDUSTRY: 'industry',      // → F3/F4
  INDIRECT: 'indirect'       // → F2-file-injection
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
