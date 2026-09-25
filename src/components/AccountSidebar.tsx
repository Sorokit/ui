/**
 * AccountSidebar
 *
 * A collapsible, mobile-responsive drawer showing account details: address
 * (with copy), all asset balances, the 5 most recent transactions, and
 * account quick links (network switcher, block explorer, disconnect).
 * Designed to be triggered from anywhere in the app (e.g. via
 * a button click or other trigger).
 *
 * Balance/account data refreshes on an interval while the sidebar is open,
 * via `useSorokit().refreshAccount()` — sorokit-ui has no blockchain logic
 * of its own (see package.json's description), so "real-time" here means
 * polling through whatever `sorokit-core` client the host app provides,
 * the same pattern already used by `ContractEventFeed`'s `pollInterval` and
 * `FeeEstimator`'s `refreshInterval`.
 *
 * @component
 * @example
 * ```tsx
 * import { AccountSidebar } from 'sorokit-ui';
 *
 * function App() {
 *   const [open, setOpen] = useState(false);
 *   return (
 *     <>
 *       <button onClick={() => setOpen(true)}>Open Account</button>
 *       <AccountSidebar open={open} onClose={() => setOpen(false)} />
 *     </>
 *   );
 * }
 * ```
 */
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import { AddressDisplay } from "@/components/AddressDisplay";
import { AssetBadge } from "@/components/AssetBadge";
import { Button } from "@/components/ui/Button";
import { AssetRowSkeleton } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import { type Transaction } from "@/lib/client";
import { cn } from "@/lib/utils";

import { TxRow } from "./TransactionHistory";

const COLLAPSED_STORAGE_KEY = "sorokit-account-sidebar-collapsed";
const RECENT_TX_LIMIT = 5;

export interface AccountSidebarProps {
  /** Whether the sidebar is visible */
  open: boolean;
  /** Called on backdrop click, close button, or Escape */
  onClose: () => void;
  /** Auto-refresh interval for account/balance data in ms while open. 0 disables polling. */
  refreshIntervalMs?: number;
}

export function AccountSidebar({
  open,
  onClose,
  refreshIntervalMs = 15_000,
}: AccountSidebarProps) {
  const {
    address,
    isConnected,
    balances,
    isLoadingAccount,
    refreshAccount,
    disconnectWallet,
    network,
    client,
  } = useSorokit();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  });
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Load the 5 most recent transactions when the sidebar opens for a
  // connected address. Deferred via setTimeout(0), same pattern
  // SorokitProvider uses for its own data-loading effects.
  useEffect(() => {
    if (!open || !address || !client) return;
    let active = true;
    const timerId = window.setTimeout(() => {
      setTxLoading(true);
      client
        .transaction.getHistory(address, 1, RECENT_TX_LIMIT)
        .then(({ data }) => {
          if (!active) return;
          setRecentTxs(data ?? []);
        })
        .finally(() => {
          if (active) setTxLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [open, address, client]);

  // Poll account/balance data while the sidebar is open.
  useEffect(() => {
    if (!open || !isConnected || refreshIntervalMs <= 0) return;
    const id = setInterval(() => {
      void refreshAccount();
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [open, isConnected, refreshIntervalMs, refreshAccount]);

  // Escape closes the sidebar.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account details"
        className={cn(
          "fixed top-0 right-0 z-50 h-full flex flex-col",
          "bg-surface border-l border-line shadow-2xl",
          "animate-in slide-in-from-right duration-200",
          collapsed ? "w-[88px]" : "w-full sm:w-[340px]",
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-line shrink-0">
          {!collapsed && (
            <h2 className="text-[13px] font-semibold text-ink">Account</h2>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand account sidebar" : "Collapse account sidebar"}
              aria-pressed={collapsed}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors"
            >
              <HugeiconsIcon
                icon={collapsed ? ArrowDown01Icon : ArrowUp01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
                className={collapsed ? "-rotate-90" : "rotate-90"}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close account sidebar"
              className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
            </button>
          </div>
        </div>

        {!address ? (
          <p className="text-[13px] text-ink-3 text-center py-10 px-4">
            Connect your wallet to view account details
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Address */}
            <div className={cn("px-4 py-4 border-b border-line", collapsed && "px-2 flex justify-center")}>
              {collapsed ? (
                <div
                  className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  title={address}
                >
                  {address.slice(0, 2).toUpperCase()}
                </div>
              ) : (
                <AddressDisplay address={address} showFull label="Address" size="sm" />
              )}
            </div>

            {/* Balances */}
            <div className={cn("py-3", collapsed ? "px-2" : "px-4")}>
              {!collapsed && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-2">
                  Assets ({balances.length})
                </p>
              )}
              {isLoadingAccount && balances.length === 0 ? (
                <div className={collapsed ? "" : "rounded-lg border border-line overflow-hidden"}>
                  <AssetRowSkeleton />
                </div>
              ) : balances.length === 0 ? (
                !collapsed && (
                  <p className="text-[12px] text-ink-3">No assets found</p>
                )
              ) : collapsed ? (
                <div className="flex flex-col items-center gap-2">
                  {balances.slice(0, 3).map((b) => (
                    <div
                      key={b.asset}
                      className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[9px] font-bold text-ink-2"
                      title={`${b.balance} ${b.assetType === "native" ? "XLM" : (b.assetCode ?? b.asset)}`}
                    >
                      {(b.assetType === "native" ? "XLM" : (b.assetCode ?? b.asset)).slice(0, 2)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {balances.map((b) => (
                    <div key={b.asset} className="flex items-center justify-between">
                      <AssetBadge balance={b} size="sm" showIssuer={false} />
                      <span className="text-[12px] font-semibold tabular-nums text-ink">
                        {parseFloat(b.balance).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!collapsed && (
              <>
                {/* Recent transactions */}
                <div className="px-4 py-3 border-t border-line">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-2">
                    Recent Activity
                  </p>
                  {txLoading && recentTxs.length === 0 ? (
                    <div className="flex flex-col gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 rounded-lg bg-surface-2 animate-pulse" />
                      ))}
                    </div>
                  ) : recentTxs.length === 0 ? (
                    <p className="text-[12px] text-ink-3">No recent transactions</p>
                  ) : (
                    <div className="rounded-lg border border-line overflow-hidden -mx-4">
                      {recentTxs.map((tx) => (
                        <TxRow key={tx.hash} tx={tx} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Settings quick links */}
                <div className="px-4 py-3 border-t border-line flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-1">
                    Settings
                  </p>
                  {network && (
                    <div className="flex items-center justify-between text-[12px] text-ink-2">
                      <span>Network</span>
                      <span className="capitalize">{network.name}</span>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshAccount()}
                    disabled={isLoadingAccount}
                  >
                    Refresh balances
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    requireConfirm
                    confirmLabel="Confirm disconnect?"
                    onClick={() => {
                      void disconnectWallet();
                      onClose();
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
