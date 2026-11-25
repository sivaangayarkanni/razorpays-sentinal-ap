"""Bootstrap default organization, policy, and admin account."""
from __future__ import annotations

import logging

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.security import hash_api_key, hash_password
from app.models.entities import AdminAccount, Agent, Organization, Policy

logger = logging.getLogger("sentinel-ap.seed")

DEMO_API_KEY = "sap_demo000000000000000000000000000001"
WEAK_PASSWORDS = frozenset({"", "admin123", "changeme", "password", "password123", "admin"})


def is_weak_admin_password(password: str | None) -> bool:
    value = (password or "").strip()
    if len(value) < 12:
        return True
    return value.lower() in WEAK_PASSWORDS


def validate_new_admin_password(password: str) -> str | None:
    """Return an error message if the password is not acceptable, else None."""
    value = (password or "").strip()
    if len(value) < 12:
        return "Password must be at least 12 characters"
    if is_weak_admin_password(value):
        return "Choose a stronger password (not a common default)"
    return None


async def seed_demo_data() -> None:
    """Idempotent bootstrap used at API startup."""
    settings = get_settings()
    async with AsyncSessionLocal() as db:
        org = (await db.execute(select(Organization).where(Organization.slug == "acme-ai"))).scalar_one_or_none()
        if org is None:
            org = Organization(
                name="Acme AI Commerce",
                slug="acme-ai",
                bank_health_threshold=0.95,
            )
            db.add(org)
            await db.flush()
            logger.info("Created default organization")

        policy = (
            await db.execute(select(Policy).where(Policy.organization_id == org.id, Policy.is_active.is_(True)))
        ).scalar_one_or_none()
        if policy is None:
            db.add(
                Policy(
                    organization_id=org.id,
                    name="Default Guardrail",
                    description="Per-transaction and daily caps, SKU allow/deny lists",
                    max_amount_paise=10_000_00,
                    daily_budget_paise=50_000_00,
                    sku_whitelist=["LAPTOP-PRO", "MOUSE-MX", "KEYBOARD-MECH", "MONITOR-4K", "SSD-1TB", "USB-C-HUB"],
                    sku_blacklist=["WEAPON", "GAMBLING", "CRYPTO_MIXER", "TOBACCO"],
                    allowed_currencies=["INR"],
                    is_active=True,
                )
            )
            logger.info("Created default policy")

        demo_agents = (
            await db.execute(select(Agent).where(Agent.api_key_prefix == DEMO_API_KEY[:12]))
        ).scalars().all()
        if settings.enable_demo:
            if not demo_agents:
                db.add(
                    Agent(
                        organization_id=org.id,
                        name="BuyerBot-Alpha",
                        api_key_hash=hash_api_key(DEMO_API_KEY),
                        api_key_prefix=DEMO_API_KEY[:12],
                    )
                )
                logger.info("ENABLE_DEMO: seeded demo agent (prefix=%s)", DEMO_API_KEY[:12])
        else:
            changed = False
            for agent in demo_agents:
                if agent.is_active:
                    agent.is_active = False
                    changed = True
            if changed:
                logger.info("Disabled seeded demo agent keys")

        email = (settings.admin_email or "").strip().lower() or "admin@sentinel-ap.local"
        admin = (await db.execute(select(AdminAccount).where(AdminAccount.email == email))).scalar_one_or_none()
        if admin is None:
            bootstrap = settings.admin_password or ""
            weak = is_weak_admin_password(bootstrap)
            # Hash whatever is configured so first login still works, then force a change if weak.
            if not bootstrap:
                bootstrap = "admin123"
                weak = True
            admin = AdminAccount(
                email=email,
                password_hash=hash_password(bootstrap),
                must_change_password=weak,
                password_version=1,
            )
            db.add(admin)
            if weak:
                logger.warning(
                    "Admin account bootstrapped with a weak or default password; "
                    "the first sign-in must set a new password of 12+ characters"
                )
            else:
                logger.info("Admin account bootstrapped from ADMIN_EMAIL / ADMIN_PASSWORD")

        await db.commit()
