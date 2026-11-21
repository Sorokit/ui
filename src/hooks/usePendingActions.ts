import { useCallback, useEffect, useState } from "react";

import { type NavSection } from "@/components/Sidebar";
import { loadScheduledTransactions } from "@/components/TransactionPanel";
import { useSorokit } from "@/context/useSorokit";

export interface PendingActionItem {
  id: string;
  type:
    | "claimable_balance"
    | "pending_swap"
    | "scheduled_tx"
    | "staking_reward"
    | "price_alert"
    | "custom";
  title: string;
  description: string;
  count?: number;
  targetScreen: NavSection;
  timestamp?: number;
}

const CUSTOM_PENDING_STORAGE_KEY = "sorokit:pending-actions";

export function loadStoredPendingActions(): PendingActionItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PENDING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredPendingActions(items: PendingActionItem[]): void {
  try {
    localStorage.setItem(CUSTOM_PENDING_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable
  }
}

export function usePendingActions(initialCustomActions?: PendingActionItem[]) {
  const { address, client, isConnected } = useSorokit();
  const [actions, setActions] = useState<PendingActionItem[]>(() => [
    ...(initialCustomActions ?? []),
    ...loadStoredPendingActions(),
  ]);
  const [claimableCount, setClaimableCount] = useState(0);

  const refreshPendingActions = useCallback(async () => {
    const collected: PendingActionItem[] = [...loadStoredPendingActions()];

    // 1. Scheduled transactions from localStorage
    const scheduled = loadScheduledTransactions();
    const pendingScheduled = scheduled.filter((t) => t.status === "pending");
    if (pendingScheduled.length > 0) {
      collected.push({
        id: "scheduled-txs",
        type: "scheduled_tx",
        title: "Scheduled Payments",
        description: `${pendingScheduled.length} payment(s) waiting for scheduled send time`,
        count: pendingScheduled.length,
        targetScreen: "transactions",
      });
    }

    // 2. Claimable balances from client if connected
    if (isConnected && address && client?.account?.getClaimableBalances) {
      try {
        const res = await client.account.getClaimableBalances(address);
        const balances = res?.data ?? [];
        setClaimableCount(balances.length);
        if (balances.length > 0) {
          collected.push({
            id: "claimable-balances",
            type: "claimable_balance",
            title: "Claimable Balances",
            description: `${balances.length} claimable balance(s) available to claim`,
            count: balances.length,
            targetScreen: "account",
          });
        }
      } catch {
        // Soft fail
      }
    }

    // 3. Staking rewards / pending actions
    try {
      const rawPriceAlerts = localStorage.getItem("sorokit:price-alert-history");
      if (rawPriceAlerts) {
        const history = JSON.parse(rawPriceAlerts);
        const recentAlerts = history.slice(-3);
        if (recentAlerts.length > 0) {
          collected.push({
            id: "price-alert-recent",
            type: "price_alert",
            title: "Price Alert Triggered",
            description: `${recentAlerts[recentAlerts.length - 1].asset} crossed threshold`,
            count: recentAlerts.length,
            targetScreen: "charts",
          });
        }
      }
    } catch {
      // ignore
    }

    if (initialCustomActions) {
      for (const custom of initialCustomActions) {
        if (!collected.some((a) => a.id === custom.id)) {
          collected.push(custom);
        }
      }
    }

    setActions(collected);
  }, [isConnected, address, client, initialCustomActions]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshPendingActions();
    });

    const handleUpdate = () => {
      void refreshPendingActions();
    };

    window.addEventListener("sorokit:scheduled-tx-updated", handleUpdate);
    window.addEventListener("sorokit:pending-actions-updated", handleUpdate);
    window.addEventListener("sorokit:price-alert-triggered", handleUpdate);

    return () => {
      window.removeEventListener("sorokit:scheduled-tx-updated", handleUpdate);
      window.removeEventListener("sorokit:pending-actions-updated", handleUpdate);
      window.removeEventListener("sorokit:price-alert-triggered", handleUpdate);
    };
  }, [refreshPendingActions]);

  const addPendingAction = useCallback(
    (item: PendingActionItem) => {
      const current = loadStoredPendingActions();
      const updated = [item, ...current.filter((a) => a.id !== item.id)];
      saveStoredPendingActions(updated);
      setActions((prev) => [item, ...prev.filter((a) => a.id !== item.id)]);
      window.dispatchEvent(new CustomEvent("sorokit:pending-actions-updated"));
    },
    [],
  );

  const clearPendingAction = useCallback(
    (id: string) => {
      const current = loadStoredPendingActions();
      const updated = current.filter((a) => a.id !== id);
      saveStoredPendingActions(updated);
      setActions((prev) => prev.filter((a) => a.id !== id));
      window.dispatchEvent(new CustomEvent("sorokit:pending-actions-updated"));
    },
    [],
  );

  return {
    pendingActions: actions,
    pendingCount: actions.length,
    claimableCount,
    refreshPendingActions,
    addPendingAction,
    clearPendingAction,
  };
}
