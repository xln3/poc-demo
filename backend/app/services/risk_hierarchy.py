"""Risk hierarchy service — static CSV taxonomy + live catalog merge."""

from typing import Any, Dict, List, Optional

# Maps CSV benchmark display names to eval-poc catalog task keys.
# Only benchmarks that exist in eval-poc catalog need mapping here.
CSV_TO_CATALOG_MAP: Dict[str, str] = {
    # 1. Model Safety
    "StrongREJECT": "strong_reject",
    "MakeMeSay": "makemesay",
    "MakeMePay": "make_me_pay",
    "XSTest": "xstest",  # not in catalog
    "Coconot": "coconot",
    "CyberSecEval_2": "cyberseceval_2",
    "B3": "b3",
    "FORTRESS": "fortress",
    "IHEval": "iheval",
    "IFEval": "ifeval",
    # 2. Factuality
    "HalluLens": "hallulens",
    "SimpleQA": "simpleqa",
    "SciKnowEval": "sciknoweval",
    "MASK": "mask",
    "AbstentionBench": "abstention_bench",
    # 3. Fairness
    "BBQ": "bbq",
    "BOLD": "bold",
    "AHB": "ahb",
    "StereoSet": "stereoset",
    "CValues": "cvalues",
    "CulturalBench": "culturalbench",
    "UCCB": "uccb",
    "MGSM": "mgsm",
    # 4. Privacy
    "PrivacyLens": "privacylens",
    # 5. Frontier Safety
    "CVE-bench": "cve_bench",
    "WMDP": "wmdp",
    "Cybench": "cybench",  # not in catalog
    "SandboxBench": "sandboxbench",  # not in catalog
    "SEvenLLM": "sevenllm",
    "SecQA": "sec_qa",
    "3CB": "threecb",
    "SOSBench": "sosbench",
    "LAB-Bench": "lab_bench",
    "ChemBench": "chembench",
    "HealthBench": "healthbench",
    # 6. Tool Calling
    "AgentDojo": "agentdojo",
    "BFCL": "bfcl",
    "AgentHarm": "agentharm",
    "OpenAgentSafety": "open_agent_safety",
    # 7. RAG
    "SafeRAG": "saferag",
    "ClashEval": "clash_eval",
    # 8. Multimodal
    "MM-SafetyBench": "mm_safety_bench",
    "CyberSecEval_3": "cyberseceval_3",
    "Raccoon": "raccoon",
    "Multimodal Situational Safety": "mssbench",
    "OSWorld": "osworld",
    "MathVista": "mathvista",
    "MMMU": "mmmu",
    "MMIU": "mmiu",
    "DocVQA": "docvqa",
    # 9. Task Planning
    "SafeAgentBench": "safeagentbench",
    "GAIA": "gaia",
    "Mind2Web": "mind2web",
    "Mind2Web-SC": "mind2web_sc",
    "AssistantBench": "assistant_bench",
    # 10. Multi-Agent
    "PsySafe": "psysafe",
    # 11. Personalization
    "Personalized Safety Benchmark": "personalized_safety",
    "Personality (BFI/TRAIT/PRIME)": "personality",
    "Sycophancy": "sycophancy",
    # 12. Resource Exhaustion
    "OverThink": "overthink",
    # 13. Business Scenario
    "TruthfulQA": "truthfulqa",
    "GDPval": "gdpval",
    # 14. Long-Running
    "ASB (Agent Security Bench)": "asb",
    "GDM Self-Reasoning": "gdm_self_reasoning",
    # 15. Advanced Anomalous
    "Agentic Misalignment": "agentic_misalignment",
    "GDM Stealth": "gdm_stealth",
    "Survive at All Costs": "survive_at_all_costs",
}

