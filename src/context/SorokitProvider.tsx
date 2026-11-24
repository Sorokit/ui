import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type {
  AccountData,
  Balance,
  NetworkInfo,
  NetworkName,
  SorokitClient,
} from "@/lib/client";
import { initClient } from "@/lib/client";
import { readSnapshot, writeSnapshot } from "@/lib/offline-cache";

import { SorokitContext, type SorokitProviderProps } from "./SorokitContext";

const STORAGE_KEY_NETWORK = "sorokit_network";
const STORAGE_KEY_CUSTOM_NETWORKS = "sorokit_custom_networks";

export const BUILTIN_NETWORKS: NetworkName[] = [
  "mainnet",
  "testnet",
  "futurenet",
  "localnet",
  "custom",
];

/**
 * Wallet-extension globals, keyed by the id we report to consumers. Outer
 * arrays carry aliases because extensions don't agree on casing (xBull vs
 * xbull, freighter vs isFreighter).
 */
const WALLET_GLOBAL_KEYS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["freighter", ["freighter", "isFreighter"]],
  ["xbull", ["xbull", "xBull"]],
  ["albedo", ["albedo"]],
  ["lobstr", ["lobstr"]],
];

/**
 * #954 — snapshot which supported wallet extensions have injected their
 * globals. Extensions commonly inject a few milliseconds *after* DOM load,
 * so this is called repeatedly (on mount, on the `stellar#initialized`
 * event, and on a short poll) rather than once.
 */
function detectInjectedWallets(): string[] {
  if (typeof window === "undefined") return [];
  const win = window as unknown as Record<string, unknown>;
  return WALLET_GLOBAL_KEYS.filter(([, keys]) =>
    keys.some((key) => Boolean(win[key])),
  ).map(([id]) => id);
}

