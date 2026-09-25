import { useContext } from "react";

import { getClient } from "@/lib/client";

import { SorokitContext, type SorokitState } from "./SorokitContext";

const safeDefaults: SorokitState = {
  address: null,
  walletName: null,
  isConnected: false,
  isConnecting: false,
  isInitializing: false,
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
  error: null,
  errorHistory: [],
  clearError: () => {},
};

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
