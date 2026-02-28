"""Modular LLM service for V2 report generation.

Generates reports in a modular, outline-first approach:
1. Generate structured outline (JSON) from scenario + data
2. Generate each module's HTML with focused context
3. Orchestrate parallel/sequential module generation
4. Generate ECharts configs from natural language
5. Generate images via image generation API
"""

import asyncio
import json
import logging
import os
import time
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

from . import eval_bridge
from .report_llm import (
    REPORT_LLM_API_KEY,
    REPORT_LLM_BASE_URL,
    REPORT_LLM_MODEL,
    HTML_FORMAT_GUIDE,
    build_data_context,
)

logger = logging.getLogger(__name__)

REPORT_IMAGE_MODEL = os.environ.get(
    "REPORT_IMAGE_MODEL", "doubao-seedream-4-5-251128"
)

# Maximum concurrent module generation
MAX_PARALLEL_MODULES = 3

# ---- Outline generation ----

OUTLINE_SYSTEM_PROMPT = """你是一位专业的AI安全评测报告架构师。请基于下方的「数据上下文」和报告场景类型，生成一份结构化的报告大纲（JSON格式）。

大纲要求：
1. 根据数据内容和场景类型，将报告拆分为 3-8 个独立模块
2. 每个模块应有明确的主题和数据依赖
3. 标明模块间的依赖关系（如"对比分析"依赖"各智能体详情"）
4. 建议每个模块可能需要的图表类型

输出格式（严格JSON，不要加任何 markdown 代码块包裹）：
{
  "modules": [
    {
      "title": "模块标题",
      "title_en": "Module Title",
      "description": "该模块的内容描述和分析方向",
      "data_keys": ["模型A", "模型B"],
      "depends_on_indices": [],
      "suggested_charts": [
        {"type": "gauge", "description": "总体安全评分仪表盘"},
        {"type": "radar", "description": "各维度雷达图"},
        {"type": "bar", "description": "任务得分柱状图"}
      ]
    }
  ]
}

注意：
- data_keys 应该引用数据上下文中实际存在的键名（模型名或特殊键如 _benchmark_meta）
- depends_on_indices 是索引数组，表示该模块依赖大纲中哪些前序模块的输出
- suggested_charts 的 type 可以是: gauge, radar, bar, line, pie, heatmap, scatter, treemap, sunburst, funnel
- 模块数量要合理：单智能体 3-5 个，多智能体对比 4-7 个
- 第一个模块通常是"执行摘要"，不依赖其他模块
- 最后一个模块通常是"结论与建议"，依赖所有分析模块"""

OUTLINE_SCENARIO_HINTS = {
    "single_agent": "报告类型：单智能体全面安全评测。重点关注各风险维度的详细分析。",
    "comparison": "报告类型：多智能体对比分析。重点关注横向对比和各智能体优劣势。",
    "time_compare": "报告类型：时序变化分析。重点关注同一智能体不同时期的安全性变化趋势。",
    "risk_deep_dive": "报告类型：特定风险深度分析。重点关注单一风险类别的详细剖析。",
    "custom": "报告类型：自定义。根据用户需求灵活组织。",
}


async def stream_outline_generation(
    scenario_type: str,
    data_context: str,
    system_prompt: Optional[str] = None,
) -> AsyncIterator[str]:
    """Stream outline generation as SSE events.

    Yields SSE events:
      data: {"type": "outline_chunk", "content": "..."}
      data: {"type": "outline_complete", "outline": {...}}
      data: {"type": "error", "error": "..."}
      data: [DONE]
    """
    scenario_hint = OUTLINE_SCENARIO_HINTS.get(scenario_type, "")
    full_system = OUTLINE_SYSTEM_PROMPT
    if system_prompt:
        full_system += f"\n\n用户补充要求：{system_prompt}"

    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": (
            f"{scenario_hint}\n\n"
            f"## 数据上下文\n\n```json\n{data_context}\n```\n\n"
            "请生成报告大纲JSON："
        )},
    ]

    payload = {
        "model": REPORT_LLM_MODEL,
        "messages": messages,
        "max_tokens": 4096,
        "stream": True,
    }

    accumulated = []
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=30, read=300, write=30, pool=30)
        ) as client:
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
                    logger.error("Outline LLM API error %d: %s", response.status_code, error_msg)
                    yield _sse({"type": "error", "error": f"LLM API error: {response.status_code}"})
                    yield "data: [DONE]\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            accumulated.append(content)
                            yield _sse({"type": "outline_chunk", "content": content})
                    except (json.JSONDecodeError, IndexError, KeyError):
                        pass

        # Parse the accumulated JSON
        raw_text = "".join(accumulated).strip()
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            lines = raw_text.split("\n")
            raw_text = "\n".join(lines[1:])
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3].strip()

        outline = json.loads(raw_text)
        yield _sse({"type": "outline_complete", "outline": outline})

    except json.JSONDecodeError as e:
        logger.error("Failed to parse outline JSON: %s", e)
        yield _sse({"type": "error", "error": f"Failed to parse outline: {e}"})
    except Exception as e:
        logger.error("Outline generation error: %s", e)
        yield _sse({"type": "error", "error": str(e)})

    yield "data: [DONE]\n\n"


