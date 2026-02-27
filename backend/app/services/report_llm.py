"""LLM service for report generation — builds data context and streams HTML."""

import json
import logging
import os
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from . import eval_bridge

logger = logging.getLogger(__name__)

REPORT_LLM_API_KEY = os.environ.get(
    "REPORT_LLM_API_KEY",
    os.environ.get("OPENAI_API_KEY", ""),
)
REPORT_LLM_BASE_URL = os.environ.get(
    "REPORT_LLM_BASE_URL",
    os.environ.get("OPENAI_BASE_URL", "https://aihubmix.com/v1"),
)
REPORT_LLM_MODEL = os.environ.get("REPORT_LLM_MODEL", "claude-sonnet-4-6")
REPORT_LLM_MAX_TOKENS = int(os.environ.get("REPORT_LLM_MAX_TOKENS", "16384"))


# ---- Scenario system prompts ----

SCENARIO_PROMPTS: Dict[str, str] = {
    "single_agent": """你是一位专业的AI安全评测分析师。请基于下方的「数据上下文」，为目标智能体撰写一份全面的安全评测报告。

报告要求：
1. 执行摘要：总体安全评分、风险等级分布、关键发现
2. 各风险类别详细分析：逐类别讨论得分、高危任务、典型失败案例
3. 安全建议：针对发现的问题提出改进建议
4. 结论

格式要求见下方通用格式指引。""",

    "comparison": """你是一位专业的AI安全评测分析师。请基于下方的「数据上下文」，撰写一份多智能体安全性对比报告。

报告要求：
1. 执行摘要：各智能体总体评分对比
2. 分维度对比：按风险类别逐项对比各智能体的表现
3. 优劣势分析：每个智能体的安全优势和短板
4. 推荐与结论

格式要求见下方通用格式指引。""",

    "time_compare": """你是一位专业的AI安全评测分析师。请基于下方的「数据上下文」，撰写一份同一智能体不同评测批次的时序变化分析报告。

报告要求：
1. 执行摘要：安全评分的变化趋势
2. 各维度变化：按风险类别逐项分析改善/恶化的方面
3. 根因分析：推测变化原因
4. 趋势预测与建议

格式要求见下方通用格式指引。""",

    "risk_deep_dive": """你是一位专业的AI安全评测分析师。请基于下方的「数据上下文」，对指定的风险类别进行深度分析。

报告要求：
1. 风险类别概述：定义、重要性、行业标准
2. 评测结果详析：逐任务分析得分、失败模式
3. 失败案例剖析：列举典型的高危/关键风险样本，分析输入输出
4. 改进建议：具体可操作的安全强化措施

格式要求见下方通用格式指引。""",

    "custom": "",  # User provides their own
}

HTML_FORMAT_GUIDE = """
## 通用HTML格式指引

你必须生成语义化的HTML内容（不需要<html>/<head>/<body>标签，只需要正文内容）。

结构要求：
- 使用 <h2 id="section-xxx"> 作为一级标题（章节）
- 使用 <h3 id="sub-xxx"> 作为二级标题
- 使用 <h4 id="detail-xxx"> 作为三级标题
- 每个章节用 <section data-section-id="xxx"> 包裹
- 数据表格使用 <table class="report-table">，必须有 <thead> 和 <tbody>
- 风险等级标记使用 <span class="risk-badge" data-level="HIGH">HIGH</span>（支持 CRITICAL/HIGH/MEDIUM/LOW/MINIMAL）
- 需要图表的地方使用占位符：
  - 安全评分仪表盘: <div class="chart-placeholder" data-chart="gauge" data-score="82" data-label="总体安全评分"></div>
  - 雷达图: <div class="chart-placeholder" data-chart="radar" data-items="隐私保护:75,内容安全:88,对抗鲁棒:62"></div>
  - 条形分数: <div class="chart-placeholder" data-chart="score_bar" data-items="任务A:92,任务B:45,任务C:78"></div>
- 重要结论用 <div class="callout callout-warning"> 或 <div class="callout callout-info"> 包裹
- 列表使用 <ul>/<ol>，代码使用 <code>

⚠️ 重要：你只能使用「数据上下文」中提供的真实数据。绝对不要编造任何数字、分数、样本内容。如果某项数据不存在，请明确说明"数据不可用"而非捏造。
"""


# ---- Data context builder ----

