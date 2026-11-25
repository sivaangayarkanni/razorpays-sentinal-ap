# Sentinel-AP repository walkthrough

This is the briefing document for explaining the live system. It describes the code that is actually in the repo — not a simulated or demo-mode path.

- **Web UI:** https://sentinel-ap.vercel.app
- **API:** https://sentinel-api-ecw9.onrender.com
- **Repo:** https://github.com/sivaangayarkanni/razorpays-sentinal-ap (public)
- **Stack version:** 1.4.0

Admin login email is `admin@sentinel-ap.local`. The password is not written here. It lives only in the operator’s local `ADMIN_PASSWORD.txt` (gitignored).

> **Public-repo warning.** Because the GitHub repository is public, the baked-in bcrypt hash used to bootstrap a fresh ephemeral SQLite database is visible in `backend/app/seed.py`. A determined attacker can try to crack it offline. Prefer making the repository private, or rotate the operator password and stop relying on a hash that shipped in git.

---

## 1. What it is

Sentinel-AP is a security guardrail between **autonomous AI buyer agents** and **Razorpay**. An agent never talks to Razorpay directly. It posts a payment intent to Sentinel. Sentinel either hard-blocks the intent on policy, queues it when the payment rail looks unhealthy, or creates a real Razorpay Order and lets Checkout collect the payment.

Nothing in the production path invents a fake `order_mock_…` id. `RAZORPAY_MOCK` is ignored. If Razorpay keys are missing, order creation fails closed.

---

## 2. Architecture

```
AI buyer agent or console /pay
        │  POST /api/v1/agent/intents
        │  headers: X-API-Key, optional Idempotency-Key
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Sentinel-AP API  (FastAPI on Render)                       │
│                                                             │
│  Auth: hashed agent key  ·  revoked / unknown → 401         │
│  Optional idempotency fingerprint                           │
│                                                             │
│  Gate 1  PolicyEngine (deterministic HARD_BLOCK / PASS)     │
│  Gate 2  Bank health   (QUEUED if the rail is degraded)     │
│  Rail    Razorpay Orders API (amount in paise, INR)         │
│           → status ALLOW + razorpay_order_id                │
└───────────────┬───────────────────────────┬─────────────────┘
                │                           │
                ▼                           ▼
     Checkout.js (test/live key)    Webhook payment.captured
     POST /api/v1/payments/verify   (HMAC signature)
                │
                ▼
          Intent CLEARED
```

There is no `REVIEW` or `SOFT` outcome. The intent FSM is `PENDING → ALLOW | HARD_BLOCK | QUEUED | FAILED`, and `ALLOW` or a recovered queue job can become `CLEARED` after a verified payment.

**Hosting**

| Piece | Where | Notes |
|---|---|---|
| API | Render Docker web service `srv-dahbqqv40ujc73edm3pg` (Oregon, free tier) | Ephemeral disk. SQLite fallback is used because no Render Postgres is attached (`ALLOW_SQLITE_FALLBACK`). A deploy wipes the database and re-seeds it. |
| Queue drain | In-process loop every 15s | No separate worker process. |
| Redis | Render Key Value exists, but the API often cannot read the connection URL (dashboard API returns 403) | `/health` reports `redis: not_configured` or `unavailable` in that case. The app still runs. |
| Frontend | Vercel project `sentinel-ap` | Deploy from `frontend/` with `--prod`. The dashboard Root Directory is still `.`, so a git-connected deploy from the repo root would be wrong. |

---

## 3. Request flow, step by step

1. **Issue an agent key** in the console (`/agents` or the button on `/pay`). The plaintext key is shown once. Only a hash and a prefix are stored.
2. **POST `/api/v1/agent/intents`** with `X-API-Key`, `amount_paise`, `currency`, `sku`, optional `description` / `external_ref`, and optional `Idempotency-Key`.
3. Unknown, expired, or revoked keys return **401**.
4. If an `Idempotency-Key` was seen before:
   - same payload fingerprint → the original intent is returned (`idempotent: true`);
   - different payload → **409** with `reason_code: IDEMPOTENCY_KEY_CONFLICT`.
