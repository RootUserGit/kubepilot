/**
 * Browser auth uses HttpOnly cookies on the API origin (localhost:8000).
 * JavaScript cannot read the session token — use GET /v1/auth/session/verify.
 */

export type AuthUser = {
  email: string;
  displayName: string;
};

/** Remove legacy localStorage tokens from earlier builds. */
export function clearLegacyClientStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("kubepilot_access_token");
  localStorage.removeItem("kubepilot_user");
  sessionStorage.removeItem("kubepilot_access_token");
  sessionStorage.removeItem("kubepilot_user");
}
