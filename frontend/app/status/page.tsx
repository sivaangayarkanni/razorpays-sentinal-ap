"use client";

import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/ui";
import { ServerStatusBadge } from "@/components/SystemStatus";
import { API_URL } from "@/lib/api";
import { formatCheckedAt, useServerStatus } from "@/lib/health";

export default function StatusPage() {
  const s = useServerStatus();
  const rows: Array<[string, string]> = [
    ["API", s.label],
    ["Latency", s.latencyMs != null ? `${s.latencyMs} ms` : "—"],
    ["Last checked", s.checkedAt ? `${formatCheckedAt(s.checkedAt)} IST` : "—"],
    ["Service", s.health?.service || "sentinel-ap"],
    ["Version", s.health?.version || "—"],
    ["Database", s.health?.db || "—"],
    ["Redis", s.health?.redis || "—"],
    ["Queue drainer", s.health?.queue_drainer == null ? "—" : s.health.queue_drainer ? "running" : "stopped"],
    ["Razorpay keys", s.health?.razorpay_keys == null ? "—" : s.health.razorpay_keys ? "configured" : "missing"],
    ["Endpoint", API_URL],
  ];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8 page-enter">
        <PageHeader
          title="API status"
          description="Live health of the Sentinel-AP backend. The indicator polls /health every 15 seconds. A response slower than 5 seconds is treated as a cold start."
          actions={<ServerStatusBadge />}
        />
        <div className="panel mt-6 overflow-hidden">
          <dl className="divide-y divide-line">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-3 px-5 py-3 text-sm">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="col-span-2 font-medium text-fg break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {s.error && <p className="mt-4 text-sm text-rose-700">{s.error}</p>}
        <p className="mt-6 text-xs text-fg-subtle">
          Online is green, Waking up / slow is amber (typical of a Render free-tier cold start), and Offline is red.
        </p>
      </main>
    </>
  );
}