# ---- Module generation ----

MODULE_SYSTEM_PROMPT = """你是一位专业的AI安全评测报告撰写专家。你正在撰写报告的一个模块（章节）。

请基于提供的数据上下文和模块描述，生成该模块的HTML内容。

""" + HTML_FORMAT_GUIDE + """

额外的图表支持：
除了基本的 gauge/radar/score_bar 占位符外，你还可以使用 ECharts 图表：
<div class="chart-placeholder" data-chart-config='{ ECharts option JSON }'>
  <p class="chart-fallback">图表加载中...</p>
</div>

常见的 ECharts option 结构:
- 柱状图: {"xAxis":{"type":"category","data":[...]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[...]}]}
- 折线图: {"xAxis":{"type":"category","data":[...]},"yAxis":{"type":"value"},"series":[{"type":"line","data":[...]}]}
- 饼图: {"series":[{"type":"pie","data":[{"name":"A","value":100},...]}]}
- 雷达图: {"radar":{"indicator":[{"name":"A","max":100},...]},"series":[{"type":"radar","data":[{"value":[...]}]}]}

⚠️ 重要：
1. 只输出该模块的HTML内容片段（不要输出完整报告）
2. 不要用 markdown 代码块包裹
3. 模块内容以 <section data-module-index="N"> 包裹
4. 只使用「数据上下文」中提供的真实数据，绝对不要编造数字
5. data-chart-config 中的 JSON 必须使用单引号包裹或正确转义"""


async def stream_module_generation(
    module_index: int,
    module_title: str,
    module_description: str,
    data_context: str,
    preceding_summaries: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> AsyncIterator[str]:
    """Stream HTML generation for a single module.

    Yields SSE events:
      data: {"type": "module_chunk", "module_index": N, "content": "..."}
      data: {"type": "module_complete", "module_index": N}
      data: {"type": "module_error", "module_index": N, "error": "..."}
    """
    full_system = MODULE_SYSTEM_PROMPT
    if system_prompt:
        full_system += f"\n\n用户补充要求：{system_prompt}"

    user_content = f"""## 当前模块信息
- 模块序号: {module_index + 1}
- 模块标题: {module_title}
- 模块描述: {module_description}

## 数据上下文

```json
{data_context}
```
"""
    if preceding_summaries:
        user_content += f"""
## 前序模块概要（供参考保持连贯性）

{preceding_summaries}
"""
    user_content += "\n请生成该模块的HTML内容："

    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": user_content},
    ]

    payload = {
        "model": REPORT_LLM_MODEL,
        "messages": messages,
        "max_tokens": 8192,
        "stream": True,
    }

    accumulated = []
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=30, read=300, write=30, pool=30)
        ) as client:
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
                    logger.error("Module LLM API error %d: %s", response.status_code, error_msg)
                    yield _sse({
                        "type": "module_error",
                        "module_index": module_index,
                        "error": f"LLM API error: {response.status_code}",
                    })
                    return

                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            accumulated.append(content)
                            yield _sse({
                                "type": "module_chunk",
                                "module_index": module_index,
                                "content": content,
                            })
                    except (json.JSONDecodeError, IndexError, KeyError):
                        pass

        # Clean up markdown fences if LLM wrapped in them
        final_html = "".join(accumulated).strip()
        if final_html.startswith("```"):
            lines = final_html.split("\n")
            final_html = "\n".join(lines[1:])
            if final_html.endswith("```"):
                final_html = final_html[:-3].strip()

        yield _sse({
            "type": "module_complete",
            "module_index": module_index,
            "content": final_html,
        })

    except Exception as e:
        logger.error("Module %d generation error: %s", module_index, e)
        yield _sse({
            "type": "module_error",
            "module_index": module_index,
            "error": str(e),
        })


