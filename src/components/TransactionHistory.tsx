import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";
import type { Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";
import { truncateAddress } from "@/lib/utils";

const PAGE_SIZE = 10;

function TxRow({ tx }: { tx: Transaction }) {
  const date = new Date(tx.createdAt);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-line last:border-0 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {/* Status icon */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${tx.successful ? "bg-success-dim" : "bg-error-dim"}`}
        >
          <HugeiconsIcon
            icon={tx.successful ? CheckmarkCircle01Icon : Cancel01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className={tx.successful ? "text-green" : "text-red"}
          />
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span data-txhash className="truncate">
            {truncateAddress(tx.hash, 10, 6)}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-3">Ledger {tx.ledger}</span>
            {tx.memo && (
              <span className="text-[10px] text-ink-3">· {tx.memo}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <Badge variant={tx.successful ? "success" : "error"} live>
          {tx.successful ? "Success" : "Failed"}
        </Badge>
        <span className="text-[10px] text-ink-3">
          {dateStr} {timeStr}
        </span>
      </div>
    </div>
  );
}

export function TransactionHistory() {
  const { address, isConnected } = useSorokit();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    let active = true;
    const timerId = window.setTimeout(() => {
      setLoading(true);
      getClient()
        .transaction.getHistory(address, page, PAGE_SIZE)
        .then(({ data, error: err, total: t }) => {
          if (!active) return;
          if (err) {
            setError(err);
            return;
          }
          setTxs(data ?? []);
          setTotal(t);
          setError(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [address, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Transaction History
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {total > 0 ? `${total} transactions` : "Past transactions"}
          </p>
        </div>
        {loading && (
          <span className="w-4 h-4 border border-ink-3 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view history
        </p>
      ) : error ? (
        <p className="text-[13px] text-red text-center py-10">{error}</p>
      ) : loading && txs.length === 0 ? (
        <div className="px-5 py-4 flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-surface-2 animate-pulse shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 w-32 rounded bg-surface-2 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-surface-2 animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-surface-2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : txs.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          No transactions found
        </p>
      ) : (
        <>
          <div>
            {txs.map((tx) => (
              <TxRow key={tx.hash} tx={tx} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-line">
              <span className="text-[11px] text-ink-3">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px] sm:min-h-0"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={2}
                  />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px] sm:min-h-0"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={2}
                  />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
