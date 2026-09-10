"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { LoginForm, useAdminToken } from "@/components/AuthGate";
import { api, formatINR } from "@/lib/api";

export default function PoliciesPage() {
  const { token, ready } = useAdminToken();
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const t = localToken || token;
  const load = async (tok: string) => setPolicies(await api.policies(tok));

  useEffect(() => {
    if (t) load(t).catch(console.error);
  }, [t]);

  if (!ready) return null;
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
    try {
      await api.updatePolicy(t, active.id, patch);
      setMsg("Policy updated");
      await load(t);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-bold">Policy Management</h1>
        <p className="text-slate-400">Gate 1 deterministic guardrails (per-org)</p>
        {msg && <p className="mt-2 text-sm text-sentinel-300">{msg}</p>}

        {active && (
          <div className="glass mt-6 space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{active.name}</h2>
              <span className="badge badge-allow">{active.is_active ? "ACTIVE" : "INACTIVE"}</span>
            </div>
            <p className="text-sm text-slate-400">{active.description}</p>

            <label className="block text-sm">
              Max amount (paise)
              <input
                className="input mt-1"
                type="number"
                defaultValue={active.max_amount_paise}
                onBlur={(e) => save({ max_amount_paise: Number(e.target.value) })}
              />
              <span className="text-xs text-slate-500">= {formatINR(active.max_amount_paise)}</span>
            </label>

            <label className="block text-sm">
              Daily budget (paise)
              <input
                className="input mt-1"
                type="number"
                defaultValue={active.daily_budget_paise}
                onBlur={(e) => save({ daily_budget_paise: Number(e.target.value) })}
              />
            </label>

            <label className="block text-sm">
              SKU whitelist (comma-separated)
              <textarea
                className="input mt-1 min-h-[80px]"
                defaultValue={(active.sku_whitelist || []).join(", ")}
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

            <label className="block text-sm">
              SKU blacklist (comma-separated)
              <textarea
                className="input mt-1 min-h-[80px]"
                defaultValue={(active.sku_blacklist || []).join(", ")}
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

            <button className="btn-primary" disabled={saving} onClick={() => t && load(t)}>
              {saving ? "Saving…" : "Reload"}
            </button>
          </div>
        )}
      </main>
    </>
  );
}
