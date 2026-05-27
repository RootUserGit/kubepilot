"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Headphones, Shield } from "lucide-react";
import { completeGoogleSession } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export function AuthGateway() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, applySession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [ssoCompleting, setSsoCompleting] = useState(false);
  const exchangeStarted = useRef(false);

  const oauthCode = searchParams.get("code");

  useEffect(() => {
    if (loading || oauthCode) return;
    if (user) {
      router.replace("/dashboard");
    }
  }, [loading, user, oauthCode, router]);

  useEffect(() => {
    const ssoError = searchParams.get("sso_error");
    if (ssoError) {
      const messages: Record<string, string> = {
        not_configured:
          "Google Sign-In is not configured on the server. Add KUBEPILOT_GOOGLE_CLIENT_ID and KUBEPILOT_GOOGLE_CLIENT_SECRET to .env and restart the API.",
        token_exchange_failed: "Google sign-in was cancelled or failed. Try again.",
        missing_profile: "Google did not return a profile. Try another account.",
        missing_email: "Your Google account has no email address we can use.",
        email_not_verified: "Please verify your Google email address and try again.",
        login_failed: "Google sign-in failed. Try again.",
      };
      setError(messages[ssoError] ?? "Google sign-in failed. Try again.");
      router.replace("/login");
      return;
    }

    if (!oauthCode || exchangeStarted.current) return;

    exchangeStarted.current = true;
    let cancelled = false;
    setSsoCompleting(true);
    setError(null);

    void completeGoogleSession(oauthCode)
      .then(async (session) => {
        if (cancelled) return;
        applySession(session);
        router.replace("/dashboard");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        exchangeStarted.current = false;
        setError(err instanceof Error ? err.message : "Google sign-in failed");
        router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setSsoCompleting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [oauthCode, searchParams, router, applySession]);

  if (ssoCompleting) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <p className="text-sm text-kp-muted">Completing Google sign-in…</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[url('/dashboard-blur.svg')] bg-cover bg-center opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-kp-bg/50 via-kp-bg/80 to-kp-bg" />

      <div className="relative w-full max-w-md rounded-2xl border border-kp-border bg-kp-surface/90 p-8 backdrop-blur-xl kp-glow-blue">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-kp-blue/20 ring-1 ring-kp-blue/40">
            <Shield className="h-7 w-7 text-kp-blue-glow" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-kp-text">Sign in to KubePilot</h1>
          <p className="mt-2 text-sm text-kp-muted">
            Use your Google account to access the platform and manage your EKS environments.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <GoogleSignInButton />

          {error && (
            <p
              role="alert"
              className="w-full rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-center text-xs text-red-800 dark:text-red-200"
            >
              {error}
            </p>
          )}
        </div>

        <div className="mt-8 flex items-start gap-3 border-t border-kp-border pt-6">
          <Headphones className="mt-0.5 h-5 w-5 shrink-0 text-kp-muted" />
          <div>
            <p className="text-sm text-kp-text">Need access?</p>
            <p className="mt-0.5 text-xs text-kp-muted">
              Request a KubePilot role via the{" "}
              <Link href="/contact#access" className="text-kp-blue-glow hover:underline">
                internal IT portal
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
