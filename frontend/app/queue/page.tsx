"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, RotateCcw } from "lucide-react";
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
import { api, formatINR } from "@/lib/api";

export default function QueuePage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const t = localToken || token;

  const load = async (tok: string) => {
    setLoading(true);
    try {
      setJobs(await api.queue(tok));
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

  const retry = async (id: string) => {
    setRetrying(id);
    setMsg("");
    setErr("");
    try {
      const job = await api.retryJob(t, id);
      setMsg(`Job ${id.slice(0, 8)}… → ${job.status}`);
      await load(t);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setRetrying(null);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 page-enter">
        <PageHeader
          title="Soft-Fail Queue"
          description="Jobs waiting for bank rail recovery"
          actions={
            <button className="btn-secondary" onClick={() => load(t)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          }
        />

        {msg && <InfoBanner message={msg} />}
        {err && <ErrorBanner message={err} />}

        <div className="mt-6">
          {loading && jobs.length === 0 && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="panel !p-4">
                  <div className="skeleton h-5 w-48" />
                  <div className="mt-2 skeleton h-4 w-64" />
                </div>
              ))}
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <EmptyState
              title="Queue empty"
              description="Degrade bank health, then submit a valid intent from the Playground."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/bank-health" className="btn-secondary text-xs">
                    Bank Health
                  </Link>
                  <Link href="/playground" className="btn-primary text-xs">
                    Playground
                  </Link>
                </div>
              }
            />
          )}

          {jobs.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Job</th>
                    <th>Intent</th>
                    <th>Attempts</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <StatusBadge status={j.status} />
                      </td>
                      <td className="font-mono text-xs text-slate-400">{j.id.slice(0, 8)}…</td>
                      <td>
                        {j.intent ? (
                          <span>
                            <span className="font-mono text-sentinel-300">{j.intent.sku}</span>
                            <span className="text-slate-500"> · </span>
                            <span className="tabular-nums">{formatINR(j.intent.amount_paise)}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                        {j.last_error && (
                          <div className="mt-0.5 max-w-xs truncate text-xs text-rose-300/80">
                            {j.last_error}
                          </div>
                        )}
                      </td>
                      <td className="tabular-nums text-slate-400">
                        {j.attempts}/{j.max_attempts}
                      </td>
                      <td className="text-right">
                        {j.status !== "COMPLETED" && j.status !== "CANCELLED" ? (
                          <button
                            className="btn-primary !px-3 !py-1.5 text-xs"
                            onClick={() => retry(j.id)}
                            disabled={retrying === j.id}
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            {retrying === j.id ? "Retrying…" : "Retry"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
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
