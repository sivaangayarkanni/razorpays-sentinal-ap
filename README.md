# Sentinel-AP

**Smart Security Guardrail middleware** between Autonomous AI Agents and the Razorpay Payment Gateway.

Built for the **Razorpay Buildathon**.

```
AI Buyer Agent → Sentinel-AP (Gate 1 Policy → Gate 2 Bank Health) → Razorpay
                      │                          │
                 HARD_BLOCK                   QUEUED (soft-fail)
                      │                          │
                      └──────── ALLOW / CLEARED ─┘
```

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
│   │   ├── api/             # agent + admin routes
│   │   ├── core/            # config, db, security
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

**Demo credentials**
- Admin: `admin@sentinel-ap.local` / `admin123`
- Agent API key: `sap_demo000000000000000000000000000001`

> Change `JWT_SECRET`, `ADMIN_PASSWORD`, and Razorpay keys before any real deployment. Never commit `.env`.

## 5-minute judge demo script

1. Open **http://localhost:3000** — pitch landing page.
2. Go to **Demo Playground**.
3. Click **✓ Successful clearance** → status `ALLOW`, Gate 1 + Gate 2 pass, mock Razorpay `order_id`.
4. Click **⛔ Hard Block — blacklisted SKU** → `HARD_BLOCK` / `SKU_BLACKLISTED`.
5. Click **⛔ Hard Block — amount cap** → `HARD_BLOCK` / `AMOUNT_CAP_EXCEEDED`.
6. Click **⏸ Soft-Fail Queue** → bank forced to 80%, intent `QUEUED`.
7. Click **Restore bank health & clear queue** → job `COMPLETED`, intent `CLEARED`.
8. Open **Dashboard** (login with admin) — decision feed shows all outcomes.
9. Open **Bank Health** / **Soft-Fail Queue** / **Policies** to tweak live.

## API examples

```bash
# Successful intent
curl -s -X POST http://localhost:8000/api/v1/agent/intents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sap_demo000000000000000000000000000001" \
  -d '{"amount_paise":499900,"currency":"INR","sku":"LAPTOP-PRO"}' | jq

# Hard block (blacklist)
curl -s -X POST http://localhost:8000/api/v1/agent/intents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sap_demo000000000000000000000000000001" \
  -d '{"amount_paise":50000,"currency":"INR","sku":"WEAPON"}' | jq

# Admin login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sentinel-ap.local","password":"admin123"}' | jq -r .access_token)

# Degrade bank rail for soft-fail demo
curl -s -X POST http://localhost:8000/api/v1/admin/bank-health/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mock_success_rate":0.80,"threshold":0.95}' | jq
```

Amounts are always in **paise** (INR × 100).

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

## Razorpay keys

Set in `.env`:

```
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_MOCK=false
```

Leave empty / `RAZORPAY_MOCK=true` for offline judge demos (deterministic mock orders).

## Optional CI

Copy `docs/github-actions-ci.yml.example` to `.github/workflows/ci.yml` if your GitHub token has the `workflow` scope.

## License

MIT — built for Razorpay Buildathon.
