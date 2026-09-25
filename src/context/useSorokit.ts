import { useContext } from "react";

import { getClient } from "@/lib/client";

import { SorokitContext, type SorokitState } from "./SorokitContext";

// Built lazily (only when actually falling back) rather than at module scope
// — calling getClient() eagerly here would throw for any consumer that
// imports this module before initClient() has run, even if they never use
// useSorokit() outside a provider. `client` is exposed via a getter so
// reading every other field still works even when no client has been
// initialized yet; only actually touching `.client` in that case throws
// getClient()'s real error.
function buildSafeDefaults(): SorokitState {
  return {
    get client() {
      return getClient();
    },
    address: null,
    walletName: null,
    isConnected: false,
    isConnecting: false,
    isLoading: false,
    connectWallet: async () => {},
    disconnectWallet: async () => {},
    isDisconnecting: false,
    account: null,
    balances: [],
    isLoadingAccount: false,
    refreshAccount: async () => {},
    network: null,
    switchNetwork: async () => {},
    resetTransactionWatchers: () => {},
    error: null,
    errorHistory: [],
    clearError: () => {},
  };
}

export function useSorokit(): SorokitState {
  const ctx = useContext(SorokitContext);
  if (!ctx) {
    console.warn(
      "[sorokit-ui] useSorokit used outside <SorokitProvider>. Returning safe defaults.",
    );
    return buildSafeDefaults();
  }
  return ctx;
}
