"""Seed demo organization, agent, and policy."""
from __future__ import annotations

import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import generate_api_key, hash_api_key
from app.models.entities import Agent, Organization, Policy

logger = logging.getLogger("sentinel-ap.seed")

# Fixed demo key so judges / README can use it without looking it up
DEMO_API_KEY = "sap_demo000000000000000000000000000001"


async def seed_demo_data() -> None:
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Organization).where(Organization.slug == "acme-ai"))).scalar_one_or_none()
        if existing:
            logger.info("Demo data already present")
            return

        org = Organization(
            name="Acme AI Commerce",
            slug="acme-ai",
            bank_health_threshold=0.95,
        )
        db.add(org)
        await db.flush()

        agent = Agent(
            organization_id=org.id,
            name="BuyerBot-Alpha",
            api_key_hash=hash_api_key(DEMO_API_KEY),
            api_key_prefix=DEMO_API_KEY[:12],
        )
        db.add(agent)

        policy = Policy(
            organization_id=org.id,
            name="Buildathon Guardrail",
            description="Demo policy: ₹10k/txn, ₹50k/day, blacklist risky SKUs",
            max_amount_paise=10_000_00,  # ₹10,000
            daily_budget_paise=50_000_00,  # ₹50,000
            sku_whitelist=["LAPTOP-PRO", "MOUSE-MX", "KEYBOARD-MECH", "MONITOR-4K", "SSD-1TB", "USB-C-HUB"],
            sku_blacklist=["WEAPON", "GAMBLING", "CRYPTO_MIXER", "TOBACCO"],
            allowed_currencies=["INR"],
            is_active=True,
        )
        db.add(policy)
        await db.commit()
        logger.info("Seeded demo org/agent/policy. Demo API key prefix=%s", DEMO_API_KEY[:12])