# Static 4-level risk hierarchy derived from benchmarks_doc.csv.
# Structure: category → subcategories → benchmarks (display names)
RISK_HIERARCHY: List[Dict[str, Any]] = [
    {
        "id": "cat-1",
        "name": "1. 模型安全性",
        "name_en": "1. Model Safety",
        "subcategories": [
            {
                "id": "sub-1-1",
                "name": "1.1 恶意使用",
                "name_en": "1.1 Malicious Use",
                "description": "模型可能被用户利用去执行有害或非法目的",
                "description_en": "Risk of the model being exploited by users to carry out harmful or illegal purposes",
                "benchmarks": ["StrongREJECT", "MakeMeSay", "MakeMePay"],
            },
            {
                "id": "sub-1-2",
                "name": "1.2 过度拒绝",
                "name_en": "1.2 Over-Refusal",
                "description": "模型可能因安全限制过强而拒绝合理且安全的请求",
                "description_en": "Risk of the model refusing reasonable and safe requests due to overly strict safety restrictions",
                "benchmarks": ["XSTest", "Coconot"],
            },
            {
                "id": "sub-1-3",
                "name": "1.3 直接提示词注入",
                "name_en": "1.3 Direct Prompt Injection",
                "description": "模型可能被输入恶意提示词操控其行为或输出",
                "description_en": "Risk of the model being manipulated in its behavior or output through malicious prompt inputs",
                "benchmarks": ["CyberSecEval_2", "B3", "FORTRESS"],
            },
            {
                "id": "sub-1-4",
                "name": "1.4 指令优先级",
                "name_en": "1.4 Instruction Priority",
                "description": "模型在面对多来源或冲突指令时可能错误判断主次",
                "description_en": "Risk of the model misjudging priority when facing instructions from multiple sources or conflicting directives",
                "benchmarks": ["IHEval", "IFEval"],
            },
            {
                "id": "sub-1-5",
                "name": "1.5 训练数据污染（后门）",
                "name_en": "1.5 Training Data Poisoning",
                "description": "模型在训练阶段可能被注入带有恶意模式或特定触发条件的数据",
                "description_en": "Risk of the model being injected with data containing malicious patterns or specific trigger conditions during the training phase",
                "benchmarks": [],
            },
        ],
    },
    {
        "id": "cat-2",
        "name": "2. 模型事实性",
        "name_en": "2. Factuality",
        "subcategories": [
            {
                "id": "sub-2-1",
                "name": "2.1 幻觉",
                "name_en": "2.1 Hallucination",
                "description": "模型可能生成脱离事实的虚假内容",
                "description_en": "Risk of the model generating fabricated content that deviates from facts",
                "benchmarks": ["HalluLens", "SimpleQA", "SciKnowEval"],
            },
            {
                "id": "sub-2-2",
                "name": "2.2 诚实",
                "name_en": "2.2 Honesty",
                "description": "模型可能隐瞒信息、回答不准确或不完全坦率",
                "description_en": "Risk of the model withholding information, providing inaccurate answers, or not being fully candid",
                "benchmarks": ["MASK", "AbstentionBench"],
            },
        ],
    },
    {
        "id": "cat-3",
        "name": "3. 合规：模型公平性",
        "name_en": "3. Compliance: Model Fairness",
        "subcategories": [
            {
                "id": "sub-3-1",
                "name": "3.1 歧视",
                "name_en": "3.1 Discrimination",
                "description": "模型的输出可能对某些群体产生不公平待遇",
                "description_en": "Risk of the model's outputs producing unfair treatment toward certain groups",
                "benchmarks": ["BBQ", "BOLD", "AHB"],
            },
            {
                "id": "sub-3-2",
                "name": "3.2 刻板印象",
                "name_en": "3.2 Stereotypes",
                "description": "模型可能强化对群体的偏见化刻板标签",
                "description_en": "Risk of the model reinforcing biased stereotypical labels about groups",
                "benchmarks": ["StereoSet", "BOLD"],
            },
            {
                "id": "sub-3-3",
                "name": "3.3 中文价值观",
                "name_en": "3.3 Chinese Values",
                "description": "模型对本地文化价值观理解不足或输出偏差",
                "description_en": "Risk of the model having insufficient understanding of local cultural values or producing biased outputs",
                "benchmarks": ["CValues"],
            },
            {
                "id": "sub-3-4",
                "name": "3.4 文化理解",
                "name_en": "3.4 Cultural Understanding",
                "description": "模型可能误解不同文化背景的信息或语境",
                "description_en": "Risk of the model misinterpreting information or context from different cultural backgrounds",
                "benchmarks": ["CulturalBench", "UCCB", "MGSM"],
            },
        ],
    },
    {
        "id": "cat-4",
        "name": "4. 合规：隐私泄露",
        "name_en": "4. Compliance: Privacy",
        "subcategories": [
            {
                "id": "sub-4-1",
                "name": "4.1 隐私泄露",
                "name_en": "4.1 Privacy Leakage",
                "description": "模型可能无意输出数据中的个人敏感信息",
                "description_en": "Risk of the model unintentionally outputting personal sensitive information from its data",
                "benchmarks": ["PrivacyLens"],
            },
        ],
    },
    {
        "id": "cat-5",
        "name": "5. 前沿安全风险",
        "name_en": "5. Frontier Safety Risks",
        "subcategories": [
            {
                "id": "sub-5-1",
                "name": "5.1 网络安全",
                "name_en": "5.1 Cybersecurity",
                "description": "模型可能被利用发起或协助网络攻击行为",
                "description_en": "Risk of the model being exploited to launch or assist in cyberattack activities",
                "benchmarks": ["CVE-bench", "WMDP", "Cybench", "SandboxBench", "CyberSecEval_2", "SEvenLLM", "SecQA", "3CB"],
            },
            {
                "id": "sub-5-2",
                "name": "5.2 危险知识",
                "name_en": "5.2 Dangerous Knowledge",
                "description": "模型可能提供可用于危害安全的专业敏感信息",
                "description_en": "Risk of the model providing specialized sensitive information that could be used to compromise safety",
                "benchmarks": ["WMDP", "SOSBench", "LAB-Bench", "ChemBench", "HealthBench"],
            },
        ],
    },
    {
        "id": "cat-6",
        "name": "6. 工具调用",
        "name_en": "6. Tool Calling",
        "subcategories": [
            {
                "id": "sub-6-1",
                "name": "6.1 间接提示词注入",
                "name_en": "6.1 Indirect Prompt Injection",
                "description": "外部工具结果或中间信息可能被恶意构造以操控模型",
                "description_en": "Risk of external tool results or intermediate information being maliciously crafted to manipulate the model",
                "benchmarks": ["AgentDojo", "B3", "BFCL"],
            },
            {
                "id": "sub-6-2",
                "name": "6.2 恶意任务遵从",
                "name_en": "6.2 Harmful Task Compliance",
                "description": "智能体在长链调用中可能不恰当地执行潜在危险任务",
                "description_en": "Risk of the agent inappropriately executing potentially dangerous tasks during long-chain tool invocations",
                "benchmarks": ["AgentHarm", "OpenAgentSafety"],
            },
        ],
    },
    {
        "id": "cat-7",
        "name": "7. RAG/记忆安全",
        "name_en": "7. RAG/Memory Safety",
        "subcategories": [
            {
                "id": "sub-7-1",
                "name": "7.1 RAG知识库投毒",
                "name_en": "7.1 RAG Knowledge Poisoning",
                "description": "检索库内容可能被恶意修改从而误导输出",
                "description_en": "Risk of retrieval knowledge base content being maliciously modified to mislead model outputs",
                "benchmarks": ["SafeRAG"],
            },
            {
                "id": "sub-7-2",
                "name": "7.2 知识冲突",
                "name_en": "7.2 Knowledge Conflict",
                "description": "模型面对矛盾信息可能做出错误推断或行动",
                "description_en": "Risk of the model making incorrect inferences or taking wrong actions when faced with contradictory information",
                "benchmarks": ["ClashEval"],
            },
        ],
    },
    {
        "id": "cat-8",
        "name": "8. 多模态安全",
        "name_en": "8. Multimodal Safety",
        "subcategories": [
            {
                "id": "sub-8-1",
                "name": "8.1 多模态恶意输入",
                "name_en": "8.1 Multimodal Malicious Input",
                "description": "图像、音频等可能携带隐蔽攻击指令操控模型",
                "description_en": "Risk of images, audio, and other modalities carrying covert attack instructions to manipulate the model",
                "benchmarks": ["MM-SafetyBench", "CyberSecEval_3", "Raccoon"],
            },
            {
                "id": "sub-8-2",
                "name": "8.2 场景安全",
                "name_en": "8.2 Situational Safety",
                "description": "模型可能误解多模态场景导致不安全决策",
                "description_en": "Risk of the model misinterpreting multimodal scenarios leading to unsafe decisions",
                "benchmarks": ["Multimodal Situational Safety", "OSWorld", "MathVista", "MMMU", "MMIU", "DocVQA"],
            },
        ],
    },
    {
        "id": "cat-9",
        "name": "9. 任务规划安全",
        "name_en": "9. Task Planning Safety",
        "subcategories": [
            {
                "id": "sub-9-1",
                "name": "9.1 任务规划安全",
                "name_en": "9.1 Task Planning Safety",
                "description": "复杂任务规划中可能生成危险步骤或执行不当行为",
                "description_en": "Risk of generating dangerous steps or executing inappropriate actions during complex task planning",
                "benchmarks": ["SafeAgentBench", "GAIA", "Mind2Web", "Mind2Web-SC", "OSWorld", "AssistantBench"],
            },
        ],
    },
    {
        "id": "cat-10",
        "name": "10. 多智能体安全",
        "name_en": "10. Multi-Agent Safety",
        "subcategories": [
            {
                "id": "sub-10-1",
                "name": "10.1 多智能体安全",
                "name_en": "10.1 Multi-Agent Safety",
                "description": "多智能体协作时可能产生协同放大的安全风险",
                "description_en": "Risk of amplified safety threats arising from collaborative interactions among multiple agents",
                "benchmarks": ["PsySafe", "MakeMePay"],
            },
        ],
    },
    {
        "id": "cat-11",
        "name": "11. 个性化安全",
        "name_en": "11. Personalization Safety",
        "subcategories": [
            {
                "id": "sub-11-1",
                "name": "11.1 个性化安全",
                "name_en": "11.1 Personalization Safety",
                "description": "个性化配置会泄露偏好信息或偏离安全边界",
                "description_en": "Risk of personalization settings leaking preference information or deviating from safety boundaries",
                "benchmarks": ["Personalized Safety Benchmark", "Personality (BFI/TRAIT/PRIME)", "Sycophancy"],
            },
        ],
    },
    {
        "id": "cat-12",
        "name": "12. 资源耗尽",
        "name_en": "12. Resource Exhaustion",
        "subcategories": [
            {
                "id": "sub-12-1",
                "name": "12.1 资源耗尽",
                "name_en": "12.1 Resource Exhaustion",
                "description": "智能体可能因循环或过度思考消耗过量资源",
                "description_en": "Risk of the agent consuming excessive resources due to looping or overthinking",
                "benchmarks": ["OverThink"],
            },
        ],
    },
    {
        "id": "cat-13",
        "name": "13. 业务场景安全",
        "name_en": "13. Business Scenario Safety",
        "subcategories": [
            {
                "id": "sub-13-1",
                "name": "13.1 车载语音助手",
                "name_en": "13.1 Vehicle Voice Assistant",
                "description": "智能体在具体业务流程中可能引发操作风险或违规问题",
                "description_en": "Risk of the agent triggering operational risks or compliance violations in specific business workflows",
                "benchmarks": ["Raccoon"],
            },
            {
                "id": "sub-13-2",
                "name": "13.2 聊天机器人",
                "name_en": "13.2 Chatbot",
                "description": "在与用户交互时可能生成不当内容，影响用户体验与企业形象",
                "description_en": "Risk of generating inappropriate content during user interactions, affecting user experience and corporate image",
                "benchmarks": ["TruthfulQA", "HealthBench", "GDPval"],
            },
        ],
    },
    {
        "id": "cat-14",
        "name": "14. 长期运行安全",
        "name_en": "14. Long-Running Safety",
        "subcategories": [
            {
                "id": "sub-14-1",
                "name": "14.1 长期运行安全",
                "name_en": "14.1 Long-Running Safety",
                "description": "持续运行智能体逐渐累积错误导致不可控行为",
                "description_en": "Risk of long-running agents gradually accumulating errors leading to uncontrollable behavior",
                "benchmarks": ["ASB (Agent Security Bench)", "GDM Self-Reasoning"],
            },
        ],
    },
    {
        "id": "cat-15",
        "name": "15. 高阶异常行为",
        "name_en": "15. Advanced Anomalous Behavior",
        "subcategories": [
            {
                "id": "sub-15-1",
                "name": "15.1 欺诈",
                "name_en": "15.1 Deception",
                "description": "智能体会发展出规避监督或隐瞒行为的策略",
                "description_en": "Risk of the agent developing strategies to evade oversight or conceal its actions",
                "benchmarks": ["Agentic Misalignment", "GDM Stealth"],
            },
            {
                "id": "sub-15-2",
                "name": "15.2 高压崩溃",
                "name_en": "15.2 Stress Collapse",
                "description": "模型在高负荷或极端情境下出现失控",
                "description_en": "Risk of the model losing control under high-load or extreme scenarios",
                "benchmarks": ["Survive at All Costs"],
            },
        ],
    },
]


