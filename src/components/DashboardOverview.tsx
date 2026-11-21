/**
 * DashboardOverview — quick-action tiles (Send, Receive, Swap, Stake) and
 * balance summary cards shown above the active Dashboard screen.
 */

import {
  ArrowDataTransferHorizontalIcon,
  Plant01Icon,
  SentIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";

import type { NavSection } from "@/components/Sidebar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import { safeFormat } from "@/lib/utils";

export type QuickActionId = "send" | "receive" | "swap" | "stake";

export const QUICK_ACTIONS: {
  id: QuickActionId;
  label: string;
  section: NavSection;
  icon: IconSvgElement;
}[] = [
  { id: "send", label: "Send", section: "transactions", icon: SentIcon },
  { id: "receive", label: "Receive", section: "wallet", icon: Wallet01Icon },
  { id: "swap", label: "Swap", section: "soroban", icon: ArrowDataTransferHorizontalIcon },
  { id: "stake", label: "Stake", section: "farming", icon: Plant01Icon },
];

export interface DashboardOverviewProps {
  onNavigate: (section: NavSection) => void;
}

export function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const { isConnected, isLoading, isLoadingAccount, account, balances, error } =
    useSorokit();

  // Account data hydrates after the wallet connects; until it lands (and no
  // error occurred) show placeholders rather than a misleading 0.00.
  const hydrating =
    isLoading || isLoadingAccount || (isConnected && !account && !error);

  const xlm = balances.find((b) => b.assetType === "native");
  const summary = [
    { label: "XLM Balance", value: safeFormat(xlm?.balance ?? "") },
    { label: "Assets", value: String(balances.length) },
  ];

  return (
    <div className="flex flex-col gap-4 mb-6" data-testid="dashboard-overview">
      <div
        role="group"
        aria-label="Quick actions"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {QUICK_ACTIONS.map(({ id, label, section, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(section)}
            data-testid={`quick-action-${id}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-3 py-4 text-[12px] font-medium text-ink-2 transition-colors cursor-pointer hover:border-line-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-base"
          >
            <HugeiconsIcon icon={icon} size={20} color="currentColor" strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {isConnected && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          aria-busy={hydrating}
          data-testid="balance-summary"
        >
          {summary.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-surface px-5 py-4 flex flex-col gap-1"
            >
              <span className="text-[11px] uppercase tracking-wider text-ink-3">
                {label}
              </span>
              {hydrating ? (
                <Skeleton
                  className="h-6 w-24"
                  data-testid="balance-summary-skeleton"
                />
              ) : (
                <span className="text-[20px] font-semibold text-ink">{value}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
