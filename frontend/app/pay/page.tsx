"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { AdminGuard } from "@/components/AuthGate";
import { ErrorBanner, InfoBanner, PageHeader } from "@/components/ui";
import {
  ApiError,
  api,
  formatINR,
  loadRazorpayCheckout,
  type IntentResult,
} from "@/lib/api";

type Case = { label: string; amountRupees: number; sku: string; currency: string; description: string };

const CASES: Case[] = [
  { label: "ALLOW · ₹4,999 LAPTOP-PRO", amountRupees: 4999, sku: "LAPTOP-PRO", currency: "INR", description: "Catalogue purchase" },
  { label: "Cap · ₹50,001", amountRupees: 50001, sku: "LAPTOP-PRO", currency: "INR", description: "Over per-txn cap" },
  { label: "Blacklist · WEAPON", amountRupees: 100, sku: "WEAPON", currency: "INR", description: "Blocked SKU" },
  { label: "Not listed · UNKNOWN-SKU", amountRupees: 100, sku: "UNKNOWN-SKU", currency: "INR", description: "Not on whitelist" },
  { label: "Currency · USD", amountRupees: 100, sku: "LAPTOP-PRO", currency: "USD", description: "Non-INR" },
  { label: "Invalid · ₹0", amountRupees: 0, sku: "LAPTOP-PRO", currency: "INR", description: "Zero amount" },
  { label: "Absurd · ₹1,00,00,001", amountRupees: 10000001, sku: "LAPTOP-PRO", currency: "INR", description: "Sanity limit" },
];

function lastReason(intent?: IntentResult | null): { code?: string; message?: string } {
  const decisions = intent?.decisions || [];
  const first = [...decisions].reverse()[0] || decisions[0];
  return { code: first?.reason_code, message: first?.reason_message || intent?.message };
}

export default function PayPage() {
  return (
    <AdminGuard>
      {({ token }) => <PayInner token={token} />}
    </AdminGuard>
  );
}

