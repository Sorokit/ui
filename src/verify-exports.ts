// This file ensures that all public exports are available.
// If any of these are removed from the public API, the build will fail.

import {
  FeeEstimator,
  AddressDisplay,
  AssetPill,
  ContractEventFeed,
  // Types
  type AccountData,
  type Balance,
  type Transaction,
  type ClaimableBalance,
  type ContractEvent,
  type NetworkInfo,
  type InvokeParams,
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
