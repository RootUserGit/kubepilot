import { ContactPage } from "@/components/contact/ContactPage";
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function ContactRoute() {
  return (
    <PublicLayout headerVariant="docs">
      <ContactPage />
    </PublicLayout>
  );
}
