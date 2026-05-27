import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type PublicLayoutProps = {
  children: React.ReactNode;
  headerVariant?: "landing" | "docs" | "auth";
  showFooter?: boolean;
};

export function PublicLayout({
  children,
  headerVariant = "landing",
  showFooter = true,
}: PublicLayoutProps) {
  return (
    <>
      <SiteHeader variant={headerVariant} />
      <main className="flex-1">{children}</main>
      {showFooter && headerVariant !== "auth" && <SiteFooter />}
    </>
  );
}
