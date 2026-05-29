"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  return (
    <PublicLayout headerVariant="landing">
      <LandingPage />
    </PublicLayout>
  );
}
