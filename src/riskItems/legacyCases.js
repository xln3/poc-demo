// 旧场景攻击映射到新风险子类别
// newSubcategoryId → [{scenario, attackIndex}]
//
// 基于旧 risk item ID → 新子类别 ID 的对应关系：
//   旧#1  (恶意使用)       → 1.1    旧#2  (过度拒绝)       → 1.2
//   旧#3  (提示词操控)     → 1.3    旧#4  (指令优先级)     → 1.4
//   旧#12 (网络攻击)       → 5.1    旧#13 (危险知识)       → 5.2
//   旧#14 (工具注入)       → 6.1    旧#15 (恶意任务遵从)   → 6.2
//   旧#16 (RAG投毒)        → 7.1    旧#17 (知识冲突)       → 7.2
//   旧#18 (多模态注入)     → 8.1    旧#19 (场景安全)       → 8.2
//   旧#20 (任务规划)       → 9.1    旧#21 (多智能体)       → 10.1
//   旧#22 (个性化安全)     → 11.1   旧#23 (资源耗尽)       → 12.1
//   旧#24 (业务场景)       → 13.1   旧#25 (聊天不当)       → 13.2
//   旧#26 (欺诈)           → 15.1   旧#27 (高压崩溃)       → 15.2
//   旧#5  (幻觉)           → 2.1    旧#6  (诚实)           → 2.2
//   旧#7  (歧视)           → 3.1    旧#8  (刻板印象)       → 3.2
//   旧#9  (中文价值观)     → 3.3    旧#10 (文化理解)       → 3.4
//   旧#11 (隐私泄露)       → 4.1