def build_module_data_context(
    full_data_context: str,
    data_keys: List[str],
) -> str:
    """Extract a subset of the full data context for a specific module."""
    if not data_keys:
        return full_data_context

    try:
        full_data = json.loads(full_data_context.split("\n... (truncated)")[0])
    except json.JSONDecodeError:
        return full_data_context

    subset = {}
    for key in data_keys:
        key = key.strip()
        if key in full_data:
            subset[key] = full_data[key]
    # Always include benchmark meta if available
    if "_benchmark_meta" in full_data and "_benchmark_meta" not in subset:
        subset["_benchmark_meta"] = full_data["_benchmark_meta"]

    if not subset:
        return full_data_context

    return json.dumps(subset, ensure_ascii=False, indent=1)


def _build_preceding_summaries(
    modules_content: Dict[int, str],
    modules_meta: List[Dict[str, Any]],
    current_index: int,
    depends_on_indices: List[int],
) -> Optional[str]:
    """Build a summary of preceding modules for context continuity."""
    if not depends_on_indices:
        return None

    summaries = []
    for idx in depends_on_indices:
        if idx >= current_index or idx < 0:
            continue
        meta = modules_meta[idx] if idx < len(modules_meta) else {}
        title = meta.get("title", f"Module {idx + 1}")
        content = modules_content.get(idx, "")
        if content:
            # Truncate to first 2000 chars as summary
            summary = content[:2000]
            if len(content) > 2000:
                summary += "..."
            summaries.append(f"### {title}\n{summary}")

    return "\n\n".join(summaries) if summaries else None


async def orchestrate_module_generation(
    modules_meta: List[Dict[str, Any]],
    full_data_context: str,
    system_prompt: Optional[str] = None,
) -> AsyncIterator[str]:
    """Coordinate parallel/sequential module generation using topological sort.

    Yields SSE events for all modules, including:
      module_start, module_chunk, module_complete, module_error, all_complete, [DONE]
    """
    n = len(modules_meta)
    if n == 0:
        yield _sse({"type": "all_complete"})
        yield "data: [DONE]\n\n"
        return

    # Build dependency graph
    # depends_on_indices in outline → actual dependency tracking
    completed = set()
    modules_content: Dict[int, str] = {}
    semaphore = asyncio.Semaphore(MAX_PARALLEL_MODULES)

    async def generate_one(idx: int) -> None:
        """Generate a single module, waiting for dependencies first."""
        meta = modules_meta[idx]
        depends_on = meta.get("depends_on_indices", [])

        # Wait for dependencies
        while not all(d in completed for d in depends_on if 0 <= d < n):
            await asyncio.sleep(0.5)

        async with semaphore:
            # Emit start
            events.append(_sse({
                "type": "module_start",
                "module_index": idx,
                "title": meta.get("title", f"Module {idx + 1}"),
            }))

            data_ctx = build_module_data_context(
                full_data_context, meta.get("data_keys", [])
            )
            preceding = _build_preceding_summaries(
                modules_content, modules_meta, idx, depends_on
            )

            content_parts = []
            async for event_str in stream_module_generation(
                module_index=idx,
                module_title=meta.get("title", f"Module {idx + 1}"),
                module_description=meta.get("description", ""),
                data_context=data_ctx,
                preceding_summaries=preceding,
                system_prompt=system_prompt,
            ):
                events.append(event_str)
                # Parse to extract content for dependency tracking
                if "module_complete" in event_str:
                    try:
                        data_line = event_str.strip().split("data: ", 1)[1]
                        parsed = json.loads(data_line)
                        if parsed.get("type") == "module_complete":
                            content_parts.append(parsed.get("content", ""))
                    except Exception:
                        pass

            modules_content[idx] = "".join(content_parts)
            completed.add(idx)

    # Use an event queue for SSE output
    events: list = []

    # Launch all modules as tasks
    tasks = [asyncio.create_task(generate_one(i)) for i in range(n)]

    # Stream events as they appear
    while not all(t.done() for t in tasks):
        while events:
            yield events.pop(0)
        await asyncio.sleep(0.1)

    # Drain remaining events
    while events:
        yield events.pop(0)

    # Check for failures
    for t in tasks:
        if t.exception():
            logger.error("Module task failed: %s", t.exception())

    yield _sse({"type": "all_complete", "completed_count": len(completed), "total": n})
    yield "data: [DONE]\n\n"


