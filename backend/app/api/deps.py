"""FastAPI dependencies: DB session, agent API key, admin JWT."""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_access_token, verify_api_key
from app.models.entities import Agent, Organization

bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_agent_from_api_key(
    db: DbSession,
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> Agent:
    if not x_api_key or not x_api_key.startswith("sap_"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid X-API-Key")

    prefix = x_api_key[:12]
    q = await db.execute(
        select(Agent)
        .where(Agent.api_key_prefix == prefix, Agent.is_active.is_(True))
        .options(selectinload(Agent.organization))
    )
    agents = q.scalars().all()
    for agent in agents:
        # api_key_hash stores bcrypt of full key
        if verify_api_key(x_api_key, agent.api_key_hash):
            if not agent.organization.is_active:
                raise HTTPException(status_code=403, detail="Organization inactive")
            return agent

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


async def get_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)] = None,
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Bearer token required")
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    return payload


AgentDep = Annotated[Agent, Depends(get_agent_from_api_key)]
AdminDep = Annotated[dict, Depends(get_admin)]
