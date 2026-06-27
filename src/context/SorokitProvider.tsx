import { useCallback, useEffect, useMemo,useState } from "react";

import type { AccountData, Balance, NetworkInfo, NetworkName } from "@/lib/client";

import {
  SorokitContext,
  type SorokitProviderProps,
} from "./sorokit-context";

export function SorokitProvider({ client, children }: SorokitProviderProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load network on mount
  useEffect(() => {
    let active = true;

    const timerId = window.setTimeout(() => {
      client.network.getNetwork().then(({ data, error: nextError }) => {
        if (!active) return;
        if (data) setNetwork(data);
        if (nextError) setError(nextError);
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [client]);

  // Load account when address changes or refresh is triggered
  useEffect(() => {
    if (!address) return;

    let active = true;
    const timerId = window.setTimeout(() => {
      setIsLoadingAccount(true);
      Promise.all([
        client.account.getAccount(address),
        client.account.getBalances(address),
      ])
        .then(([accountRes, balancesRes]) => {
          if (!active) return;
          if (accountRes.data) setAccount(accountRes.data);
          if (accountRes.error) setError(accountRes.error);
          if (balancesRes.data) setBalances(balancesRes.data);
          if (balancesRes.error) setError(balancesRes.error);
        })
        .finally(() => {
          if (active) setIsLoadingAccount(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [address, client, refreshTick]);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { data, error } = await client.wallet.connect();
      if (error) {
        setError(error);
        return;
      }
      if (data?.address) setAddress(data.address);
    } finally {
      setIsConnecting(false);
    }
  }, [client]);

  const disconnectWallet = useCallback(async () => {
    await client.wallet.disconnect();
    setAddress(null);
    setAccount(null);
    setBalances([]);
  }, [client]);

  const switchNetwork = useCallback(
    async (name: NetworkName) => {
      const { data, error } = await client.network.switchNetwork(name);
      if (error) {
        setError(error);
        return;
      }
      if (data) {
        setNetwork(data);
        setAddress(null);
        setAccount(null);
        setBalances([]);
      }
    },
    [client],
  );

  const clearError = useCallback(() => setError(null), []);

  const refreshAccount = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  const value = useMemo(
    () => ({
      address,
      isConnected: !!address,
      isConnecting,
      connectWallet,
      disconnectWallet,
      account,
      balances,
      isLoadingAccount,
      refreshAccount,
      network,
      switchNetwork,
      error,
      clearError,
    }),
    [
      address,
      isConnecting,
      connectWallet,
      disconnectWallet,
      account,
      balances,
      isLoadingAccount,
      refreshAccount,
      network,
      switchNetwork,
      error,
      clearError,
    ],
  );

  return (
    <SorokitContext.Provider value={value}>
      {children}
    </SorokitContext.Provider>
  );
}
