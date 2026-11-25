"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { Nav } from "@/components/Nav";
import { AdminGuard } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

export default function BankHealthPage() {
  return <AdminGuard>{({ token }) => <BankHealthInner token={token} />}</AdminGuard>;
}

function BankHealthInner({ token }: { token: string }) {
  const [health, setHealth] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, hist] = await Promise.all([api.bankHealth(token), api.bankHistory(token)]);
      setHealth(h);
      setHistory(hist);
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const pct = health ? Math.round(health.success_rate * 100) : 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 page-enter">
        <PageHeader
          title="Bank Health"
          description="Live Gate 2 pre-flight telemetry for the payment rail"
          actions={
            <button className="btn-secondary" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          }
        />

        {err && <ErrorBanner message={err} />}

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

        <div className="panel mt-6">
          <h2 className="mb-3 font-semibold text-white">Recent snapshots</h2>
          {history.length === 0 ? (
            <EmptyState title="No snapshots yet" description="Health checks are recorded as the rail is probed." />
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
                      <td className="text-slate-400">{new Date(h.created_at).toLocaleString()}</td>
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
