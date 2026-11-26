import { clearSessionCookie } from "@/lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const ADMIN_TOKEN_KEY = "sentinel_admin_token";

export class ApiError extends Error {
  status: number;
  reasonCode?: string;
  detail?: unknown;
  constructor(message: string, status: number, detail?: unknown, reasonCode?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.reasonCode = reasonCode;
  }
}

function clearStaleAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem("sentinel_must_change");
  clearSessionCookie();
  window.dispatchEvent(new Event("sentinel:unauthorized"));
  const path = window.location.pathname;
  if (path !== "/login") {
    const next = path + window.location.search;
    window.location.replace(`/login?next=${encodeURIComponent(next)}`);
  }
}


const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableNetworkError(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string }).name || "";
  const message = String((err as { message?: string }).message || err);
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /fail(ed)? to fetch|networkerror|aborted|timeout|load failed/i.test(message)
  );
}

export async function wakeApi(opts?: {
  attempts?: number;
  onStatus?: (msg: string) => void;
}): Promise<boolean> {
  const attempts = opts?.attempts ?? 5;
  const delays = [0, 2000, 4000, 8000, 12000];
  for (let i = 0; i < attempts; i++) {
    if (delays[i]) {
      opts?.onStatus?.("Waking API… the Render service may be starting.");
      await sleep(delays[i]);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), i === 0 ? 12_000 : 90_000);
    try {
      const res = await fetch(`${API_URL}/health`, { cache: "no-store", signal: ctrl.signal });
      if (res.ok) {
        opts?.onStatus?.("API is ready");
        return true;
      }
    } catch {
      // retry
    } finally {
      clearTimeout(timer);
    }
  }
  opts?.onStatus?.("API unreachable");
  return false;
}

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string; apiKey?: string } = {}
): Promise<T> {
  const { token, apiKey, headers, ...rest } = opts;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (apiKey) h["X-API-Key"] = apiKey;

  const attempts = 4;
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    if (i === 1) {
      await wakeApi({ attempts: 3 });
    } else if (i > 1) {
      await sleep(2000 * i);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), i === 0 ? 15_000 : 90_000);
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: h,
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        const detail = (err as { detail?: unknown; message?: unknown }).detail
          ?? (err as { message?: unknown }).message
          ?? err;
        let msg = typeof detail === "string" ? detail : JSON.stringify(detail);
        let reasonCode: string | undefined;
        if (detail && typeof detail === "object") {
          const obj = detail as { message?: unknown; reason_code?: unknown };
          if ("message" in obj) msg = String(obj.message || msg);
          if (typeof obj.reason_code === "string") reasonCode = obj.reason_code;
        }
        if (res.status === 401 && token) {
          clearStaleAdminToken();
        }
        throw new ApiError(msg, res.status, detail, reasonCode);
      }
      return res.json();
    } catch (e) {
      lastError = e;
      if (!isRetryableNetworkError(e)) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "network error";
  throw new Error(
    `Failed to reach the API at ${API_URL} (${reason}). The backend may still be starting, or it may be down. Wait a few seconds and retry.`
  );
}

export type IntentResult = {
  id: string;
  status: string;
  amount_paise: number;
  currency: string;
  sku: string;
  description?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  decisions: Array<{
    gate: string;
    outcome: string;
    reason_code?: string;
    reason_message?: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  queue_job_id?: string;
  message: string;
  created_at: string;
};

export type PublicConfig = {
  razorpay_key_id: string;
  mock: boolean;
  api_mode: "mock" | "test" | "live" | "unknown" | string;
};

export type PaymentVerifyResult = {
  success: boolean;
  intent_id: string;
  status: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  message: string;
};

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; must_change_password?: boolean; token_type?: string }>(
      "/api/v1/admin/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    ),
  changePassword: (token: string, current_password: string, new_password: string) =>
    request<{ access_token: string; must_change_password?: boolean }>("/api/v1/admin/change-password", {
      method: "POST",
      token,
      body: JSON.stringify({ current_password, new_password }),
    }),
  agents: (token: string) =>
    request<Array<{ id: string; name: string; api_key_prefix: string; is_active: boolean; created_at: string }>>(
      "/api/v1/admin/agents",
      { token }
    ),
  createAgent: (token: string, name: string) =>
    request<{
      id: string;
      name: string;
      api_key_prefix: string;
      is_active: boolean;
      created_at: string;
      api_key?: string;
    }>("/api/v1/admin/agents", {
      method: "POST",
      token,
      body: JSON.stringify({ name }),
    }),
  revokeAgent: (token: string, id: string) =>
    request<{ id: string; name: string; api_key_prefix: string; is_active: boolean; created_at: string }>(
      `/api/v1/admin/agents/${id}/revoke`,
      { method: "POST", token }
    ),
  stats: (token: string) => request<Record<string, unknown>>("/api/v1/admin/stats", { token }),
  intents: (token: string, status?: string) =>
    request<IntentResult[]>(
      `/api/v1/admin/intents${status ? `?status=${status}` : ""}`,
      { token }
    ),
  policies: (token: string) => request<any[]>("/api/v1/admin/policies", { token }),
  updatePolicy: (token: string, id: string, body: Record<string, unknown>) =>
    request<any>(`/api/v1/admin/policies/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    }),
  createPolicy: (token: string, body: Record<string, unknown>) =>
    request<any>("/api/v1/admin/policies", { method: "POST", token, body: JSON.stringify(body) }),
  queue: (token: string) => request<any[]>("/api/v1/admin/queue", { token }),
  retryJob: (token: string, id: string) =>
    request<any>(`/api/v1/admin/queue/${id}/retry`, { method: "POST", token }),
  bankHealth: (token: string) => request<any>("/api/v1/admin/bank-health", { token }),
  bankHistory: (token: string) => request<any[]>("/api/v1/admin/bank-health/history", { token }),
  bankConfig: (token: string, body: Record<string, unknown>) =>
    request<any>("/api/v1/admin/bank-health/config", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),
  audit: (token: string) => request<any[]>("/api/v1/admin/audit", { token }),
  createIntent: (apiKey: string, body: Record<string, unknown>, idempotencyKey?: string) =>
    request<IntentResult>("/api/v1/agent/intents", {
      method: "POST",
      apiKey,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      body: JSON.stringify(body),
    }),
  publicConfig: () => request<PublicConfig>("/api/v1/public/config"),
  verifyPayment: (
    apiKey: string,
    body: {
      intent_id: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ) =>
    request<PaymentVerifyResult>("/api/v1/payments/verify", {
      method: "POST",
      apiKey,
      body: JSON.stringify(body),
    }),
  razorpayStatus: (token: string) =>
    request<{
      mode: string;
      key_id_prefix: string;
      mock: boolean;
      keys_configured: boolean;
      last_probe_at?: string;
      last_probe_ok?: boolean;
      last_probe_detail?: string;
    }>("/api/v1/admin/razorpay/status", { token }),
};

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function isRealRazorpayOrder(orderId?: string | null): boolean {
  return !!orderId && !orderId.startsWith("order_mock_");
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };
  }
}

export function loadRazorpayCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export { API_URL };

export function paymentModeLabel(config: { mock?: boolean; api_mode?: string; razorpay_key_id?: string } | null): {
  label: string;
  kind: "live" | "test" | "missing";
} {
  const key = config?.razorpay_key_id || "";
  if (config?.mock || !key) return { label: "No payment keys", kind: "missing" };
  if (key.startsWith("rzp_live_") || config?.api_mode === "live") return { label: "Live", kind: "live" };
  return { label: "Test keys", kind: "test" };
}
