"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  CreditCard,
  Gauge,
  Layers,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import clsx from "clsx";

const SLIDES = [
  {
    n: "01",
    title: "Problem",
    subtitle: "AI agents + hallucination + stuck payouts",
    icon: Ban,
    accent: "from-rose-500/20 to-transparent border-rose-500/25",
    iconCls: "text-rose-300 bg-rose-500/10 ring-rose-500/30",
    bullets: [
      "Buyer agents invent SKUs or overspend against policy",
      "Prompt-only guardrails are non-deterministic",
      "Bank rail blips leave payments stuck or double-fired",
      "No audit trail between agent intent and Razorpay",
    ],
  },
  {
    n: "02",
    title: "Solution",
    subtitle: "Sentinel-AP dual-gate control plane",
    icon: Shield,
    accent: "from-sentinel-500/20 to-transparent border-sentinel-500/25",
    iconCls: "text-sentinel-300 bg-sentinel-500/10 ring-sentinel-500/30",
    bullets: [
      "Middleware between AI agents and Razorpay",
      "Gate 1 hard-blocks policy violations",
      "Gate 2 soft-fails when rails degrade",
      "ALLOW → live test Orders + Checkout verify",
    ],
  },
  {
    n: "03",
    title: "How it works",
    subtitle: "Intent → Gates → Rail",
    icon: Layers,
    accent: "from-sky-500/20 to-transparent border-sky-500/25",
    iconCls: "text-sky-300 bg-sky-500/10 ring-sky-500/30",
    bullets: [
      "POST /api/v1/agent/intents with X-API-Key",
      "Idempotency-Key + X-Request-Id for safe retries",
      "Decision trail + audit on every outcome",
      "Outcomes: ALLOW · HARD_BLOCK · QUEUED → CLEARED",
    ],
  },
  {
    n: "04",
    title: "Gate 1",
    subtitle: "Deterministic policy hard block",
    icon: Ban,
    accent: "from-rose-500/20 to-transparent border-rose-500/25",
    iconCls: "text-rose-300 bg-rose-500/10 ring-rose-500/30",
    bullets: [
      "Per-txn + daily budget caps (paise)",
      "SKU whitelist / blacklist + currency allow-list",
      "Clear reason codes (AMOUNT_CAP_EXCEEDED, …)",
      "No LLM in the money path — internship-ready reliability",
    ],
  },
  {
    n: "05",
    title: "Gate 2",
    subtitle: "Bank health soft-fail queue",
    icon: Gauge,
    accent: "from-amber-500/20 to-transparent border-amber-500/25",
    iconCls: "text-amber-300 bg-amber-500/10 ring-amber-500/30",
    bullets: [
      "Pre-flight success-rate vs threshold (default 95%)",
      "Degraded → QUEUED (no Razorpay call)",
      "ARQ worker + admin manual retry when healthy",
      "Clears to CLEARED with Order creation",
    ],
  },
  {
    n: "06",
    title: "Razorpay",
    subtitle: "Test Orders + Checkout + verify",
    icon: CreditCard,
    accent: "from-emerald-500/20 to-transparent border-emerald-500/25",
    iconCls: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/30",
    bullets: [
      "Live rzp_test_ Orders (amounts in paise)",
      "Checkout.js → POST /payments/verify (HMAC)",
      "Webhook payment.captured (optional secret)",
      "Public config exposes key_id only — never secret",
    ],
  },
  {
    n: "07",
    title: "Why this wins",
    subtitle: "Deterministic · reliable · auditable",
    icon: Zap,
    accent: "from-violet-500/20 to-transparent border-violet-500/25",
    iconCls: "text-violet-300 bg-violet-500/10 ring-violet-500/30",
    bullets: [
      "Moat: policy + rail health, not another Checkout wrapper",
      "Full decision/audit trail for compliance demos",
      "OpenAPI 1.2 · metrics · request IDs · idempotency",
      "FastAPI + Next.js + Postgres + Redis production stack",
    ],
  },
  {
    n: "08",
    title: "Ask / Demo",
    subtitle: "Playground + internship-ready stack",
    icon: Target,
    accent: "from-cyan-500/20 to-transparent border-cyan-500/25",
    iconCls: "text-cyan-300 bg-cyan-500/10 ring-cyan-500/30",
    bullets: [
      "Open Playground — ALLOW → test card 4111… → verify",
      "Hard-block + soft-fail scenarios in one click",
      "Agent example: examples/agent_buyer.py",
      "Docs: ARCHITECTURE.md · INTERNSHIP.md",
    ],
  },
];

export function PitchDeck() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = useCallback((index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      child.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      setActive(index);
    }
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (!children.length) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      children.forEach((c, i) => {
        const center = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(center - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      setActive(best);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const section = document.getElementById("pitch");
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        scrollTo(Math.min(active + 1, SLIDES.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        scrollTo(Math.max(active - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scrollTo]);

  return (
    <section id="pitch" className="scroll-mt-20 border-y border-white/[0.06] bg-black/20 py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sentinel-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Pitch deck
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Eight slides judges can skim
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Snap-scroll · arrow keys when in view · mobile-friendly
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost !px-3"
              aria-label="Previous slide"
              onClick={() => scrollTo(Math.max(active - 1, 0))}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-xs text-slate-500">
              {String(active + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              className="btn-ghost !px-3"
              aria-label="Next slide"
              onClick={() => scrollTo(Math.min(active + 1, SLIDES.length - 1))}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="list"
          aria-label="Pitch slides"
        >
          {SLIDES.map((s, i) => (
            <article
              key={s.n}
              role="listitem"
              className={clsx(
                "glass relative w-[min(100%,320px)] shrink-0 snap-center bg-gradient-to-b p-5 md:w-[340px] md:p-6",
                s.accent,
                i === active && "ring-1 ring-sentinel-500/40"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl ring-1", s.iconCls)}>
                  <s.icon className="h-5 w-5" aria-hidden />
                </div>
                <span className="font-mono text-2xl font-bold tabular-nums text-white/15">{s.n}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{s.subtitle}</p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-400" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {i === SLIDES.length - 1 && (
                <Link href="/playground" className="btn-primary mt-5 w-full !py-2.5 text-sm">
                  Launch Playground
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </article>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.n}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              className={clsx(
                "h-1.5 rounded-full transition-all",
                i === active ? "w-6 bg-sentinel-400" : "w-1.5 bg-white/20 hover:bg-white/40"
              )}
              onClick={() => scrollTo(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
