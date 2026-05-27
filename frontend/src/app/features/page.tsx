import { FeaturesPage } from "@/components/features/FeaturesPage";
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function FeaturesRoute() {
  return (
    <PublicLayout headerVariant="docs">
      <FeaturesPage />
    </PublicLayout>
  );
}
