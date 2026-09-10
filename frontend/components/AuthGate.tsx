"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock } from "lucide-react";
import { api } from "@/lib/api";

const TOKEN_KEY = "sentinel_admin_token";

export function useAdminToken() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY));
    setReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    localStorage.setItem(TOKEN_KEY, res.access_token);
    setToken(res.access_token);
    return res.access_token;
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return { token, ready, login, logout };
}

export function LoginForm({ onLogin }: { onLogin: (t: string) => void }) {
  const [email, setEmail] = useState("admin@sentinel-ap.local");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const res = await api.login(email, password);
      localStorage.setItem(TOKEN_KEY, res.access_token);
      onLogin(res.access_token);
    } catch (ex: any) {
      setErr(ex.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail("admin@sentinel-ap.local");
    setPassword("admin123");
  };

  return (
    <div className="mx-auto max-w-md px-4 page-enter">
      <form onSubmit={submit} className="glass-strong mt-14 space-y-5 p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sentinel-600/20 text-sentinel-300 ring-1 ring-sentinel-500/30">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Admin Login</h2>
            <p className="mt-0.5 text-sm text-slate-400">Access decision feeds, policies, and rail controls</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            Demo credentials
          </div>
          <p className="mt-1.5 font-mono text-xs text-slate-300">
            admin@sentinel-ap.local <span className="text-slate-600">/</span> admin123
          </p>
          <button type="button" className="btn-ghost mt-2 !px-2.5 !py-1 text-xs" onClick={fillDemo}>
            Prefill demo login
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@sentinel-ap.local"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {err && (
          <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
