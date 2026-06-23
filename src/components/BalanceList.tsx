import { useSorokit } from "@/context/useSorokit";
import { Badge } from "@/components/ui/Badge";
import { AssetBadge } from "@/components/AssetBadge";
import { SkeletonRow } from "@/components/ui/Skeleton";
import type { Balance } from "@/lib/client";

function AssetRow({ b }: { b: Balance }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-line last:border-0">
      <AssetBadge balance={b} />
      <span className="text-[14px] font-semibold text-ink tabular-nums">
        {parseFloat(b.balance).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })}
      </span>
    </div>
  );
}

export function BalanceList() {
  const { balances, isLoadingAccount, isConnected } = useSorokit();

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Assets</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Token balances</p>
        </div>
        {isConnected && !isLoadingAccount && (
          <Badge variant="default">{balances.length} assets</Badge>
        )}
      </div>

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view assets
        </p>
      ) : isLoadingAccount ? (
        <div className="px-5 py-5 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : balances.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          No assets found
        </p>
      ) : (
        <div>
          {balances.map((b) => (
            <AssetRow key={b.asset} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}
