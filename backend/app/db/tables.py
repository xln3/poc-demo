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


class AgentConfig(Base):
    """Persisted agent configuration for eval integration."""
    __tablename__ = "agent_configs"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(256), nullable=False)
    api_base = Column(String(512), nullable=False)
    api_key_encrypted = Column(Text, nullable=True)
    model_id = Column(String(256), nullable=False)  # openai/xxx format
    system_prompt = Column(Text, nullable=True)
    tools_enabled = Column(Boolean, default=False)
    enabled_tools = Column(JSON, default=list)
    rag_enabled = Column(Boolean, default=False)
    rag_config = Column(JSON, default=dict)
    mcp_enabled = Column(Boolean, default=False)
    mcp_servers = Column(JSON, default=list)
    features = Column(JSON, default=dict)  # {thinking:{enabled,mode,budget},web,tools,...}
    eval_model_id = Column(String(256), nullable=True)  # ID in eval-poc
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)


class EvalTemplate(Base):
    """Reusable evaluation configuration template."""
    __tablename__ = "eval_templates"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    config_json = Column(JSON, nullable=False, default=dict)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)


class Report(Base):
    """LLM-generated evaluation report."""
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(512), nullable=False)
    content = Column(Text, nullable=True)  # HTML content
    scenario_type = Column(String(64), nullable=False, default="single_agent")
    system_prompt = Column(Text, nullable=True)
    source_data = Column(JSON, nullable=False, default=dict)  # {agents, models, jobs, ...}
    metadata_json = Column(JSON, nullable=False, default=dict)
    status = Column(String(32), nullable=False, default="draft")  # draft | generating | ready
    generation_mode = Column(String(16), nullable=False, default="legacy")  # legacy | modular
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    history = relationship("ReportHistory", back_populates="report", cascade="all, delete-orphan",
                           order_by="ReportHistory.version.desc()")
    outline = relationship("ReportOutline", back_populates="report", uselist=False,
                           cascade="all, delete-orphan")
    modules = relationship("ReportModule", back_populates="report", cascade="all, delete-orphan",
                           order_by="ReportModule.order_index")


class ReportHistory(Base):
    """Version snapshot of a report's content."""
    __tablename__ = "report_history"

    id = Column(Integer, primary_key=True)
    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=True)  # HTML snapshot
    change_summary = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    report = relationship("Report", back_populates="history")

    __table_args__ = (
        Index("ix_report_history_report_version", "report_id", "version", unique=True),
    )


class ReportOutline(Base):
    """Structured outline for modular report generation."""
    __tablename__ = "report_outlines"

    id = Column(String(36), primary_key=True, default=_uuid)
    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"),
                       nullable=False, unique=True)
    outline_json = Column(JSON, nullable=False, default=dict)
    # { modules: [{ title, description, data_keys, depends_on_indices, suggested_charts }] }
    status = Column(String(16), nullable=False, default="draft")  # draft | approved | generating
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    report = relationship("Report", back_populates="outline")


class ReportModule(Base):
    """Individual module of a modular report."""
    __tablename__ = "report_modules"

    id = Column(String(36), primary_key=True, default=_uuid)
    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)  # HTML content for this module
    status = Column(String(16), nullable=False, default="pending")
    # pending | generating | ready | error
    depends_on = Column(JSON, nullable=False, default=list)  # list of module IDs
    data_keys = Column(JSON, nullable=False, default=list)  # data keys relevant to this module
    chart_configs = Column(JSON, nullable=False, default=list)  # list of ECharts option objects
    generation_meta = Column(JSON, nullable=False, default=dict)  # tokens used, timing, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    report = relationship("Report", back_populates="modules")

    __table_args__ = (
        Index("ix_report_modules_report_order", "report_id", "order_index"),
    )


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