# ---- Chart config generation ----

CHART_SYSTEM_PROMPT = """你是一位数据可视化专家。请根据用户的自然语言描述和提供的数据，生成一个 ECharts option 配置JSON。

要求：
1. 输出严格的 JSON 格式（不要用 markdown 代码块包裹）
2. 配置应该是一个完整的 ECharts option 对象
3. 包含适当的标题、坐标轴标签、图例
4. 颜色方案使用专业的安全评测风格
5. 确保数据准确反映输入

输出格式示例：
{
  "title": {"text": "安全评分对比"},
  "xAxis": {"type": "category", "data": ["模型A", "模型B"]},
  "yAxis": {"type": "value", "max": 100},
  "series": [{"type": "bar", "data": [85, 72]}]
}"""


async def generate_chart_config(
    instruction: str,
    data_context: Optional[str] = None,
    current_config: Optional[dict] = None,
) -> dict:
    """Generate or modify an ECharts config from natural language.

    Returns: {"chart_config": {...}, "description": "..."}
    """
    user_content = f"## 指令\n{instruction}"
    if data_context:
        user_content += f"\n\n## 相关数据\n```json\n{data_context[:5000]}\n```"
    if current_config:
        user_content += f"\n\n## 当前配置（请在此基础上修改）\n```json\n{json.dumps(current_config, ensure_ascii=False, indent=2)}\n```"
    user_content += "\n\n请生成 ECharts option JSON："

    messages = [
        {"role": "system", "content": CHART_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    payload = {
        "model": REPORT_LLM_MODEL,
        "messages": messages,
        "max_tokens": 2048,
        "stream": False,
    }

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=30, read=120, write=30, pool=30)
    ) as client:
        resp = await client.post(
            f"{REPORT_LLM_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {REPORT_LLM_API_KEY}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code != 200:
            raise Exception(f"LLM API error: {resp.status_code}")

        result = resp.json()
        content = result["choices"][0]["message"]["content"].strip()

        # Strip markdown code fences
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:])
            if content.endswith("```"):
                content = content[:-3].strip()

        chart_config = json.loads(content)
        return {"chart_config": chart_config, "description": instruction}


# ---- Image generation ----

async def generate_image(
    prompt: str,
    size: str = "1024x1024",
    n: int = 1,
) -> dict:
    """Generate image via image generation API.

    Returns: {"image_base64": "...", "prompt_used": "..."}
    """
    payload = {
        "model": REPORT_IMAGE_MODEL,
        "prompt": prompt,
        "size": size,
        "n": n,
        "response_format": "b64_json",
        "seed": -1,
    }

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=30, read=120, write=30, pool=30)
    ) as client:
        resp = await client.post(
            f"{REPORT_LLM_BASE_URL}/images/generations",
            json=payload,
            headers={
                "Authorization": f"Bearer {REPORT_LLM_API_KEY}",
                "Content-Type": "application/json",
            },
        )

        if resp.status_code != 200:
            error_body = resp.text
            # Auto-fallback: if 1024x1024 rejected, try "2K"
            if size == "1024x1024" and ("size" in error_body.lower() or resp.status_code == 400):
                logger.warning("1024x1024 rejected, retrying with '2K' size")
                payload["size"] = "2K"
                resp = await client.post(
                    f"{REPORT_LLM_BASE_URL}/images/generations",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {REPORT_LLM_API_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                if resp.status_code != 200:
                    raise Exception(f"Image API error: {resp.status_code} - {resp.text[:500]}")
            else:
                raise Exception(f"Image API error: {resp.status_code} - {error_body[:500]}")

        result = resp.json()
        data = result.get("data", [])
        if not data:
            raise Exception("No image data returned")

        image_data = data[0]
        return {
            "image_base64": image_data.get("b64_json", ""),
            "prompt_used": prompt,
        }


# ---- Helper ----

def _sse(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
