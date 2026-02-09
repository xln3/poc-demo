// T1-T4 威胁分类体系 (来自 ATTACK-TAXONOMY.md)

export const ThreatCategory = {
  T1: { id: 'T1', label: '对话攻击', desc: '载荷通过指令通道' },
  T2: { id: 'T2', label: '数据注入', desc: '载荷通过数据通道' },
  T3: { id: 'T3', label: '系统漏洞', desc: '绕过AI直攻系统' },
  T4: { id: 'T4', label: '模型固有', desc: '无攻击者' },
};

export const ThreatSubcategory = {
  'T1.1': { parent: 'T1', label: '指令注入' },
  'T1.2': { parent: 'T1', label: '对齐绕过' },
  'T1.3': { parent: 'T1', label: '多轮操纵' },
  'T1.4': { parent: 'T1', label: '信息套取' },
  'T2.1': { parent: 'T2', label: '文档注入' },
  'T2.2': { parent: 'T2', label: 'Web/邮件注入' },
  'T2.3': { parent: 'T2', label: '工具返回值注入' },
  'T2.4': { parent: 'T2', label: '知识库注入' },
  'T2.5': { parent: 'T2', label: '供应链注入' },
  'T2.6': { parent: 'T2', label: '跨Agent注入' },
  'T3.1': { parent: 'T3', label: '认证绕过' },
  'T3.2': { parent: 'T3', label: '协议缺陷' },
  'T3.3': { parent: 'T3', label: '配置利用' },
  'T3.4': { parent: 'T3', label: '凭证存储缺陷' },
  'T4.1': { parent: 'T4', label: '输出安全' },
  'T4.2': { parent: 'T4', label: '行为可控' },
  'T4.3': { parent: 'T4', label: '自主决策' },
};

// 风险目标
export const RiskGoal = {
  G1: { id: 'G1', label: '机密性', desc: '不应被获取的信息被泄露' },
  G2: { id: 'G2', label: '完整性', desc: 'Agent 产生非预期行为或不正确的输出' },
  G3: { id: 'G3', label: '可用性', desc: 'Agent 的正常服务能力受损' },
};
