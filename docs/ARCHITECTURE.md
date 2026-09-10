# Sentinel-AP Architecture

## Purpose

Sentinel-AP is a **payment control plane** between autonomous AI buyer agents and Razorpay.
Agents never talk to Razorpay directly. Every spend intent is evaluated by two gates, then
(optionally) turned into a Razorpay Order + Checkout flow with signature verify and webhooks.

## High-level flow

```
AI Buyer Agent
   │  POST /api/v1/agent/intents
   │  Headers: X-API-Key, Idempotency-Key?, X-Request-Id?
   ▼
┌──────────────────────────────────────────────────────────┐
│ Sentinel-AP (FastAPI)                                    │
│  1. Rate limit + auth (API key → Agent + Org)             │
│  2. Idempotency lookup (return same intent if key exists)│
│  3. Gate 1 — Policy Engine (HARD_BLOCK | PASS)           │
│  4. Gate 2 — Bank Health (QUEUED | PASS)                 │
│  5. Razorpay Orders API (ALLOW + order_id)               │
│  6. Audit events + decision trail                        │
└──────────────────────────────────────────────────────────┘
   │
   ├─ HARD_BLOCK → stop (no money movement)
   ├─ QUEUED → Soft-Fail Queue (Redis/ARQ + manual retry)
   └─ ALLOW → Checkout.js → POST /payments/verify
              └─ webhook payment.captured (optional)
```

## Components

| Layer | Tech | Role |
|-------|------|------|
| API | FastAPI 1.2.x | Intent pipeline, admin, payments, webhooks, metrics |
| DB | PostgreSQL | Orgs, agents, policies, intents, decisions, queue, audit, idempotency |
| Cache / queue | Redis + ARQ | Soft-fail retries (worker optional on Render Starter) |
| Payments | Razorpay Orders + Checkout | Amounts in **paise**; test keys in Render |
| Web | Next.js 14 | Landing + pitch deck, playground, dashboard |

## Gate 1 — Policy (deterministic Hard Block)

- Per-transaction amount cap (`max_amount_paise`)
- Daily budget (`daily_budget_paise`) against today's ALLOW/QUEUED/CLEARED spend
- SKU whitelist (if non-empty) and blacklist
- Currency allow-list

Outcomes are **deterministic** — same inputs → same reason codes (`AMOUNT_CAP_EXCEEDED`,
`SKU_BLACKLISTED`, `DAILY_BUDGET_EXCEEDED`, …). No LLM in the money path.

## Gate 2 — Bank health (Soft-Fail Queue)

- Pre-flight success-rate check vs org threshold (default 95%)
- Degraded → `QUEUED` + `QueueJob` (no Razorpay call)
- Recovered → worker or admin manual retry → Order → `CLEARED`

## Razorpay integration

1. `create_order` (httpx + Basic auth) when Gate 2 passes
2. Frontend Checkout.js with public `key_id` from `GET /api/v1/public/config`
3. `POST /api/v1/payments/verify` — HMAC of `order_id|payment_id`
4. `POST /api/v1/webhooks/razorpay` — `payment.captured` updates `payment_id`  
   (`RAZORPAY_WEBHOOK_SECRET` optional; if unset, verify skipped with warning log)

## Cross-cutting

- **Idempotency-Key** → `idempotency_records` unique on `(agent_id, key)`
- **X-Request-Id** middleware — echoed on every response; stored in intent metadata / audit when useful
- **Metrics** — `GET /api/v1/public/metrics` (intents by status, blocks, queue depth)
- **Errors** — consistent JSON `{ error, message, status_code, request_id }`

## Trust boundaries

- Agent API key never reaches Razorpay
- Razorpay secret never reaches the browser (only `key_id`)
- Admin JWT for dashboard / bank simulation / queue retry
- Demo credentials are intentional for Buildathon judges

## Deploy topology

- **API**: Render Docker (`sentinel-api-ecw9.onrender.com`)
- **Web**: Vercel (`sentinel-ap.vercel.app`) with `NEXT_PUBLIC_API_URL`
- **Worker**: Render ARQ worker (may be suspended on free/billing plans — enqueue + manual clear still demoable)
