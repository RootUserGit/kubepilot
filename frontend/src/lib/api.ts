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

export type ClusterPublic = {
  id: string;
  name: string;
  created_at: string;
  kubeconfig_configured: boolean;
  registration_status: string | null;
  connectivity_status?: string | null;
  last_scan_at?: string | null;
  provider: string | null;
  environment: string | null;
  region: string | null;
};

export async function fetchClusters(): Promise<ClusterPublic[]> {
  const res = await apiFetch(`${API_BASE}/v1/clusters`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load clusters"));
  }
  return res.json();
}

export async function fetchCluster(clusterId: string): Promise<ClusterPublic> {
  const res = await apiFetch(`${API_BASE}/v1/clusters/${clusterId}`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load cluster"));
  }
  return res.json();
}

export type ClusterNodeSummary = {
  name: string;
  ready: boolean;
  status: string;
  roles: string[];
  kubelet_version: string | null;
  os_image: string | null;
  cpu_capacity_millicores: number | null;
  memory_capacity_mebibytes: number | null;
  cpu_allocatable_millicores: number | null;
  memory_allocatable_mebibytes: number | null;
  cpu_usage_millicores: number | null;
  memory_usage_mebibytes: number | null;
};

export type ResourceCountItem = {
  kind: string;
  label: string;
  count: number;
};

export type FindingReferenceItem = {
  title: string;
  url: string;
};

export type ClusterInsightItem = {
  id: string;
  category: string;
  severity: string;
  title: string;
  detail: string | null;
  resource_kind: string;
  resource_name: string;
  namespace: string;
  container_name: string | null;
  related_pods: string[];
  check_id: string;
  remediation: string | null;
  finding_type?: string;
  attack_techniques?: string[];
  raw_severity?: string | null;
  effective_severity?: string | null;
  disposition?: string;
  suppression_reason?: string | null;
  references?: FindingReferenceItem[];
};

export type NamespaceHealthItem = {
  namespace: string;
  health_score: number;
  health_status: string;
  health_label: string;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  workload_count: number;
};

export type WorstNamespaceHealth = {
  name: string;
  health_score: number;
  health_status: string;
};

export type RemediationStepItem = {
  order: number;
  title: string;
  description: string;
  command: string | null;
  command_type: string;
  dry_run_command?: string | null;
  verify_command?: string | null;
};

export type RemediationPlanResult = {
  summary: string;
  steps: RemediationStepItem[];
  impact_level: string;
  impact_summary: string;
  downtime_notes: string | null;
  prerequisites: string[];
  warnings: string[];
  rollback_steps: RemediationStepItem[];
  do_not_remediate: boolean;
  do_not_remediate_reason: string | null;
  readonly_notice: string;
  remediation_source?: string;
  llm_note?: string | null;
};

export type FindingExplainResult = {
  summary: string;
  likely_false_positive: string;
  confidence: number;
  citations: { title: string; url: string }[];
};

export type InventoryItem = {
  name: string;
  namespace: string | null;
  status: string | null;
  detail: string | null;
};

export type ClusterHealth = {
  health_score: number | null;
  health_status: string;
  health_label: string;
  summary: string;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  aggregation_method?: string;
  namespace_health?: NamespaceHealthItem[];
  worst_namespace?: WorstNamespaceHealth | null;
};

export type ClusterHealthItem = {
  cluster_id: string;
  cluster_name: string;
  health_score: number | null;
  health_status: string;
  health_label: string;
  summary: string;
  critical_count: number;
  high_count: number;
  medium_count?: number;
  low_count?: number;
  aggregation_method?: string;
  namespace_health?: NamespaceHealthItem[];
  worst_namespace?: WorstNamespaceHealth | null;
  kubernetes_version?: string | null;
  provider?: string | null;
  environment?: string | null;
  region?: string | null;
  registration_status?: string | null;
};

export type FindingContextPayload = {
  namespace?: string;
  resource_kind?: string;
  resource_name?: string;
  check_id?: string;
  container_name?: string | null;
  title?: string;
  severity?: string;
  category?: string;
  detail?: string | null;
  remediation?: string | null;
  disposition?: string;
  suppression_reason?: string | null;
};

const remediateInflight = new Map<string, Promise<RemediationPlanResult>>();

export async function fetchFindingRemediate(
  clusterId: string,
  insightId: string,
  context?: FindingContextPayload,
): Promise<RemediationPlanResult> {
  const cacheKey = JSON.stringify({ clusterId, insightId, context: context ?? null });
  const existing = remediateInflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const res = await apiFetch(
        `${API_BASE}/v1/clusters/${clusterId}/findings/${encodeURIComponent(insightId)}/remediate`,
        {
          method: "POST",
          headers: context ? { "Content-Type": "application/json" } : undefined,
          body: context ? JSON.stringify(context) : undefined,
        },
      );
      if (!res.ok) {
        throw new Error(await parseError(res, "Could not load remediation plan"));
      }
      return (await res.json()) as RemediationPlanResult;
    } finally {
      remediateInflight.delete(cacheKey);
    }
  })();

  remediateInflight.set(cacheKey, request);
  return request;
}

export async function fetchFindingExplain(
  clusterId: string,
  insightId: string,
): Promise<FindingExplainResult> {
  const res = await apiFetch(
    `${API_BASE}/v1/clusters/${clusterId}/findings/${encodeURIComponent(insightId)}/explain`,
    { method: "POST" },
  );
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load explanation"));
  }
  return res.json();
}

