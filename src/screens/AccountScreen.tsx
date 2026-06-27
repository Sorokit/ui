import { Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AccountCard } from "@/components/AccountCard";
import { BalanceList } from "@/components/BalanceList";
import { ClaimableBalanceCard } from "@/components/ClaimableBalanceCard";
import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";

export function AccountScreen() {
  const { isConnected, isLoadingAccount, refreshAccount } = useSorokit();

  return (
    <div className="flex flex-col gap-5">
      {isConnected && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            loading={isLoadingAccount}
            onClick={refreshAccount}
            aria-label="Refresh account data"
          >
            <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={1.5} />
            Refresh
          </Button>
        </div>
      )}
      <AccountCard />
      <BalanceList />
      <ClaimableBalanceCard />
    </div>
  );
}
