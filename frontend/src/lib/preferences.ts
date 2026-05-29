export type UserPreferences = {
  emailNotifications: boolean;
  slackNotifications: boolean;
  autoSyncClusters: boolean;
  compactView: boolean;
  defaultClusterView: string;
  dateFormat: string;
};

const STORAGE_KEY = "kubepilot-preferences";

const DEFAULTS: UserPreferences = {
  emailNotifications: true,
  slackNotifications: true,
  autoSyncClusters: true,
  compactView: false,
  defaultClusterView: "all",
  dateFormat: "relative",
};

export function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const next = { ...loadPreferences(), ...prefs };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("kubepilot-preferences"));
  }
  return next;
}
