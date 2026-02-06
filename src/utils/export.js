import { SCENARIOS } from '../scenarios/index.js';
import { CONFIG, ATTACK_TYPES, RISK_LEVELS } from '../config';

/**
 * Export attack scenario report as JSON
 */
export const exportReport = () => {
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
  URL.revokeObjectURL(url);
};

/**
 * Export test result as JSON
 * @param {Object} lastTestResult - The last test result object
 * @param {Array} logs - The logs array
 */
export const exportTestResult = (lastTestResult, logs) => {
  if (!lastTestResult) {
    alert('暂无测试结果，请先执行真实测试');
    return;
  }

  const result = {
    ...lastTestResult,
    exportedAt: new Date().toISOString(),
    logs: logs
  };

  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-result-${lastTestResult.attack.id}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export attack demo as standalone HTML file
 * @param {Object} params - Parameters
 * @param {Object} params.attack - Current attack object
 * @param {Object} params.scenario - Current scenario object
 * @param {Object} params.attackType - Attack type configuration
 * @param {Object} params.riskLevel - Risk level configuration
 */
export const exportHTML = ({ attack, scenario, attackType, riskLevel }) => {
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
<div class="title">${attack.name}—${scenario.name}</div>
<div class="desc">${attack.description}</div>
<div class="tags"><span class="tag tag-type">${attackType.icon} ${attackType.label}</span><span class="tag tag-level">危害等级：${riskLevel.label}</span></div>
<div class="container">
<div class="panel"><div class="panel-title">🤖 被测模型：${CONFIG.api.model}</div><div class="chat" id="chat"></div></div>
<div class="panel"><div class="panel-title">终端运行日志</div><div id="logs"></div></div>
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
      const sp=document.createElement('span');sp.className='log-label';sp.textContent='['+({query:'查询',rule:'规则',tool:'工具',data:'数据',alert:'告警'}[l.type]||l.type)+']';
      ld.appendChild(sp);ld.appendChild(document.createTextNode(l.content));
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
    const sp2=document.createElement('span');sp2.className='log-label';sp2.textContent='['+({query:'查询',rule:'规则',tool:'工具',data:'数据',alert:'告警'}[l.type]||l.type)+']';
    ld.appendChild(sp2);ld.appendChild(document.createTextNode(l.content));
    logsEl.appendChild(ld);
  }
}
play();
</script></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${attack.id}-${attack.name}.html`; a.click();
  URL.revokeObjectURL(url);
};
