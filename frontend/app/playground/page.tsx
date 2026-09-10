"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  CreditCard,
  PauseCircle,
  Play,
  Terminal,
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorBanner, PageHeader } from "@/components/ui";
import {
  api,
  formatINR,
  IntentResult,
  API_URL,
  PublicConfig,
  isRealRazorpayOrder,
  loadRazorpayCheckout,
} from "@/lib/api";

const DEMO_KEY = "sap_demo000000000000000000000000000001";

const SCENARIOS = [
  {
    id: "allow",
    title: "Successful clearance",
    desc: "Whitelisted SKU, under budget, healthy bank → ALLOW + Checkout",
    body: { amount_paise: 4999_00, currency: "INR", sku: "LAPTOP-PRO", description: "MacBook purchase" },
    prep: "healthy" as const,
    icon: CheckCircle2,
    accent: "hover:border-emerald-500/30",
  },
  {
    id: "block-sku",
    title: "Hard Block — blacklisted SKU",
    desc: "SKU WEAPON hits Gate 1 blacklist → HARD_BLOCK",
    body: { amount_paise: 500_00, currency: "INR", sku: "WEAPON", description: "Should be blocked" },
    prep: null,
    icon: Ban,
    accent: "hover:border-rose-500/30",
  },
  {
    id: "block-amount",
    title: "Hard Block — amount cap",
    desc: "₹25,000 exceeds ₹10,000 per-txn cap → HARD_BLOCK",
    body: { amount_paise: 25000_00, currency: "INR", sku: "MONITOR-4K", description: "Over cap" },
    prep: null,
    icon: Ban,
    accent: "hover:border-rose-500/30",
  },
  {
    id: "queue",
    title: "Soft-Fail Queue",
    desc: "Degrade bank to 80%, then submit valid intent → QUEUED",
    body: { amount_paise: 1999_00, currency: "INR", sku: "MOUSE-MX", description: "Queued while rail degraded" },
    prep: "degrade" as const,
    icon: PauseCircle,
    accent: "hover:border-amber-500/30",
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
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    payment_id: string;
    order_id: string;
  } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const push = (m: string) => setLog((l) => [m, ...l].slice(0, 20));

  useEffect(() => {
    api
      .publicConfig()
      .then(setConfig)
      .catch(() =>
        setConfig({ razorpay_key_id: "", mock: true, api_mode: "mock" })
      );
  }, []);

  const ensureAdmin = async () => {
    if (adminToken) return adminToken;
    const res = await api.login("admin@sentinel-ap.local", "admin123");
    setAdminToken(res.access_token);
    return res.access_token;
  };

  const openCheckout = async (intent: IntentResult) => {
    if (!intent.razorpay_order_id || !isRealRazorpayOrder(intent.razorpay_order_id)) {
      push("Mock order — Checkout skipped (set RAZORPAY_MOCK=false for live test)");
      return;
    }
    setCheckoutLoading(true);
    setError("");
    try {
      let cfg = config;
      if (!cfg || cfg.mock || !cfg.razorpay_key_id) {
        cfg = await api.publicConfig();
        setConfig(cfg);
      }
      if (cfg.mock || !cfg.razorpay_key_id) {
        setError("Razorpay is in mock mode — no Checkout key available");
        return;
      }
      const ok = await loadRazorpayCheckout();
      if (!ok || !window.Razorpay) {
        setError("Failed to load Razorpay Checkout.js");
        return;
      }
      push(`Opening Razorpay Checkout for ${intent.razorpay_order_id}`);
      const rzp = new window.Razorpay({
        key: cfg.razorpay_key_id,
        amount: intent.amount_paise,
        currency: intent.currency || "INR",
        name: "Sentinel-AP",
        description: `${intent.sku} · Guardrailed agent payment`,
        order_id: intent.razorpay_order_id,
        prefill: {
          name: "Buildathon Judge",
          email: "judge@sentinel-ap.demo",
        },
        theme: { color: "#10b981" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            push(`Checkout success → verifying ${response.razorpay_payment_id}`);
            const verified = await api.verifyPayment(apiKey, {
              intent_id: intent.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setPaymentSuccess({
              payment_id: verified.razorpay_payment_id || response.razorpay_payment_id,
              order_id: verified.razorpay_order_id || response.razorpay_order_id,
            });
            setResult({
              ...intent,
              razorpay_payment_id: verified.razorpay_payment_id || response.razorpay_payment_id,
              message: verified.message,
            });
            push(`Verified payment ${response.razorpay_payment_id}`);
          } catch (e: any) {
            setError(typeof e.message === "string" ? e.message : "Verify failed");
          }
        },
      });
      rzp.on("payment.failed", (resp: unknown) => {
        push(`Payment failed: ${JSON.stringify(resp)}`);
        setError("Razorpay payment failed — try test card 4111 1111 1111 1111");
      });
      rzp.open();
    } catch (e: any) {
      setError(typeof e.message === "string" ? e.message : "Checkout error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const runScenario = async (s: (typeof SCENARIOS)[number]) => {
    setLoading(true);
    setActiveScenario(s.id);
    setError("");
    setResult(null);
    setPaymentSuccess(null);
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
      if (res.status === "ALLOW" && isRealRazorpayOrder(res.razorpay_order_id)) {
        // Auto-open Checkout for successful live orders
        await openCheckout(res);
      }
    } catch (e: any) {
      setError(typeof e.message === "string" ? e.message : JSON.stringify(e.message));
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  };

  const submitCustom = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setPaymentSuccess(null);
    try {
      const res = await api.createIntent(apiKey, {
        amount_paise: amount,
        currency: "INR",
        sku,
        description: "Custom playground intent",
      });
      setResult(res);
      push(`Custom → ${res.status}`);
      if (res.status === "ALLOW" && isRealRazorpayOrder(res.razorpay_order_id)) {
        await openCheckout(res);
      }
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
      const intents = await api.intents(tok);
      const updated = intents.find((i) => i.id === result.id);
      if (updated) setResult(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const modeLabel =
    config?.mock || config?.api_mode === "mock"
      ? "Mock mode"
      : config?.api_mode === "test"
        ? "Test mode · Razorpay"
        : config?.api_mode === "live"
          ? "Live mode · Razorpay"
          : "Razorpay";

  const modeBadgeClass =
    config?.mock || config?.api_mode === "mock"
      ? "bg-slate-500/20 text-slate-300 ring-slate-500/30"
      : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8 page-enter">
        <PageHeader
          title="Demo Playground"
          description={
            <>
              Simulate an AI buyer agent hitting Sentinel-AP. API:{" "}
              <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-sentinel-300">
                {API_URL}
              </code>
            </>
          }
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${modeBadgeClass}`}
          >
            <CreditCard className="h-3 w-3" aria-hidden />
            {modeLabel}
          </span>
          {!config?.mock && (
            <span className="text-[11px] text-slate-500">
              Test card: 4111 1111 1111 1111 · any future expiry · any CVV ·{" "}
              <a
                className="text-sentinel-400 underline-offset-2 hover:underline"
                href="https://razorpay.com/docs/payments/payments/test-card-details/"
                target="_blank"
                rel="noreferrer"
              >
                docs
              </a>
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="panel space-y-3">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-sentinel-400" aria-hidden />
                <h2 className="font-semibold text-white">One-click scenarios</h2>
              </div>
              <div className="space-y-2">
                {SCENARIOS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3.5 py-3 text-left transition ${s.accent} hover:bg-white/[0.04] disabled:opacity-50`}
                      disabled={loading}
                      onClick={() => runScenario(s)}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-300 ring-1 ring-white/10">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">
                          {activeScenario === s.id ? "Running…" : s.title}
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-400">{s.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel space-y-4">
              <h2 className="font-semibold text-white">Custom intent</h2>
              <label className="block space-y-1.5">
                <span className="label">Agent API Key</span>
                <input
                  className="input font-mono text-xs"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <span className="text-[11px] text-slate-500">
                  Demo key prefilled — discoverable for judges
                </span>
              </label>
              <label className="block space-y-1.5">
                <span className="label">Amount (paise)</span>
                <input
                  className="input"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                />
                <span className="text-xs text-slate-500">{formatINR(amount)}</span>
              </label>
              <label className="block space-y-1.5">
                <span className="label">SKU</span>
                <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
              </label>
              <button className="btn-primary w-full" disabled={loading} onClick={submitCustom}>
                {loading ? "Submitting…" : "Submit Intent"}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel min-h-[300px]">
              <h2 className="mb-3 font-semibold text-white">Result</h2>
              {error && <ErrorBanner message={error} />}
              {!result && !error && (
                <EmptyState
                  title="No result yet"
                  description="Run a scenario to see Gate 1 / Gate 2 outcomes."
                  icon={Terminal}
                />
              )}
              {paymentSuccess && (
                <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Payment verified
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-emerald-200/80">
                    payment_id: {paymentSuccess.payment_id}
                  </p>
                  <p className="font-mono text-[11px] text-emerald-200/60">
                    order_id: {paymentSuccess.order_id}
                  </p>
                </div>
              )}
              {result && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={result.status} />
                    <span className="font-mono text-sm text-sentinel-300">{result.sku}</span>
                    <span className="font-semibold tabular-nums">{formatINR(result.amount_paise)}</span>
                  </div>
                  <p className="text-sm text-slate-300">{result.message}</p>
                  <div className="space-y-2">
                    {result.decisions.map((d, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/[0.08] bg-black/30 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-sentinel-400">
                            {d.gate}
                          </span>
                          <StatusBadge status={d.outcome} />
                          {d.reason_code && (
                            <span className="font-mono text-[11px] text-slate-500">{d.reason_code}</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-slate-400">{d.reason_message}</p>
                      </div>
                    ))}
                  </div>
                  {result.razorpay_order_id && (
                    <p className="font-mono text-xs text-emerald-400">
                      Razorpay order: {result.razorpay_order_id}
                      {isRealRazorpayOrder(result.razorpay_order_id) ? " · live test" : " · mock"}
                    </p>
                  )}
                  {result.razorpay_payment_id && (
                    <p className="font-mono text-xs text-emerald-300">
                      Razorpay payment: {result.razorpay_payment_id}
                    </p>
                  )}
                  {result.status === "ALLOW" &&
                    isRealRazorpayOrder(result.razorpay_order_id) &&
                    !paymentSuccess && (
                      <button
                        className="btn-primary w-full"
                        disabled={loading || checkoutLoading}
                        onClick={() => openCheckout(result)}
                      >
                        {checkoutLoading ? "Opening Checkout…" : "Pay with Razorpay Checkout"}
                      </button>
                    )}
                  {result.status === "QUEUED" && result.queue_job_id && (
                    <button className="btn-primary w-full" onClick={clearAndRetry} disabled={loading}>
                      Restore bank health &amp; clear queue
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="panel">
              <h2 className="mb-2 font-semibold text-white">Activity log</h2>
              <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
                {log.map((l, i) => (
                  <li key={i} className="border-b border-white/[0.04] py-1 last:border-0">
                    <span className="text-slate-600">›</span> {l}
                  </li>
                ))}
                {log.length === 0 && <li className="text-slate-600">Waiting for activity…</li>}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
