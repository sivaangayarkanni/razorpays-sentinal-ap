"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export type HealthPayload = {
  status?: string;
  service?: string;
  version?: string;
  db?: string;
  redis?: string;
  queue_drainer?: boolean;
  razorpay_keys?: boolean;
};

export type StatusKind = "online" | "waking" | "offline" | "checking";

export type ServerStatus = {
  kind: StatusKind;
  label: string;
  latencyMs: number | null;
  checkedAt: Date | null;
  health: HealthPayload | null;
  error?: string;
};

export const HEALTH_POLL_MS = 15_000;
export const SLOW_HEALTH_MS = 5_000;
const PROBE_TIMEOUT_MS = 20_000;

export function formatCheckedAt(at: Date | null): string {
  if (!at) return "—";
  return at.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export async function probeHealth(): Promise<Omit<ServerStatus, "label"> & { label?: string }> {
  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/health`, { cache: "no-store", signal: ctrl.signal });
    const latencyMs = Math.round(performance.now() - started);
    const health = (await res.json().catch(() => null)) as HealthPayload | null;
    if (!res.ok) {
      return {
        kind: "offline",
        latencyMs,
        checkedAt: new Date(),
        health,
        error: `HTTP ${res.status}`,
      };
    }
    if (latencyMs >= SLOW_HEALTH_MS) {
      return { kind: "waking", latencyMs, checkedAt: new Date(), health };
    }
    return { kind: "online", latencyMs, checkedAt: new Date(), health };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const message = err instanceof Error ? err.message : "unreachable";
    return {
      kind: "offline",
      latencyMs,
      checkedAt: new Date(),
      health: null,
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function labelFor(kind: StatusKind): string {
  if (kind === "online") return "Online";
  if (kind === "waking") return "Waking up / slow";
  if (kind === "offline") return "Offline";
  return "Checking…";
}

export function useServerStatus(intervalMs = HEALTH_POLL_MS): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({
    kind: "checking",
    label: "Checking…",
    latencyMs: null,
    checkedAt: null,
    health: null,
  });

  const refresh = useCallback(async () => {
    const next = await probeHealth();
    setStatus({
      kind: next.kind,
      label: labelFor(next.kind),
      latencyMs: next.latencyMs,
      checkedAt: next.checkedAt,
      health: next.health,
      error: next.error,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await probeHealth();
      if (cancelled) return;
      setStatus({
        kind: next.kind,
        label: labelFor(next.kind),
        latencyMs: next.latencyMs,
        checkedAt: next.checkedAt,
        health: next.health,
        error: next.error,
      });
    })();
    const id = window.setInterval(() => {
      if (!cancelled && !document.hidden) void refresh();
    }, intervalMs);
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, refresh]);

  return status;
}
