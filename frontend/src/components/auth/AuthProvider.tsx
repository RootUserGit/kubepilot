"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { logoutSession, verifySession, type SessionUser } from "@/lib/api";
import { clearLegacyClientStorage } from "@/lib/auth";
import { IdleActivityMonitor } from "@/components/auth/IdleActivityMonitor";
import { IdleTimeoutAlert } from "@/components/auth/IdleTimeoutAlert";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  applySession: (user: SessionUser) => void;
  signOut: () => Promise<void>;
  onIdleTimeout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_IDLE_SECONDS = 4 * 60 * 60;

function isGoogleCallbackOnLogin(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname === "/login" && new URLSearchParams(window.location.search).has("code")
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState(DEFAULT_IDLE_SECONDS);
  const [showIdleAlert, setShowIdleAlert] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const initialVerifyDone = useRef(false);

  const refresh = useCallback(async (options?: { force?: boolean }) => {
    if (refreshInFlight.current) {
      await refreshInFlight.current;
      return;
    }
    const run = (async () => {
      try {
        const result = await verifySession({ force: options?.force });
        if (result.idle_timeout_seconds != null) {
          setIdleTimeoutSeconds(result.idle_timeout_seconds);
        }
        if (result.authenticated && result.user_email) {
          setUser({
            user_email: result.user_email,
            display_name: result.display_name ?? undefined,
          });
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
    refreshInFlight.current = run;
    try {
      await run;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  const applySession = useCallback((session: SessionUser) => {
    setUser(session);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await logoutSession();
    setUser(null);
    setLoading(false);
  }, []);

  const onIdleTimeout = useCallback(async () => {
    await signOut();
    setShowIdleAlert(true);
  }, [signOut]);

  const dismissIdleAlert = useCallback(() => {
    setShowIdleAlert(false);
  }, []);

  useEffect(() => {
    clearLegacyClientStorage();
    if (initialVerifyDone.current) return;
    if (isGoogleCallbackOnLogin()) {
      setLoading(false);
      return;
    }
    initialVerifyDone.current = true;
    void refresh({ force: true });
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt != null && Date.now() - hiddenAt >= 5 * 60 * 1000) {
        void refresh({ force: true });
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user, refresh]);

  const value = useMemo(
    () => ({ user, loading, refresh, applySession, signOut, onIdleTimeout }),
    [user, loading, refresh, applySession, signOut, onIdleTimeout],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user ? <IdleActivityMonitor idleTimeoutSeconds={idleTimeoutSeconds} /> : null}
      <IdleTimeoutAlert open={showIdleAlert} onDismiss={dismissIdleAlert} />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
