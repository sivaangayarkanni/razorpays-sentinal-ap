"use client";

import { useEffect, useState } from "react";
import { KeyRound, Plus, ShieldOff } from "lucide-react";
import { Nav } from "@/components/Nav";
import { AdminGuard } from "@/components/AuthGate";
import { EmptyState, ErrorBanner, InfoBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";

export default function AgentsPage() {
  return <AdminGuard>{({ token }) => <AgentsInner token={token} />}</AdminGuard>;
}

function AgentsInner({ token }: { token: string }) {
  const [agents, setAgents] = useState<
    Array<{ id: string; name: string; api_key_prefix: string; is_active: boolean; created_at: string }>
  >([]);
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<{ name: string; api_key: string } | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setAgents(await api.agents(token));
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      const created = await api.createAgent(token, name.trim());
      if (created.api_key) setFreshKey({ name: created.name, api_key: created.api_key });
      setName("");
      setMsg("API key created. Copy it now — it will not be shown again.");
      await load();
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this API key? The agent will no longer be able to submit intents.")) return;
    try {
      await api.revokeAgent(token, id);
      setMsg("API key revoked");
      await load();
    } catch (ex: any) {
      setErr(ex.message);
    }
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 page-enter">
        <PageHeader
          title="Agent API keys"
          description="Issue keys for buyer agents. The full key is shown only once at creation."
        />
        {err && <ErrorBanner message={err} />}
        {msg && <InfoBanner message={msg} />}

        {freshKey && (
          <div className="panel mt-6 border border-sentinel-500/30">
            <div className="flex items-center gap-2 text-sm font-semibold text-sentinel-700">
              <KeyRound className="h-4 w-4" aria-hidden />
              New key for {freshKey.name}
            </div>
            <p className="mt-2 text-xs text-fg-muted">
              Store this key in your agent’s secret manager. We only keep a hash.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-surface p-3 font-mono text-xs text-fg">
              {freshKey.api_key}
            </pre>
            <button
              type="button"
              className="btn-secondary mt-3 text-xs"
              onClick={() => navigator.clipboard.writeText(freshKey.api_key)}
            >
              Copy key
            </button>
          </div>
        )}

        <form onSubmit={create} className="panel mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 space-y-1.5">
            <span className="label">Agent name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="procurement-bot"
              required
            />
          </label>
          <button className="btn-primary sm:mb-0.5" disabled={saving || !name.trim()}>
            <Plus className="h-4 w-4" aria-hidden />
            {saving ? "Creating…" : "Create key"}
          </button>
        </form>

        <div className="panel mt-6">
          <h2 className="mb-3 font-semibold text-fg">Issued keys</h2>
          {!loading && agents.length === 0 ? (
            <EmptyState title="No agents yet" description="Create a key to let an agent call the intents API." />
          ) : (
            <div className="table-wrap">
              <table className="table min-w-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium text-fg">{a.name}</td>
                      <td className="font-mono text-xs text-sentinel-700">{a.api_key_prefix}…</td>
                      <td>{a.is_active ? "Active" : "Revoked"}</td>
                      <td className="text-fg-muted">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="text-right">
                        {a.is_active && (
                          <button type="button" className="btn-danger !px-2.5 !py-1 text-xs" onClick={() => revoke(a.id)}>
                            <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