export function SorokitProvider({
  client,
  onError,
  onNetworkChange,
  createClientForNetwork,
  children,
}: SorokitProviderProps) {
  const [prevClientProp, setPrevClientProp] = useState(client);
  const [currentClient, setCurrentClient] = useState<SorokitClient>(client);

  if (client !== prevClientProp) {
    setPrevClientProp(client);
    setCurrentClient(client);
  }

  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isHardware, setIsHardware] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [initialNetwork, setInitialNetwork] = useState<NetworkInfo | null>(null);
  const [customNetworks, setCustomNetworks] = useState<NetworkInfo[]>(() => {
    // #724 — guard against SSR/Node.js where `window` is undefined. The
    // try/catch below only covers SecurityError from localStorage access,
    // not the ReferenceError thrown when `window` itself doesn't exist.
    if (typeof window === "undefined") return [];
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
  // #954 — ids of wallet extensions currently detected on `window`. Seeded
  // synchronously so an extension injected before mount is visible on the
  // first render, then updated as late injections land.
  const [detectedWallets, setDetectedWallets] = useState<string[]>(() =>
    detectInjectedWallets(),
  );

  // #1163 - offline mode. `isCached` is true while the account/balances on
  // screen came from the local snapshot rather than a live response.
  const isOnline = useOnlineStatus();
  const [isCached, setIsCached] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const networkKeyRef = useRef<string | null>(null);
  useEffect(() => {
    networkKeyRef.current = network?.name ?? null;
  }, [network]);

  const error = accountError ?? networkError ?? walletError ?? null;

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // #954 — detect wallet extensions that inject after mount. Some announce
  // readiness with `stellar#initialized`; others just assign their global a
  // few frames later, so also poll briefly before giving up.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      const next = detectInjectedWallets();
      setDetectedWallets((prev) =>
        prev.length === next.length && prev.every((w, i) => w === next[i])
          ? prev
          : next,
      );
    };

    refresh();
    window.addEventListener("stellar#initialized", refresh);
    window.addEventListener("stellar:initialized", refresh);

    let attempts = 0;
    const maxAttempts = 10;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      refresh();
      if (attempts >= maxAttempts) window.clearInterval(intervalId);
    }, 200);

    return () => {
      cancelled = true;
      window.removeEventListener("stellar#initialized", refresh);
      window.removeEventListener("stellar:initialized", refresh);
      window.clearInterval(intervalId);
    };
  }, []);

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

  // #954 — cancels the in-flight account/balance query. The client API has no
  // AbortSignal parameter, so the controller is used as the provider's own
  // cancellation flag; what matters is that a superseded query (a rapid network
  // switch, a disconnect, a new address) has its rejection checked and
  // swallowed instead of surfacing as an unhandled promise rejection.
  const accountRequestRef = useRef<AbortController | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      accountRequestRef.current?.abort();
      accountRequestRef.current = null;
    };
  }, []);

  // #537 — a single source of truth for "a network switch is in flight".
  // `NetworkScreen` and `NetworkSwitcher` both read this through the context,
  // so controls on one surface disable while the other surface started a
  // switch. The ref additionally hard-blocks overlapping calls inside the
  // provider itself: a second `switchNetwork` while one is pending resolves
  // immediately instead of racing the first to `setNetwork`.
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const isSwitchingNetworkRef = useRef(false);

  const reportError = useCallback(
    (err: string, source: string, severity: "info" | "error" = "error") => {
      if (source === "account") {
        setAccountError(err);
      } else if (source === "network") {
        setNetworkError(err);
      } else if (source === "wallet") {
        setWalletError(err);
      } else {
        console.warn(
          `SorokitProvider: unknown error source "${source}"; defaulting to account error.`,
          err,
        );
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
      // #724 — `window` may be undefined in SSR/non-browser environments;
      // skip the localStorage restore when there's no browser storage.
      if (typeof window !== "undefined") {
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

  // #1163 - applies an account/balance response pair. Fresh data is shown and
  // written to the offline cache; for any half that failed, the last cached
  // copy is used instead. Returns true when cached data filled a gap.
  const applyAccountResults = useCallback(
    (
      addr: string,
      accountRes: { data: AccountData | null; error: string | null },
      balancesRes: { data: Balance[] | null; error: string | null },
    ): boolean => {
      const key = networkKeyRef.current;
      const cached = readSnapshot(key, addr);
      let usedCache = false;

      if (accountRes.data) {
        setAccount(accountRes.data);
      } else if (accountRes.error && cached?.account) {
        setAccount(cached.account);
        usedCache = true;
      }
      if (balancesRes.data) {
        setBalances(balancesRes.data);
      } else if (balancesRes.error && cached?.balances) {
        setBalances(cached.balances);
        usedCache = true;
      }

      if (accountRes.data || balancesRes.data) {
        writeSnapshot(key, addr, {
          ...(accountRes.data ? { account: accountRes.data } : {}),
          ...(balancesRes.data ? { balances: balancesRes.data } : {}),
        });
      }

      setIsCached(usedCache);
      setLastSyncedAt(usedCache ? (cached?.cachedAt ?? null) : Date.now());
      return usedCache;
    },
    [],
  );

  // Load account when address changes
  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccount(null);
      setBalances([]);
      return;
    }
    setAccountError(null);

    let active = true;
    // Supersede any query already in flight (address change, client change,
    // rapid network switching) before starting a new one.
    accountRequestRef.current?.abort();
    const controller = new AbortController();
    accountRequestRef.current = controller;

    const timerId = window.setTimeout(() => {
      if (!active || controller.signal.aborted) return;
      setIsLoadingAccount(true);
      Promise.all([
        client.account.getAccount(address),
        client.account.getBalances(address),
      ])
        .then(([accountRes, balancesRes]) => {
          if (!active || controller.signal.aborted) return;
          const usedCache = applyAccountResults(address, accountRes, balancesRes);
          const combined = [accountRes.error, balancesRes.error]
            .filter(Boolean)
            .join("; ");
          if (combined) setAccountError(combined);
          const severity = usedCache ? "info" : "error";
          if (accountRes.error && balancesRes.error) {
            reportError(
              `${accountRes.error}; ${balancesRes.error}`,
              "account",
              severity,
            );
          } else if (accountRes.error) {
            reportError(accountRes.error, "account", severity);
          } else if (balancesRes.error) {
            reportError(balancesRes.error, "account", severity);
          }
        })
        .catch((e) => {
          // A rejected request from a query that has since been superseded is
          // expected (e.g. a network switch aborted it); only a rejection for
          // the *current* query is a real error worth surfacing.
          if (!active || controller.signal.aborted) return;
          const message =
            e instanceof Error ? e.message : "Failed to load account data";
          // #1163 - a rejected request (typically a dropped connection) falls
          // back to the last-known snapshot when there is one.
          const usedCache = applyAccountResults(
            address,
            { data: null, error: message },
            { data: null, error: message },
          );
          setAccountError(message);
          reportError(message, "account", usedCache ? "info" : "error");
        })
        .finally(() => {
          if (active && !controller.signal.aborted) setIsLoadingAccount(false);
        });
    }, 0);

    return () => {
      active = false;
      controller.abort();
      if (accountRequestRef.current === controller) {
        accountRequestRef.current = null;
      }
      window.clearTimeout(timerId);
    };
  }, [address, client, reportError, applyAccountResults]);

  function detectWalletName(): string | null {
    if (typeof window === "undefined") return null;
    const win = window as unknown as Record<string, unknown>;
    if (win.freighter) return "Freighter";
    if (win.xBull) return "xBull";
    if (win.albedo) return "Albedo";
    if (win.lobstr) return "Lobstr";
    return null;
  }

  // #845 — hardware detection lives here, once, instead of being re-derived from
  // `walletName` inside each consumer. The provider already knows the wallet
  // name at connect time, so it is the only place that can answer this.
  //
  // Matched against the name rather than an injected flag because the client
  // adapter's `connect()` resolves to just an address (`SorokitClient.wallet.
  // connect` in src/lib/client.ts) and surfaces no wallet metadata, and
  // `detectWalletName()` only ever returns the four known extension names.
  // Substring matching is therefore the only signal actually available here; the
  // win is that it is now defined once and every consumer agrees on the answer.
  function detectIsHardware(walletName: string | null): boolean {
    if (!walletName) return false;
    const name = walletName.toLowerCase();
    return (
      name.includes("ledger") ||
      name.includes("hardware") ||
      name.includes("webusb")
    );
  }

  const clearError = useCallback(() => {
    setAccountError(null);
    setNetworkError(null);
    setWalletError(null);
  }, []);

  const connectWallet = useCallback(async () => {
    clearError();
    setIsConnecting(true);
    try {
      const name = detectWalletName();
      setWalletName(name);
      // #845 — set alongside walletName so the two can't disagree.
      setIsHardware(detectIsHardware(name));
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
    } catch (e) {
      // The extension itself can throw/reject (e.g. the user rejected the
      // popup, or injection failed) instead of resolving with `{ error }`.
      // Without this, isConnecting still clears in `finally` below but
      // nothing sets `error`, leaving callers like WalletConnectModal with
      // neither an address nor an error to transition out of "connecting".
      reportError(
        e instanceof Error ? e.message : "Failed to connect wallet.",
        "wallet",
        "error",
      );
    } finally {
      setIsConnecting(false);
    }
  }, [clearError, reportError]);

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
      // #845 — a disconnected session has no wallet, so the hardware flag goes
      // with it rather than outliving the name it was derived from.
      setIsHardware(false);
      setAccount(null);
      setBalances([]);
      setIsCached(false);
      setLastSyncedAt(null);
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

  // #715, #847 — registry of polling cancel callbacks. Each polling component
  // (FeeEstimator, ContractEventFeed, TransactionStatusTracker, GasOptimizer)
  // registers its cancel on mount and deregisters on unmount.
  const watchersRef = useRef<Set<() => void>>(new Set());

  const registerWatcher = useCallback((cancel: () => void): () => void => {
    watchersRef.current.add(cancel);
    return () => {
      watchersRef.current.delete(cancel);
    };
  }, []);

  const resetTransactionWatchers = useCallback(() => {
    for (const cancel of watchersRef.current) {
      try {
        cancel();
      } catch (err) {
        console.error("Error executing watcher cancel callback:", err);
      }
    }
  }, []);

  const switchNetwork = useCallback(
    async (param: NetworkName | NetworkInfo) => {
      // #537 — reject overlapping switches. The last-response-wins race
      // between concurrent `switchNetwork` calls could leave the UI showing
      // one network while the active RPC connection pointed at another.
      if (isSwitchingNetworkRef.current) return;
      isSwitchingNetworkRef.current = true;
      setIsSwitchingNetwork(true);

      try {
      // #954 — cancel any in-flight account/balance query before the switch
      // builds a new client, so the old network's responses can't land on the
      // new one (and their rejections don't surface as unhandled).
      accountRequestRef.current?.abort();
      accountRequestRef.current = null;
      resetTransactionWatchers();
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
          setCurrentClient(nextClient);
          initClient(nextClient);
        } else {
          setCurrentClient(clientRef.current);
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
        setIsCached(false);
        setLastSyncedAt(null);

        onNetworkChangeRef.current?.(data);
      }
      } finally {
        isSwitchingNetworkRef.current = false;
        setIsSwitchingNetwork(false);
      }
    },
    [reportError, resetTransactionWatchers],
  );

  const addCustomNetwork = useCallback(
    async (config: NetworkInfo) => {
      const isBuiltin = BUILTIN_NETWORKS.some(
        (b) => b.toLowerCase() === config.name.trim().toLowerCase(),
      );
      if (isBuiltin) {
        const msg = `Cannot add custom network with built-in name "${config.name}".`;
        reportError(msg, "network", "error");
        throw new Error(msg);
      }
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
    [reportError, switchNetwork],
  );

  const clearCustomNetworks = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY_CUSTOM_NETWORKS);
    setCustomNetworks([]);
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!address || isRefreshingRef.current || !isMountedRef.current) return;
    isRefreshingRef.current = true;
    setIsLoadingAccount(true);

    // Supersede the previous query and register this one so a network switch
    // (which aborts `accountRequestRef`) cancels it cleanly.
    accountRequestRef.current?.abort();
    const controller = new AbortController();
    accountRequestRef.current = controller;

    try {
      const [accountRes, balancesRes] = await Promise.all([
        clientRef.current.account.getAccount(address),
        clientRef.current.account.getBalances(address),
      ]);
      if (controller.signal.aborted) return;
      const usedCache = applyAccountResults(address, accountRes, balancesRes);
      const severity = usedCache ? "info" : "error";
      if (controller.signal.aborted || !isMountedRef.current) return;
      if (accountRes.data) setAccount(accountRes.data);
      if (balancesRes.data) setBalances(balancesRes.data);

      if (accountRes.error && balancesRes.error) {
        reportError(
          `${accountRes.error}; ${balancesRes.error}`,
          "account",
          severity,
        );
      } else if (accountRes.error) {
        reportError(accountRes.error, "account", severity);
      } else if (balancesRes.error) {
        reportError(balancesRes.error, "account", severity);
      }
    } catch (e) {
      // Swallow a rejection for a query that has been superseded (e.g. the
      // network switched mid-refresh); surface only genuine failures.
      if (controller.signal.aborted || !isMountedRef.current) return;
      const message =
        e instanceof Error ? e.message : "Failed to refresh account data";
      const usedCache = applyAccountResults(
        address,
        { data: null, error: message },
        { data: null, error: message },
      );
      reportError(message, "account", usedCache ? "info" : "error");
    } finally {
      if (accountRequestRef.current === controller) {
        accountRequestRef.current = null;
      }
      if (isMountedRef.current && !controller.signal.aborted) {
        setIsLoadingAccount(false);
      }
      isRefreshingRef.current = false;
    }
  }, [address, reportError, applyAccountResults]);

  // #1163 - auto-sync: when connectivity returns, refresh so cached data is
  // replaced by live data without the user having to do anything.
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (isOnline && !wasOnline) void refreshAccount();
  }, [isOnline, refreshAccount]);

  const value = useMemo(
    () => ({
      client: currentClient,
      address,
      walletName,
      detectedWallets,
      isHardware,
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
      isOffline: !isOnline,
      isCached,
      lastSyncedAt,
      network,
      initialNetwork,
      switchNetwork,
      isSwitchingNetwork,
      customNetworks,
      addCustomNetwork,
      clearCustomNetworks,
      resetTransactionWatchers,
      registerWatcher,
      error,
      accountError,
      networkError,
      walletError,
      errorSeverity,
      errorHistory,
      clearError,
      reportError,
    }),
    [
      currentClient,
      address,
      walletName,
      detectedWallets,
      isHardware,
      isConnecting,
      isDisconnecting,
      isLoadingAccount,
      connectWallet,
      disconnectWallet,
      account,
      balances,
      refreshAccount,
      isOnline,
      isCached,
      lastSyncedAt,
      network,
      initialNetwork,
      switchNetwork,
      isSwitchingNetwork,
      customNetworks,
      addCustomNetwork,
      clearCustomNetworks,
      resetTransactionWatchers,
      registerWatcher,
      error,
      accountError,
      networkError,
      walletError,
      errorSeverity,
      errorHistory,
      clearError,
      reportError,
    ],
  );

  return (
    <SorokitContext.Provider value={value}>{children}</SorokitContext.Provider>
  );
}
