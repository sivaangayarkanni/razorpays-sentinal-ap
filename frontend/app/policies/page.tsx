"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  LoadingScreen,
  PageHeader,
} from "@/components/ui";
import { api, formatINR } from "@/lib/api";

export default function PoliciesPage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const t = localToken || token;

  const load = async (tok: string) => {
    setLoading(true);
    try {
      setPolicies(await api.policies(tok));
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (t) load(t);
  }, [t]);

  if (!ready) {
    return (
      <>
        <Nav />
        <LoadingScreen />
      </>
    );
  }
  if (!t) {
    return (
      <>
        <Nav />
        <LoginForm onLogin={(tok) => setLocalToken(tok)} />
      </>
    );
  }

  const active = policies.find((p) => p.is_active) || policies[0];

  const save = async (patch: Record<string, unknown>) => {
    if (!active || !t) return;
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      await api.updatePolicy(t, active.id, patch);
      setMsg("Policy updated");
      await load(t);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 page-enter">
        <PageHeader
          title="Policy Management"
          description="Gate 1 deterministic guardrails (per-org)"
          actions={
            <button className="btn-secondary" disabled={saving || loading} onClick={() => t && load(t)}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Reload
            </button>
          }
        />

        {msg && <InfoBanner message={msg} />}
        {err && <ErrorBanner message={err} />}

        {loading && !active && (
          <div className="panel mt-6 space-y-4">
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        )}

        {!loading && !active && (
          <div className="mt-6">
            <EmptyState title="No policies found" description="Seed the backend or create a policy via API." />
          </div>
        )}

        {active && (
          <div className="panel mt-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sentinel-600/15 text-sentinel-300 ring-1 ring-sentinel-500/25">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{active.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-400">{active.description}</p>
                </div>
              </div>
              <StatusBadge status={active.is_active ? "ACTIVE" : "INACTIVE"} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="label">Max amount (paise)</span>
                <input
                  className="input"
                  type="number"
                  defaultValue={active.max_amount_paise}
                  key={`max-${active.max_amount_paise}`}
                  onBlur={(e) => save({ max_amount_paise: Number(e.target.value) })}
                />
                <span className="text-xs text-slate-500">= {formatINR(active.max_amount_paise)}</span>
              </label>

              <label className="block space-y-1.5">
                <span className="label">Daily budget (paise)</span>
                <input
                  className="input"
                  type="number"
                  defaultValue={active.daily_budget_paise}
                  key={`daily-${active.daily_budget_paise}`}
                  onBlur={(e) => save({ daily_budget_paise: Number(e.target.value) })}
                />
                <span className="text-xs text-slate-500">= {formatINR(active.daily_budget_paise)}</span>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="label">SKU whitelist (comma-separated)</span>
              <textarea
                className="textarea"
                defaultValue={(active.sku_whitelist || []).join(", ")}
                key={`wl-${(active.sku_whitelist || []).join(",")}`}
                onBlur={(e) =>
                  save({
                    sku_whitelist: e.target.value
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            <label className="block space-y-1.5">
              <span className="label">SKU blacklist (comma-separated)</span>
              <textarea
                className="textarea"
                defaultValue={(active.sku_blacklist || []).join(", ")}
                key={`bl-${(active.sku_blacklist || []).join(",")}`}
                onBlur={(e) =>
                  save({
                    sku_blacklist: e.target.value
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>

            <p className="text-xs text-slate-500">
              Changes save on blur. {saving ? "Saving…" : "Ready."}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