5. The pipeline persists a `PENDING` intent, then runs **Gate 1**. A failing rule writes a `HARD_BLOCK` decision with a clear `reason_code` and stops. The request still returns HTTP 200; the block is in the body (`status: HARD_BLOCK`).
6. **Gate 2** probes Razorpay / bank-health cache. If the success rate is below the threshold, the intent is `QUEUED` and retried by the in-process drainer.
7. On a healthy rail, Sentinel calls **Razorpay `POST /orders`** (paise, `payment_capture: 1`). Success → `ALLOW` and a real `order_…` id.
8. The console (or an integrating agent) opens **Checkout.js** with the public key from `GET /api/v1/public/config` and that `razorpay_order_id`.
9. Checkout’s success handler posts to **`POST /api/v1/payments/verify`**. Sentinel checks the HMAC-SHA256 signature with the Razorpay secret. Mock signatures (`order_mock_…`, `mock_signature`) are rejected.
10. An optional Razorpay webhook (`payment.captured`) can also clear the intent, after its own signature check.

Amounts are always **paise** (INR × 100). ₹4,999 is `499900`.

---

## 4. Repository map

### Backend (`backend/`)

| Path | Role |
|---|---|
| `app/main.py` | FastAPI app, lifespan, SQLite fallback, in-process queue drain, `GET /health` |
| `app/core/config.py` | Settings. `razorpay_mock` is accepted but ignored. |
| `app/core/database.py` | Async SQLAlchemy engine; SQLite fallback when Postgres is unreachable |
| `app/core/security.py` | JWT, password hashing, agent-key hashing |
| `app/core/rate_limit.py` | Safety-net HTTP 429 (30 intents / 60s) on top of the policy velocity rule |
| `app/models/entities.py` | Org, Admin, Agent, Policy, Intent, Decision, QueueJob, IdempotencyRecord, Audit |
| `app/schemas/api.py` | Pydantic request/response models |
| `app/seed.py` | Default org, policy, and admin bootstrap (bcrypt hash, never plaintext) |
| `app/api/agent.py` | Agent intents, idempotency fingerprint + conflict |
| `app/api/admin.py` | Login, keys, policies, queue, bank health, audit, stats |
| `app/api/payments.py` | Public Checkout key, payment verify |
| `app/api/webhooks.py` | Razorpay webhook receiver |
| `app/api/metrics.py` | Public metrics + architecture diagram |
| `app/services/policy_engine.py` | Gate 1, pure functions, no I/O |
| `app/services/gate_pipeline.py` | Orchestration; daily spend and velocity are **per agent key** |
| `app/services/bank_health.py` | Live Razorpay probe, cache, circuit breaker |
| `app/services/razorpay_client.py` | Real Orders / verify / fetch only |
| `app/services/intent_fsm.py` | Allowed status transitions |
| `app/services/audit.py` | Append-only audit log |
| `app/workers/tasks.py` | Optional ARQ tasks (the free-tier service drains in-process instead) |
| `tests/` | Policy engine, HTTP edge cases, mock-disabled behaviour, admin bootstrap |

### Frontend (`frontend/`)

| Path | Role |
|---|---|
| `app/page.tsx` | Landing, including the live status chip |
| `app/pay/page.tsx` | **New payment** — real intents, Checkout on ALLOW, labeled HARD_BLOCK cases |
| `app/status/page.tsx` | Full health page (latency, last checked IST, DB, Redis, queue, keys configured) |
| `app/policies/page.tsx` | Editable Gate 1 rules (caps, SKU lists, velocity, payment window) |
| `app/agents/page.tsx` | Issue and revoke keys |
| `app/integrate/page.tsx` | curl + Checkout.js snippet for an agent app |
| `app/dashboard/page.tsx` | Stats and decision feed |
| `app/queue/page.tsx` | Soft-fail queue |
| `app/bank-health/page.tsx` | Rail health |
| `app/pitch/page.tsx` | One-pager (React, not standalone HTML) |
| `components/Nav.tsx` | Console header + compact status badge |
| `components/SystemStatus.tsx` | Online / Waking up / Offline indicator |
| `lib/api.ts` | API client, Checkout loader, verify helper |
| `lib/health.ts` | `/health` poller every 15s; slow if latency ≥ 5s |

### Docs and deploy

| Path | Role |
|---|---|
| `docs/REPO_WALKTHROUGH.md` | This file |
| `docs/REPO_WALKTHROUGH.pdf` | Printable copy |
| `docs/ARCHITECTURE.md` | Longer design notes |
| `docs/Sentinel-AP-Pitch-One-Pager.pdf` | Pitch PDF |
| `render.yaml` | Render blueprint |
| `frontend/` + Vercel CLI | Production UI deploys |

---

## 5. Gate 1 policy rules and `reason_code`s

Default policy seeded on a fresh database (all editable on `/policies`):