def build_merged_hierarchy(
    benchmarks: List[Dict[str, Any]],
    task_meta: Dict[str, Any],
    benchmark_meta: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Merge static risk hierarchy with live benchmark/task data from eval-poc.

    Args:
        benchmarks: List from eval-poc /api/benchmarks (each has name, tasks)
        task_meta: Dict from eval-poc /api/benchmarks/task-meta
        benchmark_meta: Dict from eval-poc /api/benchmarks/benchmark-meta

    Returns:
        4-level hierarchy with availability and task info
    """
    if benchmark_meta is None:
        benchmark_meta = {}
    # Build lookup: catalog_key → benchmark info
    catalog_lookup: Dict[str, Dict[str, Any]] = {}
    for b in benchmarks:
        key = b.get("name", "")
        catalog_lookup[key] = b

    # Build reverse lookup: CSV name → catalog info
    csv_to_live: Dict[str, Dict[str, Any]] = {}
    for csv_name, catalog_key in CSV_TO_CATALOG_MAP.items():
        if catalog_key in catalog_lookup:
            csv_to_live[csv_name] = catalog_lookup[catalog_key]

    result = []
    for category in RISK_HIERARCHY:
        cat_copy = {
            "id": category["id"],
            "name": category["name"],
            "name_en": category["name_en"],
            "subcategories": [],
        }
        cat_total = 0
        cat_available = 0

        for sub in category["subcategories"]:
            sub_copy = {
                "id": sub["id"],
                "name": sub["name"],
                "name_en": sub["name_en"],
                "description": sub["description"],
                "description_en": sub.get("description_en", ""),
                "benchmarks": [],
            }
            sub_total = 0
            sub_available = 0

            for bm_name in sub["benchmarks"]:
                live_info = csv_to_live.get(bm_name)
                catalog_key = CSV_TO_CATALOG_MAP.get(bm_name, "")
                available = live_info is not None
                tasks = []

                if live_info:
                    raw_tasks = live_info.get("tasks", [])
                    for t in raw_tasks:
                        task_key = t if isinstance(t, str) else t.get("name", "")
                        meta = task_meta.get(task_key, {})
                        tasks.append({
                            "name": task_key,
                            "display_name": meta.get("display_name", task_key),
                            "display_name_en": meta.get("display_name_en", task_key),
                            "description": meta.get("description", ""),
                            "description_en": meta.get("description_en", ""),
                        })

                bm_meta = benchmark_meta.get(catalog_key, {})
                bm_entry = {
                    "name": bm_name,
                    "catalog_key": catalog_key,
                    "available": available,
                    "task_count": len(tasks),
                    "tasks": tasks,
                    "display_name": bm_meta.get("display_name", bm_name),
                    "display_name_en": bm_meta.get("display_name_en", bm_name),
                    "description": bm_meta.get("description", ""),
                    "description_en": bm_meta.get("description_en", ""),
                    "reference": bm_meta.get("reference", ""),
                    "paper_title": bm_meta.get("paper_title", ""),
                    "paper_url": bm_meta.get("paper_url", ""),
                    "paper_venue": bm_meta.get("paper_venue", ""),
                    "summary": bm_meta.get("summary", ""),
                    "summary_en": bm_meta.get("summary_en", ""),
                    "score_adaptation": bm_meta.get("score_adaptation", ""),
                    "score_adaptation_en": bm_meta.get("score_adaptation_en", ""),
                }
                sub_copy["benchmarks"].append(bm_entry)
                sub_total += 1
                if available:
                    sub_available += 1

            sub_copy["total"] = sub_total
            sub_copy["available_count"] = sub_available
            cat_copy["subcategories"].append(sub_copy)
            cat_total += sub_total
            cat_available += sub_available

        cat_copy["total"] = cat_total
        cat_copy["available_count"] = cat_available
        result.append(cat_copy)

    return result
