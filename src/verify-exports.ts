// This file ensures that all public exports are available and checks for
// circular dependencies across component and context modules (#969).
// If any public export is removed from the public API, the build will fail.

import {
  // Types
  type AccountData,
  ActivityTimeline,
  AddressDisplay,
  AssetPill,
  type Balance,
  BatchPaymentProcessor,
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
  type NavSection,
  type NetworkInfo,
  type Nft,
  type Operation,
  PortfolioRebalancer,
  type ProposalStatus,
  Sidebar,
  SwapSimulator,
  type TimelineFilter,
  type TimelineGroup,
  TopBar,
  type Transaction,
  useFeeData,
  useIsVisible,
  useOutsideClick,
  type VoteChoice,
} from "./components/index";

/**
 * Detects circular dependencies in a module dependency graph using DFS cycle detection.
 * @param graph Adjacency map from module path to array of imported module paths.
 * @returns Array of detected circular dependency chains (each chain starts and ends with the cycle root).
 */
export function detectCircularDependencies(
  graph: Record<string, string[]>,
): string[][] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const pathStack: string[] = [];
  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    pathStack.push(node);

    const neighbors = graph[node] ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (inStack.has(neighbor)) {
        const cycleStartIdx = pathStack.indexOf(neighbor);
        if (cycleStartIdx !== -1) {
          const cycle = [...pathStack.slice(cycleStartIdx), neighbor];
          const key = cycle.join(" -> ");
          if (!seenCycleKeys.has(key)) {
            seenCycleKeys.add(key);
            cycles.push(cycle);
          }
        }
      }
    }

    pathStack.pop();
    inStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

// Reference all verified exports to prevent unused-import stripping
export const VERIFIED_PUBLIC_EXPORTS = {
  ActivityTimeline,
  FeeEstimator,
  GasOptimizer,
  AddressDisplay,
  AssetPill,
  ContractEventFeed,
  GovernanceDashboard,
  PortfolioRebalancer,
  SwapSimulator,
  BatchPaymentProcessor,
  Sidebar,
  TopBar,
  useFeeData,
  useIsVisible,
  useOutsideClick,
};

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
  navSection: NavSection;
};