function PayInner({ token }: { token: string }) {
  const [apiKey, setApiKey] = useState("");
  const [keyPrefix, setKeyPrefix] = useState("");
  const [amountRupees, setAmountRupees] = useState("4999");
  const [sku, setSku] = useState("LAPTOP-PRO");
  const [currency, setCurrency] = useState("INR");
  const [description, setDescription] = useState("Catalogue purchase");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [intent, setIntent] = useState<IntentResult | null>(null);
  const [verified, setVerified] = useState<string>("");
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("sentinel_pay_key_prefix");
    if (stored) setKeyPrefix(stored);
  }, []);

  const amountPaise = useMemo(() => {
    const n = Number(amountRupees);
    if (Number.isNaN(n)) return 0;
    return Math.round(n * 100);
  }, [amountRupees]);

  const issueKey = async () => {
    setIssuing(true);
    setErr("");
    setMsg("");
    try {
      const created = await api.createAgent(token, `pay-${new Date().toISOString().slice(0, 16)}`);
      if (!created.api_key) throw new Error("The full key was not returned. Create one on the API keys page.");
      setApiKey(created.api_key);
      setKeyPrefix(created.api_key_prefix);
      sessionStorage.setItem("sentinel_pay_key_prefix", created.api_key_prefix);
      setMsg(`Issued key ${created.api_key_prefix}… — shown only in this session, never stored on the server in plaintext.`);
    } catch (e: any) {
      setErr(e.message || "Could not issue a key");
    } finally {
      setIssuing(false);
    }
  };

  const applyCase = (c: Case) => {
    setAmountRupees(String(c.amountRupees));
    setSku(c.sku);
    setCurrency(c.currency);
    setDescription(c.description);
    setErr("");
    setMsg("");
    setVerified("");
  };

  const openCheckout = async (result: IntentResult, key: string) => {
    const cfg = await api.publicConfig();
    if (!cfg.razorpay_key_id) {
      setErr("Razorpay key id is not configured on the API, so Checkout cannot open.");
      return;
    }
    if (!result.razorpay_order_id) {
      setErr("ALLOW response did not include a razorpay_order_id.");
      return;
    }
    const ok = await loadRazorpayCheckout();
    if (!ok || !window.Razorpay) {
      setErr("Could not load Razorpay Checkout.js");
      return;
    }
    setMsg("Opening Razorpay Checkout…");
    const rzp = new window.Razorpay({
      key: cfg.razorpay_key_id,
      amount: result.amount_paise,
      currency: result.currency,
      name: "Sentinel-AP",
      description: result.description || result.sku,
      order_id: result.razorpay_order_id,
      handler: async (resp: any) => {
        try {
          const verifiedRes = await api.verifyPayment(key, {
            intent_id: result.id,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          setVerified(verifiedRes.message || "Payment verified");
          setMsg(`Verified ${verifiedRes.razorpay_payment_id || ""} · status ${verifiedRes.status}`);
          setIntent({ ...result, status: verifiedRes.status, razorpay_payment_id: verifiedRes.razorpay_payment_id });
        } catch (e: any) {
          setErr(e.message || "Signature verification failed");
        }
      },
      modal: {
        ondismiss: () => setMsg("Checkout closed without completing payment. The Razorpay order is still open."),
      },
    });
    rzp.on("payment.failed", (resp: unknown) => {
      setErr(`Checkout payment failed: ${JSON.stringify(resp)}`);
    });
    rzp.open();
  };

  const submit = async (opts?: { burst?: number; case?: Case }) => {
    if (!apiKey) {
      setErr("Issue or paste an agent API key first.");
      return;
    }
    const rupees = opts?.case ? opts.case.amountRupees : Number(amountRupees);
    const payCurrency = opts?.case ? opts.case.currency : currency;
    const paySku = opts?.case ? opts.case.sku : sku;
    const payDescription = opts?.case ? opts.case.description : description;
    const paise = Math.round((Number.isNaN(Number(rupees)) ? 0 : Number(rupees)) * 100);
    setBusy(true);
    setErr("");
    setMsg("");
    setVerified("");
    setIntent(null);
    const rounds = opts?.burst ?? 1;
    try {
      let last: IntentResult | null = null;
      for (let i = 0; i < rounds; i++) {
        const body = {
          amount_paise: paise,
          currency: payCurrency,
          sku: paySku,
          description: rounds > 1 ? `${payDescription} #${i + 1}` : payDescription,
        };
        last = await api.createIntent(apiKey, body, crypto.randomUUID());
      }
      if (!last) return;
      setIntent(last);
      if (last.status === "ALLOW") {
        setMsg(`ALLOW · order ${last.razorpay_order_id || "—"}`);
        await openCheckout(last, apiKey);
      } else if (last.status === "HARD_BLOCK") {
        const r = lastReason(last);
        setMsg(`HARD_BLOCK · ${r.code || "unknown"}`);
      } else if (last.status === "QUEUED") {
        setMsg("QUEUED — bank health is degraded. The intent will retry automatically.");
      } else {
        setMsg(`${last.status} — ${last.message}`);
      }
    } catch (e: any) {
      if (e instanceof ApiError && e.reasonCode) {
        setErr(`${e.reasonCode}: ${e.message}`);
      } else {
        setErr(e.message || "Request failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const reason = lastReason(intent);
    return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8 page-enter">
        <PageHeader
          title="New payment"
          description="Submit a real intent through Gate 1 and Gate 2. On ALLOW, Razorpay Checkout opens with the returned order id. Nothing here is simulated."
        />

        {msg && <InfoBanner message={msg} />}
        {err && <ErrorBanner message={err} />}

        <div className="panel mt-6 space-y-4">
          <h2 className="font-semibold text-fg">Agent key</h2>
          <p className="text-sm text-fg-muted">
            The full key stays in this browser tab only. Create one here or paste a key from the{" "}
            <Link href="/agents" className="text-link underline-offset-2 hover:underline">
              API keys
            </Link>{" "}
            page.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-xs" disabled={issuing} onClick={issueKey}>
              {issuing ? "Issuing…" : "Issue a test key"}
            </button>
            {keyPrefix && <span className="chip">Active prefix {keyPrefix}…</span>}
          </div>
          <label className="block space-y-1.5">
            <span className="label">X-API-Key</span>
            <input
              className="input font-mono text-xs"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              placeholder="sap_…"
            />
          </label>
        </div>

        <div className="panel mt-6 space-y-4">
          <h2 className="font-semibold text-fg">Intent</h2>
          <div className="flex flex-wrap gap-2">
            {CASES.map((c) => (
              <button key={c.label} type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => applyCase(c)}>
                {c.label}
              </button>
            ))}
            <button
              type="button"
              className="btn-ghost !px-2.5 !py-1 text-xs"
              onClick={() => {
                const c: Case = {
                  label: "Velocity",
                  amountRupees: 100,
                  sku: "MOUSE-MX",
                  currency: "INR",
                  description: "Velocity burst",
                };
                applyCase(c);
                void submit({ burst: 9, case: c });
              }}
            >
              Velocity · 9 intents
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="label">Amount (INR)</span>
              <input className="input" type="number" step="0.01" value={amountRupees} onChange={(e) => setAmountRupees(e.target.value)} />
              <span className="text-xs text-fg-subtle">{formatINR(amountPaise)} · {amountPaise} paise</span>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Currency</span>
              <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">SKU</span>
              <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Description</span>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "Submitting…" : "Submit payment intent"}
          </button>
        </div>

        {intent && (
          <div className={`panel mt-6 space-y-3 ${intent.status === "HARD_BLOCK" ? "ring-1 ring-rose-500/30" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-fg">Result</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  intent.status === "ALLOW" || intent.status === "CLEARED"
                    ? "bg-sentinel-50 text-sentinel-700"
                    : intent.status === "HARD_BLOCK"
                      ? "bg-rose-50 text-rose-700"
                      : "bg-amber-50 text-amber-800"
                }`}
              >
                {intent.status}
              </span>
            </div>
            {reason.code && (
              <p className="font-mono text-sm text-fg">
                reason_code: <span className="font-semibold">{reason.code}</span>
              </p>
            )}
            {reason.message && <p className="text-sm text-fg-muted">{reason.message}</p>}
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              <div>
                <dt className="text-fg-subtle">Intent</dt>
                <dd className="font-mono text-xs break-all">{intent.id}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Razorpay order</dt>
                <dd className="font-mono text-xs break-all">{intent.razorpay_order_id || "—"}</dd>
              </div>
            </dl>
            {verified && <p className="text-sm text-sentinel-700">{verified}</p>}
          </div>
        )}
      </main>
    </>
  );
}
