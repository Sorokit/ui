import { memo, useCallback, useMemo, useState } from "react";

import { AssetBadge } from "@/components/AssetBadge";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { AssetRowSkeleton } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import type { Balance } from "@/lib/client";
import { cn, safeFormat } from "@/lib/utils";

type SortMode = "default" | "balance-desc" | "alpha";

function getAssetCode(balance: Balance) {
  return balance.assetType === "native" ? "XLM" : balance.assetCode ?? balance.asset;
}

/**
 * Composite React key for a balance row: `asset` alone collides for two
 * balances with the same code but different issuers (e.g. two USDC
 * balances from different issuers), silently dropping re-renders and
 * mixing up row state (issue #524). `assetIssuer` is undefined for native
 * XLM and for liquidity-pool-share balances, hence the "native" fallback.
 */
export function balanceKey(balance: Balance): string {
  return `${getAssetCode(balance)}-${balance.assetIssuer ?? "native"}`;
}

function compareBalances(a: Balance, b: Balance) {
  const aIsXlm = a.assetType === "native";
  const bIsXlm = b.assetType === "native";
  if (aIsXlm !== bIsXlm) {
    return aIsXlm ? -1 : 1;
  }

  const aZero = Number(a.balance) === 0;
  const bZero = Number(b.balance) === 0;
  if (aZero !== bZero) {
    return aZero ? 1 : -1;
  }

  return getAssetCode(a).localeCompare(getAssetCode(b));
}

function sortBalances(balances: Balance[], mode: SortMode) {
  if (mode === "balance-desc") {
    return [...balances].sort((a, b) => Number(b.balance) - Number(a.balance));
  }
  if (mode === "alpha") {
    return [...balances].sort((a, b) =>
      getAssetCode(a).localeCompare(getAssetCode(b)),
    );
  }
  return [...balances].sort(compareBalances);
}

const sortLabels: Record<SortMode, string> = {
  default: "Default",
  "balance-desc": "Balance",
  alpha: "A-Z",
};

const AssetRow = memo(function AssetRow({
  b,
  onAssetClick,
  detailRef,
  showIssuerSuffix,
}: {
  b: Balance;
  onAssetClick?: (balance: Balance) => void;
  detailRef?: React.RefObject<HTMLElement | null>;
  showIssuerSuffix?: boolean;
}) {
  const isZeroBalance = Number(b.balance) === 0;
  const onClick = useCallback(() => {
    onAssetClick?.(b);
    requestAnimationFrame(() => {
      detailRef?.current?.focus();
    });
  }, [b, detailRef, onAssetClick]);
  const hasClickHandler = Boolean(onAssetClick);

  return (
    <div
      role={hasClickHandler ? "button" : undefined}
      tabIndex={hasClickHandler ? 0 : undefined}
      onClick={hasClickHandler ? onClick : undefined}
      onKeyDown={
        hasClickHandler
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex items-center justify-between px-5 py-4 border-b border-line last:border-0",
        isZeroBalance && "opacity-50",
        hasClickHandler && "cursor-pointer hover:bg-surface-2 transition-colors",
      )}
    >
      <AssetBadge balance={b} showIssuerSuffix={showIssuerSuffix} />
      <div className="flex flex-col items-end gap-0.5">
        <span
          className={cn(
            "text-[14px] font-semibold tabular-nums",
            isZeroBalance ? "text-ink-3" : "text-ink",
          )}
        >
          {safeFormat(b.balance)}
        </span>
        {isZeroBalance && (
          <span className="text-[12px] text-ink-3">No balance</span>
        )}
      </div>
    </div>
  );
});

export interface BalanceListProps {
  onAssetClick?: (balance: Balance) => void;
  detailRef?: React.RefObject<HTMLElement | null>;
  /** When true, renders an approximate XLM-equivalent portfolio total in the header. */
  showTotal?: boolean;
  /** Price of 1 XLM (e.g. in USD). Used alongside `showTotal` to show a USD-equivalent figure. */
  xlmPrice?: number;
}