- Per-transaction cap: **₹50,000** (`max_amount_paise = 50_000_00`)
- Daily spend cap: **₹1,00,000 per agent key**
- SKU whitelist: `LAPTOP-PRO`, `MOUSE-MX`, `KEYBOARD-MECH`, `MONITOR-4K`, `SSD-1TB`, `USB-C-HUB`
- SKU blacklist: `WEAPON`, `GAMBLING`, `CRYPTO_MIXER`, `TOBACCO`
- Currency: **INR only**
- Velocity: **8 intents per minute per agent key**
- Payment window: unset (open all day). Timezone default `Asia/Kolkata`.

Evaluation order:

| Order | Rule | `reason_code` | Typical demo input |
|---|---|---|---|
| 1 | Policy row is inactive | `POLICY_INACTIVE` | Turn the policy off |
| 2 | Amount ≤ 0 | `AMOUNT_INVALID` | ₹0 or a negative amount |
| 3 | Amount > ₹1,00,00,000 (sanity cap) | `AMOUNT_ABSURD` | ₹1,00,00,001 |
| 4 | Currency not allowed | `CURRENCY_DENIED` | `USD` |
| 5 | SKU on the blacklist | `SKU_BLACKLISTED` | `WEAPON` |
| 6 | Non-empty whitelist and SKU is absent | `SKU_NOT_WHITELISTED` | `UNKNOWN-SKU` |
| 7 | Amount above per-txn cap | `AMOUNT_CAP_EXCEEDED` | ₹50,001 |
| 8 | Today’s spend for this key + amount > daily cap | `DAILY_BUDGET_EXCEEDED` | Several large ALLOW/QUEUED intents, then one more |
| 9 | Intents from this key in the last 60s ≥ max | `VELOCITY_EXCEEDED` | “Velocity · 9 intents” on `/pay` |
| 10 | Current hour outside the optional window | `OUTSIDE_PAYMENT_WINDOW` | Set start/end hours on `/policies` |
| — | All checks passed | `POLICY_PASS` | ₹4,999 `LAPTOP-PRO` |

HTTP-level (not a Gate 1 decision):

| Situation | Status | `reason_code` |
|---|---|---|
| Reused `Idempotency-Key` with a different payload | 409 | `IDEMPOTENCY_KEY_CONFLICT` |
| Revoked, expired, or unknown agent key | 401 | (auth error) |
| Burst above the safety-net limiter (30 / 60s) | 429 | (rate limiter) |

There is no `REVIEW` / `SOFT` state in `DecisionOutcome`.

---

## 6. Live API status indicator

The console header and the landing page show a live chip that polls `GET /health` every **15 seconds**.

| State | When | Colour |
|---|---|---|
| **Online** | HTTP 200 and latency under 5 seconds | Green |
| **Waking up / slow** | HTTP 200 but the response took **5 seconds or more** (typical Render free-tier cold start) | Amber |
| **Offline** | Network error, abort, or non-200 | Red |

The chip also shows latency. Hover (and the `/status` page) add last-checked time in **IST**, database backend (`sqlite` / `postgres` / `unavailable`), Redis (`ok` / `not_configured` / `unavailable`), queue-drainer flag, and whether Razorpay keys are configured (boolean only — never the secret).

`GET /health` itself stays cheap: it reports process readiness plus a ≤ 0.5s Redis ping. It returns 200 even when the database is degraded, so a crash-loop is distinguishable from “the process is up.”

---

## 7. Security notes

- **Agent keys** are stored as hashes plus a short prefix. The full key is displayed once.
- **Admin auth** is JWT, bound to a `password_version` so a password change invalidates old tokens.
- **Admin bootstrap:** if `ADMIN_PASSWORD_HASH` is a bcrypt hash, that wins; else a strong `ADMIN_PASSWORD` is hashed; else the baked-in hash is used (see the public-repo warning above). Weak defaults such as `admin123` are ignored.
- **Idempotency** records a SHA-256 fingerprint of amount, currency, SKU, description, and external_ref.
- **Checkout verify** and **webhooks** both require a valid Razorpay HMAC. `order_mock_…` / `mock_signature` are rejected.
- **CORS** allows the production Vercel origin and `*.vercel.app`.
- `/docs` is off unless `ENABLE_DOCS=true`.
- Do not commit `.env`, `ADMIN_PASSWORD.txt`, or `shots/`.

---

## 8. What was removed (no simulation / demo mode)

