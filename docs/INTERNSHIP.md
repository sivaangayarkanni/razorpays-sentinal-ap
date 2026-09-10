# Internship notes — Sentinel-AP

## Problem

Autonomous AI agents are starting to buy things. Hallucinated SKUs, over-budget spends, and
bank-rail outages turn into **stuck or unauthorized payouts**. Policy in the LLM prompt is not
enough — money needs a deterministic middleware.

## Design decisions

1. **Dual-gate, not a monolith** — separate *authorization* (Gate 1) from *rail reliability* (Gate 2).
2. **Hard block vs soft fail** — policy violations must never pay; degraded banks should queue, not fail closed forever.
3. **Paise everywhere** — avoid float INR bugs; Razorpay-native amounts.
4. **Idempotency-Key** — agents retry; we must not create duplicate Orders.
5. **Audit first** — every gate writes a decision row + audit event for interview demos.
6. **Mock ↔ live test** — same code path; `RAZORPAY_MOCK` toggles without UI forks.

## Tradeoffs

| Choice | Upside | Downside |
|--------|--------|----------|
| In-process bank health mock | Instant judge demos | Not a real NPCI feed |
| create_all + seed on boot | Zero-ops Render demo | Prefer Alembic-only in true prod |
| Optional webhook secret | Works in test without Dashboard setup | Must set secret before production |
| ARQ worker on Starter | Real async retries | Billing can suspend worker |
| Single-org seed | Fast judge path | Multi-tenant needs org scoping polish |

## What I'd ship next

1. Persist bank-health probes from Razorpay settlement APIs / synthetic canaries
2. Alembic-only migrations + CI migration check
3. Per-agent budget + approval workflows for high-value intents
4. Signed webhook secret required when `APP_ENV=production`
5. OpenTelemetry traces linked by `X-Request-Id`
6. Billing-safe always-on worker or Render cron drain for the soft-fail queue

## Interview demo script (5 min)

1. Landing `#pitch` — skim 8 slides (problem → ask)
2. Playground → Successful clearance → Checkout test card `4111…` → verify
3. Hard block SKU + amount cap (reason codes)
4. Soft-fail queue → restore health → clear
5. Show `X-Request-Id` / metrics / OpenAPI 1.2.0 / `examples/agent_buyer.py`
