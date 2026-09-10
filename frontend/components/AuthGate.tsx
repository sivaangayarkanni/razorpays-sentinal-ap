"use client";

import { useEffect, useState } from "react";
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

  return (
    <form onSubmit={submit} className="glass mx-auto mt-16 max-w-md space-y-4 p-8">
      <h2 className="text-xl font-bold">Admin Login</h2>
      <p className="text-sm text-slate-400">Demo: admin@sentinel-ap.local / admin123</p>
      <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
      <input
        className="input"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      {err && <p className="text-sm text-rose-400">{err}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
