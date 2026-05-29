import { LogoLink } from "./LogoLink";

type LogoProps = {
  showBadge?: boolean;
};

/** @deprecated Prefer LogoLink for auth-aware home routing */
export function Logo({ showBadge = false }: LogoProps) {
  return <LogoLink showBadge={showBadge} />;
}
