// ============ 基础攻击构建器 ============

import { LogStatus, LogType } from '../types.js';

export class AttackBuilder {
  constructor(id) {
    this._attack = {
      id,
      conversations: [],
      logs: []
    };
  }

  static create(id) {
    return new AttackBuilder(id);
  }

  name(name) {
    this._attack.name = name;
    return this;
  }

  type(type) {
    this._attack.type = type;
    return this;
  }

  level(level) {
    this._attack.level = level;
    return this;
  }

  description(desc) {
    this._attack.description = desc;
    return this;
  }

  payload(testPayload) {
    this._attack.testPayload = testPayload;
    return this;
  }

  // 添加对话消息
  userMessage(content, options = {}) {
    this._attack.conversations.push({
      role: 'user',
      content,
      ...options
    });
    return this;
  }

  agentMessage(content, options = {}) {
    this._attack.conversations.push({
      role: 'agent',
      content,
      ...options
    });
    return this;
  }

  // 添加日志 - 通用方法
  log(type, content, status) {
    this._attack.logs.push({ type, content, status });
    return this;
  }

  // 便捷日志方法
  logNormal(type, content) {
    return this.log(type, content, LogStatus.NORMAL);
  }

  logWarning(type, content) {
    return this.log(type, content, LogStatus.WARNING);
  }

  logBypassed(type, content) {
    return this.log(type, content, LogStatus.BYPASSED);
  }

  logDanger(type, content) {
    return this.log(type, content, LogStatus.DANGER);
  }

  // 快捷日志方法
  logQuery(content, status = LogStatus.NORMAL) {
    return this.log(LogType.QUERY, content, status);
  }

  logRule(content, status = LogStatus.NORMAL) {
    return this.log(LogType.RULE, content, status);
  }

  logTool(content, status = LogStatus.NORMAL) {
    return this.log(LogType.TOOL, content, status);
  }

  logData(content, status = LogStatus.NORMAL) {
    return this.log(LogType.DATA, content, status);
  }

  logAlert(content, status = LogStatus.WARNING) {
    return this.log(LogType.ALERT, content, status);
  }

  // 设置完整对话（直接传入数组）
  conversations(convs) {
    this._attack.conversations = convs;
    return this;
  }

  // 设置完整日志（直接传入数组）
  logs(logs) {
    this._attack.logs = logs;
    return this;
  }

  // 声明场景所需工具
  requiredTools(tools) {
    this._attack.requiredTools = tools;
    return this;
  }

  // 声明环境预置（文件、数据库等）
  toolSetup(setup) {
    this._attack.toolSetup = setup;
    return this;
  }

  build() {
    return this._attack;
  }
}
