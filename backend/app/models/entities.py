"""SQLAlchemy ORM models for Sentinel-AP."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


# Use JSONB on Postgres; JSON for sqlite tests
JsonType = JSON().with_variant(JSONB(), "postgresql")


class DecisionOutcome(str, enum.Enum):
    ALLOW = "ALLOW"
    HARD_BLOCK = "HARD_BLOCK"
    QUEUED = "QUEUED"
    CLEARED = "CLEARED"
    FAILED = "FAILED"


class QueueStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    RETRYING = "RETRYING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    bank_health_threshold: Mapped[float] = mapped_column(Float, default=0.95)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    agents: Mapped[list[Agent]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    policies: Mapped[list[Policy]] = relationship(back_populates="organization", cascade="all, delete-orphan")
    intents: Mapped[list[Intent]] = relationship(back_populates="organization")


class Agent(Base):
    __tablename__ = "agents"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_agent_org_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)  # sap_xxxx for lookup
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="agents")
    intents: Mapped[list[Intent]] = relationship(back_populates="agent")


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Budget in paise (INR * 100)
    max_amount_paise: Mapped[int] = mapped_column(Integer, default=100_000_00)  # ₹1,00,000
    daily_budget_paise: Mapped[int] = mapped_column(Integer, default=500_000_00)  # ₹5,00,000
    sku_whitelist: Mapped[list[Any]] = mapped_column(JsonType, default=list)
    sku_blacklist: Mapped[list[Any]] = mapped_column(JsonType, default=list)
    allowed_currencies: Mapped[list[Any]] = mapped_column(JsonType, default=lambda: ["INR"])
    extra_rules: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="policies")


class Intent(Base):
    __tablename__ = "intents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"))
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id"))
    external_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    sku: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    status: Mapped[DecisionOutcome] = mapped_column(
        Enum(DecisionOutcome, name="decision_outcome"), default=DecisionOutcome.ALLOW
    )
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="intents")
    agent: Mapped[Agent] = relationship(back_populates="intents")
    decisions: Mapped[list[Decision]] = relationship(back_populates="intent", cascade="all, delete-orphan")
    queue_jobs: Mapped[list[QueueJob]] = relationship(back_populates="intent", cascade="all, delete-orphan")


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    intent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("intents.id", ondelete="CASCADE"))
    gate: Mapped[str] = mapped_column(String(32), nullable=False)  # gate1 | gate2 | razorpay
    outcome: Mapped[DecisionOutcome] = mapped_column(Enum(DecisionOutcome, name="decision_outcome", create_constraint=False))
    reason_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reason_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    intent: Mapped[Intent] = relationship(back_populates="decisions")


class QueueJob(Base):
    __tablename__ = "queue_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    intent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("intents.id", ondelete="CASCADE"))
    status: Mapped[QueueStatus] = mapped_column(
        Enum(QueueStatus, name="queue_status"), default=QueueStatus.PENDING
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=5)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    intent: Mapped[Intent] = relationship(back_populates="queue_jobs")


class BankHealthSnapshot(Base):
    __tablename__ = "bank_health_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    provider: Mapped[str] = mapped_column(String(64), default="razorpay")
    success_rate: Mapped[float] = mapped_column(Float, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    is_degraded: Mapped[bool] = mapped_column(Boolean, default=False)
    details: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True
    )
    actor: Mapped[str] = mapped_column(String(255), nullable=False)  # agent:id | admin:email | system
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JsonType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class IdempotencyRecord(Base):
    """Maps (agent_id, Idempotency-Key) → intent for safe retries."""

    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("agent_id", "key", name="uq_idempotency_agent_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    agent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    intent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("intents.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
