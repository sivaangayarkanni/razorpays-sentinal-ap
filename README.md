# Sentinel-AP

**Smart Security Guardrail middleware** between Autonomous AI Agents and the Razorpay Payment Gateway.

Built for the **Razorpay Buildathon**.

```
AI Buyer Agent → Sentinel-AP (Gate 1 Policy → Gate 2 Bank Health) → Razorpay Orders + Checkout
                      │                          │
                 HARD_BLOCK                   QUEUED (soft-fail)
                      │                          │
                      └──────── ALLOW / CLEARED ─┘
```

## Live demo (Buildathon)

| Surface | URL |
|---------|-----|
| **Web UI (Vercel)** | https://sentinel-ap.vercel.app |
| **API (Render)** | https://sentinel-api-ecw9.onrender.com |
| **API docs** | https://sentinel-api-ecw9.onrender.com/docs |
| **Health** | https://sentinel-api-ecw9.onrender.com/health |

**Demo credentials**
- Admin: `admin@sentinel-ap.local` / `admin123`
- Agent API key: `sap_demo000000000000000000000000000001`

### Judge demo script (with real Razorpay test Checkout)

1. Open **https://sentinel-ap.vercel.app/playground** — look for the **Test mode · Razorpay** badge.
2. Click **✓ Successful clearance** → Gate 1 + Gate 2 pass → real Razorpay `order_…` id (not `order_mock_`).
3. Razorpay Checkout opens automatically. Pay with test card:
   - Card: `4111 1111 1111 1111`
   - Expiry: any future date · CVV: any · Name: any
   - Docs: https://razorpay.com/docs/payments/payments/test-card-details/
4. On success, playground calls `POST /api/v1/payments/verify` and shows `payment_id` + verified state.
5. Click **⛔ Hard Block — blacklisted SKU** → `HARD_BLOCK` / `SKU_BLACKLISTED` (unchanged).
6. Click **⛔ Hard Block — amount cap** → `HARD_BLOCK` / `AMOUNT_CAP_EXCEEDED` (unchanged).
7. Click **⏸ Soft-Fail Queue** → bank forced to 80%, intent `QUEUED` (enqueue display works without worker).
8. Click **Restore bank health & clear queue** → manual retry attempts CLEARED when rail recovers.
9. Open **Dashboard** (admin login) — decision feed + audit trail for `razorpay.order_created` / `razorpay.payment_verified`.

> **Worker note:** Soft-fail enqueue (`QUEUED`) works without the ARQ worker. Automatic background retries need the Render worker service (Starter plan). Manual **Restore & clear** from Playground / Queue admin still clears jobs when bank health recovers. If the worker is suspended for billing, judges can still demo Gate 2 via enqueue + manual retry.

### Razorpay test keys setup

On the API host (Render env — never commit secrets):

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_MOCK=false
```

Public config (no secret): `GET /api/v1/public/config` → `{ razorpay_key_id, mock, api_mode }`.

**v1.2 production features**
- `Idempotency-Key` on `POST /api/v1/agent/intents` (duplicate → same intent)
- `X-Request-Id` on every response
- `POST /api/v1/webhooks/razorpay` (`payment.captured`; optional `RAZORPAY_WEBHOOK_SECRET`)
- `GET /api/v1/public/metrics` — intents by status, blocks, queue depth
- Pitch deck on landing `#pitch` · docs in `docs/ARCHITECTURE.md` + `docs/INTERNSHIP.md`
- Agent demo: `python examples/agent_buyer.py`

Admin probe: `GET /api/v1/admin/razorpay/status` (JWT) → mode + key prefix + last probe.

## Architecture

```mermaid
flowchart LR
  Agent[AI Buyer Agent] -->|POST /agent/intents<br/>X-API-Key| API[Sentinel-AP FastAPI]
  API --> G1{Gate 1<br/>Policy Engine}
  G1 -->|fail| HB[HARD_BLOCK]
  G1 -->|pass| G2{Gate 2<br/>Bank Health}
  G2 -->|degraded &lt;95%| Q[Soft-Fail Queue<br/>Redis + ARQ]
  G2 -->|healthy| RZ[Razorpay Order]
  Q -->|retry when healthy| RZ
  RZ --> CO[Checkout.js]
  CO --> V[POST /payments/verify]
  Admin[Admin Dashboard<br/>Next.js] --> API
  API --> PG[(PostgreSQL)]
  API --> RD[(Redis)]
```

