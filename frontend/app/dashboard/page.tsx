"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  ErrorBanner,
  LoadingScreen,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { api, formatINR, IntentResult } from "@/lib/api";

const FILTERS = ["", "ALLOW", "HARD_BLOCK", "QUEUED", "CLEARED", "FAILED"] as const;

export default function DashboardPage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [intents, setIntents] = useState<IntentResult[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const t = localToken || token;

  const load = useCallback(async (tok: string, status?: string) => {
    setLoading(true);
    try {
      const [s, i] = await Promise.all([api.stats(tok), api.intents(tok, status || undefined)]);
      setStats(s);
      setIntents(i);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (t) load(t, filter);
  }, [t, filter, load]);

  if (!ready) {
    return (
      <>
        <Nav />
        <LoadingScreen />
      </>
    );
  }
  if (!t) {
    return (
      <>
        <Nav />
        <LoginForm
          onLogin={(tok) => {
            setLocalToken(tok);
            load(tok);
          }}
        />
      </>
    );
  }

  const cards = stats
    ? [
        { label: "Total", value: stats.total_intents, tone: "text-white" },
        { label: "Allowed", value: stats.allowed, tone: "text-emerald-300" },
        { label: "Hard Blocked", value: stats.hard_blocked, tone: "text-rose-300" },
        { label: "Queued", value: stats.queued, tone: "text-amber-300" },
        { label: "Cleared", value: stats.cleared, tone: "text-sky-300" },
        {
          label: "Bank Rail",
          value: `${((stats.bank_success_rate as number) * 100).toFixed(1)}%`,
          tone: stats.bank_is_degraded ? "text-amber-300" : "text-emerald-300",
          hint: stats.bank_is_degraded ? "Degraded" : "Healthy",
        },
      ]
    : [];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8 page-enter">
        <PageHeader
          title="Decision Feed"
          description="Live Gate 1 / Gate 2 outcomes across agent intents"
          actions={
            <button className="btn-secondary" onClick={() => t && load(t, filter)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          }
        />

        {err && <ErrorBanner message={err} />}

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {loading && !stats
            ? Array.from({ length: 6 }).map((_, i) => <StatCard key={i} label="…" value="—" loading />)
            : cards.map((c) => (
                <StatCard key={c.label} label={c.label} value={c.value} tone={c.tone} hint={c.hint} />
              ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Status filter">
          {FILTERS.map((f) => (
            <button
              key={f || "all"}
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? "btn-primary !py-1.5 text-xs" : "btn-ghost !py-1.5 text-xs"}
              onClick={() => setFilter(f)}
            >
              {f || "ALL"}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {loading && intents.length === 0 && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="panel !p-4">
                  <div className="skeleton h-5 w-40" />
                  <div className="mt-3 skeleton h-16 w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading &&
            intents.map((intent) => (
              <article key={intent.id} className="panel !p-4 transition hover:border-white/15">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={intent.status} />
                    <span className="font-mono text-sm text-sentinel-300">{intent.sku}</span>
                    <span className="font-semibold tabular-nums">{formatINR(intent.amount_paise)}</span>
                  </div>
                  <time className="text-xs text-slate-500" dateTime={intent.created_at}>
                    {new Date(intent.created_at).toLocaleString()}
                  </time>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {intent.decisions.map((d, idx) => (
                    <div
                      key={idx}
                      className="min-w-[180px] flex-1 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold uppercase tracking-wide text-slate-300">{d.gate}</span>
                        <span className="text-slate-600">→</span>
                        <StatusBadge status={d.outcome} />
                      </div>
                      {d.reason_message && (
                        <div className="mt-1.5 text-slate-400">{d.reason_message}</div>
                      )}
                    </div>
                  ))}
                </div>
                {intent.razorpay_order_id && (
                  <div className="mt-2 font-mono text-xs text-emerald-400/80">
                    order: {intent.razorpay_order_id}
                  </div>
                )}
              </article>
            ))}

          {!loading && intents.length === 0 && (
            <EmptyState
              title="No decisions yet"
              description="Submit an intent from the Demo Playground to populate the feed."
              action={
                <Link href="/playground" className="btn-primary text-xs">
                  Open Playground
                </Link>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
