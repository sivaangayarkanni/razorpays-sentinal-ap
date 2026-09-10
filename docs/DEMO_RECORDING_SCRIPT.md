# Sentinel-AP — Demo Recording Script

**Target length:** ~3–5 minutes (voiceover)  
**Audience:** Razorpay Buildathon judges / internship reviewers  
**Surfaces:** https://sentinel-ap.vercel.app · https://sentinel-api-ecw9.onrender.com  

| Item | Value |
|------|-------|
| Web UI | https://sentinel-ap.vercel.app |
| Playground | https://sentinel-ap.vercel.app/playground |
| Pitch strip | https://sentinel-ap.vercel.app/#pitch |
| API / OpenAPI | https://sentinel-api-ecw9.onrender.com/docs |
| Metrics | https://sentinel-api-ecw9.onrender.com/api/v1/public/metrics |
| Admin login | `admin@sentinel-ap.local` / `admin123` |
| Agent API key | `sap_demo000000000000000000000000000001` |
| Test card | `4111 1111 1111 1111` · any future expiry · any CVV · any name |

> **Prep:** Warm the API (hit `/health`) so Render is not cold. Confirm playground shows **Test mode · Razorpay**. Close unrelated tabs. Use 1080p, cursor highlight on.

---

## Full cut (~4:00)

### 0:00–0:25 — Cold open

**[SCREEN]** Landing page — https://sentinel-ap.vercel.app — scroll slightly so hero + dual-gate diagram are visible.

**SPEAK:**  
“Hi — I’m showing **Sentinel-AP**, an autonomous transaction reliability layer for the Razorpay Buildathon.  
AI buyer agents are starting to spend money. The problem: prompts are not a payment authorization layer. Hallucinated SKUs, over-budget intents, and bank-rail outages turn into unauthorized or stuck payouts.  
Sentinel-AP sits **between** the agent and Razorpay — dual gates, then Orders and Checkout — so agents never talk to the gateway directly.”

---

### 0:25–0:55 — #pitch skim

**[SCREEN]** Click `#pitch` / scroll the pitch deck strip. Pause ~2s on Problem → Dual-gate → Architecture → Ask.

**SPEAK:**  
“Quick pitch skim. Problem: no deterministic control plane. Solution: **Gate 1** hard-blocks policy violations; **Gate 2** soft-fails when bank health drops below ninety-five percent — queue, don’t charge.  
Stack is FastAPI, Postgres, Redis, Razorpay Orders plus Checkout, Next.js. Live on Vercel and Render.  
Why internship-ready: Idempotency-Key, audit trail, webhooks, Checkout test mode, OpenAPI one-point-two.”

---

### 0:55–2:10 — Playground ALLOW + Checkout

**[SCREEN]** Open https://sentinel-ap.vercel.app/playground  
Point at **Test mode · Razorpay** badge.  
Click **✓ Successful clearance**.

**SPEAK:**  
“Playground. Successful clearance — Gate 1 and Gate 2 both pass. Watch for a real Razorpay `order_…` id — not `order_mock_`.”

**[SCREEN]** When Checkout opens, fill test card:

- Card: `4111 1111 1111 1111`
- Expiry: any future date (e.g. `12/30`)
- CVV: `123`
- Name: any

Complete payment. Wait for playground verify success (`payment_id` + verified).

**SPEAK:**  
“Paying with Razorpay’s published test card, four-one-one-one repeating. On success the UI calls `POST /payments/verify` — HMAC of order and payment id — and we land in a verified state. Money path is live test mode end to end.”

---

### 2:10–2:50 — Hard blocks

**[SCREEN]** Click **⛔ Hard Block — blacklisted SKU**. Highlight status `HARD_BLOCK` / `SKU_BLACKLISTED`.

**SPEAK:**  
“Hard block — blacklisted SKU. Deterministic reason code `SKU_BLACKLISTED`. No Order created. Gate 1 never lets unauthorized catalog hit Razorpay.”

**[SCREEN]** Click **⛔ Hard Block — amount cap**. Highlight `AMOUNT_CAP_EXCEEDED`.

