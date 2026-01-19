import { useState, useEffect, useRef } from 'react';
import { CONFIG, ATTACK_TYPES, RISK_LEVELS, LOG_TYPES } from './config';
import { SCENARIOS } from './scenarios';

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

    // 显示用户消息
    const userMsg = { role: 'user', content: attack.testPayload, isInjection: true };
    setMessages([userMsg]);

    // 添加日志
    const modelName = CONFIG.models.find(m => m.id === selectedModel)?.name || selectedModel;
    setLogs([
      { type: 'data', content: `发送测试 Payload...`, status: 'normal' },
      { type: 'tool', content: `模型: ${modelName}`, status: 'normal' },
    ]);

    try {
      const response = await CONFIG.callModel(
        [{ role: 'user', content: attack.testPayload }],
        scenario.systemPrompt,
        selectedModel
      );
      
      setRealResponse(response);

      // 显示模型响应
      const agentMsg = { role: 'agent', content: response };
      setMessages(prev => [...prev, agentMsg]);

      // 添加日志：收到响应
      setLogs(prev => [
        ...prev,
        { type: 'data', content: `收到响应 (${response.length} 字符)`, status: 'normal' },
        { type: 'tool', content: `正在使用 ${CONFIG.judgeModel} 评判攻击结果...`, status: 'normal' }
      ]);

      // 调用评判模型
      const judgeResult = await CONFIG.judgeAttackSuccess(attack, scenario.systemPrompt, response);

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
              <span className="text-xs text-yellow-400 animate-pulse">● 请求中...</span>
            )}
          </div>
        </div>

        {/* 真实测试模式控制面板 */}
        {mode === 'real' && (
          <div className="mb-4 p-3 bg-slate-800 rounded-lg">
            <div className="flex items-center gap-4 mb-3">
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
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">测试 Payload（点击执行发送给真实模型）</span>
              <button
                onClick={runRealTest}
                disabled={apiStatus === 'loading'}
                className={`px-4 py-1.5 rounded text-xs font-medium transition ${
                  apiStatus === 'loading' 
                    ? 'bg-slate-600 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {apiStatus === 'loading' ? '⏳ 请求中...' : '▶️ 执行测试'}
              </button>
            </div>
            <pre className="text-xs bg-slate-900 p-2 rounded overflow-x-auto custom-scroll text-orange-300">
              {currentAttack.testPayload}
            </pre>
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
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700 flex-shrink-0">
              <span className="text-xs text-slate-400">🖥️ 系统后台日志</span>
              <span className="text-xs text-slate-500">({logs.length})</span>
            </div>
            <div ref={logRef} className="flex-1 overflow-y-auto custom-scroll space-y-1 font-mono text-xs pr-1">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`p-2 rounded border-l-2 ${
                    log.status === 'normal' ? 'bg-slate-700/50 border-slate-500' :
                    log.status === 'warning' ? 'bg-yellow-900/30 border-yellow-500' :
                    log.status === 'bypassed' ? 'bg-orange-900/30 border-orange-500' :
                    'bg-red-900/30 border-red-500'
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