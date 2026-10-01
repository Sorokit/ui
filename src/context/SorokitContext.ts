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
  isHardware?: boolean;
  isConnected: boolean;
  isConnecting: boolean;
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
  /**
   * True while a `switchNetwork` call is in flight (#537). Components with
   * network-selection controls read this to disable their options, so two
   * surfaces (e.g. `NetworkScreen` and `NetworkSwitcher`) can never fire
   * overlapping switches — the provider also enforces this with an
   * in-flight guard, making the last call win deterministically.
   */
  isSwitchingNetwork?: boolean;
  customNetworks?: NetworkInfo[];
  addCustomNetwork?: (config: NetworkInfo) => Promise<void>;
  /**
   * Resets any pending transaction watchers/polling timers across the client context.
   */
  resetTransactionWatchers?: () => void;
  /**
   * Register a cancel callback for a polling timer. Returns an unregister
   * function to call on unmount. Used by FeeEstimator, ContractEventFeed,
   * TransactionStatusTracker, and GasOptimizer so that `resetTransactionWatchers`
   * can stop all of them on network switch.
   */
  registerWatcher?: (cancel: () => void) => () => void;
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