**SPEAK:**  
“Amount cap exceeded — same story. Policy lives in Python, not in the LLM. Same inputs, same reason codes, every time.”

---

### 2:50–3:30 — Soft-fail queue

**[SCREEN]** Click **⏸ Soft-Fail Queue**. Show bank forced ~80%, intent `QUEUED`.

**SPEAK:**  
“Soft-fail. We force bank health down to eighty percent — under the ninety-five threshold — so Gate 2 queues the intent. No Razorpay call while the rail is sick.”

**[SCREEN]** Click **Restore bank health & clear queue**. Show job completed / intent `CLEARED`.

**SPEAK:**  
“Restore health and clear — manual retry for the demo; production path is the ARQ worker. Intent moves to `CLEARED` with an Order when the rail recovers. Soft-fail, not fail-forever.”

---

### 3:30–4:00 — Tech proof

**[SCREEN]** New tab: https://sentinel-api-ecw9.onrender.com/api/v1/public/metrics — briefly show intents by status / blocks / queue.  
Then https://sentinel-api-ecw9.onrender.com/docs — scroll Agent / Payments / Webhooks tags.  
Optional: DevTools → Network on a playground call → highlight response header `X-Request-Id`.

**SPEAK:**  
“Tech proof: public metrics — intents by status, blocks, queue depth. OpenAPI one-point-two — agent intents with Idempotency-Key, payment verify, Razorpay webhooks for `payment.captured`. Every response carries `X-Request-Id` for tracing. That’s production-shaped surface area, not a slideware demo.”

---

### 4:00–4:20 — Close / internship ask

**[SCREEN]** Back to landing or `#pitch` Ask slide. Optionally flash Dashboard after quick login (`admin@sentinel-ap.local` / `admin123`) — decision feed with `razorpay.order_created` / `razorpay.payment_verified`.

**SPEAK:**  
“Sentinel-AP makes agentic commerce safe on Razorpay: fewer unauthorized charges, zero stuck payouts on degraded rails, full audit for every intent.  
I’m asking for a Buildathon win and an internship conversation — happy to walk the repo, the dual-gate design, and what I’d ship next. Thanks.”

---

## Timing cheat-sheet

| Segment | Approx | Key beat |
|---------|--------|----------|
| Cold open | 0:00–0:25 | Problem + where Sentinel sits |
| #pitch | 0:25–0:55 | Dual-gate one-liner |
| ALLOW + Checkout | 0:55–2:10 | Real `order_…` + 4111… + verify |
| Hard blocks | 2:10–2:50 | SKU + amount reason codes |
| Soft-fail | 2:50–3:30 | QUEUED → restore → CLEARED |
| Tech proof | 3:30–4:00 | Metrics / OpenAPI / X-Request-Id |
| Close | 4:00–4:20 | Internship ask |

If Checkout is slow, trim pitch skim to ~15s and keep the money path.

---

## Optional 90-second cut

**[SCREEN]** Landing (5s) → Playground ALLOW + Checkout 4111… (40s) → Hard block SKU (10s) → Soft-fail + restore (20s) → `/docs` flash (10s) → close (5s).

**SPEAK (compressed):**  
“Sentinel-AP — dual-gate middleware between AI agents and Razorpay. Gate 1 hard-blocks bad policy; Gate 2 queues when banks are unhealthy. Here’s a live test Checkout with card four-one-one-one… verified. Blacklisted SKU hard-blocks with a reason code. Soft-fail queues at eighty percent health, then clears when the rail recovers. OpenAPI, idempotency, webhooks, request ids — internship-ready. Built for the Razorpay Buildathon. Thanks.”

---

## Recording tips

1. Prefer Chromium; disable password managers on Checkout.
2. If API is cold, first intent may take 20–40s — narrate “warming Render” or pre-hit `/health`.
3. Soft-fail enqueue works without the ARQ worker; use **Restore & clear** for the CLEARED beat.
4. Never show `.env` or `RAZORPAY_KEY_SECRET` — only public URLs and the demo admin/agent credentials above.
5. One-pager PDF for judges: `docs/Sentinel-AP-Pitch-One-Pager.pdf`.
