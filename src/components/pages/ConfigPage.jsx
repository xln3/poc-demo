import ConfigPanel from '../ConfigPanel.jsx';

/**
 * ConfigPage - 配置 tab 主内容
 * Phase 1: 直接包装 ConfigPanel
 * Phase 2: 扩展沙箱终端管理、RAG/MCP 详细配置
 */
export default function ConfigPage({ appMode, configPanel }) {
  return <ConfigPanel appMode={appMode} {...configPanel} />;
}
