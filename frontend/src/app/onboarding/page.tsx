import { OnboardingPage } from "@/components/onboarding/OnboardingPage";
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function OnboardingRoute() {
  return (
    <PublicLayout headerVariant="docs">
      <OnboardingPage />
    </PublicLayout>
  );
}
