"""SQLAlchemy ORM table definitions."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime,
    ForeignKey, JSON, Index,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(String(16), nullable=False, default="tester")  # admin | tester
    created_at = Column(DateTime, default=datetime.utcnow)

    providers = relationship("LLMProvider", back_populates="user", cascade="all, delete-orphan")


class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider_name = Column(String(64), nullable=False)  # e.g. "OpenAI", "智谱"
    base_url = Column(String(512), nullable=False)
    api_key_encrypted = Column(Text, nullable=False)  # Fernet encrypted
    models_json = Column(JSON, default=list)  # ["gpt-4o", "gpt-4o-mini"]
    is_default = Column(Boolean, default=False)
    input_price_per_1k = Column(Float, nullable=True)
    output_price_per_1k = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="providers")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(256), nullable=False)
    scenario_key = Column(String(64), nullable=True)
    attack_id = Column(String(64), nullable=True)
    attack_type = Column(String(32), nullable=True)
    capability_level = Column(String(32), nullable=True)  # F1-F6
    payload = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    threat_class = Column(String(16), nullable=True)  # T1.1, T2.3, etc.
    risk_item_id = Column(Integer, nullable=True)  # Maps to RISK_ITEMS[id]
    data_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    capability_level = Column(String(32), nullable=True)  # F1-F6
    case_count = Column(Integer, default=0)
    total_size = Column(Integer, default=0)
    data_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(256), nullable=False)
    status = Column(String(32), default="pending")
    source_type = Column(String(32), default="manual")
    data_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class ApiUsage(Base):
    """Tracks per-call LLM API usage for cost analysis."""
    __tablename__ = "api_usage"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    provider_id = Column(Integer, ForeignKey("llm_providers.id"), nullable=True)
    model = Column(String(128), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    cost = Column(Float, nullable=True)  # calculated from provider pricing

    __table_args__ = (
        Index("ix_api_usage_user_ts", "user_id", "timestamp"),
    )