export function BalanceList({
  onAssetClick,
  detailRef,
  showTotal,
  xlmPrice,
}: BalanceListProps) {
  const { balances, isLoadingAccount, isConnected, network } = useSorokit();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  const isTestnet = network?.name === "testnet";
  const showFriendbot = isTestnet && isConnected && !isLoadingAccount && balances.length === 0;

  const skeletonCount = balances.length > 0 ? balances.length : 3;

  const codeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of balances) {
      const code = getAssetCode(b);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [balances]);

  const filtered = useMemo(
    () =>
      search
        ? balances.filter((b) =>
            getAssetCode(b).toLowerCase().includes(search.toLowerCase()),
          )
        : balances,
    [balances, search],
  );

  const { sorted, sortedLp } = useMemo(() => {
    const regularBalances = filtered.filter(
      (b) => b.assetType !== "liquidity_pool_shares",
    );
    const lpBalances = filtered.filter(
      (b) => b.assetType === "liquidity_pool_shares",
    );
    return {
      sorted: sortBalances(regularBalances, sortMode),
      sortedLp: sortBalances(lpBalances, sortMode),
    };
  }, [filtered, sortMode]);

  // Approximate — only native XLM balances are summed since other assets
  // have no price feed available here.
  const xlmTotal = useMemo(
    () =>
      balances
        .filter((b) => b.assetType === "native")
        .reduce((sum, b) => sum + Number(b.balance), 0),
    [balances],
  );

  const cycleSort = () => {
    setSortMode((m) =>
      m === "default" ? "balance-desc" : m === "balance-desc" ? "alpha" : "default",
    );
  };

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Assets</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Token balances</p>
          {showTotal && isConnected && !isLoadingAccount && (
            <p className="text-[11px] text-ink-3 mt-0.5">
              ~{xlmTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
              {typeof xlmPrice === "number"
                ? ` (~$${(xlmTotal * xlmPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                : ""}
            </p>
          )}
        </div>
        {isConnected && !isLoadingAccount && (
          <div className="flex items-center gap-2">
            <button
              onClick={cycleSort}
              className="text-[11px] text-ink-3 hover:text-ink-2 transition-colors px-2 py-1 rounded-md hover:bg-surface-2"
              title={`Sort: ${sortLabels[sortMode]}`}
            >
              ↕ {sortLabels[sortMode]}
            </button>
            <Badge variant="default">{balances.length} assets</Badge>
          </div>
        )}
      </div>

      {isConnected && !isLoadingAccount && balances.length > 0 && (
        <div className="px-4 py-2 border-b border-line">
          <Input
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[12px]"
          />
        </div>
      )}

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view assets
        </p>
      ) : isLoadingAccount ? (
        <div>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <AssetRowSkeleton key={i} />
          ))}
        </div>
      ) : sorted.length === 0 && sortedLp.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-[13px] text-ink-3">
            {search ? "No matching assets" : "No assets found"}
          </p>
          {showFriendbot && !search && (
            <a
              href="https://friendbot.stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-brand hover:underline"
            >
              Fund with Friendbot →
            </a>
          )}
        </div>
      ) : (
        <div>
          {sorted.length > 0 && (
            <div>
              {sorted.map((b) => (
                <AssetRow
                  key={balanceKey(b)}
                  b={b}
                  showIssuerSuffix={Boolean(
                    b.assetIssuer && (codeCounts.get(getAssetCode(b)) ?? 0) > 1,
                  )}
                  onAssetClick={onAssetClick}
                  detailRef={detailRef}
                />
              ))}
            </div>
          )}
          {sortedLp.length > 0 && (
            <div>
              <div className="px-5 py-2.5 border-b border-t border-line bg-surface-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-3">
                  Liquidity Positions
                </h4>
              </div>
              {sortedLp.map((b) => (
                <AssetRow
                  key={balanceKey(b)}
                  b={b}
                  showIssuerSuffix={Boolean(
                    b.assetIssuer && (codeCounts.get(getAssetCode(b)) ?? 0) > 1,
                  )}
                  onAssetClick={onAssetClick}
                  detailRef={detailRef}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
