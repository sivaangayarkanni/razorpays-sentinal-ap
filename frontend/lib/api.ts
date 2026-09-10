const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: h, cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || JSON.stringify(err));
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/api/v1/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
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
  createIntent: (apiKey: string, body: Record<string, unknown>) =>
    request<IntentResult>("/api/v1/agent/intents", {
      method: "POST",
      apiKey,
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
