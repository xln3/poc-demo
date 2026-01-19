import { useState, useEffect, useRef, useCallback } from 'react';
import { CONFIG, ATTACK_TYPES, RISK_LEVELS, LOG_TYPES } from './config';
import { SCENARIOS } from './scenarios/index.js';
import { sandboxClient, ImageType, ToolType, TOOL_DESCRIPTIONS } from './sandbox.js';

// 按攻击类型重组数据
const getGroupedData = () => {
  const grouped = {};
  Object.entries(ATTACK_TYPES).forEach(([typeKey, typeInfo]) => {
    grouped[typeKey] = { ...typeInfo, scenarios: {} };
    Object.entries(SCENARIOS).forEach(([scenarioKey, scenario]) => {
      const attacks = scenario.attacks.filter(a => a.type === typeKey);
      if (attacks.length > 0) {
        grouped[typeKey].scenarios[scenarioKey] = { ...scenario, attacks };
      }
    });
  });
  return grouped;
};

export default function App() {
  // 状态
  const [mode, setMode] = useState('mock'); // 'mock' | 'real'
  const [selectedAttack, setSelectedAttack] = useState({ scenario: 'loan', index: 0 });
  const [expanded, setExpanded] = useState({ type: 'integrity', scenario: 'loan' });
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [typingMsg, setTypingMsg] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [apiError, setApiError] = useState('');
  const [realResponse, setRealResponse] = useState('');
  const [selectedModel, setSelectedModel] = useState(CONFIG.models[0].id);
  const [documentReadme, setDocumentReadme] = useState('');
  const [showDocument, setShowDocument] = useState(true);
  const [docTab, setDocTab] = useState('info'); // 'info' | 'readme'
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [isEditingLlmConfig, setIsEditingLlmConfig] = useState(false);
  const [customTestPayload, setCustomTestPayload] = useState('');
  const [isEditingPayload, setIsEditingPayload] = useState(false);
  const [payloadFiles, setPayloadFiles] = useState([]);

  // Sandbox states
  const [sandboxEnabled, setSandboxEnabled] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'running' | 'error'
  const [sandboxImage, setSandboxImage] = useState(ImageType.PYTHON);
  const [containerInfo, setContainerInfo] = useState(null);
  const [sandboxAvailable, setSandboxAvailable] = useState(false);
  const [toolCommand, setToolCommand] = useState('');
  const [toolResult, setToolResult] = useState(null);
  const [showSandboxPanel, setShowSandboxPanel] = useState(true);

  // LLM 参数配置 (所有模式共享)
  const [llmTemperature, setLlmTemperature] = useState(CONFIG.llmParams.temperature);
  const [llmMaxTokens, setLlmMaxTokens] = useState(CONFIG.llmParams.max_tokens);
  const [llmTopP, setLlmTopP] = useState(CONFIG.llmParams.top_p);

  // API 请求计时器
  const [apiStartTime, setApiStartTime] = useState(null);
  const [apiElapsedTime, setApiElapsedTime] = useState(0);

  const chatRef = useRef(null);
  const logRef = useRef(null);
  const abortRef = useRef(false);

  const groupedData = getGroupedData();
  const currentScenario = SCENARIOS[selectedAttack.scenario];
  const currentAttack = currentScenario.attacks[selectedAttack.index];
  const attackType = ATTACK_TYPES[currentAttack.type];
  const riskLevel = RISK_LEVELS[currentAttack.level];

  // 自动滚动
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typingMsg]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  // 检查 sandbox 服务是否可用
  useEffect(() => {
    const checkSandbox = async () => {
      const available = await sandboxClient.healthCheck();
      setSandboxAvailable(available);
    };
    checkSandbox();
    // 每 30 秒检查一次
    const interval = setInterval(checkSandbox, 30000);
    return () => clearInterval(interval);
  }, []);

  // API 请求计时器
  useEffect(() => {
    if (apiStatus === 'loading') {
      // 开始计时 - 使用本地变量捕获开始时间
      const startTime = Date.now();
      setApiStartTime(startTime);
      setApiElapsedTime(0);

      // 每 100ms 更新一次显示时间
      const interval = setInterval(() => {
        setApiElapsedTime(Date.now() - startTime);
      }, 100);

      return () => clearInterval(interval);
    } else {
      // 请求结束，重置计时器
      setApiStartTime(null);
      setApiElapsedTime(0);
    }
  }, [apiStatus]);

  // Sandbox WebSocket 日志回调
  const handleSandboxLog = useCallback((log) => {
    setLogs(prev => [...prev, {
      type: log.type,
      content: log.content,
      status: log.status,
      timestamp: log.timestamp,
      details: log.details,
    }]);
  }, []);

  // 启动容器
  const startContainer = async () => {
    setSandboxStatus('connecting');
    try {
      const info = await sandboxClient.createContainer(sandboxImage);
      setContainerInfo(info);
      setSandboxStatus('running');

      // 连接 WebSocket 获取实时日志
      sandboxClient.connectLogs(handleSandboxLog, (error) => {
        console.error('Sandbox WebSocket error:', error);
      });

      setLogs(prev => [...prev, {
        type: 'container',
        content: `容器已启动: ${info.container_id} (${info.image})`,
        status: 'success',
      }]);
    } catch (error) {
      setSandboxStatus('error');
      setLogs(prev => [...prev, {
        type: 'error',
        content: `容器启动失败: ${error.message}`,
        status: 'danger',
      }]);
    }
  };

  // 停止容器
  const stopContainer = async () => {
    sandboxClient.disconnectLogs();
    try {
      await sandboxClient.destroyContainer();
      setContainerInfo(null);
      setSandboxStatus('disconnected');
      setLogs(prev => [...prev, {
        type: 'container',
        content: '容器已停止',
        status: 'warning',
      }]);
    } catch (error) {
      setLogs(prev => [...prev, {
        type: 'error',
        content: `容器停止失败: ${error.message}`,
        status: 'danger',
      }]);
    }
  };

  // 执行 shell 命令
  const executeCommand = async () => {
    if (!toolCommand.trim() || sandboxStatus !== 'running') return;

    setToolResult(null);
    setLogs(prev => [...prev, {
      type: 'tool',
      content: `执行命令: ${toolCommand}`,
      status: 'normal',
    }]);

    try {
      const result = await sandboxClient.runCommand(toolCommand);
      setToolResult(result);

      if (result.success) {
        const output = result.result;
        setLogs(prev => [...prev, {
          type: 'tool',
          content: `命令完成 (exit: ${output.exit_code})`,
          status: output.exit_code === 0 ? 'success' : 'warning',
        }]);
      } else {
        setLogs(prev => [...prev, {
          type: 'error',
          content: `命令失败: ${result.error}`,
          status: 'danger',
        }]);
      }
    } catch (error) {
      setLogs(prev => [...prev, {
        type: 'error',
        content: `执行错误: ${error.message}`,
        status: 'danger',
      }]);
    }
  };

  // 清理：组件卸载时断开 WebSocket
  useEffect(() => {
    return () => {
      sandboxClient.disconnectLogs();
    };
  }, []);

  // 加载恶意文档说明文件
  useEffect(() => {
    if (currentAttack.documentReadme) {
      fetch(currentAttack.documentReadme)
        .then(res => res.text())
        .then(setDocumentReadme)
        .catch(() => setDocumentReadme(''));
    } else {
      setDocumentReadme('');
    }
  }, [currentAttack]);

  // 切换时重置
  useEffect(() => {
    abortRef.current = true;
    setMessages([]);
    setLogs([]);
    setTypingMsg(null);
    setIsPlaying(false);
    setRealResponse('');
    setApiStatus('idle');
    setApiError('');
    // 切换场景时重置系统提示词为默认值
    setCustomSystemPrompt(currentScenario.systemPrompt || '');
    setIsEditingLlmConfig(false);
    // 切换场景时重置测试 payload 为默认值
    setCustomTestPayload(currentAttack.testPayload || '');
    setIsEditingPayload(false);
    // 重置添加的文件
    setPayloadFiles([]);

    if (mode === 'mock') {
      const timer = setTimeout(() => {
        abortRef.current = false;
        playMockAttack();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedAttack, mode]);

  // Mock 模式播放
  const playMockAttack = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    const attack = SCENARIOS[selectedAttack.scenario].attacks[selectedAttack.index];
    let logIdx = 0;
    const logsPerMsg = Math.ceil(attack.logs.length / attack.conversations.length);

    for (const conv of attack.conversations) {
      if (abortRef.current) break;
      
      for (let i = 0; i <= conv.content.length; i++) {
        if (abortRef.current) break;
        setTypingMsg({ ...conv, content: conv.content.slice(0, i) });
        await new Promise(r => setTimeout(r, CONFIG.typingSpeed));
      }
      if (abortRef.current) break;
      
      setTypingMsg(null);
      setMessages(prev => [...prev, conv]);
      
      const logsToAdd = attack.logs.slice(logIdx, logIdx + logsPerMsg);
      for (const log of logsToAdd) {
        if (abortRef.current) break;
        await new Promise(r => setTimeout(r, CONFIG.logDelay));
        setLogs(prev => [...prev, log]);
      }
      logIdx += logsPerMsg;
      await new Promise(r => setTimeout(r, CONFIG.stepDelay));
    }
    
    while (logIdx < attack.logs.length && !abortRef.current) {
      await new Promise(r => setTimeout(r, CONFIG.logDelay));
      setLogs(prev => [...prev, attack.logs[logIdx]]);
      logIdx++;
    }
    setIsPlaying(false);
  };

  // 真实 API 测试
  const runRealTest = async () => {
    const attack = currentAttack;
    const scenario = currentScenario;

    setApiStatus('loading');
    setApiError('');
    setRealResponse('');
    setMessages([]);
    setLogs([]);

    // 构建实际发送的 payload
    // 优先级：用户添加的文件 + 自定义 payload > 攻击的 realTestPayload > 攻击的 testPayload
    let actualPayload;
    const hasUserFiles = payloadFiles.length > 0;
    const hasCustomPayload = customTestPayload !== currentAttack.testPayload;

    if (hasUserFiles || hasCustomPayload) {
      // 用户有自定义内容，发送实际文件内容
      actualPayload = getActualPayload();
    } else {
      // 使用攻击原有的 payload
      actualPayload = attack.realTestPayload || attack.testPayload;
    }
    const hasFileContent = !!attack.realTestPayload || hasUserFiles;

    // 显示用户消息（显示简化版，但实际发送完整版）
    const userMsg = {
      role: 'user',
      content: hasFileContent ? attack.testPayload : actualPayload,
      isInjection: true,
      injectionSource: attack.documentFileName ? `📄 ${attack.documentFileName}` : undefined
    };
    setMessages([userMsg]);

    // 添加日志
    const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
    const initialLogs = [
      { type: 'tool', content: `模型: ${modelName}`, status: 'normal' },
    ];
    if (hasUserFiles) {
      initialLogs.push({ type: 'data', content: `已添加 ${payloadFiles.length} 个文件: ${payloadFiles.map(f => f.name).join(', ')}`, status: 'normal' });
    }
    if (attack.realTestPayload && !hasUserFiles && !hasCustomPayload) {
      initialLogs.push({ type: 'data', content: `解析文件: ${attack.documentFileName}`, status: 'normal' });
      initialLogs.push({ type: 'alert', content: `⚠️ 文件包含隐藏的恶意内容`, status: 'warning' });
    }
    initialLogs.push({ type: 'data', content: `发送 Payload (${actualPayload.length} 字符)...`, status: 'normal' });
    setLogs(initialLogs);

    // 获取实际使用的系统提示词（自定义或默认）
    const activeSystemPrompt = customSystemPrompt || scenario.systemPrompt;

    try {
      const response = await CONFIG.callModel(
        [{ role: 'user', content: actualPayload }],
        activeSystemPrompt,
        selectedModel,
        { temperature: llmTemperature, max_tokens: llmMaxTokens, top_p: llmTopP }
      );

      // Extract content from response object (handles both old string format and new object format)
      const responseContent = typeof response === 'object' ? response.content : response;
      const apiTime = typeof response === 'object' ? response.timing.totalTime : null;

      setRealResponse(responseContent);

      // 显示模型响应
      const agentMsg = { role: 'agent', content: responseContent };
      setMessages(prev => [...prev, agentMsg]);

      // 添加日志：收到响应 + timing
      setLogs(prev => [
        ...prev,
        { type: 'data', content: `收到响应 (${responseContent.length} 字符)`, status: 'normal' },
        ...(apiTime ? [{ type: 'data', content: `⏱️ API 耗时: ${apiTime}ms`, status: 'normal' }] : []),
        { type: 'tool', content: `正在使用 ${CONFIG.judgeModel} 评判攻击结果...`, status: 'normal' }
      ]);

      // 调用评判模型（传入实际发送的 payload）
      const judgeResult = await CONFIG.judgeAttackSuccess(attack, activeSystemPrompt, responseContent, actualPayload);

      setApiStatus('success');

      // 根据评判结果添加日志
      if (judgeResult.success === true) {
        setLogs(prev => [
          ...prev,
          { type: 'alert', content: `🚨 攻击成功！${judgeResult.reason}`, status: 'danger' }
        ]);
        // 标记响应为危险
        setMessages(prev => prev.map((msg, idx) =>
          idx === prev.length - 1 ? { ...msg, isDangerous: true } : msg
        ));
      } else if (judgeResult.success === false) {
        setLogs(prev => [
          ...prev,
          { type: 'rule', content: `✅ 攻击失败：${judgeResult.reason}`, status: 'normal' }
        ]);
      } else {
        setLogs(prev => [
          ...prev,
          { type: 'alert', content: `⚠️ 评判不确定：${judgeResult.reason}`, status: 'warning' }
        ]);
      }

    } catch (error) {
      setApiStatus('error');
      setApiError(error.message);
      setLogs(prev => [
        ...prev,
        { type: 'alert', content: `🚨 API 错误: ${error.message}`, status: 'danger' }
      ]);
    }
  };

  const selectAttack = (scenarioKey, idx) => {
    const scenario = SCENARIOS[scenarioKey];
    const attack = scenario.attacks[idx];
    setExpanded({ type: attack.type, scenario: scenarioKey });
    setSelectedAttack({ scenario: scenarioKey, index: scenario.attacks.findIndex(a => a.id === attack.id) });
  };

  const toggleType = (type) => setExpanded(prev => ({ ...prev, type: prev.type === type ? null : type }));
  const toggleScenario = (scenario) => setExpanded(prev => ({ ...prev, scenario: prev.scenario === scenario ? null : scenario }));

  // 文件处理函数
  const handleAddFile = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const content = await file.text();
      setPayloadFiles(prev => [...prev, { name: file.name, content }]);
    }
    e.target.value = ''; // 重置 input 以便再次选择同一文件
  };

  const removePayloadFile = (index) => {
    setPayloadFiles(prev => prev.filter((_, i) => i !== index));
  };

  // 获取显示的 Payload（文件名 + 用户输入）
  const getDisplayPayload = () => {
    if (payloadFiles.length === 0) return customTestPayload;
    const fileNames = payloadFiles.map(f => `[文件: ${f.name}]`).join('\n');
    return `${fileNames}\n\n${customTestPayload}`;
  };

  // 获取实际发送的 Payload（文件内容 + 用户输入）
  const getActualPayload = () => {
    if (payloadFiles.length === 0) return customTestPayload;
    const fileContents = payloadFiles.map(f => `=== ${f.name} ===\n${f.content}`).join('\n\n');
    return `${fileContents}\n\n${customTestPayload}`;
  };

  // 导出报告
  const exportReport = () => {
    const report = {
      title: "LLM Agent 安全攻击场景测试报告",
      generatedAt: new Date().toISOString(),
      model: CONFIG.api.model,
      scenarios: Object.entries(SCENARIOS).map(([key, s]) => ({
        name: s.name,
        attacks: s.attacks.map(a => ({
          id: a.id, name: a.name,
          type: ATTACK_TYPES[a.type].label,
          level: RISK_LEVELS[a.level].label,
          description: a.description,
          testPayload: a.testPayload
        }))
      })),
      totalAttacks: Object.values(SCENARIOS).reduce((a, s) => a + s.attacks.length, 0)
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'attack-report.json'; a.click();
  };

  // 导出 HTML
  const exportHTML = () => {
    const attack = currentAttack;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${attack.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f172a;color:#fff;font-family:system-ui;padding:20px}
.title{font-size:20px;font-weight:bold;margin-bottom:10px}
.desc{color:#94a3b8;font-size:14px;margin-bottom:15px}
.tags{display:flex;gap:8px;margin-bottom:20px}
.tag{padding:4px 10px;border-radius:4px;font-size:12px}
.tag-type{background:#7c3aed;color:#fff}
.tag-level{background:#dc2626;color:#fff}
.container{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.panel{background:#1e293b;border-radius:8px;padding:15px}
.panel-title{font-size:14px;color:#94a3b8;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #334155}
.chat{min-height:300px}
.msg{max-width:85%;padding:10px 14px;border-radius:12px;margin-bottom:8px;font-size:13px;white-space:pre-wrap;opacity:0;animation:fadeIn 0.3s forwards}
.msg-user{background:#2563eb;margin-left:auto;border-bottom-right-radius:4px}
.msg-agent{background:#334155;border-bottom-left-radius:4px}
.msg-injection{background:rgba(127,29,29,0.5);border:1px solid rgba(239,68,68,0.5)}
.msg-danger{background:rgba(124,58,0,0.5);border:1px solid rgba(249,115,22,0.5)}
.log{padding:8px;border-radius:4px;margin-bottom:4px;font-size:12px;font-family:monospace;border-left:2px solid;opacity:0;animation:fadeIn 0.3s forwards}
.log-normal{background:rgba(51,65,85,0.5);border-color:#64748b}
.log-warning{background:rgba(113,63,18,0.3);border-color:#eab308}
.log-bypassed{background:rgba(124,45,18,0.3);border-color:#f97316}
.log-danger{background:rgba(127,29,29,0.3);border-color:#ef4444}
.log-label{display:inline-block;width:50px}
@keyframes fadeIn{to{opacity:1}}
</style></head><body>
<div class="title">${attack.name}—${currentScenario.name}</div>
<div class="desc">${attack.description}</div>
<div class="tags"><span class="tag tag-type">${attackType.icon} ${attackType.label}</span><span class="tag tag-level">危害等级：${riskLevel.label}</span></div>
<div class="container">
<div class="panel"><div class="panel-title">🤖 被测模型：${CONFIG.api.model}</div><div class="chat" id="chat"></div></div>
<div class="panel"><div class="panel-title">🖥️ 系统后台日志</div><div id="logs"></div></div>
</div>
<script>
const msgs=${JSON.stringify(attack.conversations)};
const logs=${JSON.stringify(attack.logs)};
const chat=document.getElementById('chat');
const logsEl=document.getElementById('logs');
let msgIdx=0,logIdx=0;
const logsPerMsg=Math.ceil(logs.length/msgs.length);
async function play(){
  for(const m of msgs){
    const div=document.createElement('div');
    div.className='msg msg-'+(m.role==='user'?'user':'agent')+(m.isInjection?' msg-injection':'')+(m.isDangerous?' msg-danger':'');
    chat.appendChild(div);
    for(let i=0;i<=m.content.length;i++){div.textContent=m.content.slice(0,i);await new Promise(r=>setTimeout(r,18));}
    for(let i=0;i<logsPerMsg&&logIdx<logs.length;i++,logIdx++){
      await new Promise(r=>setTimeout(r,350));
      const l=logs[logIdx];
      const ld=document.createElement('div');
      ld.className='log log-'+l.status;
      ld.innerHTML='<span class="log-label">['+{query:'查询',rule:'规则',tool:'工具',data:'数据',alert:'告警'}[l.type]+']</span>'+l.content;
      logsEl.appendChild(ld);
    }
    await new Promise(r=>setTimeout(r,600));
    msgIdx++;
  }
  while(logIdx<logs.length){
    await new Promise(r=>setTimeout(r,350));
    const l=logs[logIdx++];
    const ld=document.createElement('div');
    ld.className='log log-'+l.status;
    ld.innerHTML='<span class="log-label">['+{query:'查询',rule:'规则',tool:'工具',data:'数据',alert:'告警'}[l.type]+']</span>'+l.content;
    logsEl.appendChild(ld);
  }
}
play();
</script></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${attack.id}-${attack.name}.html`; a.click();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex text-sm">
      {/* 滚动条样式已移至 index.css */}
      
      {/* 左侧导航 */}
      <div className="w-64 bg-slate-800 p-3 overflow-y-auto custom-scroll flex-shrink-0 border-r border-slate-700">
        <h1 className="font-bold text-base mb-3">🛡️ 攻击场景库</h1>
        
        {/* 模式切换 */}
        <div className="mb-3 p-2 bg-slate-700 rounded">
          <div className="text-xs text-slate-400 mb-2">测试模式</div>
          <div className="flex gap-1">
            <button
              onClick={() => setMode('mock')}
              className={`flex-1 py-1.5 rounded text-xs transition ${
                mode === 'mock' ? 'bg-blue-600' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              📺 模拟演示
            </button>
            <button
              onClick={() => setMode('real')}
              className={`flex-1 py-1.5 rounded text-xs transition ${
                mode === 'real' ? 'bg-green-600' : 'bg-slate-600 hover:bg-slate-500'
              }`}
            >
              🔬 真实测试
            </button>
          </div>
        </div>

        {/* 沙箱控制 */}
        <div className="mb-3 p-2 bg-slate-700 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">🐳 沙箱环境</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              !sandboxAvailable ? 'bg-slate-600 text-slate-400' :
              sandboxStatus === 'running' ? 'bg-green-600 text-white' :
              sandboxStatus === 'connecting' ? 'bg-yellow-600 text-white' :
              sandboxStatus === 'error' ? 'bg-red-600 text-white' :
              'bg-slate-600 text-slate-300'
            }`}>
              {!sandboxAvailable ? '离线' :
               sandboxStatus === 'running' ? '运行中' :
               sandboxStatus === 'connecting' ? '启动中' :
               sandboxStatus === 'error' ? '错误' : '未启动'}
            </span>
          </div>

          {sandboxAvailable ? (
            <>
              {sandboxStatus !== 'running' && (
                <div className="mb-2">
                  <select
                    value={sandboxImage}
                    onChange={(e) => setSandboxImage(e.target.value)}
                    className="w-full bg-slate-600 text-white text-xs px-2 py-1 rounded border border-slate-500 focus:outline-none"
                    disabled={sandboxStatus === 'connecting'}
                  >
                    <option value={ImageType.PYTHON}>🐍 Python 3.11</option>
                    <option value={ImageType.UBUNTU}>🐧 Ubuntu 22.04</option>
                    <option value={ImageType.NODE}>📦 Node 20</option>
                  </select>
                </div>
              )}

              <div className="flex gap-1">
                {sandboxStatus === 'running' ? (
                  <button
                    onClick={stopContainer}
                    className="flex-1 py-1.5 rounded text-xs bg-red-600 hover:bg-red-500 transition"
                  >
                    ⏹️ 停止容器
                  </button>
                ) : (
                  <button
                    onClick={startContainer}
                    disabled={sandboxStatus === 'connecting'}
                    className={`flex-1 py-1.5 rounded text-xs transition ${
                      sandboxStatus === 'connecting'
                        ? 'bg-slate-600 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    {sandboxStatus === 'connecting' ? '⏳ 启动中...' : '▶️ 启动容器'}
                  </button>
                )}
              </div>

              {containerInfo && sandboxStatus === 'running' && (
                <div className="mt-2 text-xs text-slate-400 font-mono">
                  <div>ID: {containerInfo.container_id}</div>
                  <div>Session: {containerInfo.session_id}</div>
                </div>
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500 text-center py-2">
              <div>后端服务未运行</div>
              <div className="mt-1 text-slate-600">cd backend && ./run.sh</div>
            </div>
          )}
        </div>

        {/* 导出按钮 */}
        <div className="mb-3">
          <button
            onClick={() => setShowExport(!showExport)}
            className="w-full text-xs px-2 py-1.5 bg-slate-700 hover:bg-slate-600 rounded"
          >
            📤 导出功能
          </button>
          {showExport && (
            <div className="mt-2 p-2 bg-slate-700 rounded text-xs space-y-2">
              <button onClick={exportReport} className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 rounded">
                📄 测试报告 (JSON)
              </button>
              <button onClick={exportHTML} className="w-full py-1.5 bg-green-600 hover:bg-green-500 rounded">
                🎬 当前演示 (HTML)
              </button>
            </div>
          )}
        </div>
        
        {/* 层级列表 */}
        {Object.entries(groupedData).map(([typeKey, typeData]) => (
          <div key={typeKey} className="mb-2">
            <button
              onClick={() => toggleType(typeKey)}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-medium ${
                expanded.type === typeKey ? 'bg-slate-700' : 'hover:bg-slate-700/50'
              }`}
            >
              <span>{typeData.icon} {typeData.label}</span>
              <span className="text-slate-500">{expanded.type === typeKey ? '−' : '+'}</span>
            </button>

            {expanded.type === typeKey && (
              <div className="ml-2 mt-1">
                {Object.entries(typeData.scenarios).map(([scenarioKey, scenario]) => (
                  <div key={scenarioKey} className="mb-1">
                    <button
                      onClick={() => toggleScenario(scenarioKey)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs ${
                        expanded.scenario === scenarioKey ? 'bg-slate-600' : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <span>{scenario.icon} {scenario.name}</span>
                      <span className="text-slate-500">{expanded.scenario === scenarioKey ? '−' : '+'}</span>
                    </button>

                    {expanded.scenario === scenarioKey && (
                      <div className="ml-3 mt-1 space-y-0.5">
                        {scenario.attacks.map((attack) => {
                          const originalIdx = SCENARIOS[scenarioKey].attacks.findIndex(a => a.id === attack.id);
                          const isSelected = selectedAttack.scenario === scenarioKey && selectedAttack.index === originalIdx;
                          return (
                            <button
                              key={attack.id}
                              onClick={() => selectAttack(scenarioKey, originalIdx)}
                              className={`w-full text-left px-2 py-1 rounded text-xs truncate ${
                                isSelected ? 'bg-blue-600' : 'hover:bg-slate-700/50 text-slate-300'
                              }`}
                            >
                              {attack.id} {attack.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-slate-700 text-xs text-slate-500">
          共 {Object.values(SCENARIOS).reduce((a, s) => a + s.attacks.length, 0)} 个场景
        </div>
      </div>
      
      {/* 右侧主区域 */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {/* 标题区 */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-bold">{currentAttack.name}—{currentScenario.name}</h2>
            {mode === 'real' && (
              <span className="px-2 py-0.5 bg-green-600 rounded text-xs">🔬 真实测试模式</span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{currentAttack.description}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs text-white ${attackType.color}`}>
              {attackType.icon} {attackType.label}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs ${riskLevel.color}`}>
              危害等级：{riskLevel.label}
            </span>
            {mode === 'mock' && isPlaying && (
              <span className="text-xs text-green-400 animate-pulse">● 演示中</span>
            )}
            {mode === 'real' && apiStatus === 'loading' && (
              <span className="text-xs text-yellow-400 animate-pulse">● 请求中... {(apiElapsedTime / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>

        {/* 恶意文档预览 - 仅间接注入攻击显示 */}
        {currentAttack.documentFile && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg border border-slate-700">
            {/* 标题栏：文件名 + 下载按钮 + 折叠按钮 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-300">
                  📄 恶意文档示例
                </span>
                <a
                  href={currentAttack.documentFile}
                  download={currentAttack.documentFileName}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition flex items-center gap-1"
                >
                  ⬇️ 下载 {currentAttack.documentFileName}
                </a>
              </div>
              <button
                onClick={() => setShowDocument(!showDocument)}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
              >
                {showDocument ? '▼ 收起' : '▶ 展开'}
              </button>
            </div>

            {showDocument && (
              <>
                {/* Tab 切换 */}
                <div className="flex gap-1 mb-3">
                  <button
                    onClick={() => setDocTab('info')}
                    className={`px-3 py-1 text-xs rounded transition ${
                      docTab === 'info' ? 'bg-orange-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    🔍 攻击说明
                  </button>
                  <button
                    onClick={() => setDocTab('readme')}
                    className={`px-3 py-1 text-xs rounded transition ${
                      docTab === 'readme' ? 'bg-orange-600' : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    📋 攻击详情
                  </button>
                </div>

                {/* 攻击说明 Tab */}
                {docTab === 'info' && (
                  <div className="space-y-3">
                    {/* 攻击原理 */}
                    <div className="bg-slate-900 p-3 rounded">
                      <div className="text-xs text-orange-400 font-medium mb-2">⚠️ 攻击原理</div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {currentAttack.riskExplanation}
                      </p>
                    </div>

                    {/* 隐藏技术 */}
                    <div className="bg-slate-900 p-3 rounded">
                      <div className="text-xs text-red-400 font-medium mb-2">🔧 文件中的手脚（隐藏技术）</div>
                      <div className="flex flex-wrap gap-2">
                        {currentAttack.hidingTechniques?.map((tech, i) => (
                          <span key={i} className="px-2 py-1 text-xs bg-red-900/50 border border-red-500/30 rounded">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 下载提示 */}
                    <div className="bg-slate-900/50 p-3 rounded border border-dashed border-slate-600">
                      <div className="text-xs text-slate-400">
                        💡 <strong>查看隐藏内容：</strong>下载上方的恶意文件，使用对应工具查看隐藏内容：
                      </div>
                      <ul className="text-xs text-slate-500 mt-2 ml-4 list-disc space-y-1">
                        <li>PDF：使用文本编辑器或 PDF 调试工具查看隐藏文字层 / 元数据</li>
                        <li>DOCX：解压后查看 word/document.xml 或使用 VBA 查看隐藏文本</li>
                        <li>XLSX：使用 VBA 编辑器查看 veryHidden 工作表</li>
                        <li>图片：使用 exiftool 或十六进制编辑器查看 EXIF/注释段</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* 详细文档 Tab */}
                {docTab === 'readme' && (
                  <pre className="text-xs bg-slate-900 p-3 rounded overflow-auto max-h-80 custom-scroll whitespace-pre-wrap leading-relaxed">
                    {documentReadme.split('\n').map((line, i) => {
                      // 高亮标题行
                      if (line.startsWith('===') || line.startsWith('【')) {
                        return <span key={i} className="text-orange-400">{line}{'\n'}</span>;
                      }
                      // 高亮危险标记
                      if (line.includes('🔴') || line.includes('❌') || line.includes('SYSTEM') || line.includes('AI指令') || line.includes('AI-REVIEW')) {
                        return <span key={i} className="text-red-400">{line}{'\n'}</span>;
                      }
                      // 高亮说明性文字
                      if (line.startsWith('-') || line.startsWith('•')) {
                        return <span key={i} className="text-slate-400">{line}{'\n'}</span>;
                      }
                      return <span key={i} className="text-slate-300">{line}{'\n'}</span>;
                    })}
                  </pre>
                )}
              </>
            )}
          </div>
        )}

        {/* 真实测试模式控制面板 */}
        {mode === 'real' && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg">
            {/* 模型选择和执行按钮 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">选择模型：</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-slate-700 text-white text-xs px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500"
                >
                  {CONFIG.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={runRealTest}
                disabled={apiStatus === 'loading'}
                className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                  apiStatus === 'loading'
                    ? 'bg-slate-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {apiStatus === 'loading' ? `⏳ 请求中... ${(apiElapsedTime / 1000).toFixed(1)}s` : '▶️ 执行测试'}
              </button>
            </div>

            {/* LLM 配置和测试 Payload 并排显示 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* LLM 配置模块 */}
              <div className="bg-slate-900 rounded border border-slate-700 flex flex-col">
                {/* 标题栏 - 参数显示在标题行 */}
                <div className="flex items-center justify-between p-2 border-b border-slate-700">
                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <span className="text-slate-400 font-medium">LLM 配置</span>
                    {/* 参数内联显示/编辑 */}
                    <span className="text-slate-500">Temperature</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={llmTemperature}
                      onChange={(e) => setLlmTemperature(parseFloat(e.target.value) || 0)}
                      disabled={!isEditingLlmConfig}
                      className={`w-12 bg-slate-800 border rounded px-1 text-cyan-400 font-mono text-xs ${
                        isEditingLlmConfig ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    />
                    <span className="text-slate-500">Max Tokens</span>
                    <input
                      type="number"
                      min="256"
                      max="131072"
                      step="1024"
                      value={llmMaxTokens}
                      onChange={(e) => setLlmMaxTokens(parseInt(e.target.value) || 256)}
                      disabled={!isEditingLlmConfig}
                      className={`w-16 bg-slate-800 border rounded px-1 text-cyan-400 font-mono text-xs ${
                        isEditingLlmConfig ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    />
                    <span className="text-slate-500">Top P</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={llmTopP}
                      onChange={(e) => setLlmTopP(parseFloat(e.target.value) || 0)}
                      disabled={!isEditingLlmConfig}
                      className={`w-12 bg-slate-800 border rounded px-1 text-cyan-400 font-mono text-xs ${
                        isEditingLlmConfig ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    />
                    {customSystemPrompt !== currentScenario.systemPrompt && (
                      <span className="text-yellow-400">(已修改)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditingLlmConfig ? (
                      <>
                        <button
                          onClick={() => setIsEditingLlmConfig(false)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                        >
                          ✓ 保存
                        </button>
                        <button
                          onClick={() => {
                            setCustomSystemPrompt(currentScenario.systemPrompt || '');
                            setLlmTemperature(CONFIG.llmParams.temperature);
                            setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                            setLlmTopP(CONFIG.llmParams.top_p);
                            setIsEditingLlmConfig(false);
                          }}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          ✕ 重置
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditingLlmConfig(true)}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          ✏️ 修改
                        </button>
                        <button
                          onClick={() => {
                            setCustomSystemPrompt(currentScenario.systemPrompt || '');
                            setLlmTemperature(CONFIG.llmParams.temperature);
                            setLlmMaxTokens(CONFIG.llmParams.max_tokens);
                            setLlmTopP(CONFIG.llmParams.top_p);
                          }}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                        >
                          🔄 重置
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 内容区 - 系统提示词 */}
                <div className="p-2 flex-1">
                  {isEditingLlmConfig ? (
                    <textarea
                      value={customSystemPrompt}
                      onChange={(e) => setCustomSystemPrompt(e.target.value)}
                      className="w-full h-full min-h-[10.5rem] max-h-[10.5rem] text-xs bg-slate-800 p-2 rounded border border-blue-500 text-cyan-300 font-mono resize-none focus:outline-none custom-scroll"
                      placeholder="输入系统提示词..."
                    />
                  ) : (
                    <pre className="text-xs bg-slate-800 p-2 rounded overflow-auto max-h-[10.5rem] custom-scroll text-cyan-300 whitespace-pre-wrap">
                      {customSystemPrompt || '(无系统提示词)'}
                    </pre>
                  )}
                </div>
              </div>

              {/* 测试 Payload 模块 */}
              <div className="bg-slate-900 rounded border border-slate-700 flex flex-col">
                {/* 标题栏 */}
                <div className="flex items-center justify-between p-2 border-b border-slate-700">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">🎯 测试 Payload</span>
                    {(customTestPayload !== currentAttack.testPayload || payloadFiles.length > 0) && (
                      <span className="text-yellow-400">(已修改)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditingPayload && (
                      <label className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded cursor-pointer transition">
                        + 添加文件
                        <input type="file" className="hidden" onChange={handleAddFile} multiple />
                      </label>
                    )}
                    {isEditingPayload ? (
                      <>
                        <button
                          onClick={() => setIsEditingPayload(false)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                        >
                          ✓ 保存
                        </button>
                        <button
                          onClick={() => {
                            setCustomTestPayload(currentAttack.testPayload || '');
                            setPayloadFiles([]);
                            setIsEditingPayload(false);
                          }}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          ✕ 重置
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsEditingPayload(true)}
                          className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded transition"
                        >
                          ✏️ 修改
                        </button>
                        <button
                          onClick={() => {
                            setCustomTestPayload(currentAttack.testPayload || '');
                            setPayloadFiles([]);
                          }}
                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition"
                        >
                          🔄 重置
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* 文件列表（如果有） */}
                {payloadFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-2 pt-2">
                    {payloadFiles.map((file, i) => (
                      <span key={i} className="text-xs bg-slate-700 px-2 py-0.5 rounded flex items-center gap-1">
                        📄 {file.name}
                        {isEditingPayload && (
                          <button
                            onClick={() => removePayloadFile(i)}
                            className="text-red-400 hover:text-red-300 ml-1"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {/* 内容区 - Payload 文本 */}
                <div className="p-2 flex-1">
                  {isEditingPayload ? (
                    <textarea
                      value={customTestPayload}
                      onChange={(e) => setCustomTestPayload(e.target.value)}
                      className="w-full h-full min-h-[10.5rem] max-h-[10.5rem] text-xs bg-slate-800 p-2 rounded border border-blue-500 text-orange-300 font-mono resize-none focus:outline-none custom-scroll break-all"
                      placeholder="输入测试 Payload..."
                    />
                  ) : (
                    <pre className="text-xs bg-slate-800 p-2 rounded overflow-y-auto overflow-x-hidden max-h-[10.5rem] custom-scroll text-orange-300 whitespace-pre-wrap break-all">
                      {getDisplayPayload() || '(无 Payload)'}
                    </pre>
                  )}
                </div>
              </div>
            </div>

            {apiError && (
              <div className="mt-2 text-xs text-red-400">❌ {apiError}</div>
            )}
          </div>
        )}

        {/* 主面板 */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
          {/* 对话面板 */}
          <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
              <span className="text-xs text-slate-400">🤖 被测模型：</span>
              <span className="text-xs font-mono text-blue-400">
                {mode === 'real'
                  ? (CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel)
                  : CONFIG.api.model}
              </span>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto custom-scroll space-y-2 pr-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? msg.isInjection ? 'bg-red-900/50 border border-red-500/40' : 'bg-blue-600'
                      : msg.isDangerous ? 'bg-orange-900/50 border border-orange-500/40' : 'bg-slate-700'
                  }`}>
                    <pre className="whitespace-pre-wrap font-sans leading-relaxed">{msg.content}</pre>
                    {msg.isInjection && <div className="mt-1 text-red-300 text-xs">⚠️ 恶意注入</div>}
                    {msg.isDangerous && <div className="mt-1 text-orange-300 text-xs">⚠️ 危险输出</div>}
                  </div>
                </div>
              ))}
              {typingMsg && (
                <div className={`flex ${typingMsg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                    typingMsg.role === 'user'
                      ? typingMsg.isInjection ? 'bg-red-900/30 border border-red-500/30' : 'bg-blue-600/70'
                      : 'bg-slate-700/70'
                  }`}>
                    <span className="whitespace-pre-wrap font-sans leading-relaxed">{typingMsg.content}<span className="animate-pulse">▋</span></span>
                  </div>
                </div>
              )}
              {messages.length === 0 && !typingMsg && (
                <div className="text-slate-500 text-center py-8">
                  {mode === 'mock' ? '等待演示开始...' : '点击「执行测试」发送 Payload'}
                </div>
              )}
            </div>
          </div>
          
          {/* 日志面板 */}
          <div className="bg-slate-800 rounded-lg p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">🖥️ 系统后台日志</span>
                <span className="text-xs text-slate-500">({logs.length})</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded transition"
              >
                清空
              </button>
            </div>

            {/* 沙箱命令执行区 */}
            {sandboxStatus === 'running' && (
              <div className="mb-2 p-2 bg-slate-900 rounded border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-emerald-400">⚡ 沙箱命令</span>
                  <span className="text-xs text-slate-500 font-mono">{containerInfo?.image}</span>
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={toolCommand}
                    onChange={(e) => setToolCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        executeCommand();
                      }
                    }}
                    placeholder="输入命令，如: ls -la, python --version"
                    className="flex-1 text-xs bg-slate-800 px-2 py-1 rounded border border-slate-600 text-green-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={executeCommand}
                    disabled={!toolCommand.trim()}
                    className={`px-3 py-1 text-xs rounded transition ${
                      toolCommand.trim()
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-slate-700 cursor-not-allowed'
                    }`}
                  >
                    ▶️ 执行
                  </button>
                </div>
                {toolResult && (
                  <div className="mt-2 p-2 bg-slate-800 rounded text-xs font-mono">
                    <div className="text-slate-500 mb-1">
                      Exit: {toolResult.success ? toolResult.result?.exit_code : 'error'} |
                      {toolResult.execution_time_ms}ms
                    </div>
                    <pre className="text-green-300 whitespace-pre-wrap max-h-32 overflow-auto custom-scroll">
                      {toolResult.success
                        ? toolResult.result?.output || '(无输出)'
                        : toolResult.error}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div ref={logRef} className="flex-1 overflow-y-auto custom-scroll space-y-1 font-mono text-xs pr-1">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`p-2 rounded border-l-2 ${
                    log.status === 'normal' ? 'bg-slate-700/50 border-slate-500' :
                    log.status === 'success' ? 'bg-emerald-900/30 border-emerald-500' :
                    log.status === 'warning' ? 'bg-yellow-900/30 border-yellow-500' :
                    log.status === 'bypassed' ? 'bg-orange-900/30 border-orange-500' :
                    log.status === 'danger' ? 'bg-red-900/30 border-red-500' :
                    'bg-slate-700/50 border-slate-500'
                  }`}
                >
                  <span className={`inline-block w-12 ${LOG_TYPES[log.type]?.color || 'text-slate-400'}`}>
                    [{LOG_TYPES[log.type]?.label || log.type}]
                  </span>
                  <span className="text-slate-300 break-all">{log.content}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-slate-500 text-center py-8">等待日志...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}