"""LLM provider management and chat proxy endpoints.

Providers are stored per-user with encrypted API keys. The /api/llm/chat
endpoint proxies requests to the configured LLM API, keeping keys server-side.
"""

import ipaddress
import logging
import os
import socket
from datetime import datetime
from typing import Optional, List
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from ..db.engine import get_db
from ..db.tables import User, LLMProvider, ApiUsage, AgentConfig
from ..auth.security import require_user, get_current_user
from ..services.encryption import encrypt_api_key, decrypt_api_key, mask_api_key

router = APIRouter(prefix="/api/llm", tags=["llm"])
limiter = Limiter(key_func=get_remote_address)

LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT", "120"))
# 流式请求的读超时单独放宽：思考型模型（如 kimi-k3）单轮生成可达数分钟，
# 网关排队时 chunk 间隔可能超过 120s。connect 保持 30s 快速失败。
LLM_STREAM_TIMEOUT = httpx.Timeout(
    float(os.environ.get("LLM_STREAM_TIMEOUT", "600")), connect=30.0
)


def _validate_llm_url(url: str) -> None:
    """Block SSRF: only allow HTTPS/HTTP to public internet hosts.

    Raises HTTPException(400) if the URL targets private/reserved networks,
    uses a non-HTTP scheme, or resolves to a private IP.
    """
    parsed = urlparse(url)

    # Scheme whitelist
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail=f"URL scheme '{parsed.scheme}' not allowed; use http or https")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="URL has no hostname")

    # Block well-known cloud metadata endpoints
    _BLOCKED_HOSTS = {"metadata.google.internal", "169.254.169.254"}
    if hostname in _BLOCKED_HOSTS:
        raise HTTPException(status_code=400, detail="URL targets a blocked metadata service")

    # Resolve hostname and check all IPs
    try:
        addr_infos = socket.getaddrinfo(hostname, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail=f"Cannot resolve hostname: {hostname}")

    for family, _, _, _, sockaddr in addr_infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(
                status_code=400,
                detail=f"URL resolves to a private/reserved IP ({ip}); only public addresses are allowed",
            )


# ===== Pydantic models =====

class ProviderCreate(BaseModel):
    provider_name: str
    base_url: str
    api_key: str
    models: List[str] = []
    is_default: bool = False
    input_price_per_1k: Optional[float] = None
    output_price_per_1k: Optional[float] = None


class ProviderUpdate(BaseModel):
    provider_name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None  # only updated if provided
    models: Optional[List[str]] = None
    is_default: Optional[bool] = None
    input_price_per_1k: Optional[float] = None
    output_price_per_1k: Optional[float] = None


class ProviderResponse(BaseModel):
    id: int
    provider_name: str
    base_url: str
    api_key_masked: str
    models: List[str]
    is_default: bool
    input_price_per_1k: Optional[float]
    output_price_per_1k: Optional[float]


class ChatRequest(BaseModel):
    messages: list
    system_prompt: str = ""
    provider_id: Optional[int] = None
    agent_id: Optional[str] = None  # Use agent's API config instead of provider
    model: Optional[str] = None  # If absent with agent_id, uses agent's model_id
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 1.0
    stream: bool = False
    tools: Optional[list] = None
    thinking: Optional[dict] = None


# ===== Provider CRUD =====

@router.post("/providers", response_model=ProviderResponse, status_code=201)
async def create_provider(
    req: ProviderCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    _validate_llm_url(req.base_url)
    provider = LLMProvider(
        user_id=user.id,
        provider_name=req.provider_name,
        base_url=req.base_url.rstrip("/"),
        api_key_encrypted=encrypt_api_key(req.api_key),
        models_json=req.models,
        is_default=req.is_default,
        input_price_per_1k=req.input_price_per_1k,
        output_price_per_1k=req.output_price_per_1k,
    )
    # If setting as default, unset others
    if req.is_default:
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.user_id == user.id, LLMProvider.is_default == True)
        )
        for p in result.scalars():
            p.is_default = False

    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return _to_response(provider)


@router.get("/providers", response_model=List[ProviderResponse])
async def list_providers(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.user_id == user.id).order_by(LLMProvider.id)
    )
    return [_to_response(p) for p in result.scalars()]


@router.put("/providers/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: int,
    req: ProviderUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.id == provider_id, LLMProvider.user_id == user.id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if req.provider_name is not None:
        provider.provider_name = req.provider_name
    if req.base_url is not None:
        _validate_llm_url(req.base_url)
        provider.base_url = req.base_url.rstrip("/")
    if req.api_key is not None:
        provider.api_key_encrypted = encrypt_api_key(req.api_key)
    if req.models is not None:
        provider.models_json = req.models
    if req.is_default is not None:
        if req.is_default:
            others = await db.execute(
                select(LLMProvider).where(LLMProvider.user_id == user.id, LLMProvider.is_default == True)
            )
            for p in others.scalars():
                p.is_default = False
        provider.is_default = req.is_default
    if req.input_price_per_1k is not None:
        provider.input_price_per_1k = req.input_price_per_1k
    if req.output_price_per_1k is not None:
        provider.output_price_per_1k = req.output_price_per_1k

    await db.commit()
    await db.refresh(provider)
    return _to_response(provider)


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.id == provider_id, LLMProvider.user_id == user.id)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    await db.delete(provider)
    await db.commit()
    return {"ok": True}


# ===== Chat Proxy =====

