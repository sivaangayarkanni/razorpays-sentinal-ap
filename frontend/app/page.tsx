import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Gauge,
  Layers,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { Nav } from "@/components/Nav";

const TRUST = [
  "FastAPI · OpenAPI",
  "Postgres · Redis · ARQ",
  "Razorpay Orders (paise)",
  "Deterministic Gate 1",
  "Soft-Fail Queue",
  "Full audit trail",
];

const GATES = [
  {
    gate: "Gate 1",
    title: "AI Logic & Policy Guardrail",
    tone: "Hard Block",
    icon: Ban,
    accent: "border-rose-500/25 from-rose-500/15 via-transparent to-transparent",
    iconCls: "text-rose-300 bg-rose-500/10 ring-rose-500/25",
    points: [
      "Deterministic budget caps (per-txn + daily)",
      "SKU whitelist / blacklist enforcement",
      "Clear reason codes for every block",
    ],
  },
  {
    gate: "Gate 2",
    title: "Bank Uptime Guardrail",
    tone: "Soft-Fail Queue",
    icon: Gauge,
    accent: "border-amber-500/25 from-amber-500/15 via-transparent to-transparent",
    iconCls: "text-amber-300 bg-amber-500/10 ring-amber-500/25",
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
    icon: Zap,
    accent: "border-emerald-500/25 from-emerald-500/15 via-transparent to-transparent",
    iconCls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/25",
    points: [
      "Amounts in paise (INR)",
      "Mock or live test keys",
      "Full audit trail + OpenAPI",
    ],
  },
];

const STEPS = [
  { label: "AI Buyer Agent", detail: "POST /api/v1/agent/intents", icon: Sparkles },
  { label: "Gate 1 Policy", detail: "HARD_BLOCK or PASS", icon: Lock },
  { label: "Gate 2 Bank Health", detail: "Queue if degraded", icon: RefreshCw },
  { label: "Razorpay Order", detail: "ALLOW → CLEARED", icon: CheckCircle2 },
];

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="page-enter">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-grid-fade bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 md:pb-24 md:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sentinel-500/30 bg-sentinel-500/10 px-3 py-1 text-xs font-medium text-sentinel-200">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Razorpay Buildathon · Autonomous AI × Payments
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl md:leading-[1.08]">
                Smart security guardrails for{" "}
                <span className="bg-gradient-to-r from-sentinel-300 via-sky-300 to-cyan-200 bg-clip-text text-transparent">
                  AI agent payments
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
                Sentinel-AP sits between autonomous AI buyer agents and Razorpay — hard-blocking
                policy violations, soft-failing when bank rails degrade, and clearing safely when
                health recovers.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/playground" className="btn-primary !px-5 !py-3">
                  Open Demo Playground
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/dashboard" className="btn-secondary !px-5 !py-3">
                  Admin Dashboard
                </Link>
              </div>
            </div>

            {/* Trust strip */}
            <div className="mx-auto mt-14 max-w-5xl">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Built for production demos
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {TRUST.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="mx-auto max-w-7xl px-4 pb-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sentinel-400">
                <Layers className="h-3.5 w-3.5" aria-hidden />
                Architecture
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                Intent → Gates → Rail
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.label} className="panel relative !p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sentinel-600/15 text-sentinel-300 ring-1 ring-sentinel-500/25">
                    <s.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">0{i + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-white">{s.label}</h3>
                <p className="mt-1 text-xs text-slate-400">{s.detail}</p>
              </div>
            ))}
          </div>

          <div className="panel mt-4 overflow-hidden !p-0">
            <div className="border-b border-white/[0.06] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Decision path
            </div>
            <pre className="overflow-x-auto bg-black/30 p-5 font-mono text-[11px] leading-relaxed text-sentinel-200/90 md:text-xs">
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
          </div>
        </section>

        {/* Gate cards */}
        <section className="mx-auto max-w-7xl px-4 py-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Dual-gate control plane</h2>
            <p className="mt-1 text-slate-400">Policy hard-stops first. Rail health decides queue vs clear.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {GATES.map((c) => (
              <div
                key={c.gate}
                className={`glass bg-gradient-to-b ${c.accent} p-6 transition hover:border-white/15`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${c.iconCls}`}
                  >
                    <c.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="badge badge-neutral">{c.tone}</span>
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  {c.gate}
                </div>
                <h3 className="mt-1 text-lg font-bold text-white">{c.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-400" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-4">
          <div className="relative overflow-hidden rounded-3xl border border-sentinel-500/20 bg-gradient-to-br from-sentinel-950/80 via-ink-900 to-ink p-8 md:p-12">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sentinel-600/20 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Run the full Gate 1 → Gate 2 demo
                </h2>
                <p className="mt-2 max-w-xl text-slate-400">
                  One-click scenarios for allow, hard-block, and soft-fail queue — then restore bank
                  health and clear the rail.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/playground" className="btn-primary !px-5 !py-3">
                  Launch Playground
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/bank-health" className="btn-secondary !px-5 !py-3">
                  Simulate rail health
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-sm text-slate-500">
            Built for Razorpay Buildathon · FastAPI · Next.js · Postgres · Redis · ARQ
          </p>
        </section>
      </main>
    </>
  );
}
