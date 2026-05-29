"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Copy, Key, Moon, Sun } from "lucide-react";
import { PrimaryButton, DataTable } from "@/components/dashboard/ui/DashboardUi";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadPreferences, savePreferences, type UserPreferences } from "@/lib/preferences";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "team", label: "Team" },
  { id: "notifications", label: "Notifications" },
  { id: "access", label: "Access & Roles" },
  { id: "api-keys", label: "API Keys" },
  { id: "preferences", label: "Preferences" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Toggle({
  label,
  description,
  on,
  onChange,
}: {
  label: string;
  description?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <div>
        <span className="text-sm text-kp-text">{label}</span>
        {description && <p className="text-xs text-kp-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-kp-blue" : "bg-kp-border"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "left-5" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const displayName = user?.display_name ?? user?.user_email?.split("@")[0];
  const email = user?.user_email;
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadPreferences());
  const [saved, setSaved] = useState(false);

  const tabParam = searchParams.get("tab") ?? "profile";
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "profile";

  useEffect(() => setMounted(true), []);

  const setTab = useCallback(
    (id: TabId) => {
      router.replace(`/dashboard/settings?tab=${id}`, { scroll: false });
    },
    [router],
  );

  function updatePrefs(patch: Partial<UserPreferences>) {
    const next = savePreferences(patch);
    setPrefs(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isDark = (mounted ? resolvedTheme : "dark") === "dark";

  return (
    <>
      <div className="border-b border-kp-border px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium sm:text-sm ${
                tab === t.id ? "border-kp-blue text-kp-text" : "border-transparent text-kp-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {tab === "profile" && (
          <section className="mx-auto max-w-2xl rounded-xl border border-kp-border bg-kp-surface/40 p-5">
            <h2 className="font-semibold text-kp-text">Profile Information</h2>
            <p className="mt-1 text-xs text-kp-muted">Managed by your corporate IdP (read-only)</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-kp-blue text-xl font-bold text-white">
                {displayName?.slice(0, 2).toUpperCase() ?? "AS"}
              </div>
              <button type="button" className="text-xs text-kp-blue-glow hover:underline">
                Change Avatar
              </button>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Name" value={displayName ?? "—"} />
              <Field label="Email" value={email ?? "—"} />
              <Field label="Role" value="Platform Admin" />
              <Field label="Timezone" value="Asia/Kolkata (UTC +05:30)" />
              <Field label="Department" value="Platform Engineering" />
              <Field label="Employee ID" value="EMP-10482" />
            </dl>
          </section>
        )}

        {tab === "team" && (
          <section className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-kp-text">Team Members</h2>
                <p className="text-xs text-kp-muted">Platform & SRE users with KubePilot access</p>
              </div>
              <PrimaryButton>Invite Member</PrimaryButton>
            </div>
            <DataTable
              columns={["Name", "Email", "Role", "Status", "Last Active"]}
              rows={[
                [displayName ?? "You", email ?? "—", "Platform Admin", <span key="1" className="text-kp-green text-xs">Active</span>, "Now"],
                ["Amit Sharma", "amit.sharma@acme.com", "SRE Lead", <span key="2" className="text-kp-green text-xs">Active</span>, "2h ago"],
                ["Priya Nair", "priya.nair@acme.com", "FinOps Analyst", <span key="3" className="text-kp-green text-xs">Active</span>, "1d ago"],
                ["James Chen", "james.chen@acme.com", "Security Auditor", <span key="4" className="text-kp-green text-xs">Active</span>, "3d ago"],
              ]}
            />
          </section>
        )}

        {tab === "notifications" && (
          <section className="mx-auto max-w-xl rounded-xl border border-kp-border bg-kp-surface/40 p-5">
            <h2 className="font-semibold text-kp-text">Notification Channels</h2>
            <p className="mt-1 text-xs text-kp-muted">Control how KubePilot reaches you</p>
            <div className="mt-4 divide-y divide-kp-border/60">
              <Toggle
                label="Email Notifications"
                description="Critical alerts and weekly digests"
                on={prefs.emailNotifications}
                onChange={(v) => updatePrefs({ emailNotifications: v })}
              />
              <Toggle
                label="Slack Notifications"
                description="#platform-alerts channel"
                on={prefs.slackNotifications}
                onChange={(v) => updatePrefs({ slackNotifications: v })}
              />
              <Toggle
                label="In-app Alerts"
                description="Bell icon and dashboard feed"
                on={true}
                onChange={() => {}}
              />
            </div>
            <h3 className="mt-6 text-sm font-medium text-kp-text">Alert severity threshold</h3>
            <select className="mt-2 w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2 text-sm text-kp-text">
              <option>Critical & Warning</option>
              <option>Critical only</option>
              <option>All severities</option>
            </select>
          </section>
        )}

        {tab === "access" && (
          <section className="space-y-4">
            <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-5">
              <h2 className="font-semibold text-kp-text">Your Roles</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Platform Admin", "Cluster Viewer", "FinOps Reader"].map((role) => (
                  <span
                    key={role}
                    className="rounded-full border border-kp-blue/30 bg-kp-blue/10 px-3 py-1 text-xs text-kp-blue-glow"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 sm:p-5">
              <h2 className="mb-4 font-semibold text-kp-text">Role Permissions Matrix</h2>
              <DataTable
                columns={["Role", "Clusters", "Cost", "Security", "Settings"]}
                rows={[
                  ["Platform Admin", "Read/Write config", "Full", "Full", "Full"],
                  ["SRE Lead", "Read + Investigate", "Read", "Read", "Profile only"],
                  ["FinOps Analyst", "Read", "Full", "Read", "Profile only"],
                  ["Security Auditor", "Read", "Read", "Full", "Profile only"],
                ]}
              />
            </div>
          </section>
        )}

        {tab === "api-keys" && (
          <section className="rounded-xl border border-kp-border bg-kp-surface/40 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-kp-text">API Keys</h2>
                <p className="text-xs text-kp-muted">Programmatic access to KubePilot read-only API</p>
              </div>
              <PrimaryButton>Generate Key</PrimaryButton>
            </div>
            <div className="space-y-3">
              {[
                { name: "CI Pipeline", prefix: "kp_live_8f3a…", created: "May 12, 2026", lastUsed: "2h ago" },
                { name: "Local Dev", prefix: "kp_test_2b91…", created: "Apr 03, 2026", lastUsed: "Never" },
              ].map((key) => (
                <div
                  key={key.name}
                  className="flex flex-col gap-3 rounded-lg border border-kp-border bg-kp-bg-deep p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Key className="mt-0.5 h-4 w-4 text-kp-muted" />
                    <div>
                      <p className="font-medium text-kp-text">{key.name}</p>
                      <p className="font-mono text-xs text-kp-muted">{key.prefix}</p>
                      <p className="mt-1 text-[10px] text-kp-muted">
                        Created {key.created} · Last used {key.lastUsed}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="rounded-lg border border-kp-border px-3 py-1.5 text-xs text-kp-muted hover:text-kp-text">
                      <Copy className="mr-1 inline h-3 w-3" />
                      Copy
                    </button>
                    <button type="button" className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "preferences" && (
          <section className="mx-auto max-w-xl rounded-xl border border-kp-border bg-kp-surface/40 p-5">
            <h2 className="font-semibold text-kp-text">Platform Preferences</h2>
            <div className="mt-4 divide-y divide-kp-border/60">
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-center gap-2">
                  {mounted ? (isDark ? (
                    <Moon className="h-4 w-4 text-kp-muted" />
                  ) : (
                    <Sun className="h-4 w-4 text-kp-muted" />
                  )) : (
                    <Moon className="h-4 w-4 text-kp-muted" />
                  )}
                  <div>
                    <span className="text-sm text-kp-text">Theme</span>
                    <p className="text-xs text-kp-muted">{isDark ? "Dark mode" : "Light mode"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isDark}
                  disabled={!mounted}
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${isDark ? "bg-kp-blue" : "bg-kp-border"}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isDark ? "left-5" : "left-0.5"}`}
                  />
                </button>
              </div>
              <Toggle
                label="Compact View"
                description="Denser tables and smaller sidebar labels"
                on={prefs.compactView}
                onChange={(v) => updatePrefs({ compactView: v })}
              />
              <Toggle
                label="Auto-sync Clusters"
                description="Refresh cluster inventory every 5 minutes"
                on={prefs.autoSyncClusters}
                onChange={(v) => updatePrefs({ autoSyncClusters: v })}
              />
            </div>
            <div className="mt-4">
              <label className="text-xs text-kp-muted">Default cluster filter</label>
              <select
                value={prefs.defaultClusterView}
                onChange={(e) => updatePrefs({ defaultClusterView: e.target.value })}
                className="mt-1 w-full rounded-lg border border-kp-border bg-kp-bg-deep px-3 py-2 text-sm text-kp-text"
              >
                <option value="all">All clusters</option>
                <option value="production">Production only</option>
                <option value="staging">Staging only</option>
              </select>
            </div>
            {saved && (
              <p className="mt-4 text-xs text-kp-green">Preferences saved.</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-kp-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-kp-text">{value}</dd>
    </div>
  );
}

export function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-kp-muted">Loading settings…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
