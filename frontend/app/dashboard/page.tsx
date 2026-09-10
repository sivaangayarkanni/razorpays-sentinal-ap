"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import { api, formatINR, IntentResult } from "@/lib/api";

export default function DashboardPage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [intents, setIntents] = useState<IntentResult[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");

  const t = localToken || token;

  const load = useCallback(async (tok: string, status?: string) => {
    try {
      const [s, i] = await Promise.all([api.stats(tok), api.intents(tok, status || undefined)]);
      setStats(s);
      setIntents(i);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    if (t) load(t, filter);
  }, [t, filter, load]);

  if (!ready) return null;
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
        },
      ]
    : [];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Decision Feed</h1>
            <p className="text-slate-400">Live Gate 1 / Gate 2 outcomes</p>
          </div>
          <button className="btn-ghost" onClick={() => t && load(t, filter)}>
            Refresh
          </button>
        </div>

        {err && <p className="mt-4 text-rose-400">{err}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="glass p-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">{c.label}</div>
              <div className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {["", "ALLOW", "HARD_BLOCK", "QUEUED", "CLEARED", "FAILED"].map((f) => (
            <button
              key={f || "all"}
              className={filter === f ? "btn-primary text-xs" : "btn-ghost text-xs"}
              onClick={() => setFilter(f)}
            >
              {f || "ALL"}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {intents.map((intent) => (
            <div key={intent.id} className="glass p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <StatusBadge status={intent.status} />
                  <span className="font-mono text-sm text-sentinel-300">{intent.sku}</span>
                  <span className="font-semibold">{formatINR(intent.amount_paise)}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(intent.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {intent.decisions.map((d, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-slate-300">{d.gate}</span>
                    <span className="mx-2 text-slate-600">→</span>
                    <StatusBadge status={d.outcome} />
                    <div className="mt-1 text-slate-400">{d.reason_message}</div>
                  </div>
                ))}
              </div>
              {intent.razorpay_order_id && (
                <div className="mt-2 font-mono text-xs text-emerald-400/80">
                  order: {intent.razorpay_order_id}
                </div>
              )}
            </div>
          ))}
          {intents.length === 0 && (
            <p className="text-center text-slate-500 py-12">
              No decisions yet — try the Demo Playground.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
