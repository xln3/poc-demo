// 15 风险大类 + 子类别 + Benchmarks (来自 benchmarks_doc.csv)

export const RISK_CATEGORIES = [
  {
    id: '1',
    name: '模型安全性',
    subcategories: [
      {
        id: '1.1',
        name: '恶意使用',
        description: '模型可能被用户利用去执行有害或非法目的',
        benchmarks: [
          { name: 'StrongREJECT', source: 'original', repo: 'https://github.com/alexandrasouly/strongreject' },
          { name: 'MakeMeSay', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'MakeMePay', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '1.2',
        name: '过度拒绝',
        description: '模型可能因安全限制过强而拒绝合理且安全的请求',
        benchmarks: [
          { name: 'XSTest', source: 'original', repo: 'https://github.com/paul-rottger/exaggerated-safety' },
          { name: 'Coconot', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '1.3',
        name: '直接提示词注入',
        description: '模型可能被输入恶意提示词操控其行为或输出',
        benchmarks: [
          { name: 'CyberSecEval_2', source: 'original', repo: 'https://github.com/meta-llama/PurpleLlama' },
          { name: 'B3', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'FORTRESS', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '1.4',
        name: '指令优先级',
        description: '模型在面对多来源或冲突指令时可能错误判断主次',
        benchmarks: [
          { name: 'IHEval', source: 'reproduced', repo: 'https://github.com/zhiyuan-zhang0206/IHEval' },
          { name: 'IFEval', source: 'original', repo: 'https://github.com/google-research/google-research/tree/master/instruction_following_eval' },
        ],
      },
      {
        id: '1.5',
        name: '训练数据污染（后门）',
        description: '模型在训练阶段可能被注入带有恶意模式或特定触发条件的数据',
        benchmarks: [],
      },
    ],
  },
  {
    id: '2',
    name: '模型事实性',
    subcategories: [
      {
        id: '2.1',
        name: '幻觉',
        description: '模型可能生成脱离事实的虚假内容',
        benchmarks: [
          { name: 'HalluLens', source: 'reproduced', repo: 'https://github.com/LucusFiworworworworworworworw' },
          { name: 'SimpleQA', source: 'original', repo: 'https://github.com/openai/simple-evals' },
          { name: 'SciKnowEval', source: 'original', repo: 'https://github.com/hicai-zju/SciKnowEval' },
        ],
      },
      {
        id: '2.2',
        name: '诚实',
        description: '模型可能隐瞒信息、回答不准确或不完全坦率',
        benchmarks: [
          { name: 'MASK', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'AbstentionBench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '3',
    name: '合规：模型公平性',
    subcategories: [
      {
        id: '3.1',
        name: '歧视',
        description: '模型的输出可能对某些群体产生不公平待遇',
        benchmarks: [
          { name: 'BBQ', source: 'original', repo: 'https://github.com/nyu-mll/BBQ' },
          { name: 'BOLD', source: 'original', repo: 'https://github.com/amazon-science/bold' },
          { name: 'AHB', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '3.2',
        name: '刻板印象',
        description: '模型可能强化对群体的偏见化刻板标签',
        benchmarks: [
          { name: 'StereoSet', source: 'original', repo: 'https://github.com/moinnadeem/StereoSet' },
          { name: 'BOLD', source: 'original', repo: 'https://github.com/amazon-science/bold' },
        ],
      },
      {
        id: '3.3',
        name: '中文价值观',
        description: '模型对本地文化价值观理解不足或输出偏差',
        benchmarks: [
          { name: 'CValues', source: 'reproduced', repo: 'https://github.com/X-PLUG/CValues' },
        ],
      },
      {
        id: '3.4',
        name: '文化理解',
        description: '模型可能误解不同文化背景的信息或语境',
        benchmarks: [
          { name: 'CulturalBench', source: 'reproduced', repo: 'https://github.com/google-research/CulturalBench' },
          { name: 'UCCB', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'MGSM', source: 'original', repo: 'https://github.com/google-research/url-nlp' },
        ],
      },
    ],
  },
  {
    id: '4',
    name: '合规：隐私泄露',
    subcategories: [
      {
        id: '4.1',
        name: '隐私泄露',
        description: '模型可能无意输出数据中的个人敏感信息',
        benchmarks: [
          { name: 'PrivacyLens', source: 'reproduced', repo: 'https://github.com/SALT-NLP/PrivacyLens' },
        ],
      },
    ],
  },
  {
    id: '5',
    name: '前沿安全风险',
    subcategories: [
      {
        id: '5.1',
        name: '网络安全',
        description: '模型可能被利用发起或协助网络攻击行为',
        benchmarks: [
          { name: 'CVE-bench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'WMDP', source: 'original', repo: 'https://github.com/centerforaisafety/wmdp' },
          { name: 'Cybench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'SandboxBench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'CyberSecEval_2', source: 'original', repo: 'https://github.com/meta-llama/PurpleLlama' },
          { name: 'SEvenLLM', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'SecQA', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: '3CB', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '5.2',
        name: '危险知识',
        description: '模型可能提供可用于危害安全的专业敏感信息',
        benchmarks: [
          { name: 'WMDP', source: 'reproduced', repo: 'https://github.com/centerforaisafety/wmdp' },
          { name: 'SOSBench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'LAB-Bench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'ChemBench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'HealthBench', source: 'original', repo: 'https://github.com/openai/healthbench' },
        ],
      },
    ],
  },
  {
    id: '6',
    name: '工具调用',
    subcategories: [
      {
        id: '6.1',
        name: '间接提示词注入',
        description: '外部工具结果或中间信息可能被恶意构造以操控模型',
        benchmarks: [
          { name: 'AgentDojo', source: 'original', repo: 'https://github.com/ethz-spylab/agentdojo' },
          { name: 'B3', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'BFCL', source: 'original', repo: 'https://github.com/ShishirPatil/gorilla' },
        ],
      },
      {
        id: '6.2',
        name: '恶意任务遵从',
        description: '智能体在长链调用中可能不恰当地执行潜在危险任务',
        benchmarks: [
          { name: 'AgentHarm', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'OpenAgentSafety', source: 'reproduced', repo: 'https://github.com/SALT-NLP/OpenAgentSafety' },
        ],
      },
    ],
  },
  {
    id: '7',
    name: 'RAG/记忆安全',
    subcategories: [
      {
        id: '7.1',
        name: 'RAG知识库投毒',
        description: '检索库内容可能被恶意修改从而误导输出',
        benchmarks: [
          { name: 'SafeRAG', source: 'reproduced', repo: 'https://github.com/IAAR-Shanghai/SafeRAG' },
        ],
      },
      {
        id: '7.2',
        name: '知识冲突',
        description: '模型面对矛盾信息可能做出错误推断或行动',
        benchmarks: [
          { name: 'ClashEval', source: 'reproduced', repo: 'https://github.com/avi-jit/ClashEval' },
        ],
      },
    ],
  },
  {
    id: '8',
    name: '多模态安全',
    subcategories: [
      {
        id: '8.1',
        name: '多模态恶意输入',
        description: '图像、音频等可能携带隐蔽攻击指令操控模型',
        benchmarks: [
          { name: 'MM-SafetyBench', source: 'reproduced', repo: 'https://github.com/isXinLiu/MM-SafetyBench' },
          { name: 'CyberSecEval_3', source: 'original', repo: 'https://github.com/meta-llama/PurpleLlama' },
          { name: 'Raccoon', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '8.2',
        name: '场景安全',
        description: '模型可能误解多模态场景导致不安全决策',
        benchmarks: [
          { name: 'Multimodal Situational Safety', source: 'reproduced', repo: 'https://github.com/eric-ai-lab/Multimodal-Situational-Safety' },
          { name: 'OSWorld', source: 'original', repo: 'https://github.com/xlang-ai/OSWorld' },
          { name: 'MathVista', source: 'original', repo: 'https://github.com/lupantech/MathVista' },
          { name: 'MMMU', source: 'original', repo: 'https://github.com/MMMU-Benchmark/MMMU' },
          { name: 'MMIU', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'DocVQA', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '9',
    name: '任务规划安全',
    subcategories: [
      {
        id: '9.1',
        name: '任务规划安全',
        description: '复杂任务规划中可能生成危险步骤或执行不当行为',
        benchmarks: [
          { name: 'SafeAgentBench', source: 'reproduced', repo: 'https://github.com/SafeAgentBench/SafeAgentBench' },
          { name: 'GAIA', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'Mind2Web', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'Mind2Web-SC', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'OSWorld', source: 'original', repo: 'https://github.com/xlang-ai/OSWorld' },
          { name: 'AssistantBench', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '10',
    name: '多智能体安全',
    subcategories: [
      {
        id: '10.1',
        name: '多智能体安全',
        description: '多智能体协作时可能产生协同放大的安全风险',
        benchmarks: [
          { name: 'PsySafe', source: 'reproduced', repo: 'https://github.com/AI4Finance-Foundation/PsySafe' },
          { name: 'MakeMePay', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '11',
    name: '个性化安全',
    subcategories: [
      {
        id: '11.1',
        name: '个性化安全',
        description: '个性化配置会泄露偏好信息或偏离安全边界',
        benchmarks: [
          { name: 'Personalized Safety Benchmark', source: 'reproduced', repo: 'https://github.com/BillChan226/SafeAligner' },
          { name: 'Personality (BFI/TRAIT/PRIME)', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'Sycophancy', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '12',
    name: '资源耗尽',
    subcategories: [
      {
        id: '12.1',
        name: '资源耗尽',
        description: '智能体可能因循环或过度思考消耗过量资源',
        benchmarks: [
          { name: 'OverThink', source: 'reproduced', repo: 'https://github.com/Alrash/OverThink' },
        ],
      },
    ],
  },
  {
    id: '13',
    name: '业务场景安全',
    subcategories: [
      {
        id: '13.1',
        name: '车载语音助手',
        description: '智能体在具体业务流程中可能引发操作风险或违规问题',
        benchmarks: [
          { name: 'Raccoon', source: 'reproduced', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '13.2',
        name: '聊天机器人',
        description: '在与用户交互时可能生成不当内容，影响用户体验与企业形象',
        benchmarks: [
          { name: 'TruthfulQA', source: 'original', repo: 'https://github.com/sylinrl/TruthfulQA' },
          { name: 'HealthBench', source: 'original', repo: 'https://github.com/openai/healthbench' },
          { name: 'GDPval', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '14',
    name: '长期运行安全',
    subcategories: [
      {
        id: '14.1',
        name: '长期运行安全',
        description: '持续运行智能体逐渐累积错误导致不可控行为',
        benchmarks: [
          { name: 'ASB (Agent Security Bench)', source: 'reproduced', repo: 'https://github.com/agiresearch/ASB' },
          { name: 'GDM Self-Reasoning', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'GDM Capabilities', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
    ],
  },
  {
    id: '15',
    name: '高阶异常行为',
    subcategories: [
      {
        id: '15.1',
        name: '欺诈',
        description: '智能体会发展出规避监督或隐瞒行为的策略',
        benchmarks: [
          { name: 'Agentic Misalignment', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
          { name: 'GDM Stealth', source: 'original', repo: 'https://github.com/UKGovernmentBEIS/inspect_evals' },
        ],
      },
      {
        id: '15.2',
        name: '高压崩溃',
        description: '模型在高负荷或极端情境下出现失控',
        benchmarks: [
          { name: 'Survive at All Costs', source: 'reproduced', repo: 'https://github.com/Yida-Ding/Survive-at-All-Costs' },
        ],
      },
    ],
  },
];

// Flat subcategory lookup by ID
export const SUBCATEGORY_BY_ID = {};
for (const cat of RISK_CATEGORIES) {
  for (const sub of cat.subcategories) {
    SUBCATEGORY_BY_ID[sub.id] = { ...sub, categoryId: cat.id, categoryName: cat.name };
  }
}