These production paths can no longer fake a payment:

- `is_mock_mode()` always returns `false`.
- `RazorpayClient.create_order` never mints `order_mock_…` ids. Missing keys return a failure.
- `verify_payment_signature` rejects mock order ids, mock payment ids, and `mock_signature`.
- `GET /api/v1/public/config` always reports `mock: false`.
- The Gate 2 path no longer substitutes a random “mock success rate” when keys are absent; it uses the live probe (and fails honestly).
- The Demo Playground UI was already removed. Leftover “Playground” copy and buttons now point at **New payment** (`/pay`) or were rewritten.
- README examples no longer tell anyone to use `sap_demo…`. A demo agent is seeded only if `ENABLE_DEMO=true`, which is off in production.

What remains, on purpose:

- `RAZORPAY_MOCK` and `ENABLE_DEMO` still exist as env flags so old Render/dashboard settings do not crash the process, but they cannot create fake orders.
- `bank_health_service.set_mock_success_rate` is still used by **unit tests** for threshold logic. The admin config endpoint that would expose it is gated on `ENABLE_DEMO` and returns 403 in production.

---

## 9. Deployment

**API (Render).** Push `main`, then `POST /v1/services/srv-dahbqqv40ujc73edm3pg/deploys` with a cache-clearing deploy. Because the disk is ephemeral, the next boot creates a fresh SQLite database, seeds the default policy, and bootstraps the admin account from the baked-in hash (or env). Existing JWTs and agent keys from the previous deploy will not work.

**Frontend (Vercel).** From `frontend/`:

```bash
npx vercel --prod --yes
```

The production project is `sentinel-ap` (`prj_MqurT2EiufBM9KCEROXcHUDYSL7D`). `NEXT_PUBLIC_API_URL` must point at `https://sentinel-api-ecw9.onrender.com`.

Render env vars cannot be changed from this workspace (the env API returns 403). Razorpay test keys are already present on the service.

---

## 10. How to demo this live

Warm the API first if the status chip is amber or red (Render cold start can take 15–30 seconds). Then:

1. Open https://sentinel-ap.vercel.app — point at the **status chip** (header and landing). Optionally open `/status`.
2. Sign in at `/dashboard` with `admin@sentinel-ap.local` and the operator password (not written here).
3. Go to **New payment**. Click **Issue a test key**. Do not screenshot or read out the full key; the prefix is enough.
4. Submit **ALLOW · ₹4,999 LAPTOP-PRO**. Expect `status: ALLOW` and a Razorpay `order_…` id. Checkout opens. Pay with test card `4111 1111 1111 1111`, any future expiry, any CVV. After verify, the intent is `CLEARED`.
5. Click each HARD_BLOCK case and read the `reason_code` on the result card: `AMOUNT_CAP_EXCEEDED`, `SKU_BLACKLISTED`, `SKU_NOT_WHITELISTED`, `CURRENCY_DENIED`, `AMOUNT_INVALID`, `AMOUNT_ABSURD`, `VELOCITY_EXCEEDED`.
6. Show `/policies` — caps, SKU lists, velocity, and the optional payment window are editable (save on blur).
7. Show `/integrate` — curl plus the Checkout.js snippet an agent app would use.
8. On `/agents`, revoke the test key and confirm a later intent returns 401.
9. Optionally show `/dashboard` audit entries for `razorpay.order_created` and `razorpay.payment_verified`.

If an ALLOW submit comes back `FAILED` with “Razorpay keys are not configured”, the API host is missing keys — that is a real failure, not a mock fallback.

---

## 11. Tests

From `backend/` (48 tests at the time this was written):

```bash
pytest -q
```

Coverage includes every Gate 1 `reason_code` above, overnight payment windows, HTTP-level HARD_BLOCK, velocity, idempotency conflict, revoked-key 401, `/health` redis field, and “`RAZORPAY_MOCK` cannot invent orders.”

---

## 12. Explaining a folder out loud (suggested order)

1. Landing + status chip, then `/pay`.
2. `backend/app/api/agent.py` → `gate_pipeline.py` → `policy_engine.py`.
3. `razorpay_client.py` and `payments.py` (Checkout verify).
4. `entities.py` Policy / IdempotencyRecord, and `/policies`.
5. `main.py` `/health` + the 15s frontend poller in `frontend/lib/health.ts`.
6. `seed.py` bootstrap (mention the public-hash caveat, do not discuss the password).
7. Render + Vercel deploy path, including the SQLite reset on each API deploy.
