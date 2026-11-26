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

# Bcrypt hash only — never the plaintext. Used when ADMIN_PASSWORD is unset or weak
# and ADMIN_PASSWORD_HASH is unset, so a fresh (e.g. ephemeral SQLite) database
# still accepts the operator password. Override with either env var.
DEFAULT_ADMIN_PASSWORD_HASH = "$2b$12$Xr9Pcbu7Q/baSmGLSxad9u55ZbPGQ4a7PC.w7rlzRt91lr64x1swS"


def resolve_admin_password_hash() -> tuple[str, str]:
    """Return (bcrypt_hash, source) for a brand-new admin row.

    Precedence: a set ADMIN_PASSWORD_HASH, then a strong ADMIN_PASSWORD,
    then DEFAULT_ADMIN_PASSWORD_HASH. Weak values such as admin123 are ignored
    so a stale Render default cannot lock the console back to a forced change.
    """
    settings = get_settings()
    env_hash = (settings.admin_password_hash or "").strip()
    if env_hash.startswith("$2"):
        return env_hash, "ADMIN_PASSWORD_HASH"
    env_password = (settings.admin_password or "").strip()
    if env_password and not is_weak_admin_password(env_password):
        return hash_password(env_password), "ADMIN_PASSWORD"
    return DEFAULT_ADMIN_PASSWORD_HASH, "embedded_hash"


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
                    description="Per-transaction cap ₹50,000, daily cap ₹1,00,000 per agent key, SKU lists, velocity, INR only",
                    max_amount_paise=50_000_00,
                    daily_budget_paise=100_000_00,
                    sku_whitelist=["LAPTOP-PRO", "MOUSE-MX", "KEYBOARD-MECH", "MONITOR-4K", "SSD-1TB", "USB-C-HUB"],
                    sku_blacklist=["WEAPON", "GAMBLING", "CRYPTO_MIXER", "TOBACCO"],
                    allowed_currencies=["INR"],
                    max_intents_per_minute=8,
                    window_start_hour=None,
                    window_end_hour=None,
                    window_timezone="Asia/Kolkata",
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
            password_hash, source = resolve_admin_password_hash()
            admin = AdminAccount(
                email=email,
                password_hash=password_hash,
                must_change_password=False,
                password_version=1,
            )
            db.add(admin)
            logger.info("Admin account bootstrapped from %s (no forced change)", source)

        await db.commit()
