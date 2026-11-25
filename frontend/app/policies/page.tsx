"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { AdminGuard } from "@/components/AuthGate";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  ErrorBanner,
  InfoBanner,
  PageHeader,
} from "@/components/ui";
import { api, formatINR } from "@/lib/api";

export default function PoliciesPage() {
  return <AdminGuard>{({ token }) => <PoliciesInner token={token} />}</AdminGuard>;
}

function PoliciesInner({ token: t }: { token: string }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);


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
          description="Gate 1 deterministic guardrails. Daily spend and velocity are enforced per agent key."
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sentinel-50 text-sentinel-700 ring-1 ring-sentinel-500/25">
                  <ShieldCheck className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-fg">{active.name}</h2>
                  <p className="mt-0.5 text-sm text-fg-muted">{active.description}</p>
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
                <span className="text-xs text-fg-subtle">= {formatINR(active.max_amount_paise)}</span>
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
                <span className="text-xs text-fg-subtle">= {formatINR(active.daily_budget_paise)}</span>
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


            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="label">Max intents per minute (per agent key)</span>
                <input
                  className="input"
                  type="number"
                  defaultValue={active.max_intents_per_minute ?? 8}
                  key={`vel-${active.max_intents_per_minute}`}
                  onBlur={(e) => save({ max_intents_per_minute: Number(e.target.value) })}
                />
                <span className="text-xs text-fg-subtle">0 disables the velocity rule. reason_code VELOCITY_EXCEEDED</span>
              </label>
              <label className="block space-y-1.5">
                <span className="label">Allowed currencies</span>
                <input
                  className="input"
                  defaultValue={(active.allowed_currencies || ["INR"]).join(", ")}
                  key={`ccy-${(active.allowed_currencies || []).join(",")}`}
                  onBlur={(e) =>
                    save({
                      allowed_currencies: e.target.value
                        .split(",")
                        .map((s: string) => s.trim().toUpperCase())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <span className="label">Window start hour (0–23, empty = always open)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={active.window_start_hour ?? ""}
                  key={`ws-${active.window_start_hour}`}
                  onBlur={(e) =>
                    save({ window_start_hour: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <span className="label">Window end hour (0–23)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={active.window_end_hour ?? ""}
                  key={`we-${active.window_end_hour}`}
                  onBlur={(e) =>
                    save({ window_end_hour: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="label">Payment window timezone</span>
              <input
                className="input"
                defaultValue={active.window_timezone || "Asia/Kolkata"}
                key={`tz-${active.window_timezone}`}
                onBlur={(e) => save({ window_timezone: e.target.value || "Asia/Kolkata" })}
              />
              <span className="text-xs text-fg-subtle">
                Daily budget is counted per agent key. Leave both window hours empty to keep payments open all day.
              </span>
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

            <p className="text-xs text-fg-subtle">
              Changes save on blur. {saving ? "Saving…" : "Ready."}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
