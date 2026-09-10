"""Admin dashboard APIs."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminDep, DbSession
from app.core.config import get_settings
from app.core.security import create_access_token, generate_api_key, hash_api_key
from app.models.entities import (
    Agent,
    AuditEvent,
    BankHealthSnapshot,
    DecisionOutcome,
    Intent,
    Organization,
    Policy,
    QueueJob,
    QueueStatus,
)
from app.schemas.api import (
    AdminLoginRequest,
    AgentCreate,
    AgentOut,
    AuditEventOut,
    BankHealthConfigUpdate,
    BankHealthOut,
    DashboardStats,
    IntentResponse,
    DecisionOut,
    OrgOut,
    PolicyCreate,
    PolicyOut,
    PolicyUpdate,
    QueueJobOut,
    TokenResponse,
)
from app.services.audit import write_audit
from app.services.bank_health import bank_health_service
from app.services.gate_pipeline import retry_queued_job

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/login", response_model=TokenResponse)
async def login(body: AdminLoginRequest) -> TokenResponse:
    settings = get_settings()
    if body.email != settings.admin_email or body.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(body.email, extra={"role": "admin"})
    return TokenResponse(access_token=token)


@router.get("/stats", response_model=DashboardStats)
async def stats(_: AdminDep, db: DbSession) -> DashboardStats:
    async def count(status: DecisionOutcome | None = None) -> int:
        stmt = select(func.count(Intent.id))
        if status:
            stmt = stmt.where(Intent.status == status)
        r = await db.execute(stmt)
        return int(r.scalar_one())

    health = await bank_health_service.check()
    return DashboardStats(
        total_intents=await count(),
        allowed=await count(DecisionOutcome.ALLOW),
        hard_blocked=await count(DecisionOutcome.HARD_BLOCK),
        queued=await count(DecisionOutcome.QUEUED),
        cleared=await count(DecisionOutcome.CLEARED),
        failed=await count(DecisionOutcome.FAILED),
        bank_success_rate=health.success_rate,
        bank_is_degraded=health.is_degraded,
    )


@router.get("/intents", response_model=list[IntentResponse])
async def list_intents(
    _: AdminDep,
    db: DbSession,
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
) -> list[IntentResponse]:
    stmt = (
        select(Intent)
        .options(selectinload(Intent.decisions), selectinload(Intent.queue_jobs))
        .order_by(Intent.created_at.desc())
        .limit(limit)
    )
    if status:
        stmt = stmt.where(Intent.status == DecisionOutcome(status))
    rows = (await db.execute(stmt)).scalars().all()
    out: list[IntentResponse] = []
    for intent in rows:
        st = intent.status.value if hasattr(intent.status, "value") else str(intent.status)
        out.append(
            IntentResponse(
                id=intent.id,
                status=st,
                amount_paise=intent.amount_paise,
                currency=intent.currency,
                sku=intent.sku,
                description=intent.description,
                external_ref=intent.external_ref,
                razorpay_order_id=intent.razorpay_order_id,
                razorpay_payment_id=intent.razorpay_payment_id,
                decisions=[
                    DecisionOut(
                        gate=d.gate,
                        outcome=d.outcome.value if hasattr(d.outcome, "value") else str(d.outcome),
                        reason_code=d.reason_code,
                        reason_message=d.reason_message,
                        details=d.details or {},
                        created_at=d.created_at,
                    )
                    for d in sorted(intent.decisions, key=lambda x: x.created_at)
                ],
                queue_job_id=intent.queue_jobs[0].id if intent.queue_jobs else None,
                message=st,
                created_at=intent.created_at,
            )
        )
    return out


@router.get("/policies", response_model=list[PolicyOut])
async def list_policies(_: AdminDep, db: DbSession) -> list[Policy]:
    q = await db.execute(select(Policy).order_by(Policy.created_at.desc()))
    return list(q.scalars().all())


@router.post("/policies", response_model=PolicyOut)
async def create_policy(body: PolicyCreate, admin: AdminDep, db: DbSession) -> Policy:
    org = (await db.execute(select(Organization).limit(1))).scalar_one_or_none()
    if not org:
        raise HTTPException(400, "No organization seeded")
    # deactivate previous
    existing = (await db.execute(select(Policy).where(Policy.organization_id == org.id))).scalars().all()
    for p in existing:
        p.is_active = False
    policy = Policy(organization_id=org.id, **body.model_dump())
    db.add(policy)
    await write_audit(
        db,
        actor=f"admin:{admin['sub']}",
        action="policy.create",
        organization_id=org.id,
        resource_type="policy",
        payload=body.model_dump(),
    )
    await db.flush()
    return policy


@router.patch("/policies/{policy_id}", response_model=PolicyOut)
async def update_policy(policy_id: UUID, body: PolicyUpdate, admin: AdminDep, db: DbSession) -> Policy:
    policy = await db.get(Policy, policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(policy, k, v)
    await write_audit(
        db,
        actor=f"admin:{admin['sub']}",
        action="policy.update",
        organization_id=policy.organization_id,
        resource_type="policy",
        resource_id=str(policy.id),
        payload=body.model_dump(exclude_unset=True),
    )
    await db.flush()
    return policy


@router.get("/queue", response_model=list[QueueJobOut])
async def list_queue(_: AdminDep, db: DbSession, status: Optional[str] = None) -> list[QueueJobOut]:
    stmt = (
        select(QueueJob)
        .options(selectinload(QueueJob.intent))
        .order_by(QueueJob.created_at.desc())
        .limit(100)
    )
    if status:
        stmt = stmt.where(QueueJob.status == QueueStatus(status))
    jobs = (await db.execute(stmt)).scalars().all()
    result: list[QueueJobOut] = []
    for j in jobs:
        result.append(
            QueueJobOut(
                id=j.id,
                intent_id=j.intent_id,
                status=j.status.value if hasattr(j.status, "value") else str(j.status),
                attempts=j.attempts,
                max_attempts=j.max_attempts,
                last_error=j.last_error,
                next_retry_at=j.next_retry_at,
                completed_at=j.completed_at,
                created_at=j.created_at,
                intent={
                    "sku": j.intent.sku,
                    "amount_paise": j.intent.amount_paise,
                    "currency": j.intent.currency,
                    "status": j.intent.status.value if hasattr(j.intent.status, "value") else str(j.intent.status),
                },
            )
        )
    return result


@router.post("/queue/{job_id}/retry", response_model=QueueJobOut)
async def manual_retry(job_id: UUID, admin: AdminDep, db: DbSession) -> QueueJobOut:
    job = await db.get(QueueJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job.status in (QueueStatus.COMPLETED, QueueStatus.CANCELLED):
        raise HTTPException(400, f"Cannot retry job in status {job.status}")
    job = await retry_queued_job(db, job_id)
    await write_audit(
        db,
        actor=f"admin:{admin['sub']}",
        action="queue.manual_retry",
        resource_type="queue_job",
        resource_id=str(job.id),
    )
    await db.refresh(job, attribute_names=["intent"])
    return QueueJobOut(
        id=job.id,
        intent_id=job.intent_id,
        status=job.status.value if hasattr(job.status, "value") else str(job.status),
        attempts=job.attempts,
        max_attempts=job.max_attempts,
        last_error=job.last_error,
        next_retry_at=job.next_retry_at,
        completed_at=job.completed_at,
        created_at=job.created_at,
    )


@router.get("/bank-health", response_model=BankHealthOut)
async def get_bank_health(_: AdminDep, db: DbSession) -> BankHealthOut:
    health = await bank_health_service.check()
    snap = BankHealthSnapshot(
        provider=health.provider,
        success_rate=health.success_rate,
        latency_ms=health.latency_ms,
        is_degraded=health.is_degraded,
        details=health.details,
    )
    db.add(snap)
    await db.flush()
    return BankHealthOut(
        provider=health.provider,
        success_rate=health.success_rate,
        latency_ms=health.latency_ms,
        is_degraded=health.is_degraded,
        threshold=health.threshold,
        details=health.details,
        created_at=snap.created_at,
    )


@router.get("/bank-health/history", response_model=list[BankHealthOut])
async def bank_health_history(_: AdminDep, db: DbSession, limit: int = 30) -> list[BankHealthOut]:
    settings = get_settings()
    rows = (
        await db.execute(
            select(BankHealthSnapshot).order_by(BankHealthSnapshot.created_at.desc()).limit(limit)
        )
    ).scalars().all()
    return [
        BankHealthOut(
            provider=r.provider,
            success_rate=r.success_rate,
            latency_ms=r.latency_ms,
            is_degraded=r.is_degraded,
            threshold=settings.bank_health_threshold,
            details=r.details or {},
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/bank-health/config", response_model=BankHealthOut)
async def configure_bank_health(body: BankHealthConfigUpdate, admin: AdminDep, db: DbSession) -> BankHealthOut:
    settings = get_settings()
    if body.mock_success_rate is not None:
        bank_health_service.set_mock_success_rate(body.mock_success_rate)
        settings.bank_health_mock_success_rate = body.mock_success_rate
    if body.threshold is not None:
        settings.bank_health_threshold = body.threshold
        org = (await db.execute(select(Organization).limit(1))).scalar_one_or_none()
        if org:
            org.bank_health_threshold = body.threshold
    await write_audit(
        db,
        actor=f"admin:{admin['sub']}",
        action="bank_health.config",
        payload=body.model_dump(exclude_unset=True),
    )
    health = await bank_health_service.check()
    return BankHealthOut(
        provider=health.provider,
        success_rate=health.success_rate,
        latency_ms=health.latency_ms,
        is_degraded=health.is_degraded,
        threshold=health.threshold,
        details=health.details,
        created_at=datetime.now(timezone.utc),
    )


@router.get("/audit", response_model=list[AuditEventOut])
async def list_audit(_: AdminDep, db: DbSession, limit: int = 100) -> list[AuditEvent]:
    q = await db.execute(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit))
    return list(q.scalars().all())


@router.get("/org", response_model=OrgOut)
async def get_org(_: AdminDep, db: DbSession) -> Organization:
    org = (await db.execute(select(Organization).limit(1))).scalar_one_or_none()
    if not org:
        raise HTTPException(404, "No org")
    return org


@router.get("/agents", response_model=list[AgentOut])
async def list_agents(_: AdminDep, db: DbSession) -> list[AgentOut]:
    agents = (await db.execute(select(Agent).order_by(Agent.created_at.desc()))).scalars().all()
    return [
        AgentOut(
            id=a.id,
            name=a.name,
            api_key_prefix=a.api_key_prefix,
            is_active=a.is_active,
            created_at=a.created_at,
        )
        for a in agents
    ]


@router.post("/agents", response_model=AgentOut)
async def create_agent(body: AgentCreate, admin: AdminDep, db: DbSession) -> AgentOut:
    org = (await db.execute(select(Organization).limit(1))).scalar_one()
    raw_key = generate_api_key()
    agent = Agent(
        organization_id=org.id,
        name=body.name,
        api_key_hash=hash_api_key(raw_key),
        api_key_prefix=raw_key[:12],
    )
    db.add(agent)
    await db.flush()
    return AgentOut(
        id=agent.id,
        name=agent.name,
        api_key_prefix=agent.api_key_prefix,
        is_active=agent.is_active,
        created_at=agent.created_at,
        api_key=raw_key,
    )
