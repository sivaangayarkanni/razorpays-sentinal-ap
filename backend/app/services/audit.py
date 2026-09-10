"""Structured audit trail writer."""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import AuditEvent


async def write_audit(
    db: AsyncSession,
    *,
    actor: str,
    action: str,
    organization_id: UUID | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        organization_id=organization_id,
        actor=actor,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        payload=payload or {},
    )
    db.add(event)
    await db.flush()
    return event
