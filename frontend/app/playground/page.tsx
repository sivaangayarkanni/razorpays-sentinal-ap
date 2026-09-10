"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { StatusBadge } from "@/components/StatusBadge";
import { api, formatINR, IntentResult, API_URL } from "@/lib/api";

const DEMO_KEY = "sap_demo000000000000000000000000000001";

const SCENARIOS = [
  {
    id: "allow",
    title: "✓ Successful clearance",
    desc: "Whitelisted SKU, under budget, healthy bank → ALLOW",
    body: { amount_paise: 4999_00, currency: "INR", sku: "LAPTOP-PRO", description: "MacBook purchase" },
    prep: "healthy" as const,
  },
  {
    id: "block-sku",
    title: "⛔ Hard Block — blacklisted SKU",
    desc: "SKU WEAPON hits Gate 1 blacklist → HARD_BLOCK",
    body: { amount_paise: 500_00, currency: "INR", sku: "WEAPON", description: "Should be blocked" },
    prep: null,
  },
  {
    id: "block-amount",
    title: "⛔ Hard Block — amount cap",
    desc: "₹25,000 exceeds ₹10,000 per-txn cap → HARD_BLOCK",
    body: { amount_paise: 25000_00, currency: "INR", sku: "MONITOR-4K", description: "Over cap" },
    prep: null,
  },
  {
    id: "queue",
    title: "⏸ Soft-Fail Queue",
    desc: "Degrade bank to 80%, then submit valid intent → QUEUED",
    body: { amount_paise: 1999_00, currency: "INR", sku: "MOUSE-MX", description: "Queued while rail degraded" },
    prep: "degrade" as const,
  },
];

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState(DEMO_KEY);
  const [amount, setAmount] = useState(4999_00);
  const [sku, setSku] = useState("LAPTOP-PRO");
  const [result, setResult] = useState<IntentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 20));

  const ensureAdmin = async () => {
    if (adminToken) return adminToken;
    const res = await api.login("admin@sentinel-ap.local", "admin123");
    setAdminToken(res.access_token);
    return res.access_token;
  };

  const runScenario = async (s: (typeof SCENARIOS)[number]) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (s.prep === "degrade") {
        const tok = await ensureAdmin();
        await api.bankConfig(tok, { mock_success_rate: 0.8, threshold: 0.95 });
        push("Bank health forced to 80% (degraded)");
      } else if (s.prep === "healthy") {
        const tok = await ensureAdmin();
        await api.bankConfig(tok, { mock_success_rate: 0.98, threshold: 0.95 });
        push("Bank health restored to 98%");
      }
      const res = await api.createIntent(apiKey, s.body);
      setResult(res);
      push(`${s.title} → ${res.status}`);
    } catch (e: any) {
      setError(typeof e.message === "string" ? e.message : JSON.stringify(e.message));
    } finally {
      setLoading(false);
    }
  };

  const submitCustom = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.createIntent(apiKey, {
        amount_paise: amount,
        currency: "INR",
        sku,
        description: "Custom playground intent",
      });
      setResult(res);
      push(`Custom → ${res.status}`);
    } catch (e: any) {
      setError(typeof e.message === "string" ? e.message : JSON.stringify(e.message));
    } finally {
      setLoading(false);
    }
  };

  const clearAndRetry = async () => {
    if (!result?.queue_job_id) return;
    setLoading(true);
    try {
      const tok = await ensureAdmin();
      await api.bankConfig(tok, { mock_success_rate: 0.99, threshold: 0.95 });
      push("Bank restored to 99%");
      const job = await api.retryJob(tok, result.queue_job_id);
      push(`Manual retry → ${job.status}`);
      // refresh intents to show CLEARED
      const intents = await api.intents(tok);
      const updated = intents.find((i) => i.id === result.id);
      if (updated) setResult(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold">Demo Playground</h1>
        <p className="text-slate-400">
          Simulate an AI buyer agent hitting Sentinel-AP. API:{" "}
          <code className="text-sentinel-300">{API_URL}</code>
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="glass p-5 space-y-3">
              <h2 className="font-semibold">One-click scenarios</h2>
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  className="btn-ghost w-full justify-start text-left"
                  disabled={loading}
                  onClick={() => runScenario(s)}
                >
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <div className="text-xs text-slate-400 font-normal">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="glass p-5 space-y-3">
              <h2 className="font-semibold">Custom intent</h2>
              <label className="block text-sm">
                Agent API Key
                <input className="input mt-1 font-mono text-xs" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              </label>
              <label className="block text-sm">
                Amount (paise)
                <input
                  className="input mt-1"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <span className="text-xs text-slate-500">{formatINR(amount)}</span>
              </label>
              <label className="block text-sm">
                SKU
                <input className="input mt-1" value={sku} onChange={(e) => setSku(e.target.value)} />
              </label>
              <button className="btn-primary w-full" disabled={loading} onClick={submitCustom}>
                {loading ? "Submitting…" : "Submit Intent"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass p-5 min-h-[280px]">
              <h2 className="font-semibold mb-3">Result</h2>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              {!result && !error && (
                <p className="text-slate-500 text-sm">Run a scenario to see Gate 1 / Gate 2 outcomes.</p>
              )}
              {result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={result.status} />
                    <span className="font-mono text-sm">{result.sku}</span>
                    <span>{formatINR(result.amount_paise)}</span>
                  </div>
                  <p className="text-sm text-slate-300">{result.message}</p>
                  <div className="space-y-2">
                    {result.decisions.map((d, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold uppercase text-xs text-sentinel-400">{d.gate}</span>
                          <StatusBadge status={d.outcome} />
                          <span className="font-mono text-xs text-slate-500">{d.reason_code}</span>
                        </div>
                        <p className="mt-1 text-slate-400">{d.reason_message}</p>
                      </div>
                    ))}
                  </div>
                  {result.razorpay_order_id && (
                    <p className="font-mono text-xs text-emerald-400">
                      Razorpay order: {result.razorpay_order_id}
                    </p>
                  )}
                  {result.status === "QUEUED" && result.queue_job_id && (
                    <button className="btn-primary w-full" onClick={clearAndRetry} disabled={loading}>
                      Restore bank health &amp; clear queue
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="glass p-5">
              <h2 className="font-semibold mb-2">Activity log</h2>
              <ul className="space-y-1 text-xs font-mono text-slate-400 max-h-40 overflow-y-auto">
                {log.map((l, i) => (
                  <li key={i}>• {l}</li>
                ))}
                {log.length === 0 && <li className="text-slate-600">—</li>}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
