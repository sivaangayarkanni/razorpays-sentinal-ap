"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  LoadingScreen,
  PageHeader,
} from "@/components/ui";
import { api } from "@/lib/api";

export default function BankHealthPage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [rate, setRate] = useState(0.98);
  const [threshold, setThreshold] = useState(0.95);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const t = localToken || token;

  const load = async (tok: string) => {
    setLoading(true);
    try {
      const [h, hist] = await Promise.all([api.bankHealth(tok), api.bankHistory(tok)]);
      setHealth(h);
      setHistory(hist);
      setRate(h.success_rate);
      setThreshold(h.threshold);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (t) load(t);
  }, [t]);

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
        <LoginForm onLogin={(tok) => setLocalToken(tok)} />
      </>
    );
  }

  const apply = async () => {
    setApplying(true);
    setMsg("");
    setErr("");
    try {
      const h = await api.bankConfig(t, { mock_success_rate: rate, threshold });
      setHealth(h);
      setMsg(
        h.is_degraded
          ? "Rail DEGRADED — new intents will Soft-Fail Queue"
          : "Rail HEALTHY — intents will clear to Razorpay"
      );
      await load(t);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setApplying(false);
    }
  };

  const pct = health ? Math.round(health.success_rate * 100) : 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 page-enter">
        <PageHeader
          title="Bank Health"
          description="Gate 2 pre-flight rail uptime guardrail"
          actions={
            <button className="btn-secondary" onClick={() => load(t)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          }
        />

        {msg && <InfoBanner message={msg} />}
        {err && <ErrorBanner message={err} />}

        {loading && !health && (
          <div className="panel mt-6 flex flex-col items-center gap-4 py-12">
            <div className="skeleton h-36 w-36 !rounded-full" />
            <div className="skeleton h-5 w-48" />
          </div>
        )}

        {health && (
          <div className="panel mt-6 p-8 text-center">
            <div className="mx-auto flex max-w-xs flex-col items-center">
              <div
                className={clsx(
                  "relative flex h-40 w-40 items-center justify-center rounded-full border-[6px] text-4xl font-bold tabular-nums",
                  health.is_degraded
                    ? "border-amber-400/80 text-amber-300 shadow-[0_0_40px_rgba(251,191,36,0.15)]"
                    : "border-emerald-400/80 text-emerald-300 shadow-[0_0_40px_rgba(52,211,153,0.15)]"
                )}
                role="img"
                aria-label={`Success rate ${pct} percent`}
              >
                {pct}%
              </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <StatusBadge status={health.is_degraded ? "DEGRADED" : "HEALTHY"} />
                <span className="chip">
                  <Activity className="mr-1 inline h-3 w-3" aria-hidden />
                  {health.latency_ms}ms
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Threshold {(health.threshold * 100).toFixed(0)}% · provider{" "}
                <span className="font-mono text-slate-300">{health.provider}</span>
              </p>
            </div>
          </div>
        )}

        <div className="panel mt-6 space-y-5">
          <div>
            <h2 className="font-semibold text-white">Demo controls</h2>
            <p className="text-sm text-slate-400">Simulate degraded rails for soft-fail demos</p>
          </div>

          <label className="block space-y-2">
            <div className="flex justify-between text-sm">
              <span className="label !normal-case !tracking-normal">Mock success rate</span>
              <span className="font-mono text-sentinel-300">{rate.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={rate}
            />
          </label>

          <label className="block space-y-2">
            <div className="flex justify-between text-sm">
              <span className="label !normal-case !tracking-normal">Threshold</span>
              <span className="font-mono text-sentinel-300">{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              aria-valuemin={0.5}
              aria-valuemax={1}
              aria-valuenow={threshold}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" type="button" onClick={() => setRate(0.98)}>
              Healthy 98%
            </button>
            <button className="btn-ghost" type="button" onClick={() => setRate(0.8)}>
              Degrade 80%
            </button>
            <button className="btn-primary" type="button" onClick={apply} disabled={applying}>
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>

        <div className="panel mt-6">
          <h2 className="mb-3 font-semibold text-white">Recent snapshots</h2>
          {history.length === 0 ? (
            <EmptyState title="No snapshots yet" description="Apply a config change to record history." />
          ) : (
            <div className="table-wrap max-h-72 overflow-y-auto">
              <table className="table min-w-0">
                <thead>
                  <tr>
                    <th>Rate</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.created_at + String(h.success_rate)}>
                      <td
                        className={clsx(
                          "font-mono tabular-nums",
                          h.is_degraded ? "text-amber-300" : "text-emerald-300"
                        )}
                      >
                        {(h.success_rate * 100).toFixed(1)}%
                      </td>
                      <td>
                        <StatusBadge status={h.is_degraded ? "DEGRADED" : "HEALTHY"} />
                      </td>
                      <td className="text-slate-500">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
