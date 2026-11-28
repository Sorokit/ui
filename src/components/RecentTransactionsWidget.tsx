import {
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Time02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient, Transaction } from "@/lib/client";
import { cn, truncateAddress } from "@/lib/utils";

const STROOPS_PER_XLM = 10_000_000;

function formatTxAmount(tx: Transaction): string {
  if ((tx as unknown as { amount?: string }).amount) {
    return String((tx as unknown as { amount?: string }).amount);
  }
  const stroops = Number.parseInt(tx.feePaid ?? "0", 10);
  if (Number.isFinite(stroops) && stroops > 0) {
    const xlm = (stroops / STROOPS_PER_XLM).toFixed(4).replace(/\.?0+$/, "");
    return `${xlm} XLM`;
  }
  return "0 XLM";
}

function formatTxDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export interface RecentTransactionsWidgetProps {
  /** Optional transaction array to display; if omitted, fetched via useSorokit */
  transactions?: Transaction[];
  /** Callback fired when user requests to view the full transactions history */
  onViewFullHistory?: () => void;
  /** Maximum number of recent transactions to display (default: 5) */
  limit?: number;
  className?: string;
}

export function RecentTransactionsWidget({
  transactions: propTransactions,
  onViewFullHistory,
  limit = 5,
  className,
}: RecentTransactionsWidgetProps) {
  const sorokit = useSorokit();
  const isConnected = sorokit.isConnected;
  const address = sorokit.address;
  const [internalTxs, setInternalTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (propTransactions !== undefined) {
      queueMicrotask(() => {
        setInternalTxs(propTransactions.slice(0, limit));
      });
      return;
    }

    if (!isConnected || !address) {
      queueMicrotask(() => {
        setInternalTxs([]);
      });
      return;
    }

    let client: SorokitClient;
    try {
      client = sorokit.client;
    } catch {
      return;
    }
    if (!client?.transaction?.getHistory) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });

    client.transaction
      .getHistory(address, 1, limit)
      .then((res) => {
        if (!active) return;
        setInternalTxs(res.data ?? []);
      })
      .catch(() => {
        if (!active) return;
        setInternalTxs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [propTransactions, isConnected, address, sorokit, limit]);

  const txs = propTransactions !== undefined ? propTransactions.slice(0, limit) : internalTxs;

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-4 flex flex-col gap-3",
        className,
      )}
      data-testid="recent-transactions-widget"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Time02Icon}
            size={16}
            color="currentColor"
            strokeWidth={1.5}
            className="text-ink-3"
          />
          <h3 className="text-[14px] font-semibold text-ink">
            Recent Transactions
          </h3>
        </div>
        {onViewFullHistory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewFullHistory}
            data-testid="view-full-history-button"
            className="text-[12px] text-brand hover:text-brand-hover p-0 h-auto"
          >
            <span>View full history</span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
              className="ml-1"
            />
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 py-1" data-testid="recent-tx-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      ) : !isConnected && propTransactions === undefined ? (
        <p className="text-[12px] text-ink-3 text-center py-4">
          Connect your wallet to see recent activity
        </p>
      ) : txs.length === 0 ? (
        <p className="text-[12px] text-ink-3 text-center py-4" data-testid="no-recent-txs">
          No recent transactions found
        </p>
      ) : (
        <div className="divide-y divide-line" data-testid="recent-transactions-list">
          {txs.map((tx) => (
            <div
              key={tx.hash}
              onClick={onViewFullHistory}
              data-testid={`recent-tx-row-${tx.hash}`}
              className={cn(
                "py-2.5 flex items-center justify-between first:pt-0 last:pb-0 transition-colors",
                onViewFullHistory && "cursor-pointer hover:bg-surface-2/50 rounded-lg px-2 -mx-2",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  aria-hidden="true"
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    tx.successful ? "bg-success-dim text-green" : "bg-error-dim text-red",
                  )}
                >
                  <HugeiconsIcon
                    icon={tx.successful ? CheckmarkCircle01Icon : Cancel01Icon}
                    size={14}
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-medium text-ink truncate">
                    {tx.type ?? tx.operationType ?? "Payment"}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-ink-3">
                    <span data-testid="recent-tx-date">
                      {formatTxDate(tx.createdAt)}
                    </span>
                    <span>·</span>
                    <span className="font-mono" title={tx.hash}>
                      {truncateAddress(tx.hash, 6, 4)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className="text-[12px] font-semibold text-ink"
                  data-testid="recent-tx-amount"
                >
                  {formatTxAmount(tx)}
                </span>
                <Badge
                  variant={tx.successful ? "success" : "error"}
                  data-testid="recent-tx-status"
                >
                  {tx.successful ? "Success" : "Failed"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
