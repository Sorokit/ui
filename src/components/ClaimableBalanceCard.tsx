import { useEffect, useState } from "react";
import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { truncateAddress } from "@/lib/utils";
import type { ClaimableBalance } from "@/lib/client";

function BalanceRow({ cb }: { cb: ClaimableBalance }) {
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const rawCode = cb.asset.includes(":") ? cb.asset.split(":")[0] : cb.asset;
  const assetCode = rawCode === "native" ? "XLM" : rawCode;

  async function handleClaim() {
    setClaiming(true);
    setClaimError(null);
    try {
      const { error } = await getClient().account.claimBalance(cb.id);
      if (!error) {
        setClaimed(true);
      } else {
        setClaimError(error);
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-line last:border-0 gap-4">
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">
            {parseFloat(cb.amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4,
            })}
          </span>
          <Badge variant="teal">{assetCode}</Badge>
          {claimed && (
            <Badge variant="success" dot live>
              Claimed
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Sponsor
          </span>
          <span data-address>{truncateAddress(cb.sponsor, 8, 6)}</span>
        </div>
      </div>
      {!claimed && (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Button
            size="sm"
            loading={claiming}
            onClick={handleClaim}
            className="shrink-0"
          >
            Claim
          </Button>
          {claimError && (
            <span className="text-[10px] text-red max-w-[150px] text-right truncate">
              {claimError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ClaimableBalanceCard() {
  const { address, isConnected } = useSorokit();
  const [balances, setBalances] = useState<ClaimableBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    let active = true;
    const timerId = window.setTimeout(() => {
      setLoading(true);
      getClient()
        .account.getClaimableBalances(address)
        .then(({ data, error: err }) => {
          if (!active) return;
          if (err) {
            setError(err);
            return;
          }
          setBalances(data ?? []);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [address]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Claimable Balances
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            Pending balances available to claim
          </p>
        </div>
        {!loading && balances.length > 0 && (
          <Badge variant="warning">{balances.length} pending</Badge>
        )}
      </div>

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view claimable balances
        </p>
      ) : loading ? (
        <div className="px-5 py-5 flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-4 w-28 rounded bg-surface-2 animate-pulse" />
                <div className="h-3 w-36 rounded bg-surface-2 animate-pulse" />
              </div>
              <div className="h-8 w-16 rounded-lg bg-surface-2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-[13px] text-red text-center py-10">{error}</p>
      ) : balances.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          No claimable balances
        </p>
      ) : (
        <div>
          {balances.map((cb) => (
            <BalanceRow key={cb.id} cb={cb} />
          ))}
        </div>
      )}
    </div>
  );
}
