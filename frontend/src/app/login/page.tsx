import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { AuthGateway } from "@/components/auth/AuthGateway";

export default function LoginRoute() {
  return (
    <>
      <SiteHeader variant="auth" />
      <main className="flex-1">
        <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-kp-muted">Loading…</div>}>
          <AuthGateway />
        </Suspense>
      </main>
    </>
  );
}
