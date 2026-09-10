const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type IntentResult = {
  id: string;
  status: string;
  amount_paise: number;
  currency: string;
  sku: string;
  description?: string;
  razorpay_order_id?: string;
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
};

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export { API_URL };
