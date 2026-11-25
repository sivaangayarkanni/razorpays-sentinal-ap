"use client";

import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/ui";
import { API_URL } from "@/lib/api";
import Link from "next/link";

const example = `curl -sS -X POST ${"$"}{API_BASE}/api/v1/agent/intents \\\\
  -H "Content-Type: application/json" \\\\
  -H "X-API-Key: sap_<your-agent-key>" \\\\
  -H "Idempotency-Key: \$(uuidgen)" \\\\
  -d '{
    "amount_paise": 499900,
    "currency": "INR",
    "sku": "LAPTOP-PRO",
    "description": "Approved catalogue purchase"
  }'`;

export default function IntegratePage() {
  const snippet = `curl -sS -X POST ${API_URL}/api/v1/agent/intents \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sap_<your-agent-key>" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount_paise": 499900,
    "currency": "INR",
    "sku": "LAPTOP-PRO",
    "description": "Approved catalogue purchase"
  }'`;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8 page-enter">
        <PageHeader
          title="Integrate an agent"
          description="Call a single endpoint with your agent API key. Amounts are in paise (INR × 100)."
        />

        <div className="panel mt-6 space-y-3">
          <h2 className="font-semibold text-white">1. Issue a key</h2>
          <p className="text-sm text-slate-400">
            Sign in and create a key on the{" "}
            <Link href="/agents" className="text-sentinel-300 underline-offset-2 hover:underline">
              API keys
            </Link>{" "}
            page. The full key is shown once. We store only a hash.
          </p>
        </div>

        <div className="panel mt-6 space-y-3">
          <h2 className="font-semibold text-white">2. Submit a payment intent</h2>
          <p className="text-sm text-slate-400">
            <code className="font-mono text-sentinel-200">POST /api/v1/agent/intents</code> with header{" "}
            <code className="font-mono text-sentinel-200">X-API-Key</code>. Optional{" "}
            <code className="font-mono text-slate-300">Idempotency-Key</code> makes retries safe.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-sentinel-100 md:text-xs">
            {snippet}
          </pre>
        </div>

        <div className="panel mt-6 space-y-3">
          <h2 className="font-semibold text-white">3. Handle the decision</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>
              <span className="font-semibold text-amber-300">ALLOW</span> — Gate 1 and Gate 2 passed. Use{" "}
              <code className="font-mono text-xs">razorpay_order_id</code> with Checkout or your payment flow.
            </li>
            <li>
              <span className="font-semibold text-rose-300">HARD_BLOCK</span> — Policy rejected the intent. Read{" "}
              <code className="font-mono text-xs">reason_code</code>.
            </li>
            <li>
              <span className="font-semibold text-amber-300">QUEUED</span> — The payment rail is degraded. The intent
              retries automatically when health recovers.
            </li>
          </ul>
        </div>
      </main>
    </>
  );
}