export async function fetchClustersHealth(): Promise<ClusterHealthItem[]> {
  const res = await apiFetch(`${API_BASE}/v1/clusters/health`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load cluster health"));
  }
  return res.json();
}

export type ClusterSummary = {
  collected_at: string;
  kubernetes_version?: string | null;
  from_cache?: boolean;
  filtered_from_all_namespaces?: boolean;
  connectivity_status?: string | null;
  last_scan_at?: string | null;
  scan_error?: string | null;
  error: string | null;
  counts: Record<string, number>;
  resource_counts: ResourceCountItem[];
  inventory: Record<string, InventoryItem[]>;
  namespaces: string[];
  selected_namespace: string | null;
  nodes: ClusterNodeSummary[];
  insights: ClusterInsightItem[];
  metrics_available: boolean;
  metrics_message: string | null;
  timeseries: {
    cpu_millicores?: { t: string; v: number }[];
    memory_mebibytes?: { t: string; v: number }[];
  };
  health: ClusterHealth;
  namespace_health?: NamespaceHealthItem[];
};

export async function fetchClusterSummary(
  clusterId: string,
  options?: { namespace?: string | null; scan?: boolean },
): Promise<ClusterSummary> {
  const params = new URLSearchParams();
  if (options?.namespace) params.set("namespace", options.namespace);
  if (options?.scan) params.set("scan", "true");
  const qs = params.toString();
  const res = await apiFetch(
    `${API_BASE}/v1/clusters/${clusterId}/summary${qs ? `?${qs}` : ""}`,
  );
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load cluster summary"));
  }
  return res.json();
}

export async function deleteCluster(clusterId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/v1/clusters/${clusterId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not delete cluster"));
  }
}

export type LocalClusterCreatePayload = {
  name: string;
  kubeconfig_yaml?: string | null;
  namespace_scope?: string | null;
  notes?: string | null;
};

export async function createLocalCluster(payload: LocalClusterCreatePayload): Promise<ClusterPublic> {
  const res = await apiFetch(`${API_BASE}/v1/clusters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not register local cluster"));
  }
  return res.json();
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
  aws_profile_id?: string | null;
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

export type AwsConnectionType = "iam_role" | "iam_user";

export type OnboardingExternalIdResponse = {
  external_id: string;
};

export type CloudFormationLaunchResponse = {
  external_id: string;
  aws_region: string;
  cloudformation_quick_create_url: string | null;
  template_download_path: string;
  kubepilot_aws_account_id: string;
  kubepilot_principal_arn: string | null;
  setup_note: string | null;
};

export type VerifyAwsSuccessResponse = {
  status: "success";
  cluster_arn: string;
  cluster_name: string;
  aws_account_id: string;
  aws_region: string;
};

export type AwsProfilePublic = {
  id: string;
  profile_name: string;
  connection_type: "iam_user" | "iam_role";
  aws_account_id: string;
  default_region: string;
  role_arn: string | null;
  external_id: string | null;
  access_key_last4: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AwsProfileCreateUser = {
  connection_type: "iam_user";
  profile_name: string;
  aws_account_id: string;
  default_region: string;
  aws_access_key_id: string;
  aws_secret_access_key: string;
  aws_session_token?: string | null;
  role_arn?: string | null;
};

export type AwsProfileCreateRole = {
  connection_type: "iam_role";
  profile_name: string;
  aws_account_id: string;
  default_region: string;
  role_arn: string;
  external_id?: string | null;
};

export async function fetchAwsProfiles(): Promise<AwsProfilePublic[]> {
  const res = await apiFetch(`${API_BASE}/v1/aws-profiles`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not load AWS profiles"));
  }
  return res.json();
}

export async function createAwsProfile(
  payload: AwsProfileCreateUser | AwsProfileCreateRole,
): Promise<AwsProfilePublic> {
  const res = await apiFetch(`${API_BASE}/v1/aws-profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not create profile"));
  }
  return res.json();
}

export async function deleteAwsProfile(profileId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/v1/aws-profiles/${profileId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not delete profile"));
  }
}

export type VerifyAwsIamRolePayload = {
  connection_type: "iam_role";
  aws_region: string;
  cluster_name: string;
  role_arn?: string;
  external_id?: string;
  profile_id?: string;
};

export type VerifyAwsIamUserPayload = {
  connection_type: "iam_user";
  aws_region: string;
  cluster_name: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_session_token?: string | null;
  profile_id?: string;
};

export async function fetchOnboardingExternalId(): Promise<OnboardingExternalIdResponse> {
  const res = await apiFetch(`${API_BASE}/v1/onboarding/external-id`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not generate External ID"));
  }
  return res.json();
}

export async function fetchCloudFormationLaunch(
  awsRegion: string,
  externalId?: string,
): Promise<CloudFormationLaunchResponse> {
  const params = new URLSearchParams({ aws_region: awsRegion });
  if (externalId) params.set("external_id", externalId);
  const res = await apiFetch(`${API_BASE}/v1/onboarding/cloudformation-launch?${params}`);
  if (!res.ok) {
    throw new Error(await parseError(res, "Could not build CloudFormation launch URL"));
  }
  return res.json();
}

export function cloudFormationTemplateDownloadUrl(): string {
  return `${API_BASE}/v1/onboarding/cloudformation/template`;
}

export async function verifyAwsConnection(
  payload: VerifyAwsIamRolePayload | VerifyAwsIamUserPayload,
): Promise<VerifyAwsSuccessResponse> {
  const res = await apiFetch(`${API_BASE}/v1/onboarding/verify-aws`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseError(res, "AWS verification failed"));
  }
  return res.json();
}
