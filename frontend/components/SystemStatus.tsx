"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { API_URL, paymentModeLabel, wakeApi } from "@/lib/api";

type Health = { status?: string; version?: string; db?: string };
type Config = { mock?: boolean; api_mode?: string; razorpay_key_id?: string };

export function SystemStatus() {
  const [label, setLabel] = useState("Checking…");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLabel("Connecting…");
      const ready = await wakeApi({
        attempts: 5,
        onStatus: (msg) => {
          if (!cancelled) setLabel(msg.replace("Waking API… the Render service may be starting.", "Connecting…"));
        },
      });
      if (cancelled) return;
      if (!ready) {
        setOk(false);
        setLabel("API unreachable");
        return;
      }
      try {
        const [hRes, cRes] = await Promise.all([
          fetch(`${API_URL}/health`, { cache: "no-store" }),
          fetch(`${API_URL}/api/v1/public/config`, { cache: "no-store" }),
        ]);
        if (!hRes.ok) throw new Error("health");
        const health = (await hRes.json()) as Health;
        const config = cRes.ok ? ((await cRes.json()) as Config) : null;
        if (cancelled) return;
        const mode = paymentModeLabel(config);
        setOk(health.status === "ok");
        setLabel(`API ${health.version || "?"} · ${mode.label}`);
      } catch {
        if (!cancelled) {
          setOk(false);
          setLabel("API unreachable");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
        ok === true
          ? "bg-sentinel-50 text-sentinel-700 ring-sentinel-500/30"
          : ok === false
            ? "bg-rose-50 text-rose-600 ring-rose-500/30"
            : "bg-surface text-fg-muted ring-line"
      }`}
      title={API_URL}
    >
      <Activity className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