### Gate 1 — AI Logic & Policy Guardrail (Hard Block)
Deterministic Python policies: per-txn / daily budget caps, SKU whitelist & blacklist, currency allow-list. Unauthorized amounts or blacklisted SKUs return `HARD_BLOCK` with clear reason codes (`AMOUNT_CAP_EXCEEDED`, `SKU_BLACKLISTED`, …).

### Gate 2 — Payment Rail & Bank Uptime Guardrail (Soft-Fail Queue)
Pre-flight bank health ping before Razorpay dispatch. Default threshold **>95%** success. If degraded → intent enters the **Soft-Fail Queue**; a background ARQ worker (and manual admin retry) clears jobs when the rail recovers → `CLEARED`.

## Monorepo layout

```
razorpays-sentinal-ap/
├── backend/                 # Python FastAPI
│   ├── app/
│   │   ├── api/             # agent + admin + payments routes
│   │   ├── core/            # config, db, security, rate_limit
│   │   ├── models/          # SQLAlchemy entities
│   │   ├── schemas/         # Pydantic
│   │   ├── services/        # policy, bank health, razorpay, pipeline
│   │   └── workers/         # ARQ soft-fail worker
│   ├── alembic/
│   └── tests/
├── frontend/                # Next.js 14 + TS + Tailwind
├── docker-compose.yml
├── .env.example
└── README.md
```

## Quickstart (Docker — recommended)

```bash
cp .env.example .env
docker compose up --build
```

| Service   | URL                          |
|-----------|------------------------------|
| Web UI    | http://localhost:3000        |
| API docs  | http://localhost:8000/docs   |
| Health    | http://localhost:8000/health |

> Change `JWT_SECRET`, `ADMIN_PASSWORD`, and Razorpay keys before any real deployment. Never commit `.env`.

## 5-minute local demo script

1. Open **http://localhost:3000** — landing + `#pitch` slide strip.
2. Go to **Demo Playground**.
3. Click **✓ Successful clearance** → status `ALLOW`, Gate 1 + Gate 2 pass, Razorpay `order_id` (mock unless keys set).
4. Click **⛔ Hard Block — blacklisted SKU** → `HARD_BLOCK` / `SKU_BLACKLISTED`.
5. Click **⛔ Hard Block — amount cap** → `HARD_BLOCK` / `AMOUNT_CAP_EXCEEDED`.
6. Click **⏸ Soft-Fail Queue** → bank forced to 80%, intent `QUEUED`.
7. Click **Restore bank health & clear queue** → job `COMPLETED`, intent `CLEARED`.
8. Open **Dashboard** (login with admin) — decision feed shows all outcomes.

## API examples

```bash
# Successful intent
curl -s -X POST https://sentinel-api-ecw9.onrender.com/api/v1/agent/intents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sap_demo000000000000000000000000000001" \
  -d '{"amount_paise":499900,"currency":"INR","sku":"LAPTOP-PRO"}' | jq

# Public Razorpay config (safe for frontend)
curl -s https://sentinel-api-ecw9.onrender.com/api/v1/public/config | jq

# Hard block (blacklist)
curl -s -X POST https://sentinel-api-ecw9.onrender.com/api/v1/agent/intents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sap_demo000000000000000000000000000001" \
  -d '{"amount_paise":50000,"currency":"INR","sku":"WEAPON"}' | jq
```

Amounts are always in **paise** (INR × 100). Agent intents are lightly rate-limited (in-memory sliding window).

## Local dev (without full compose)

```bash
# infra
docker compose up -d postgres redis

# API
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel_ap
export REDIS_URL=redis://localhost:6379/0
uvicorn app.main:app --reload --port 8000

# worker (separate terminal)
arq app.workers.tasks.WorkerSettings

# web
cd frontend && npm install && npm run dev
```

## Tests

```bash
cd backend && pip install -r requirements.txt && pytest -q
```

Covers Gate 1 policy engine + Gate 2 bank health threshold gating.

## License

MIT — built for Razorpay Buildathon.
