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
import { SystemStatus } from "@/components/SystemStatus";
import { GuideAgents, SectionCoach } from "@/components/GuideAgents";

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
    accent: "border-rose-500/25 from-rose-500/10 via-transparent to-transparent",
    iconCls: "text-rose-600 bg-rose-50 ring-rose-500/25",
    coach: "scout" as const,
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
    accent: "border-amber-500/30 from-amber-50 via-transparent to-transparent",
    iconCls: "text-amber-700 bg-amber-50 ring-amber-500/30",
    coach: "watcher" as const,
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
    accent: "border-sentinel-500/25 from-sentinel-50 via-transparent to-transparent",
    iconCls: "text-sentinel-700 bg-sentinel-50 ring-sentinel-500/25",
    coach: "runner" as const,
    points: [
      "Amounts in paise (INR)",
      "Live or test Razorpay keys",
      "Full audit trail",
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
        <section id="hero" className="relative overflow-hidden scroll-mt-20">
          <div
            className="pointer-events-none absolute inset-0 bg-grid-fade bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-link/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 top-10 h-56 w-56 -translate-x-1/2 rounded-full bg-sentinel-400/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-16 top-40 h-48 w-48 rounded-full bg-lavender-500/15 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 md:pb-24 md:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sentinel-500/30 bg-sentinel-500/10 px-3 py-1 text-xs font-medium text-sentinel-700">
                <Shield className="h-3.5 w-3.5" aria-hidden />
                Payment guardrails for autonomous agents
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-fg md:text-6xl md:leading-[1.08]">
                Smart security guardrails for{" "}
                <span className="bg-gradient-to-r from-link via-lavender-bright to-sentinel-300 bg-clip-text text-transparent">
                  AI agent payments
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-fg-muted md:text-lg">
                Sentinel-AP sits between autonomous AI buyer agents and Razorpay — hard-blocking
                policy violations, soft-failing when bank rails degrade, and clearing safely when
                health recovers.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/dashboard" className="btn-primary !px-5 !py-3">
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/pay" className="btn-secondary !px-5 !py-3">
                  New payment
                </Link>
                <Link href="/integrate" className="btn-secondary !px-5 !py-3">
                  Integrate
                </Link>
              </div>
              <div className="mt-5 flex justify-center">
                <SystemStatus />
              </div>
            </div>

            <GuideAgents />

            {/* Trust strip */}
            <div className="mx-auto mt-14 max-w-5xl">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">
                Built for production
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {TRUST.map((t) => (
                  <span key={t} className="chip chip-accent">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section id="architecture" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-8 pt-10">
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
            <SectionCoach guideId="watcher" className="hidden sm:inline-flex" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.label} className="panel relative !p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sentinel-50 text-sentinel-700 ring-1 ring-sentinel-500/25">
                    <s.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="font-mono text-[11px] text-fg-subtle">0{i + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-fg">{s.label}</h3>
                <p className="mt-1 text-xs text-fg-muted">{s.detail}</p>
              </div>
            ))}
          </div>

          <div className="panel mt-4 overflow-hidden !p-0">
            <div className="border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              Decision path
            </div>
            <pre className="overflow-x-auto bg-surface p-5 font-mono text-[11px] leading-relaxed text-sentinel-700/90 md:text-xs">
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
        <section id="gates" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Dual-gate control plane</h2>
              <p className="mt-1 text-fg-muted">
                Policy hard-stops first. Rail health decides queue vs clear.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SectionCoach guideId="scout" />
              <SectionCoach guideId="watcher" />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {GATES.map((c) => (
              <div
                key={c.gate}
                className={`glass bg-gradient-to-b ${c.accent} p-6 transition hover:border-line`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${c.iconCls}`}
                  >
                    <c.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="badge badge-neutral">{c.tone}</span>
                    <SectionCoach guideId={c.coach} />
                  </div>
                </div>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
                  {c.gate}
                </div>
                <h3 className="mt-1 text-lg font-bold text-fg">{c.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-fg-muted">
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
        <section id="cta" className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-20 pt-4">
          <div className="relative overflow-hidden rounded-3xl border border-sentinel-500/25 bg-gradient-to-br from-link/5 via-white to-sentinel-50 p-8 md:p-12">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sentinel-500/20 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-lavender-500/10 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="mb-3">
                  <SectionCoach guideId="runner" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Connect an agent and go live
                </h2>
                <p className="mt-2 max-w-xl text-fg-muted">
                  Sign in to issue API keys, set policies, and monitor rail health. Agents call a
                  single intent endpoint with their key.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard" className="btn-primary !px-5 !py-3">
                  Open console
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/integrate" className="btn-secondary !px-5 !py-3">
                  Integration guide
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-sm text-fg-subtle">
            Sentinel-AP · FastAPI · Next.js · Postgres · Redis ·{" "}
            <Link href="/pitch" className="text-link hover:underline">
              Pitch
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
