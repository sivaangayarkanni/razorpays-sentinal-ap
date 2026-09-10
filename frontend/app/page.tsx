import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-12">
        <section className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sentinel-500/30 bg-sentinel-500/10 px-3 py-1 text-xs font-medium text-sentinel-300">
            Razorpay Buildathon · Autonomous AI × Payments
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight md:text-6xl">
            Smart Security Guardrails for{" "}
            <span className="bg-gradient-to-r from-sentinel-400 to-indigo-400 bg-clip-text text-transparent">
              AI Agent Payments
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Sentinel-AP sits between Autonomous AI Buyer Agents and Razorpay — hard-blocking
            policy violations, soft-failing when bank rails degrade, and clearing safely when
            health recovers.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/playground" className="btn-primary">
              Open Demo Playground
            </Link>
            <Link href="/dashboard" className="btn-ghost">
              Admin Dashboard
            </Link>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              gate: "Gate 1",
              title: "AI Logic & Policy Guardrail",
              tone: "Hard Block",
              color: "from-rose-500/20 to-rose-500/5 border-rose-500/20",
              points: [
                "Deterministic budget caps (per-txn + daily)",
                "SKU whitelist / blacklist",
                "Clear reason codes for every block",
              ],
            },
            {
              gate: "Gate 2",
              title: "Bank Uptime Guardrail",
              tone: "Soft-Fail Queue",
              color: "from-amber-500/20 to-amber-500/5 border-amber-500/20",
              points: [
                "Pre-flight bank health ping",
                "Threshold default >95% success",
                "Redis + ARQ retry worker",
              ],
            },
            {
              gate: "Rail",
              title: "Razorpay Dispatch",
              tone: "PASS → Pay",
              color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
              points: [
                "Amounts in paise (INR)",
                "Mock or live test keys",
                "Full audit trail + OpenAPI",
              ],
            },
          ].map((c) => (
            <div key={c.gate} className={`glass bg-gradient-to-b ${c.color} p-6`}>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                {c.gate} · {c.tone}
              </div>
              <h3 className="mt-2 text-xl font-bold">{c.title}</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {c.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-sentinel-400">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="glass mt-16 p-8">
          <h2 className="text-2xl font-bold">Flow</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black/40 p-4 text-left text-xs text-sentinel-200 md:text-sm">
{`AI Buyer Agent
      │  POST /api/v1/agent/intents  (X-API-Key)
      ▼
┌─────────────────────────────────────────┐
│              Sentinel-AP                │
│  Gate 1 Policy ──► HARD_BLOCK (stop)    │
│       │ PASS                            │
│  Gate 2 Bank Health                     │
│       ├── degraded ──► Soft-Fail Queue  │
│       └── healthy  ──► Razorpay Order   │
└─────────────────────────────────────────┘
      │
      ▼
  ALLOW | HARD_BLOCK | QUEUED → CLEARED`}
          </pre>
        </section>

        <section className="mt-12 text-center text-sm text-slate-500">
          Built for Razorpay Buildathon · FastAPI · Next.js · Postgres · Redis · ARQ
        </section>
      </main>
    </>
  );
}
