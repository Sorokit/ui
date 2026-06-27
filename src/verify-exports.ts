// This file ensures that all public exports are available.
// If any of these are removed from the public API, the build will fail.

import {
  // Types
  type AccountData,
  AddressDisplay,
  AssetPill,
  type Balance,
  type ClaimableBalance,
  type ContractEvent,
  ContractEventFeed,
  FeeEstimator,
  type InvokeParams,
  type NetworkInfo,
  type Transaction,
} from "./components/index";



// Dummy usage to prevent unused warnings if strictly checked
console.log({
  FeeEstimator,
  AddressDisplay,
  AssetPill,
  ContractEventFeed,
});

// Dummy type usage to prevent unused type warnings
export type TestExports = {
  account: AccountData;
  balance: Balance;
  tx: Transaction;
  claim: ClaimableBalance;
  event: ContractEvent;
  network: NetworkInfo;
  invoke: InvokeParams;
};
