"""SQLAlchemy ORM table definitions."""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime,
    ForeignKey, JSON, Index,
)
from sqlalchemy.orm import DeclarativeBase, relationship


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

    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    scenario_key = Column(String(64), nullable=True)
    attack_id = Column(String(64), nullable=True)
    attack_type = Column(String(32), nullable=True)
    payload = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    data_json = Column(JSON, default=dict)  # Full test case schema (v2.x)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    capability_level = Column(String(32), nullable=True)  # F1-F6
    data_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    cases = relationship("DatasetCase", back_populates="dataset", cascade="all, delete-orphan")


class DatasetCase(Base):
    __tablename__ = "dataset_cases"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("test_cases.id"), nullable=True)
    order_index = Column(Integer, default=0)

    dataset = relationship("Dataset", back_populates="cases")


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True)
    name = Column(String(256), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    status = Column(String(32), default="pending")  # pending | running | completed
    summary_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    entries = relationship("TestResultEntry", back_populates="test_result", cascade="all, delete-orphan")


class TestResultEntry(Base):
    __tablename__ = "test_result_entries"

    id = Column(Integer, primary_key=True)
    test_result_id = Column(Integer, ForeignKey("test_results.id", ondelete="CASCADE"), nullable=False)
    test_case_id = Column(Integer, ForeignKey("test_cases.id"), nullable=True)
    attack_name = Column(String(256), nullable=True)
    model_id = Column(String(128), nullable=True)
    response = Column(Text, nullable=True)
    judgment = Column(JSON, default=dict)  # {riskLevel, reason, ...}
    timing_json = Column(JSON, default=dict)
    token_usage_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    test_result = relationship("TestResult", back_populates="entries")


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
