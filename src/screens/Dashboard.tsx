import { type ComponentType, lazy, Suspense, useCallback, useEffect, useState } from "react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkBanner } from "@/components/NetworkBanner";
import { type NavSection, Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AccountScreen } from "@/screens/AccountScreen";
import { WalletScreen } from "@/screens/WalletScreen";

// Screens that are less likely to be the entry point are code-split so the
// initial bundle only pays for what's visited.
const BudgetScreen = lazy(() =>
  import("@/screens/BudgetScreen").then((m) => ({ default: m.BudgetScreen })),
);
const ChartingScreen = lazy(() =>
  import("@/screens/ChartingScreen").then((m) => ({ default: m.ChartingScreen })),
);
const NetworkScreen = lazy(() =>
  import("@/screens/NetworkScreen").then((m) => ({ default: m.NetworkScreen })),
);
const NFTScreen = lazy(() =>
  import("@/screens/NFTScreen").then((m) => ({ default: m.NFTScreen })),
);
const RecoveryScreen = lazy(() =>
  import("@/screens/RecoveryScreen").then((m) => ({ default: m.RecoveryScreen })),
);
const SorobanScreen = lazy(() =>
  import("@/screens/SorobanScreen").then((m) => ({ default: m.SorobanScreen })),
);
const TransactionsScreen = lazy(() =>
  import("@/screens/TransactionsScreen").then((m) => ({
    default: m.TransactionsScreen,
  })),
);
const YieldFarmingScreen = lazy(() =>
  import("@/screens/YieldFarmingScreen").then((m) => ({
    default: m.YieldFarmingScreen,
  })),
);

const PAGE_TITLES: Record<NavSection, string> = {
  wallet: "Wallet — Sorokit",
  account: "Account — Sorokit",
  transactions: "Transactions — Sorokit",
  soroban: "Soroban — Sorokit",
  network: "Network — Sorokit",
  recovery: "Recovery — Sorokit",
  charts: "Charts — Sorokit",
  farming: "Yield Farming — Sorokit",
  budget: "Budget — Sorokit",
  nfts: "NFTs — Sorokit",
};

const SCREENS: Record<NavSection, ComponentType> = {
  wallet: WalletScreen,
  account: AccountScreen,
  transactions: TransactionsScreen,
  soroban: SorobanScreen,
  network: NetworkScreen,
  recovery: RecoveryScreen,
  charts: ChartingScreen,
  farming: YieldFarmingScreen,
  budget: BudgetScreen,
  nfts: NFTScreen,
};

const SCREEN_LABELS: Record<NavSection, string> = {
  wallet: "Wallet",
  account: "Account",
  transactions: "Transactions",
  soroban: "Soroban",
  network: "Network",
  recovery: "Recovery",
  charts: "Charts",
  farming: "Yield Farming",
  budget: "Budget",
  nfts: "NFTs",
};

/**
 * Fallback shown when a single screen's ErrorBoundary catches a render
 * error. Scoped to the screen's own area — Sidebar, TopBar, and the other
 * (hidden) screens are rendered by Dashboard outside this boundary, so a
 * crash here never tears down the rest of the shell.
 */
function ScreenErrorFallback({
  screenName,
  onRetry,
}: {
  screenName: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-[13px] font-medium text-ink">
        {screenName} couldn't load
      </p>
      <p className="text-[12px] text-ink-3">
        Something went wrong rendering this screen. The rest of the dashboard
        is unaffected.
      </p>
      <button
        onClick={onRetry}
        className="inline-flex items-center h-8 px-3.5 rounded-lg bg-surface-2 border border-line hover:border-line-2 text-[12px] text-ink-2 transition-colors cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}

export interface DashboardProps {
  /** Max width of the main content column. Defaults to "700px". */
  maxContentWidth?: string;
  /**
   * Controlled active section. When provided, `Dashboard` renders this section
   * and never changes it internally — the parent owns the state and should
   * update it from `onSectionChange`.
   */
  activeSection?: NavSection;
  /** Fired whenever a nav item is chosen, in both controlled and uncontrolled mode. */
  onSectionChange?: (section: NavSection) => void;
  /** Initial section in uncontrolled mode. Ignored when `activeSection` is set. */
  defaultSection?: NavSection;
}

export function Dashboard({
  maxContentWidth = "700px",
  activeSection,
  onSectionChange,
  defaultSection = "wallet",
}: DashboardProps = {}) {
  const isControlled = activeSection !== undefined;
  const [internalActive, setInternalActive] =
    useState<NavSection>(defaultSection);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const active = isControlled ? activeSection : internalActive;

  useEffect(() => {
    document.title = PAGE_TITLES[active];
  }, [active]);

  // Screens keep their mounted state once actually shown (e.g. a half-typed
  // Soroban form) instead of being torn down every time navigation moves
  // away. Tracked off `active` (what actually rendered), not the nav click,
  // so controlled mode only mounts a screen once the parent confirms it.
  const [visited, setVisited] = useState<Set<NavSection>>(
    () => new Set([active]),
  );
  if (!visited.has(active)) {
    setVisited((prev) => new Set(prev).add(active));
  }

  const handleNavigate = useCallback(
    (section: NavSection) => {
      // In controlled mode the parent decides what renders next; only report.
      if (!isControlled) setInternalActive(section);
      onSectionChange?.(section);
    },
    [isControlled, onSectionChange],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-base">
      <Sidebar
        active={active}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          active={active}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
        />
        <NetworkBanner active={active} />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div
            className="mx-auto px-6 py-8 sm:px-10 sm:py-10 min-h-[300px]"
            style={{ maxWidth: maxContentWidth }}
          >
            {[...visited].map((section) => {
              const Screen = SCREENS[section];
              return (
                <div
                  key={section}
                  hidden={section !== active}
                  data-testid={`screen-wrapper-${section}`}
                >
                  <ErrorBoundary
                    isolate
                    fallback={(_error, reset) => (
                      <ScreenErrorFallback
                        screenName={SCREEN_LABELS[section]}
                        onRetry={reset}
                      />
                    )}
                  >
                    <Suspense fallback={null}>
                      <Screen />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
