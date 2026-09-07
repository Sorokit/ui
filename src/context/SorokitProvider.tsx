import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AccountData,
  Balance,
  NetworkInfo,
  NetworkName,
} from "@/lib/client";
import { initClient } from "@/lib/client";

import { SorokitContext, type SorokitProviderProps } from "./SorokitContext";

const STORAGE_KEY_NETWORK = "sorokit_network";
const STORAGE_KEY_CUSTOM_NETWORKS = "sorokit_custom_networks";

export function SorokitProvider({
  client,
  onError,
  onNetworkChange,
  createClientForNetwork,
  children,
}: SorokitProviderProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [initialNetwork, setInitialNetwork] = useState<NetworkInfo | null>(null);
  const [customNetworks, setCustomNetworks] = useState<NetworkInfo[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_CUSTOM_NETWORKS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorSeverity, setErrorSeverity] = useState<"info" | "error">("error");
  const [errorHistory, setErrorHistory] = useState<string[]>([]);

  const error = accountError ?? networkError ?? walletError ?? null;

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // #353 — connectWallet/disconnectWallet/switchNetwork/refreshAccount read
  // the client through this ref instead of closing over the `client` prop
  // directly, so their identities stay stable even when a parent passes a
  // new `client` object reference on every render.
  const clientRef = useRef(client);
  useEffect(() => {
    clientRef.current = client;
    // Keep the module singleton pointed at the client the provider is using,
    // so components that reach for `getClient()` share this one.
    initClient(client);
  }, [client]);

  const onNetworkChangeRef = useRef(onNetworkChange);
  useEffect(() => {
    onNetworkChangeRef.current = onNetworkChange;
  }, [onNetworkChange]);

  const createClientForNetworkRef = useRef(createClientForNetwork);
  useEffect(() => {
    createClientForNetworkRef.current = createClientForNetwork;
  }, [createClientForNetwork]);

  // #353 — guards refreshAccount against overlapping calls (e.g. a user
  // clicking "Refresh" again before the previous request settles), so a
  // slower earlier response can't land after a newer one and show stale data.
  const isRefreshingRef = useRef(false);

  const reportError = useCallback(
    (err: string, source: string, severity: "info" | "error" = "error") => {
      if (source === "account") {
        setAccountError(err);
      } else if (source === "network") {
        setNetworkError(err);
      } else if (source === "wallet") {
        setWalletError(err);
      } else {
        setAccountError(err);
      }
      setErrorSeverity(severity);
      setErrorHistory((prev) => [...prev, err]);
      onErrorRef.current?.(err, source);
    },
    [],
  );

  // Load network on mount with localStorage persistence restore
  useEffect(() => {
    let active = true;

    const timerId = window.setTimeout(() => {
      let savedNet: string | NetworkInfo | null = null;
      try {
        const item = window.localStorage.getItem(STORAGE_KEY_NETWORK);
        if (item) {
          try {
            savedNet = JSON.parse(item);
          } catch {
            savedNet = item as NetworkName;
          }
        }
      } catch {
        savedNet = null;
      }

      // Read the client's own network first so the network it was initialised
      // with is known even when a persisted preference overrides it. Both
      // pieces of state are committed together at the end so restoring a
      // preference costs no extra render.
      void (async () => {
        const { data: clientNet, error: clientError } =
          await client.network.getNetwork();

        let restored: NetworkInfo | null = null;
        let restoreError: string | null = null;
        if (savedNet) {
          const { data, error: nextError } =
            await client.network.switchNetwork(savedNet);
          restored = data;
          restoreError = nextError;
        }

        if (!active) return;
        if (clientNet) setInitialNetwork(clientNet);
        const resolved = restored ?? clientNet;
        if (resolved) setNetwork(resolved);

        const nextError = restoreError ?? clientError;
        if (nextError) reportError(nextError, "network", "info");
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [client, reportError]);

  // Load account when address changes
  useEffect(() => {
    if (!address) {
      setAccount(null);
      setBalances([]);
      return;
    }
    setAccountError(null);

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
          if (balancesRes.data) setBalances(balancesRes.data);
          const combined = [accountRes.error, balancesRes.error]
            .filter(Boolean)
            .join("; ");
          if (combined) setAccountError(combined);
          if (accountRes.error && balancesRes.error) {
            reportError(
              `${accountRes.error}; ${balancesRes.error}`,
              "account",
              "error",
            );
          } else if (accountRes.error) {
            reportError(accountRes.error, "account", "error");
          } else if (balancesRes.error) {
            reportError(balancesRes.error, "account", "error");
          }
        })
        .finally(() => {
          if (active) setIsLoadingAccount(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [address, client, reportError]);

  function detectWalletName(): string | null {
    if (typeof window === "undefined") return null;
    const win = window as unknown as Record<string, unknown>;
    if (win.freighter) return "Freighter";
    if (win.xBull) return "xBull";
    if (win.albedo) return "Albedo";
    if (win.lobstr) return "Lobstr";
    return null;
  }

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setWalletError(null);
    setAccountError(null);
    setNetworkError(null);
    try {
      const name = detectWalletName();
      setWalletName(name);
      const { data, error } = await clientRef.current.wallet.connect();
      if (error) {
        reportError(error, "wallet", "error");
        return;
      }
      if (data?.address) {
        setAddress(data.address);
        setWalletError(null);
      } else {
        // #353 — data and error both empty (e.g. the user dismissed the
        // wallet dialog without picking one) previously left the UI stuck:
        // loading ends, but nothing tells the user why nothing happened.
        reportError(
          "Connection was cancelled or no wallet was selected.",
          "wallet",
          "info",
        );
      }
    } finally {
      setIsConnecting(false);
    }
  }, [reportError]);

  const disconnectWallet = useCallback(async () => {
    setIsDisconnecting(true);
    try {
      // A wallet adapter that throws (e.g. the extension went away
      // mid-session) used to surface as an unhandled rejection. Capture it and
      // still tear the session down — the user asked to disconnect.
      let disconnectError: string | null = null;
      try {
        await clientRef.current.wallet.disconnect();
      } catch (e) {
        disconnectError =
          e instanceof Error ? e.message : "Failed to disconnect wallet.";
      }

      setAddress(null);
      setWalletName(null);
      setAccount(null);
      setBalances([]);
      setAccountError(null);
      setNetworkError(null);
      setWalletError(null);
      // #353 — a fresh session shouldn't carry over error history from
      // whatever the previous wallet connection ran into.
      setErrorHistory([]);

      // Reported after the reset so the failure isn't cleared along with it.
      if (disconnectError) reportError(disconnectError, "wallet", "error");
    } finally {
      setIsDisconnecting(false);
    }
  }, [reportError]);

  const switchNetwork = useCallback(
    async (param: NetworkName | NetworkInfo) => {
      const { data, error } = await clientRef.current.network.switchNetwork(param);
      if (error) {
        reportError(error, "network", "error");
        return;
      }
      if (data) {
        setNetworkError(null);
        setNetwork(data);

        // Re-point the `getClient()` singleton at the new network. Without
        // this, callers like `getClient().transaction.submit()` keep hitting
        // the previous network's endpoints after a switch.
        const nextClient = createClientForNetworkRef.current?.(data);
        if (nextClient) {
          clientRef.current = nextClient;
          initClient(nextClient);
        } else {
          initClient(clientRef.current);
        }

        try {
          window.localStorage.setItem(
            STORAGE_KEY_NETWORK,
            typeof param === "string" ? param : JSON.stringify(data),
          );
        } catch {
          /* fallback */
        }
        setAddress(null);
        setAccount(null);
        setBalances([]);

        onNetworkChangeRef.current?.(data);
      }
    },
    [reportError],
  );

  const addCustomNetwork = useCallback(
    async (config: NetworkInfo) => {
      setCustomNetworks((prev) => {
        const next = [...prev.filter((n) => n.name !== config.name), config];
        try {
          window.localStorage.setItem(
            STORAGE_KEY_CUSTOM_NETWORKS,
            JSON.stringify(next),
          );
        } catch {
          /* fallback */
        }
        return next;
      });
      await switchNetwork(config);
    },
    [switchNetwork],
  );

  const clearError = useCallback(() => {
    setAccountError(null);
    setNetworkError(null);
    setWalletError(null);
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!address || isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsLoadingAccount(true);
    try {
      const [accountRes, balancesRes] = await Promise.all([
        clientRef.current.account.getAccount(address),
        clientRef.current.account.getBalances(address),
      ]);
      if (accountRes.data) setAccount(accountRes.data);
      if (balancesRes.data) setBalances(balancesRes.data);
      if (accountRes.error && balancesRes.error) {
        reportError(
          `${accountRes.error}; ${balancesRes.error}`,
          "account",
          "error",
        );
      } else if (accountRes.error) {
        reportError(accountRes.error, "account", "error");
      } else if (balancesRes.error) {
        reportError(balancesRes.error, "account", "error");
      }
    } finally {
      setIsLoadingAccount(false);
      isRefreshingRef.current = false;
    }
  }, [address, reportError]);

  const value = useMemo(
    () => ({
      client,
      address,
      walletName,
      isConnected: !!address,
      isConnecting,
      isLoading: isConnecting || isLoadingAccount,
      isDisconnecting,
      connectWallet,
      disconnectWallet,
      account,
      balances,
      isLoadingAccount,
      refreshAccount,
      network,
      initialNetwork,
      switchNetwork,
      customNetworks,
      addCustomNetwork,
      error,
      accountError,
      networkError,
      walletError,
      errorSeverity,
      errorHistory,
      clearError,
    }),
    [
      client,
      address,
      walletName,
      isConnecting,
      isDisconnecting,
      isLoadingAccount,
      connectWallet,
      disconnectWallet,
      account,
      balances,
      refreshAccount,
      network,
      initialNetwork,
      switchNetwork,
      customNetworks,
      addCustomNetwork,
      error,
      accountError,
      networkError,
      walletError,
      errorSeverity,
      errorHistory,
      clearError,
    ],
  );

  return (
    <SorokitContext.Provider value={value}>{children}</SorokitContext.Provider>
  );
}
