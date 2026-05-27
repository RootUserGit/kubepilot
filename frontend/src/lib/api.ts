export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Send HttpOnly session cookies on cross-origin API calls (localhost:3000 → :8000). */
const apiFetch = (input: string, init?: RequestInit) =>
  fetch(input, { credentials: "include", ...init });

async function parseError(res: Response, fallback: string): Promise<string> {
  const detail = await res.json().catch(() => ({ detail: fallback }));
  if (typeof detail.detail === "string") return detail.detail;
  if (Array.isArray(detail.detail)) {
    return detail.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join("; ") || fallback;
  }
  return fallback;
}

export type SessionUser = {
  user_email: string;
  display_name?: string | null;
  message?: string | null;
};

export type SessionVerifyResult = {
  authenticated: boolean;
  user_email?: string | null;
  display_name?: string | null;
  session_max_age_seconds?: number | null;
  idle_timeout_seconds?: number | null;
};

const VERIFY_CACHE_MS = 2 * 60 * 1000;
let verifyCache: { at: number; data: SessionVerifyResult } | null = null;

export function clearVerifyCache(): void {
  verifyCache = null;
}

/** Check HttpOnly session cookie; 200 with authenticated=false when logged out. */
export async function verifySession(options?: { force?: boolean }): Promise<SessionVerifyResult> {
  const force = options?.force ?? false;
  if (!force && verifyCache && Date.now() - verifyCache.at < VERIFY_CACHE_MS) {
    return verifyCache.data;
  }

  const res = await apiFetch(`${API_BASE}/v1/auth/session/verify`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not verify session"));
  }
  const data = (await res.json()) as SessionVerifyResult;
  verifyCache = { at: Date.now(), data };
  return data;
}

export async function logoutSession(): Promise<void> {
  clearVerifyCache();
  await apiFetch(`${API_BASE}/v1/auth/logout`, { method: "POST" });
}

export function googleLoginUrl(): string {
  return `${API_BASE}/v1/auth/sso/google`;
}

/** Trade Google OAuth ?code= for HttpOnly session cookie on the API host. */
export async function completeGoogleSession(code: string): Promise<SessionUser> {
  const res = await apiFetch(`${API_BASE}/v1/auth/session/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Google sign-in failed"));
  }
  return res.json();
}

/** FastAPI / Pydantic validation error detail → field keys (snake_case). */
export function validationDetailToFieldErrors(detail: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(detail)) return out;
  for (const item of detail) {
    if (typeof item !== "object" || item === null) continue;
    const loc = (item as { loc?: unknown }).loc;
    const msg = (item as { msg?: unknown }).msg;
    if (typeof msg !== "string") continue;
    if (!Array.isArray(loc)) {
      out._form = out._form ? `${out._form}; ${msg}` : msg;
      continue;
    }
    const tail = loc[loc.length - 1];
    if (typeof tail === "string" && tail !== "body" && tail !== "query" && tail !== "path") {
      out[tail] = out[tail] ? `${out[tail]}; ${msg}` : msg;
    } else {
      out._form = out._form ? `${out._form}; ${msg}` : msg;
    }
  }
  return out;
}

export type ClusterRegisterPayload = {
  cluster_name: string;
  aws_account_id: string;
  aws_region: string;
  environment: string;
  role_arn: string;
  team_owner_label?: string | null;
  namespace_scope?: string | null;
  notes?: string | null;
};

export type ClusterRegistrationResponse = {
  id: string;
  name: string;
  registration_status: string;
  helm_install_command: string;
  created_at: string;
};

export type ClusterRegistrationStatusResponse = {
  cluster_id: string;
  cluster_name: string;
  registration_status: string;
  message: string | null;
};

export type ApiErrorWithFields = Error & {
  status: number;
  fieldErrors: Record<string, string>;
};

export async function registerCluster(payload: ClusterRegisterPayload): Promise<ClusterRegistrationResponse> {
  const res = await apiFetch(`${API_BASE}/v1/clusters/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof raw === "object" && raw !== null ? (raw as { detail?: unknown }).detail : undefined;
    const fieldErrors = validationDetailToFieldErrors(detail);
    let message = "Could not register cluster";
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      const parts = detail
        .map((d: unknown) => (typeof d === "object" && d !== null ? (d as { msg?: string }).msg : undefined))
        .filter((m: unknown): m is string => typeof m === "string" && m.length > 0);
      if (parts.length) message = parts.join("; ");
    }
    const err = new Error(message) as ApiErrorWithFields;
    err.status = res.status;
    err.fieldErrors = fieldErrors;
    throw err;
  }
  return raw as ClusterRegistrationResponse;
}

export async function getClusterRegistrationStatus(
  clusterId: string,
): Promise<ClusterRegistrationStatusResponse> {
  const res = await apiFetch(`${API_BASE}/v1/clusters/${clusterId}/registration-status`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load registration status"));
  }
  return res.json();
}