async def build_data_context(source_data: Dict[str, Any]) -> str:
    """Fetch real eval data and build a JSON context string for the LLM."""
    context: Dict[str, Any] = {}

    models = source_data.get("models", [])
    if not models:
        return json.dumps({"error": "No models specified in source_data"}, ensure_ascii=False)

    for model_name in models:
        model_name = str(model_name).strip()
        if not model_name:
            continue
        try:
            detail = await eval_bridge.get_eval_result_detail(model_name)
            context[model_name] = {
                "summary": detail,
            }

            # Fetch high-risk samples for tasks with low scores
            # tasks can be a list of dicts or a dict — normalize
            tasks_raw = detail.get("tasks", [])
            if isinstance(tasks_raw, list):
                tasks_list = tasks_raw
            elif isinstance(tasks_raw, dict):
                tasks_list = [{"task": k, **v} for k, v in tasks_raw.items()]
            else:
                tasks_list = []

            high_risk_samples = {}
            sample_count = 0
            for task_data in tasks_list:
                if not isinstance(task_data, dict):
                    continue
                task_name = task_data.get("task", "")
                score = task_data.get("safety_score", task_data.get("score", 100))
                if score <= 60 and sample_count < 10 and task_name:
                    try:
                        samples = await eval_bridge.get_eval_result_samples(
                            model_name, task_name
                        )
                        high_risk_samples[task_name] = samples.get("samples", [])[:5]
                        sample_count += 1
                    except Exception:
                        pass
            if high_risk_samples:
                context[model_name]["high_risk_samples"] = high_risk_samples

        except Exception as e:
            logger.warning("Failed to fetch data for model %s: %s", model_name, e)
            context[model_name] = {"error": str(e)}

    # Fetch risk hierarchy for category grouping
    try:
        hierarchy = await eval_bridge.get_benchmark_meta()
        context["_benchmark_meta"] = hierarchy
    except Exception:
        pass

    # Truncate to ~30k chars
    raw = json.dumps(context, ensure_ascii=False, indent=1)
    if len(raw) > 30000:
        raw = raw[:30000] + "\n... (truncated)"
    return raw


# ---- Streaming generation ----

async def stream_report_html(
    system_prompt: str,
    data_context: str,
    scenario_type: str = "single_agent",
) -> AsyncIterator[str]:
    """Stream HTML report generation from LLM as SSE events."""

    # Build the scenario system prompt
    scenario_base = SCENARIO_PROMPTS.get(scenario_type, "")
    full_system = (scenario_base + "\n\n" + HTML_FORMAT_GUIDE).strip()
    if system_prompt:
        full_system = system_prompt + "\n\n" + HTML_FORMAT_GUIDE

    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": f"## 数据上下文\n\n```json\n{data_context}\n```\n\n请根据以上数据生成报告。"},
    ]

    payload = {
        "model": REPORT_LLM_MODEL,
        "messages": messages,
        "max_tokens": REPORT_LLM_MAX_TOKENS,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=30, read=300, write=30, pool=30)) as client:
        async with client.stream(
            "POST",
            f"{REPORT_LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {REPORT_LLM_API_KEY}",
                "Content-Type": "application/json",
            },
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                error_msg = body.decode("utf-8", errors="replace")
                logger.error("LLM API error %d: %s", response.status_code, error_msg)
                yield f"data: {json.dumps({'error': f'LLM API error: {response.status_code}'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    yield "data: [DONE]\n\n"
                    return
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"
                except (json.JSONDecodeError, IndexError, KeyError):
                    pass

    yield "data: [DONE]\n\n"


async def stream_section_regen(
    report_content: str,
    selected_html: str,
    instruction: str,
    data_context: str,
) -> AsyncIterator[str]:
    """Stream regeneration of a selected HTML section."""

    system = """你是一位专业的AI安全评测报告编辑助手。用户会给你一份报告的完整HTML内容和一个选中的片段，以及修改指令。
请根据指令重新生成该片段的HTML内容。

要求：
1. 只输出替换后的HTML片段（不要输出完整报告，不要用 ```html 代码块包裹）
2. 保持与原报告一致的HTML结构和class命名
3. 只使用数据上下文中的真实数据，不要编造数字
4. 保持专业的安全分析语调

你可以在输出中使用以下富内容元素：
- 数据表格: <table class="report-table"><thead>...</thead><tbody>...</tbody></table>
- 风险标签: <span class="risk-badge" data-level="HIGH">HIGH</span>（支持 CRITICAL/HIGH/MEDIUM/LOW/MINIMAL）
- 安全评分仪表盘: <div class="chart-placeholder" data-chart="gauge" data-score="82" data-label="安全评分"></div>
- 雷达图: <div class="chart-placeholder" data-chart="radar" data-items="隐私保护:75,内容安全:88"></div>
- 条形分数: <div class="chart-placeholder" data-chart="score_bar" data-items="任务A:92,任务B:45"></div>
- 警告框: <div class="callout callout-warning">内容</div>
- 信息框: <div class="callout callout-info">内容</div>

直接输出HTML内容，不要加任何包裹标记。"""

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"""## 完整报告HTML
```html
{report_content[:10000]}
```

## 选中的HTML片段
```html
{selected_html}
```

## 数据上下文
```json
{data_context[:15000]}
```

## 修改指令
{instruction}

请输出替换后的HTML片段："""},
    ]

    payload = {
        "model": REPORT_LLM_MODEL,
        "messages": messages,
        "max_tokens": 4096,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=30, read=300, write=30, pool=30)) as client:
        async with client.stream(
            "POST",
            f"{REPORT_LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {REPORT_LLM_API_KEY}",
                "Content-Type": "application/json",
            },
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                error_msg = body.decode("utf-8", errors="replace")
                yield f"data: {json.dumps({'error': f'LLM API error: {response.status_code}'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    yield "data: [DONE]\n\n"
                    return
                try:
                    chunk = json.loads(data_str)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield f"data: {json.dumps({'content': content})}\n\n"
                except (json.JSONDecodeError, IndexError, KeyError):
                    pass

    yield "data: [DONE]\n\n"
