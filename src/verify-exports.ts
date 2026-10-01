// This file ensures that all public exports are available.
// If any of these are removed from the public API, the build will fail.

import {
  // Types
  type AccountData,
  ActivityTimeline,
  AddressDisplay,
  AssetPill,
  type Balance,
  type ClaimableBalance,
  type ContractEvent,
  ContractEventFeed,
  FeeEstimator,
  GasOptimizer,
  GovernanceDashboard,
  type GovernanceDashboardProps,
  type GovernanceProposal,
  type GroupedTransaction,
  type InvokeParams,
  type NetworkInfo,
  type Nft,
  type Operation,
  type ProposalStatus,
  type TimelineFilter,
  type TimelineGroup,
  type Transaction,
  type VoteChoice,
} from "./components/index";

// Dummy usage to prevent unused warnings if strictly checked
console.log({
  ActivityTimeline,
  FeeEstimator,
  GasOptimizer,
  AddressDisplay,
  AssetPill,
  ContractEventFeed,
  GovernanceDashboard,
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
  operation: Operation;
  timelineGroup: TimelineGroup;
  groupedTx: GroupedTransaction;
  timelineFilter: TimelineFilter;
  nft: Nft;
  governanceProps: GovernanceDashboardProps;
  governanceProposal: GovernanceProposal;
  proposalStatus: ProposalStatus;
  voteChoice: VoteChoice;
};
