"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { API_URL } from "@/lib/api";

type Health = { status?: string; version?: string };
type Config = { mock?: boolean; api_mode?: string };

export function SystemStatus() {
  const [label, setLabel] = useState("Checking…");
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [hRes, cRes] = await Promise.all([
          fetch(`${API_URL}/health`, { cache: "no-store" }),
          fetch(`${API_URL}/api/v1/public/config`, { cache: "no-store" }),
        ]);
        if (!hRes.ok) throw new Error("health");
        const health = (await hRes.json()) as Health;
        const config = cRes.ok ? ((await cRes.json()) as Config) : { mock: true, api_mode: "?" };
        if (cancelled) return;
        const mode = config.mock ? "mock" : config.api_mode || "live";
        setOk(health.status === "ok");
        setLabel(`API ${health.version || "?"} · ${mode}`);
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
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
          : ok === false
            ? "bg-rose-500/10 text-rose-300 ring-rose-500/30"
            : "bg-slate-500/10 text-slate-400 ring-slate-500/30"
      }`}
      title={API_URL}
    >
      <Activity className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
