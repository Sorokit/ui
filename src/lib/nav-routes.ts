import type { NavSection } from "@/components/Sidebar";

/**
 * URL path for each dashboard section, used only by the demo app (src/App.tsx)
 * so the browser's address bar, back/forward buttons, and refresh reflect the
 * active screen. The sorokit-ui component library itself stays router-agnostic
 * — Dashboard's `activeSection`/`onSectionChange` props are the integration
 * point a host app (this one included) uses to wire up its own routing.
 */
export const SECTION_PATHS: Record<NavSection, string> = {
  wallet: "/",
  account: "/account",
  transactions: "/transactions",
  soroban: "/soroban",
  network: "/network",
  recovery: "/recovery",
  charts: "/charts",
  farming: "/farming",
  budget: "/budget",
  nfts: "/nfts",
};

const PATH_TO_SECTION: Record<string, NavSection> = Object.fromEntries(
  Object.entries(SECTION_PATHS).map(([section, path]) => [path, section]),
) as Record<string, NavSection>;

export function sectionForPath(pathname: string): NavSection {
  return PATH_TO_SECTION[pathname] ?? "wallet";
}
