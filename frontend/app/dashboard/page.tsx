"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Nav } from "@/components/Nav";
import { AdminGuard } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  StatCard,
} from "@/components/ui";
import { api, formatINR, IntentResult } from "@/lib/api";

const FILTERS = ["", "ALLOW", "HARD_BLOCK", "QUEUED", "CLEARED", "FAILED"] as const;

export default function DashboardPage() {
  return <AdminGuard>{({ token }) => <DashboardInner token={token} />}</AdminGuard>;
}

function DashboardInner({ token: t }: { token: string }) {
  const [stats, setStats] = useState<any>(null);
  const [intents, setIntents] = useState<IntentResult[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);


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


  const cards = stats
    ? [
        { label: "Total", value: stats.total_intents, tone: "text-fg" },
        { label: "Allowed", value: stats.allowed, tone: "text-sentinel-600" },
        { label: "Hard Blocked", value: stats.hard_blocked, tone: "text-rose-600" },
        { label: "Queued", value: stats.queued, tone: "text-amber-600" },
        { label: "Cleared", value: stats.cleared, tone: "text-link" },
        {
          label: "Bank Rail",
          value: `${((stats.bank_success_rate as number) * 100).toFixed(1)}%`,
          tone: stats.bank_is_degraded ? "text-amber-600" : "text-sentinel-600",
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
              <article key={intent.id} className="panel !p-4 transition hover:border-line">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={intent.status} />
                    <span className="font-mono text-sm text-sentinel-700">{intent.sku}</span>
                    <span className="font-semibold tabular-nums">{formatINR(intent.amount_paise)}</span>
                  </div>
                  <time className="text-xs text-fg-subtle" dateTime={intent.created_at}>
                    {new Date(intent.created_at).toLocaleString()}
                  </time>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {intent.decisions.map((d, idx) => (
                    <div
                      key={idx}
                      className="min-w-[180px] flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold uppercase tracking-wide text-fg-muted">{d.gate}</span>
                        <span className="text-fg-subtle">→</span>
                        <StatusBadge status={d.outcome} />
                      </div>
                      {d.reason_message && (
                        <div className="mt-1.5 text-fg-muted">{d.reason_message}</div>
                      )}
                    </div>
                  ))}
                </div>
                {intent.razorpay_order_id && (
                  <div className="mt-2 font-mono text-xs text-sentinel-700">
                    order: {intent.razorpay_order_id}
                  </div>
                )}
              </article>
            ))}

          {!loading && intents.length === 0 && (
            <EmptyState
              title="No decisions yet"
              description="Agent intents appear here once they hit POST /api/v1/agent/intents."
              action={
                <Link href="/integrate" className="btn-primary text-xs">
                  Integration guide
                </Link>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
