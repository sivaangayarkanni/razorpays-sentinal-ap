import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";

const STACK = [
  "FastAPI 1.2",
  "PostgreSQL",
  "Redis + ARQ",
  "Razorpay Orders",
  "Checkout.js",
  "Next.js 14",
  "Docker / Render / Vercel",
];

const WHY = [
  { title: "Idempotency-Key", body: "agent retries never duplicate Orders" },
  { title: "Audit + decision trail", body: "every gate outcome persisted" },
  { title: "Webhooks", body: "payment.captured receiver" },
  { title: "Checkout test mode", body: "live order_ ids when keys are present" },
  { title: "OpenAPI", body: "typed agent, admin, and payments surface" },
  { title: "X-Request-Id + metrics", body: "observability built in" },
];

export function PitchOnePager() {
  return (
    <article className="pitch-sheet mx-auto max-w-5xl">
      <header className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg md:text-3xl">
            Sentinel-AP —{" "}
            <span className="bg-gradient-to-r from-link via-lavender-bright to-sentinel-400 bg-clip-text text-transparent">
              Autonomous Transaction Reliability Layer
            </span>
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Smart security guardrail between AI buyer agents and Razorpay
          </p>
        </div>
        <div className="shrink-0 text-left sm:max-w-xs sm:text-right">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="badge badge-allow">Razorpay Buildathon</span>
            <PrintButton />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            Deterministic dual-gate middleware so agents can spend — safely, observably, and
            without stuck payouts.
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="panel !p-5">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
            Problem
          </h2>
          <ul className="space-y-2.5 text-sm text-fg-muted">
            <li>
              <strong className="text-fg">Hallucinated SKUs & over-budget spends</strong> — LLM
              prompts are not a payment authorization layer.
            </li>
            <li>
              <strong className="text-fg">Bank-rail outages</strong> fail closed forever or retry
              blindly, creating stuck or duplicate money movement.
            </li>
            <li>
              <strong className="text-fg">No audit trail</strong> between agent intent and Razorpay
              Order — ops and compliance go dark.
            </li>
          </ul>
        </section>

        <section className="panel !p-5">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
            Solution — Dual Gate
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-rose-500/25 bg-rose-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                Gate 1 · Hard Block
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                Deterministic policy: amount/daily caps, SKU lists, currency allow-list. Codes like{" "}
                <code className="rounded bg-white px-1 font-mono text-[11px] text-fg">SKU_BLACKLISTED</code>,{" "}
                <code className="rounded bg-white px-1 font-mono text-[11px] text-fg">AMOUNT_CAP_EXCEEDED</code>.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Gate 2 · Soft-Fail
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
                Pre-flight bank health ({">"}95%). Degraded →{" "}
                <code className="rounded bg-white px-1 font-mono text-[11px] text-fg">QUEUED</code>; recover →
                Order → <code className="rounded bg-white px-1 font-mono text-[11px] text-fg">CLEARED</code>.
                Never pay on a sick rail.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="panel mt-4 !p-5">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
          Architecture
        </h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          <strong className="text-fg">Agents never talk to Razorpay directly.</strong> Every spend
          intent hits Sentinel-AP first — auth, idempotency, dual gates, then Orders + Checkout +
          verify/webhooks.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className="chip">AI Agent</span>
          <span className="text-fg-subtle" aria-hidden>
            →
          </span>
          <span className="chip-accent">Sentinel-AP</span>
          <span className="text-fg-subtle" aria-hidden>
            →
          </span>
          <span className="chip">Gate 1 Policy</span>
          <span className="text-fg-subtle" aria-hidden>
            →
          </span>
          <span className="chip">Gate 2 Health</span>
          <span className="text-fg-subtle" aria-hidden>
            →
          </span>
          <span className="chip-accent">Razorpay Order</span>
          <span className="text-fg-subtle" aria-hidden>
            →
          </span>
          <span className="chip">Checkout</span>
          <span className="chip-rose">HARD_BLOCK</span>
          <span className="chip-amber">QUEUED</span>
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <section className="panel !p-5">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
            Tech Stack
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {STACK.map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
        </section>
        <section className="panel !p-5">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
            Live
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex gap-3">
              <dt className="w-10 shrink-0 font-bold uppercase tracking-wider text-sentinel-700">Web</dt>
              <dd>
                <Link href="https://sentinel-ap.vercel.app" className="font-mono text-link hover:underline">
                  sentinel-ap.vercel.app
                </Link>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-10 shrink-0 font-bold uppercase tracking-wider text-sentinel-700">API</dt>
              <dd>
                <a
                  href="https://sentinel-api-ecw9.onrender.com/health"
                  className="font-mono text-link hover:underline"
                >
                  sentinel-api-ecw9.onrender.com
                </a>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-10 shrink-0 font-bold uppercase tracking-wider text-sentinel-700">Guide</dt>
              <dd>
                <Link href="/integrate" className="font-mono text-link hover:underline">
                  /integrate
                </Link>
              </dd>
            </div>
          </dl>
        </section>
        <section className="panel !p-5">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
            Ask / Impact
          </h2>
          <p className="text-sm leading-relaxed text-fg-muted">
            Make <strong className="text-fg">agentic commerce</strong> production-safe on Razorpay:
            fewer unauthorized charges, zero stuck payouts on degraded rails, full decision audit
            for every intent.
          </p>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-sentinel-500/25 bg-gradient-to-br from-sentinel-50 via-white to-link/5 p-5 shadow-card">
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-sentinel-700">
          Why Internship-Ready
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {WHY.map((item) => (
            <div key={item.title} className="text-sm text-fg-muted">
              <span className="mr-1.5 font-bold text-sentinel-600" aria-hidden>
                ✓
              </span>
              <strong className="text-fg">{item.title}</strong> — {item.body}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-6 flex flex-col gap-1 border-t border-line pt-4 text-[11px] text-fg-subtle sm:flex-row sm:justify-between">
        <span>Sentinel-AP · Razorpay Buildathon / Internship deliverable · MIT</span>
        <span className="font-mono">/pitch · docs/Sentinel-AP-Pitch-One-Pager.pdf</span>
      </footer>
    </article>
  );
}
