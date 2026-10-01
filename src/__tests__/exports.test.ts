import { describe, expect, it } from "vitest";

import * as exports from "../index";

describe("Public exports surface", () => {
  it("exposes all recently added and core component exports", () => {
    // Specifically requested component assertions (#771)
    expect(exports.RebalancerHistory).toBeDefined();
    expect(exports.SwapRoute).toBeDefined();
    expect(exports.AllocationInput).toBeDefined();
    expect(exports.StakingDashboard).toBeDefined();
describe('Public exports surface', () => {
  it('exposes all public component exports', () => {
    expect(exports.FeeEstimator).toBeTypeOf('function');
    expect(exports.AddressDisplay).toBeTypeOf('function');
    expect(exports.AssetPill).toBeTypeOf('function');
    expect(exports.ContractEventFeed).toBeTypeOf('function');
    expect(exports.GovernanceDashboard).toBeTypeOf('function');
  });

  it("exposes all public UI primitive and component exports from src/index.ts", () => {
    // UI Primitives
    expect(exports.Badge).toBeDefined();
    expect(exports.Button).toBeDefined();
    expect(exports.ButtonGroup).toBeDefined();
    expect(exports.Card).toBeDefined();
    expect(exports.CardContent).toBeDefined();
    expect(exports.CardDescription).toBeDefined();
    expect(exports.CardFooter).toBeDefined();
    expect(exports.CardHeader).toBeDefined();
    expect(exports.CardTitle).toBeDefined();
    expect(exports.InfoCell).toBeDefined();
    expect(exports.Input).toBeDefined();
    expect(exports.LabelledValue).toBeDefined();
    expect(exports.Separator).toBeDefined();
    expect(exports.AssetRowSkeleton).toBeDefined();
    expect(exports.Skeleton).toBeDefined();
    expect(exports.SkeletonCard).toBeDefined();
    expect(exports.SkeletonRow).toBeDefined();

    // Error handling
    expect(exports.ErrorBoundary).toBeDefined();

    // Wallet
    expect(exports.AccountCard).toBeDefined();
    expect(exports.AccountCardCompact).toBeDefined();
    expect(exports.AccountSidebar).toBeDefined();
    expect(exports.BalanceList).toBeDefined();
    expect(exports.WalletConnectButton).toBeDefined();
    expect(exports.WalletConnectModal).toBeDefined();
    expect(exports.DEFAULT_WALLET_OPTIONS).toBeDefined();

    // Assets
    expect(exports.AssetBadge).toBeDefined();
    expect(exports.AssetPill).toBeDefined();
    expect(exports.ASSET_COLORS).toBeDefined();
    expect(exports.getAssetColor).toBeTypeOf("function");
    expect(exports.isKnownAsset).toBeTypeOf("function");
    expect(exports.AssetFilter).toBeDefined();
    expect(exports.AssetFilterSkeleton).toBeDefined();

    // Address
    expect(exports.AddressDisplay).toBeDefined();

    // Network
    expect(exports.BANNER_CONFIG).toBeDefined();
    expect(exports.NetworkBanner).toBeDefined();
    expect(exports.NetworkSwitcher).toBeDefined();

    // Allowances
    expect(exports.AllowanceManager).toBeDefined();

    // Transactions
    expect(exports.ActivityTimeline).toBeDefined();
    expect(exports.ClaimableBalanceCard).toBeDefined();
    expect(exports.FeeCell).toBeDefined();
    expect(exports.FeeEstimator).toBeDefined();
    expect(exports.GAS_PRESETS).toBeDefined();
    expect(exports.GasOptimizer).toBeDefined();
    expect(exports.MAX_CPU_INSTRUCTIONS).toBeTypeOf("number");
    expect(exports.MAX_MEMORY_BYTES).toBeTypeOf("number");
    expect(exports.MIN_CPU_INSTRUCTIONS).toBeTypeOf("number");
    expect(exports.MIN_MEMORY_BYTES).toBeTypeOf("number");
    expect(exports.SOROBAN_MAX_INSTRUCTIONS).toBeTypeOf("number");
    expect(exports.SOROBAN_MAX_MEMORY).toBeTypeOf("number");
    expect(exports.SOROBAN_MIN_INSTRUCTIONS).toBeTypeOf("number");
    expect(exports.SOROBAN_MIN_MEMORY).toBeTypeOf("number");
    expect(exports.SOROBAN_PROTOCOL_LIMITS).toBeDefined();
    expect(exports.MultiSigTransactionBuilder).toBeDefined();
    expect(exports.TransactionConfirmModal).toBeDefined();
    expect(exports.TransactionHistory).toBeDefined();
    expect(exports.TransactionHistoryTable).toBeDefined();
    expect(exports.TransactionPanel).toBeDefined();
    expect(exports.TransactionStatusTracker).toBeDefined();

    // Soroban
    expect(exports.ContractEventFeed).toBeDefined();
    expect(exports.ContractInteractionDebugger).toBeDefined();
    expect(exports.SorobanInvokeButton).toBeDefined();
    expect(exports.SorobanPanel).toBeDefined();

    // NFT Gallery
    expect(exports.NFTCard).toBeDefined();
    expect(exports.NFTGallery).toBeDefined();

    // Portfolio Rebalancer & Staking
    expect(exports.PortfolioRebalancer).toBeDefined();
    expect(exports.DelegationRow).toBeDefined();
    expect(exports.RewardHistory).toBeDefined();
    expect(exports.RewardsPanel).toBeDefined();
    expect(exports.SwapExecutionTracker).toBeDefined();
    expect(exports.PieChart).toBeDefined();
    expect(exports.ValidatorCard).toBeDefined();
    expect(exports.ValidatorSearch).toBeDefined();

    // Utilities
    expect(exports.BASE_FEE_STROOPS).toBeTypeOf("number");
    expect(exports.buildRebalanceRecord).toBeTypeOf("function");
    expect(exports.computeAllocationDiffs).toBeTypeOf("function");
    expect(exports.computeCurrentAllocations).toBeTypeOf("function");
    expect(exports.createInitialExecution).toBeTypeOf("function");
    expect(exports.DEFAULT_SWAP_FEE_PCT).toBeTypeOf("number");
    expect(exports.estimateSlippagePct).toBeTypeOf("function");
    expect(exports.estimateSwapCostUsd).toBeTypeOf("function");
    expect(exports.formatPct).toBeTypeOf("function");
    expect(exports.formatUsd).toBeTypeOf("function");
    expect(exports.generateSwapSuggestions).toBeTypeOf("function");
    expect(exports.isTargetValid).toBeTypeOf("function");
    expect(exports.MIN_TRADE_USD).toBeTypeOf("number");
    expect(exports.normaliseTargets).toBeTypeOf("function");
    expect(exports.SLIPPAGE_BASE_PCT).toBeTypeOf("number");
    expect(exports.SLIPPAGE_MARKET_IMPACT_PER_1K).toBeTypeOf("number");
    expect(exports.totalFeeStroops).toBeTypeOf("function");
    expect(exports.totalRebalanceCostUsd).toBeTypeOf("function");
    expect(exports.updateSwapStatus).toBeTypeOf("function");
    expect(exports.weightedAverageSlippage).toBeTypeOf("function");
    expect(exports.QRCode).toBeDefined();
    expect(exports.SwapSimulator).toBeDefined();

    // Staking Utilities
    expect(exports.aggregateDailyRewards).toBeTypeOf("function");
    expect(exports.createDefaultFilter).toBeTypeOf("function");
    expect(exports.DELEGATION_BASE_FEE_STROOPS).toBeTypeOf("number");
    expect(exports.estimateDelegationFeeXlm).toBeTypeOf("function");
    expect(exports.filterValidators).toBeTypeOf("function");
    expect(exports.formatStakingPct).toBeTypeOf("function");
    expect(exports.formatXlm).toBeTypeOf("function");
    expect(exports.generateMockRewardHistory).toBeTypeOf("function");
    expect(exports.MIN_DELEGATION_XLM).toBeTypeOf("number");
    expect(exports.MOCK_DELEGATIONS).toBeDefined();
    expect(exports.MOCK_REWARD_SCHEDULE).toBeDefined();
    expect(exports.MOCK_VALIDATORS).toBeDefined();
    expect(exports.REWARD_HISTORY_DAYS).toBeTypeOf("number");
    expect(exports.STROOPS_PER_XLM).toBeTypeOf("number");
    expect(exports.totalClaimableXlm).toBeTypeOf("function");
    expect(exports.totalDelegatedXlm).toBeTypeOf("function");
    expect(exports.totalPendingXlm).toBeTypeOf("function");
    expect(exports.totalRewardHistoryXlm).toBeTypeOf("function");
    expect(exports.validateDelegationAmount).toBeTypeOf("function");

    // Features & Providers
    expect(exports.WalletStatusBadge).toBeDefined();
    expect(exports.TransactionFeeCalculator).toBeDefined();
    expect(exports.ContractInteractionBuilder).toBeDefined();
    expect(exports.GovernanceDashboard).toBeDefined();
    expect(exports.AccountBalanceChart).toBeDefined();
    expect(exports.SorokitProvider).toBeDefined();
    expect(exports.useSorokit).toBeTypeOf("function");
    expect(exports.ToastProvider).toBeDefined();
    expect(exports.useToast).toBeTypeOf("function");
    expect(exports.ToastContainer).toBeDefined();
    expect(exports.Tooltip).toBeDefined();
  });

  it("re-exports public types from client", () => {
    type Expected = {
      account: exports.AccountData;
      balance: exports.Balance;
      transaction: exports.Transaction;
      claimableBalance: exports.ClaimableBalance;
      contractEvent: exports.ContractEvent;
      networkInfo: exports.NetworkInfo;
      invokeParams: exports.InvokeParams;
      governanceProps: exports.GovernanceDashboardProps;
      governanceProposal: exports.GovernanceProposal;
      proposalStatus: exports.ProposalStatus;
      voteChoice: exports.VoteChoice;
    };
    const actual: Expected = {} as Expected;
    expect(actual).toBeDefined();
  });
});
