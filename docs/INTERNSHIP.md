# Internship notes — Sentinel-AP (v1.3 system design)

## Problem

Autonomous AI agents are starting to buy things. Hallucinated SKUs, over-budget spends, and
bank-rail outages turn into **stuck or unauthorized payouts**. Policy in the LLM prompt is not
enough — money needs a deterministic middleware.

## System design interview talking points (match the code)

### 1. Separate planes, not a spaghetti handler
Explain the five planes: **Ingress → Control → Execution → Reliability → Observability**.
Point at `docs/ARCHITECTURE.md` and `GET /api/v1/public/architecture`. Interviewers like
“control plane vs data/execution plane” language borrowed from networking/k8s.

### 2. Dual-gate authorization vs reliability
**Gate 1 (Policy)** is *authorization* — deterministic hard block, reason codes, no LLM.
**Gate 2 (Bank Health)** is *reliability* — soft-fail queue when rails are degraded.
Never conflate “not allowed” with “try later.”

### 3. Formal Intent FSM
`services/intent_fsm.py` is the **single place** transitions are validated:
`PENDING → HARD_BLOCK | QUEUED | ALLOW | FAILED`, then `QUEUED → CLEARED`, and logical
`ALLOW → VERIFIED` after Checkout. Illegal transitions raise `InvalidTransition`.
This is classic “state machine for money” interview gold.

### 4. Typed domain results; thin orchestrator
`PolicyDecision`, `HealthDecision`, `PaymentDispatch` are frozen dataclasses.
`gate_pipeline.py` only orchestrates — easy to unit-test gates in isolation.

### 5. Unit of work / transactional boundary
One request = one SQLAlchemy session commit. Decisions + intent status + queue job + audit
flush together; rollback on exception. Say: “we keep the intent decision atomic even if
Razorpay is called after Gate 2 pass” (and note the classic tradeoff: external call inside
the UoW vs outbox-after-commit — we document queue as the outbox for soft-fail).

### 6. Durable queue / outbox pattern
`QueueJob` with `status`, `attempts`, `next_retry_at` is an **outbox** — survives missing
workers. `POST /admin/queue/drain` pumps due jobs. ARQ is optimization, not the source of truth.

### 7. Circuit breaker + TTL cache on health probes
Don’t DDoS your payment provider. Short TTL cache; open circuit after consecutive failures.
Document failure modes in `bank_health.py` docstring — show you think about ops.

### 8. Idempotency + request correlation
`Idempotency-Key` on agent intents; `X-Request-Id` on every response; structured logs carry
both plus `intent_id` / `gate` / `outcome`. This is how you debug distributed money flows.

### 9. Trust boundaries
Agent key ≠ Razorpay secret. Browser only gets `key_id`. Webhook HMAC optional in demo,
required in real prod. Paise everywhere — no float INR.

## Design decisions (short)

1. **Dual-gate, not a monolith** — authorization ≠ rail reliability.
2. **Hard block vs soft fail** — policy never pays; degraded banks queue.
3. **Paise everywhere** — Razorpay-native amounts.
4. **Idempotency-Key** — agents retry; no duplicate Orders.
5. **Audit first** — every gate writes a decision + audit event.
6. **Mock ↔ live test** — `RAZORPAY_MOCK` toggles without UI forks.
7. **FSM-enforced status** — illegal money-state transitions are bugs, not silent writes.
8. **DB outbox for soft-fail** — worker optional; drain always available.

## Tradeoffs

| Choice | Upside | Downside |
|--------|--------|----------|
| In-process bank health mock | Instant judge demos | Not a real NPCI feed |
| create_all + seed on boot | Zero-ops Render demo | Prefer Alembic-only in true prod |
| Optional webhook secret | Works without Dashboard setup | Must set secret before production |
| ARQ worker on Starter | Real async retries | Billing can suspend worker |
| VERIFIED logical-only | No DB enum migration / API break | Clients must read reason_code for “paid” |
| Health probe inside request path | Simple | Need cache/circuit (we added both) |
| Single-org seed | Fast judge path | Multi-tenant needs org scoping polish |

## What I'd ship next

1. Persist bank-health probes from Razorpay settlement APIs / synthetic canaries
2. Alembic-only migrations + CI migration check
3. Per-agent budget + approval workflows for high-value intents
4. Signed webhook secret required when `APP_ENV=production`
5. OpenTelemetry traces linked by `X-Request-Id`
6. Outbox-after-commit for Razorpay create (exactly-once dispatch)
7. Billing-safe always-on worker or Render cron drain

## Interview demo script (5 min)

1. Landing `#pitch` — skim slides (problem → ask)
2. Show `GET /api/v1/public/architecture` — planes + FSM JSON
3. Playground → Successful clearance → Checkout test card `4111…` → verify
4. Hard block SKU + amount cap (reason codes)
5. Soft-fail queue → restore health → clear / drain
6. Show `X-Request-Id` / metrics / OpenAPI **1.3.0** / `examples/agent_buyer.py`
7. Mention `intent_fsm.py` + circuit breaker as “production thinking”
