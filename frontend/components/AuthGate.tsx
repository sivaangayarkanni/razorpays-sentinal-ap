"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { ADMIN_TOKEN_KEY, ApiError, api } from "@/lib/api";
import { Nav } from "@/components/Nav";
import { LoadingScreen } from "@/components/ui";

const MUST_CHANGE_KEY = "sentinel_must_change";

export function useAdminToken() {
  const [token, setToken] = useState<string | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem(ADMIN_TOKEN_KEY));
    setMustChange(localStorage.getItem(MUST_CHANGE_KEY) === "1");
    setReady(true);
    const onUnauthorized = () => {
      setToken(null);
      setMustChange(false);
    };
    window.addEventListener("sentinel:unauthorized", onUnauthorized);
    return () => window.removeEventListener("sentinel:unauthorized", onUnauthorized);
  }, []);

  const acceptSession = (accessToken: string, requireChange?: boolean) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
    if (requireChange) localStorage.setItem(MUST_CHANGE_KEY, "1");
    else localStorage.removeItem(MUST_CHANGE_KEY);
    setToken(accessToken);
    setMustChange(Boolean(requireChange));
    return accessToken;
  };

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    return acceptSession(res.access_token, res.must_change_password);
  };

  const logout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(MUST_CHANGE_KEY);
    setToken(null);
    setMustChange(false);
  };

  return { token, ready, login, logout, mustChange, acceptSession };
}

export function LoginForm({
  onLogin,
}: {
  onLogin: (token: string, mustChange?: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const res = await api.login(email, password);
      localStorage.setItem(ADMIN_TOKEN_KEY, res.access_token);
      if (res.must_change_password) localStorage.setItem(MUST_CHANGE_KEY, "1");
      else localStorage.removeItem(MUST_CHANGE_KEY);
      onLogin(res.access_token, res.must_change_password);
    } catch (ex: any) {
      setErr(ex.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 page-enter">
      <form onSubmit={submit} className="glass-strong mt-14 space-y-5 p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sentinel-600/20 text-sentinel-300 ring-1 ring-sentinel-500/30">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-0.5 text-sm text-slate-400">Admin console for policies, keys, and rail health</p>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
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

export function ChangePasswordForm({
  token,
  onChanged,
  forced,
}: {
  token: string;
  onChanged: (token: string) => void;
  forced?: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setErr("New passwords do not match");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const res = await api.changePassword(token, currentPassword, newPassword);
      localStorage.setItem(ADMIN_TOKEN_KEY, res.access_token);
      localStorage.removeItem(MUST_CHANGE_KEY);
      onChanged(res.access_token);
    } catch (ex: any) {
      setErr(ex.message || "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 page-enter">
      <form onSubmit={submit} className="glass-strong mt-14 space-y-5 p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {forced ? "Set a new admin password" : "Change password"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              {forced
                ? "The current password is a default or is too weak. Choose a password of at least 12 characters to continue."
                : "Use a unique password of at least 12 characters."}
            </p>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="label">Current password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={12}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Confirm new password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            required
          />
        </label>

        {err && (
          <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        )}

        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}

export function AdminGuard({
  children,
}: {
  children: (ctx: { token: string; logout: () => void }) => React.ReactNode;
}) {
  const auth = useAdminToken();
  const [localMust, setLocalMust] = useState<boolean | null>(null);

  if (!auth.ready) {
    return (
      <>
        <Nav />
        <LoadingScreen />
      </>
    );
  }
  if (!auth.token) {
    return (
      <>
        <Nav />
        <LoginForm
          onLogin={(tok, mustChange) => {
            auth.acceptSession(tok, mustChange);
            setLocalMust(Boolean(mustChange));
          }}
        />
      </>
    );
  }
  const must = localMust ?? auth.mustChange;
  if (must) {
    return (
      <>
        <Nav />
        <ChangePasswordForm
          token={auth.token}
          forced
          onChanged={(tok) => {
            auth.acceptSession(tok, false);
            setLocalMust(false);
          }}
        />
      </>
    );
  }
  return <>{children({ token: auth.token, logout: auth.logout })}</>;
}

export { ApiError };
