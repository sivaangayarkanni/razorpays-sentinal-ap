"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { api } from "@/lib/api";

export default function BankHealthPage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [rate, setRate] = useState(0.98);
  const [threshold, setThreshold] = useState(0.95);
  const [msg, setMsg] = useState("");

  const t = localToken || token;

  const load = async (tok: string) => {
    const [h, hist] = await Promise.all([api.bankHealth(tok), api.bankHistory(tok)]);
    setHealth(h);
    setHistory(hist);
    setRate(h.success_rate);
    setThreshold(h.threshold);
  };

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

  const apply = async () => {
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
      setMsg(e.message);
    }
  };

  const pct = health ? Math.round(health.success_rate * 100) : 0;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Bank Health</h1>
        <p className="text-slate-400">Gate 2 pre-flight rail uptime guardrail</p>

        {health && (
          <div className="glass mt-6 p-8 text-center">
            <div
              className={`mx-auto flex h-36 w-36 items-center justify-center rounded-full border-4 text-3xl font-bold ${
                health.is_degraded
                  ? "border-amber-400 text-amber-300"
                  : "border-emerald-400 text-emerald-300"
              }`}
            >
              {pct}%
            </div>
            <p className="mt-4 text-lg font-semibold">
              {health.is_degraded ? "DEGRADED" : "HEALTHY"} · latency {health.latency_ms}ms
            </p>
            <p className="text-sm text-slate-400">
              Threshold {(health.threshold * 100).toFixed(0)}% · provider {health.provider}
            </p>
          </div>
        )}

        <div className="glass mt-6 space-y-4 p-6">
          <h2 className="font-semibold">Demo controls (simulate degraded rails)</h2>
          <label className="block text-sm">
            Mock success rate: {rate.toFixed(2)}
            <input
              className="mt-2 w-full"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            Threshold: {threshold.toFixed(2)}
            <input
              className="mt-2 w-full"
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setRate(0.98)}>
              Healthy 98%
            </button>
            <button className="btn-ghost" onClick={() => setRate(0.8)}>
              Degrade 80%
            </button>
            <button className="btn-primary" onClick={apply}>
              Apply
            </button>
          </div>
          {msg && <p className="text-sm text-sentinel-300">{msg}</p>}
        </div>

        <div className="glass mt-6 p-6">
          <h2 className="font-semibold mb-3">Recent snapshots</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div key={h.created_at + h.success_rate} className="flex justify-between text-sm">
                <span className={h.is_degraded ? "text-amber-300" : "text-emerald-300"}>
                  {(h.success_rate * 100).toFixed(1)}%
                </span>
                <span className="text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