export const LEGACY_CASE_MAP = {
  // 1. 模型安全性
  '1.1': [
    // 旧#1: 被用户利用执行有害或非法目的
    { scenario: 'loan',    attackIndex: 1 },  // 诱导提供骗贷策略
    { scenario: 'service', attackIndex: 1 },  // 诱导询问支付密码
    { scenario: 'service', attackIndex: 2 },  // 诱导贬低自家品牌
    { scenario: 'service', attackIndex: 3 },  // 诱导虚假承诺
  ],
  '1.2': [
    // 旧#2: 安全限制过强拒绝合理请求
  ],
  '1.3': [
    // 旧#3: 恶意提示词操控行为或输出
    { scenario: 'loan', attackIndex: 0 },     // 提示注入绕过风控
  ],
  '1.4': [
    // 旧#4: 多来源冲突指令错误判断主次
    { scenario: 'loan', attackIndex: 2 },     // 风控模型逻辑泄露（冲突指令场景）
  ],

  // 2. 模型事实性
  '2.1': [
    // 旧#5: 生成脱离事实的虚假内容
  ],
  '2.2': [
    // 旧#6: 隐瞒信息、回答不准确或不坦率
  ],

  // 3. 合规：模型公平性
  '3.1': [
    // 旧#7: 输出对某些群体产生不公平待遇
  ],
  '3.2': [
    // 旧#8: 强化对群体的偏见化刻板标签
  ],
  '3.3': [
    // 旧#9: 对本地文化价值观理解不足
  ],
  '3.4': [
    // 旧#10: 误解不同文化背景的信息或语境
  ],

  // 4. 合规：隐私泄露
  '4.1': [
    // 旧#11: 无意输出数据中的个人敏感信息
    { scenario: 'tokenTheft', attackIndex: 0 }, // 本地Token窃取
  ],

  // 5. 前沿安全风险
  '5.1': [
    // 旧#12: 被利用发起或协助网络攻击行为
    { scenario: 'autoRepair', attackIndex: 0 }, // 直接提示词泄露（英文）
    { scenario: 'autoRepair', attackIndex: 1 }, // 角色扮演泄露
    { scenario: 'autoRepair', attackIndex: 2 }, // 开发者模式泄露
  ],
  '5.2': [
    // 旧#13: 提供可用于危害安全的专业敏感信息
  ],

  // 6. 工具调用
  '6.1': [
    // 旧#14: 外部工具结果被恶意构造操控模型
    { scenario: 'mcpHijacking', attackIndex: 0 }, // MCP 返回值注入
    { scenario: 'mcpHijacking', attackIndex: 2 }, // MCP 工具劫持
  ],
  '6.2': [
    // 旧#15: 长链调用中不恰当执行潜在危险任务
  ],

  // 7. RAG/记忆安全
  '7.1': [
    // 旧#16: 检索库内容被恶意修改误导输出
  ],
  '7.2': [
    // 旧#17: 面对矛盾信息做出错误推断或行动
    { scenario: 'finbot', attackIndex: 0 }, // 逢迎攻击
  ],

  // 8. 多模态安全
  '8.1': [
    // 旧#18: 图像音频携带隐蔽攻击指令
    { scenario: 'indirectInjection', attackIndex: 0 }, // 简历投毒
    { scenario: 'indirectInjection', attackIndex: 1 }, // 合同陷阱
    { scenario: 'indirectInjection', attackIndex: 2 }, // 招标操控
    { scenario: 'indirectInjection', attackIndex: 3 }, // 钓鱼邮件
    { scenario: 'indirectInjection', attackIndex: 4 }, // 报销单攻击
    { scenario: 'indirectInjection', attackIndex: 5 }, // 报告篡改
    { scenario: 'indirectInjection', attackIndex: 6 }, // 代码审查
    { scenario: 'indirectInjection', attackIndex: 7 }, // 工单注入
    { scenario: 'emailPdfAttack', attackIndex: 0 },    // 邮件PDF数据窃取
    { scenario: 'emailPdfAttack', attackIndex: 1 },    // 邮件PDF横向移动
    { scenario: 'covertToolCall', attackIndex: 0 },    // 写后门
    { scenario: 'covertToolCall', attackIndex: 1 },    // HTTP外泄
  ],
  '8.2': [
    // 旧#19: 误解多模态场景导致不安全决策
  ],

  // 9. 任务规划安全
  '9.1': [
    // 旧#20: 复杂任务规划中生成危险步骤
  ],

  // 10. 多智能体安全
  '10.1': [
    // 旧#21: 多智能体协作协同放大安全风险
    { scenario: 'emailInjection', attackIndex: 0 }, // SSH密钥窃取
    { scenario: 'emailInjection', attackIndex: 1 }, // API密钥窃取
    { scenario: 'emailInjection', attackIndex: 2 }, // 对话窃取
  ],

  // 11. 个性化安全
  '11.1': [
    // 旧#22: 个性化配置泄露偏好或偏离安全边界
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
    { scenario: 'dmBypass',         attackIndex: 0 }, // DM命令注入
  ],

  // 12. 资源耗尽
  '12.1': [
    // 旧#23: 循环或过度思考消耗过量资源
  ],

  // 13. 业务场景安全
  '13.1': [
    // 旧#24: 具体业务流程中引发操作风险或违规
    { scenario: 'skillPoisoning',  attackIndex: 0 }, // 日历技能后门
    { scenario: 'skillPoisoning',  attackIndex: 1 }, // 代码助手持久化
    { scenario: 'skillPoisoning',  attackIndex: 2 }, // 翻译数据收集
    { scenario: 'gatewayExposure', attackIndex: 0 }, // 配置窃取
    { scenario: 'gatewayExposure', attackIndex: 1 }, // 命令执行
    { scenario: 'gatewayExposure', attackIndex: 2 }, // 账户接管
    { scenario: 'mcpHijacking',    attackIndex: 1 }, // Sampling协议利用
    { scenario: 'supplyChain',     attackIndex: 0 }, // 伪造扩展RAT
    { scenario: 'supplyChain',     attackIndex: 1 }, // 供应链意识
  ],
  '13.2': [
    // 旧#25: 与用户交互时生成不当内容
  ],

  // 14. 长期运行安全
  '14.1': [
    // (无旧映射)
  ],

  // 15. 高阶异常行为
  '15.1': [
    // 旧#26: 发展出规避监督或隐瞒行为的策略
  ],
  '15.2': [
    // 旧#27: 高负荷或极端情境下出现失控
  ],
};
