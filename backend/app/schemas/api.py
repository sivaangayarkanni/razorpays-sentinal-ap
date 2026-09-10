"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ---- Auth ----
class AdminLoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- Intent / Agent API ----
class IntentCreate(BaseModel):
    amount_paise: int = Field(..., gt=0, description="Amount in paise (INR * 100)")
    currency: str = Field(default="INR", min_length=3, max_length=3)
    sku: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    external_ref: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DecisionOut(BaseModel):
    gate: str
    outcome: str
    reason_code: Optional[str] = None
    reason_message: Optional[str] = None
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class IntentResponse(BaseModel):
    id: UUID
    status: str
    amount_paise: int
    currency: str
    sku: str
    description: Optional[str] = None
    external_ref: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    decisions: list[DecisionOut] = Field(default_factory=list)
    queue_job_id: Optional[UUID] = None
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Policy ----
class PolicyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    max_amount_paise: int = 10_000_00
    daily_budget_paise: int = 50_000_00
    sku_whitelist: list[str] = Field(default_factory=list)
    sku_blacklist: list[str] = Field(default_factory=list)
    allowed_currencies: list[str] = Field(default_factory=lambda: ["INR"])
    is_active: bool = True


class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_amount_paise: Optional[int] = None
    daily_budget_paise: Optional[int] = None
    sku_whitelist: Optional[list[str]] = None
    sku_blacklist: Optional[list[str]] = None
    allowed_currencies: Optional[list[str]] = None
    is_active: Optional[bool] = None


class PolicyOut(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str] = None
    max_amount_paise: int
    daily_budget_paise: int
    sku_whitelist: list[Any]
    sku_blacklist: list[Any]
    allowed_currencies: list[Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---- Queue ----
class QueueJobOut(BaseModel):
    id: UUID
    intent_id: UUID
    status: str
    attempts: int
    max_attempts: int
    last_error: Optional[str] = None
    next_retry_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    intent: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}


# ---- Bank health ----
class BankHealthOut(BaseModel):
    provider: str
    success_rate: float
    latency_ms: int
    is_degraded: bool
    threshold: float
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class BankHealthConfigUpdate(BaseModel):
    threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    mock_success_rate: Optional[float] = Field(None, ge=0.0, le=1.0)


# ---- Audit ----
class AuditEventOut(BaseModel):
    id: UUID
    actor: str
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    payload: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Org / Agent ----
class AgentOut(BaseModel):
    id: UUID
    name: str
    api_key_prefix: str
    is_active: bool
    created_at: datetime
    api_key: Optional[str] = None  # only on create

    model_config = {"from_attributes": True}


class AgentCreate(BaseModel):
    name: str


class OrgOut(BaseModel):
    id: UUID
    name: str
    slug: str
    bank_health_threshold: float
    is_active: bool

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_intents: int
    allowed: int
    hard_blocked: int
    queued: int
    cleared: int
    failed: int
    bank_success_rate: float
    bank_is_degraded: bool