@router.post("/chat")
@limiter.limit("60/minute")
async def chat_proxy(
    request: Request,
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_user),
):
    """Proxy LLM chat request — reads API key from DB, forwards to provider or agent."""
    logger.info("chat_proxy: agent_id=%s, provider_id=%s, model=%r", req.agent_id, req.provider_id, req.model)
    provider = None
    effective_model = req.model  # may be overridden by agent
    if req.agent_id:
        # Agent-based routing: use agent's API config
        result = await db.execute(
            select(AgentConfig).where(AgentConfig.id == req.agent_id, AgentConfig.created_by == user.id)
        )
        agent = result.scalar_one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        api_key = decrypt_api_key(agent.api_key_encrypted) if agent.api_key_encrypted else ""
        base = agent.api_base.rstrip("/")
        url = base + "/chat/completions" if not base.endswith("/chat/completions") else base
        # Use agent's model_id if no model specified or if the model doesn't match agent
        if not effective_model:
            effective_model = agent.model_id
    elif req.provider_id:
        # Legacy provider-based routing
        result = await db.execute(
            select(LLMProvider).where(LLMProvider.id == req.provider_id, LLMProvider.user_id == user.id)
        )
        provider = result.scalar_one_or_none()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider not found")
        api_key = decrypt_api_key(provider.api_key_encrypted)
        url = provider.base_url + "/chat/completions" if not provider.base_url.endswith("/chat/completions") else provider.base_url
    else:
        raise HTTPException(status_code=400, detail="Either provider_id or agent_id is required")

    # Strip provider prefix from model_id (e.g., "openai/gpt-4o" → "gpt-4o")
    # Eval-poc uses "openai/<model>" format, but LLM APIs expect bare model names.
    if effective_model and "/" in effective_model:
        effective_model = effective_model.split("/", 1)[1]

    # Build request body
    body = {
        "model": effective_model or req.model,
        "messages": (
            [{"role": "system", "content": req.system_prompt}] if req.system_prompt else []
        ) + req.messages,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
        "top_p": req.top_p,
    }
    if req.stream:
        body["stream"] = True
    if req.tools:
        body["tools"] = req.tools
        body["tool_choice"] = "auto"
    if req.thinking:
        body["thinking"] = req.thinking

    # Usage tracking identifiers (agents have no pricing info)
    # provider_id column is INTEGER — use 0 for agent-based calls
    source_id = provider.id if req.provider_id and provider else 0
    input_price = getattr(provider, 'input_price_per_1k', None) if req.provider_id else None
    output_price = getattr(provider, 'output_price_per_1k', None) if req.provider_id else None

    logger.info("chat_proxy: effective_model=%r, url=%s", effective_model, url)
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    if req.stream:
        return StreamingResponse(
            _stream_proxy(url, headers, body, user.id, source_id, effective_model or req.model,
                          input_price, output_price),
            media_type="text/event-stream",
        )

    # Non-streaming
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        resp = await client.post(url, json=body, headers=headers)

    if resp.status_code != 200:
        logger.warning("LLM upstream error %d (model=%r): %s", resp.status_code, body.get("model"), resp.text[:500])
        raise HTTPException(status_code=502, detail=f"LLM provider returned {resp.status_code}: {resp.text[:200]}")

    data = resp.json()

    # Record usage
    usage = data.get("usage", {})
    await _record_usage(db, user.id, source_id, effective_model or req.model, usage,
                        input_price, output_price)

    return data


async def _stream_proxy(url, headers, body, user_id, provider_id, model, input_price, output_price):
    """Generator that proxies SSE stream and records usage at the end.

    Uses an independent DB session for usage recording so that the
    caller's request-scoped session is not accessed after yield.
    """
    import json as _json
    prompt_tokens = 0
    completion_tokens = 0

    async with httpx.AsyncClient(timeout=LLM_STREAM_TIMEOUT) as client:
        async with client.stream("POST", url, json=body, headers=headers) as resp:
            async for chunk in resp.aiter_bytes():
                yield chunk
                # Try to extract usage from final chunk
                text = chunk.decode("utf-8", errors="replace")
                if '"usage"' in text:
                    try:
                        for line in text.split("\n"):
                            line = line.strip()
                            if line.startswith("data: ") and line != "data: [DONE]":
                                parsed = _json.loads(line[6:])
                                if "usage" in parsed:
                                    prompt_tokens = parsed["usage"].get("prompt_tokens", 0)
                                    completion_tokens = parsed["usage"].get("completion_tokens", 0)
                    except Exception:
                        pass

    # Record usage with an independent session (the request-scoped session
    # from Depends(get_db) should not be used inside a generator after yield).
    from ..db.engine import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        usage = {"prompt_tokens": prompt_tokens, "completion_tokens": completion_tokens}
        await _record_usage(db, user_id, provider_id, model, usage, input_price, output_price)


async def _record_usage(db, user_id, provider_id, model, usage_dict, input_price=None, output_price=None):
    """Write a row to api_usage.  Skip if no valid provider_id (agent-based calls)."""
    if not provider_id:
        return  # Agent-based calls have no provider FK — skip usage recording

    prompt_tokens = usage_dict.get("prompt_tokens", 0)
    completion_tokens = usage_dict.get("completion_tokens", 0)

    cost = None
    if input_price and output_price:
        cost = (
            (prompt_tokens / 1000) * input_price
            + (completion_tokens / 1000) * output_price
        )

    row = ApiUsage(
        user_id=user_id,
        provider_id=provider_id,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        cost=cost,
    )
    db.add(row)
    await db.commit()


def _to_response(p: LLMProvider) -> ProviderResponse:
    return ProviderResponse(
        id=p.id,
        provider_name=p.provider_name,
        base_url=p.base_url,
        api_key_masked=mask_api_key(decrypt_api_key(p.api_key_encrypted)),
        models=p.models_json or [],
        is_default=p.is_default,
        input_price_per_1k=p.input_price_per_1k,
        output_price_per_1k=p.output_price_per_1k,
    )
