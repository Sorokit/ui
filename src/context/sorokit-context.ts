import { createContext } from "react";

import type {
  AccountData,
  Balance,
  NetworkInfo,
  NetworkName,
  SorokitClient,
} from "@/lib/client";

export interface SorokitState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  account: AccountData | null;
  balances: Balance[];
  isLoadingAccount: boolean;
  refreshAccount: () => void;
  network: NetworkInfo | null;
  switchNetwork: (name: NetworkName) => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export interface SorokitProviderProps {
  client: SorokitClient;
  children: React.ReactNode;
}

export const SorokitContext = createContext<SorokitState | null>(null);
