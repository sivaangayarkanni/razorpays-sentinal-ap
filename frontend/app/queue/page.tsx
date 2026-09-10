"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import { api, formatINR } from "@/lib/api";

export default function QueuePage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const t = localToken || token;
  const load = async (tok: string) => setJobs(await api.queue(tok));

  useEffect(() => {
    if (t) load(t).catch(console.error);
  }, [t]);

  if (!ready) return null;
  if (!t) {
    return (
      <>
        <Nav />
        <LoginForm onLogin={(tok) => setLocalToken(tok)} />
      </>
    );
  }

  const retry = async (id: string) => {
    try {
      const job = await api.retryJob(t, id);
      setMsg(`Job ${id.slice(0, 8)}… → ${job.status}`);
      await load(t);
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Soft-Fail Queue</h1>
            <p className="text-slate-400">Jobs waiting for bank rail recovery</p>
          </div>
          <button className="btn-ghost" onClick={() => load(t)}>
            Refresh
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-sentinel-300">{msg}</p>}

        <div className="mt-6 space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="glass p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                  <span className="font-mono text-xs text-slate-500">{j.id.slice(0, 8)}…</span>
                </div>
                {j.intent && (
                  <div className="mt-1 text-sm">
                    <span className="text-sentinel-300">{j.intent.sku}</span> ·{" "}
                    {formatINR(j.intent.amount_paise)}
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  attempts {j.attempts}/{j.max_attempts}
                  {j.last_error ? ` · ${j.last_error}` : ""}
                </div>
              </div>
              {j.status !== "COMPLETED" && j.status !== "CANCELLED" && (
                <button className="btn-primary text-xs" onClick={() => retry(j.id)}>
                  Manual Retry
                </button>
              )}
            </div>
          ))}
          {jobs.length === 0 && (
            <p className="py-12 text-center text-slate-500">
              Queue empty — degrade bank health in Bank Health page, then submit an intent.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
