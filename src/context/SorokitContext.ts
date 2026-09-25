import { createContext } from "react";

import type {
  AccountData,
  Balance,
  NetworkInfo,
  NetworkName,
  SorokitClient,
} from "@/lib/client";

export interface SorokitState {
  client: SorokitClient;
  address: string | null;
  walletName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isDisconnecting: boolean;
  account: AccountData | null;
  balances: Balance[];
  isLoadingAccount: boolean;
  refreshAccount: () => Promise<void>;
  network: NetworkInfo | null;
  /**
   * The network the client was initialised with, captured on mount before any
   * persisted preference is applied. Compare against `network` to detect a
   * selection that the client's underlying config may not match.
   */
  initialNetwork?: NetworkInfo | null;
  switchNetwork: (network: NetworkName | NetworkInfo) => Promise<void>;
  customNetworks?: NetworkInfo[];
  addCustomNetwork?: (config: NetworkInfo) => Promise<void>;
  error: string | null;
  accountError?: string | null;
  networkError?: string | null;
  walletError?: string | null;
  errorSeverity?: "info" | "error";
  errorHistory: string[];
  clearError: () => void;
}

export interface SorokitProviderProps {
  client: SorokitClient;
  onError?: (error: string, source: string) => void;
  /**
   * Called after every successful network switch. Use it for side effects the
   * provider can't know about — clearing caches, re-subscribing to feeds —
   * instead of watching the `network` value and depending on its shape.
   */
  onNetworkChange?: (network: NetworkInfo) => void;
  /**
   * Builds a client configured for a given network. When provided, a successful
   * `switchNetwork` re-initialises the `getClient()` singleton with the result,
   * so calls made after a switch reach the new network's endpoints.
   */
  createClientForNetwork?: (network: NetworkInfo) => SorokitClient;
  children: React.ReactNode;
}

export const SorokitContext = createContext<SorokitState | null>(null);
