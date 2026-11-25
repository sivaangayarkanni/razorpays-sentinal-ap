"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { API_URL } from "@/lib/api";
import { formatCheckedAt, useServerStatus, type StatusKind } from "@/lib/health";

const TONE: Record<StatusKind, string> = {
  online: "bg-sentinel-50 text-sentinel-700 ring-sentinel-500/30",
  waking: "bg-amber-50 text-amber-800 ring-amber-500/35",
  offline: "bg-rose-50 text-rose-700 ring-rose-500/30",
  checking: "bg-surface text-fg-muted ring-line",
};

const DOT: Record<StatusKind, string> = {
  online: "bg-sentinel-500",
  waking: "bg-amber-500 animate-pulse",
  offline: "bg-rose-500",
  checking: "bg-fg-subtle animate-pulse",
};

export function ServerStatusBadge({ compact = false }: { compact?: boolean }) {
  const s = useServerStatus();
  const title = [
    s.label,
    s.latencyMs != null ? `${s.latencyMs} ms` : null,
    s.checkedAt ? `checked ${formatCheckedAt(s.checkedAt)} IST` : null,
    s.health?.db ? `db ${s.health.db}` : null,
    s.health?.redis ? `redis ${s.health.redis}` : null,
    API_URL,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href="/status"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 transition hover:brightness-95 ${TONE[s.kind]}`}
      title={title}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s.kind]}`} aria-hidden />
      <Activity className="h-3 w-3" aria-hidden />
      <span>{s.label}</span>
      {!compact && s.latencyMs != null && (
        <span className="hidden text-[10px] opacity-80 sm:inline">{s.latencyMs} ms</span>
      )}
    </Link>
  );
}

export function SystemStatus() {
  const s = useServerStatus();
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <ServerStatusBadge />
      <p className="text-[11px] text-fg-subtle">
        {s.checkedAt
          ? `Checked ${formatCheckedAt(s.checkedAt)} IST${s.latencyMs != null ? ` · ${s.latencyMs} ms` : ""}`
          : "Checking API health…"}
        {s.health?.db ? ` · DB ${s.health.db}` : ""}
        {s.health?.redis ? ` · Redis ${s.health.redis}` : ""}
      </p>
    </div>
  );
}
