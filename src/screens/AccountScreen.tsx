import { Download01Icon,Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import { AccountCard } from "@/components/AccountCard";
import { BalanceList } from "@/components/BalanceList";
import { ClaimableBalanceCard } from "@/components/ClaimableBalanceCard";
import { KeystoreBackup } from "@/components/KeystoreBackup";
import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";
import type { NetworkInfo } from "@/lib/client";

function handleExport(
  address: string,
  account: ReturnType<typeof useSorokit>["account"],
  balances: ReturnType<typeof useSorokit>["balances"],
) {
  const data = {
    address,
    account,
    balances,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `sorokit-account-${address.slice(0, 8)}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Maps a Stellar network to its Stellar Expert account-explorer URL.
 * Returns null for unsupported networks.
 */
function explorerAccountUrl(
  network: NetworkInfo | null,
  address: string | null,
): string | null {
  if (!network || !address) return null;

  const segment =
    network.name === "mainnet"
      ? "public"
      : network.name === "testnet"
        ? "testnet"
        : null;

  if (!segment) return null;

  return `https://stellar.expert/explorer/${segment}/account/${address}`;
}

export function AccountScreen() {
  const {
    isConnected,
    isLoadingAccount,
    refreshAccount,
    address,
    account,
    balances,
    network,
  } = useSorokit();

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!lastRefreshed) return;

    const interval = setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => clearInterval(interval);
  }, [lastRefreshed]);

  const handleRefresh = async () => {
    await refreshAccount();
    const timestamp = new Date();
    setLastRefreshed(timestamp);
    setNow(timestamp);
  };

  const getRelativeTime = (date: Date) => {
    const diffInSeconds = Math.floor(
      (now.getTime() - date.getTime()) / 1000,
    );

    if (diffInSeconds < 60) return "just now";

    const minutes = Math.floor(diffInSeconds / 60);

    if (minutes === 1) return "1 min ago";

    return `${minutes} min ago`;
  };

  const explorerUrl = explorerAccountUrl(network, address);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-[18px] font-semibold text-ink">Account</h2>

      <p className="text-[13px] text-ink-3 -mt-3">
        Balances and account details
      </p>

      {isConnected && (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              loading={isLoadingAccount}
              onClick={handleRefresh}
              aria-label="Refresh account data"
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                size={14}
                strokeWidth={1.5}
              />
              Refresh
            </Button>

            {address && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleExport(address, account, balances)}
                aria-label="Export account data"
                data-testid="account-export-button"
              >
                <HugeiconsIcon
                  icon={Download01Icon}
                  size={14}
                  strokeWidth={1.5}
                />
                Export
              </Button>
            )}

            {explorerUrl && (
              <a
                data-testid="account-explorer-link"
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${address} on Stellar Expert`}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
              >
                Explorer
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>

          {lastRefreshed && (
            <span className="text-[11px] text-ink-3 pr-1">
              Last updated: {getRelativeTime(lastRefreshed)}
            </span>
          )}
        </div>
      )}

      <AccountCard />
      <BalanceList />
      <ClaimableBalanceCard />
      <KeystoreBackup />
    </div>
  );
}