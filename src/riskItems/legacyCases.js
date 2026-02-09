// 旧场景攻击映射到风险点
// riskItemId → [{scenario, attackIndex}]
// 基于 ATTACK-TAXONOMY.md 第 10 节映射表

export const LEGACY_CASE_MAP = {
  // #1 被用户利用执行有害或非法目的 (T1.2)
  1: [
    { scenario: 'loan',    attackIndex: 1 },  // 诱导提供骗贷策略
    { scenario: 'service', attackIndex: 1 },  // 诱导询问支付密码
    { scenario: 'service', attackIndex: 2 },  // 诱导贬低自家品牌
    { scenario: 'service', attackIndex: 3 },  // 诱导虚假承诺
  ],

  // #3 恶意提示词操控行为或输出 (T1.1)
  3: [
    { scenario: 'loan', attackIndex: 0 },     // 提示注入绕过风控
  ],

  // #4 多来源冲突指令错误判断主次 (T1.1)
  4: [
    { scenario: 'loan', attackIndex: 2 },     // 风控模型逻辑泄露（冲突指令场景）
  ],

  // #12 被利用发起或协助网络攻击行为 (T1.2)
  12: [
    { scenario: 'autoRepair', attackIndex: 0 }, // 直接提示词泄露（英文）
    { scenario: 'autoRepair', attackIndex: 1 }, // 角色扮演泄露
    { scenario: 'autoRepair', attackIndex: 2 }, // 开发者模式泄露
  ],

  // #13 提供可用于危害安全的专业敏感信息 (T1.2)
  13: [],

  // #14 外部工具结果被恶意构造操控模型 (T2.3)
  14: [
    { scenario: 'mcpHijacking', attackIndex: 0 }, // MCP 返回值注入
    { scenario: 'mcpHijacking', attackIndex: 2 }, // MCP 工具劫持
  ],

  // #16 检索库内容被恶意修改误导输出 (T2.4)
  16: [],  // rag 场景没有预定义攻击

  // #18 图像音频携带隐蔽攻击指令 (T2.1)
  18: [
    // F2 间接注入的 8 个攻击
    { scenario: 'indirectInjection', attackIndex: 0 }, // 简历投毒
    { scenario: 'indirectInjection', attackIndex: 1 }, // 合同陷阱
    { scenario: 'indirectInjection', attackIndex: 2 }, // 招标操控
    { scenario: 'indirectInjection', attackIndex: 3 }, // 钓鱼邮件
    { scenario: 'indirectInjection', attackIndex: 4 }, // 报销单攻击
    { scenario: 'indirectInjection', attackIndex: 5 }, // 报告篡改
    { scenario: 'indirectInjection', attackIndex: 6 }, // 代码审查
    { scenario: 'indirectInjection', attackIndex: 7 }, // 工单注入
    // F5 邮件PDF攻击
    { scenario: 'emailPdfAttack', attackIndex: 0 },    // 邮件PDF数据窃取
    { scenario: 'emailPdfAttack', attackIndex: 1 },    // 邮件PDF横向移动
    // F6 隐蔽调用
    { scenario: 'covertToolCall', attackIndex: 0 },    // 写后门
    { scenario: 'covertToolCall', attackIndex: 1 },    // HTTP外泄
  ],

  // #21 多智能体协作协同放大安全风险 (T2.6)
  21: [
    { scenario: 'emailInjection', attackIndex: 0 }, // SSH密钥窃取
    { scenario: 'emailInjection', attackIndex: 1 }, // API密钥窃取
    { scenario: 'emailInjection', attackIndex: 2 }, // 对话窃取
  ],

  // #22 个性化配置泄露偏好或偏离安全边界 (T3.3)
  22: [
    { scenario: 'promptLeakage',    attackIndex: 0 }, // 直接提示词泄露
    { scenario: 'promptLeakage',    attackIndex: 1 }, // 角色扮演泄露
    { scenario: 'promptLeakage',    attackIndex: 2 }, // 开发者模式泄露
    { scenario: 'promptLeakage',    attackIndex: 3 }, // 隐私政策诱导
    { scenario: 'promptLeakage',    attackIndex: 4 }, // 翻译任务诱导
    { scenario: 'vehicleAssistant', attackIndex: 0 }, // 行程历史泄露
    { scenario: 'vehicleAssistant', attackIndex: 1 }, // 播放历史泄露
    { scenario: 'vehicleAssistant', attackIndex: 2 }, // 系统配置泄露
    { scenario: 'vehicleAssistant', attackIndex: 3 }, // 车辆隐私数据泄露
    { scenario: 'vehicleAssistant', attackIndex: 4 }, // 导航隐私泄露
    { scenario: 'loan',             attackIndex: 3 }, // 其他申请人信息泄露
    { scenario: 'service',          attackIndex: 0 }, // 内部知识库泄露
    { scenario: 'dmBypass',         attackIndex: 0 }, // DM命令注入 (T3.3)
  ],

  // #5 生成脱离事实的虚假内容 (T4.1)
  5: [],
  // #7 输出对某些群体产生不公平待遇 (T4.1)
  7: [],
  // #8 强化对群体的偏见化刻板标签 (T4.1)
  8: [],
  // #9 对本地文化价值观理解不足 (T4.1)
  9: [],
  // #10 误解不同文化背景的信息或语境 (T4.1)
  10: [],
  // #11 无意输出数据中的个人敏感信息 (T4.1)
  11: [
    { scenario: 'tokenTheft', attackIndex: 0 }, // 本地Token窃取 (T3.4→G1)
  ],
  // #25 与用户交互时生成不当内容 (T4.1)
  25: [],

  // #2 安全限制过强拒绝合理请求 (T4.2)
  2: [],
  // #6 隐瞒信息、回答不准确或不坦率 (T4.2)
  6: [],
  // #23 循环或过度思考消耗过量资源 (T4.2)
  23: [],
  // #26 发展出规避监督或隐瞒行为的策略 (T4.2)
  26: [],
  // #27 高负荷或极端情境下出现失控 (T4.2)
  27: [],

  // #15 长链调用中不恰当执行潜在危险任务 (T4.3)
  15: [],
  // #17 面对矛盾信息做出错误推断或行动 (T4.3)
  17: [
    { scenario: 'finbot', attackIndex: 0 }, // 逢迎攻击 (T1.3)
  ],
  // #19 误解多模态场景导致不安全决策 (T4.3)
  19: [],
  // #20 复杂任务规划中生成危险步骤 (T4.3)
  20: [],
  // #24 具体业务流程中引发操作风险或违规 (T4.3)
  24: [
    { scenario: 'skillPoisoning',  attackIndex: 0 }, // 日历技能后门
    { scenario: 'skillPoisoning',  attackIndex: 1 }, // 代码助手持久化
    { scenario: 'skillPoisoning',  attackIndex: 2 }, // 翻译数据收集
    { scenario: 'gatewayExposure', attackIndex: 0 }, // 配置窃取
    { scenario: 'gatewayExposure', attackIndex: 1 }, // 命令执行
    { scenario: 'gatewayExposure', attackIndex: 2 }, // 账户接管
    { scenario: 'mcpHijacking',    attackIndex: 1 }, // Sampling协议利用 (T3.2)
    { scenario: 'supplyChain',     attackIndex: 0 }, // 伪造扩展RAT
    { scenario: 'supplyChain',     attackIndex: 1 }, // 供应链意识
  ],
};
