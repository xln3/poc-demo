// ============ 间接注入专用构建器 ============

import { AttackBuilder } from './AttackBuilder.js';

export class IndirectAttackBuilder extends AttackBuilder {
  constructor(id) {
    super(id);
  }

  static create(id) {
    return new IndirectAttackBuilder(id);
  }

  // 设置恶意文档信息
  document(file, readme, displayName) {
    this._attack.documentFile = file;
    this._attack.documentReadme = readme;
    this._attack.documentFileName = displayName;
    return this;
  }

  // 设置风险说明
  riskExplanation(explanation) {
    this._attack.riskExplanation = explanation;
    return this;
  }

  // 设置隐藏技术列表
  hidingTechniques(techniques) {
    this._attack.hidingTechniques = techniques;
    return this;
  }

  // 设置真实测试负载（模拟AI解析文档后看到的完整内容）
  realPayload(payload) {
    this._attack.realTestPayload = payload;
    return this;
  }

  // 设置真实信息与虚假信息对比
  realVsFake(real, fake) {
    this._attack.realVsFake = { real, fake };
    return this;
  }

  // 设置被遗漏的风险
  missedRisks(risks) {
    this._attack.missedRisks = risks;
    return this;
  }

  // 设置违规项（用于报销等场景）
  violations(violations) {
    this._attack.violations = violations;
    return this;
  }

  // 设置被遗漏的漏洞（用于代码审查场景）
  missedVulnerabilities(vulns) {
    this._attack.missedVulnerabilities = vulns;
    return this;
  }

  // 添加带注入源标记的用户消息
  injectedUserMessage(content, source) {
    this._attack.conversations.push({
      role: 'user',
      content,
      isInjection: true,
      injectionSource: source
    });
    return this;
  }

  // 添加危险的AI响应
  dangerousAgentMessage(content) {
    this._attack.conversations.push({
      role: 'agent',
      content,
      isDangerous: true
    });
    return this;
  }
}
