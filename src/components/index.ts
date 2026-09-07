/**
 * Sorokit UI - React components for Stellar/Soroban development
 *
 * @packageDocumentation
 *
 * @example
 * ```tsx
 * import { SorokitProvider, SorobanPanel } from 'sorokit-ui';
 *
 * export function App() {
 *   return (
 *     <SorokitProvider>
 *       <SorobanPanel />
 *     </SorokitProvider>
 *   );
 * }
 * ```
 */

import "../styles.css";

// UI primitives
//
// Card, Separator, and SkeletonCard are adopted primitives (not raw div +
// Tailwind) — see SwapSimulator/RecoveryScreen/ChartingScreen/YieldFarmingScreen
// /BudgetScreen for Card, WalletConnectModal for Separator, and
// ClaimableBalanceCard for SkeletonCard.
export { Badge } from "./ui/Badge";
export type { ButtonGroupProps } from "./ui/Button";
export { Button, ButtonGroup } from "./ui/Button";
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/Card";
export type { InfoCellProps } from "./ui/InfoCell";
export { InfoCell } from "./ui/InfoCell";
export { Input } from "./ui/Input";
export { LabelledValue } from "./ui/LabelledValue";
export { Separator } from "./ui/Separator";
export { AssetRowSkeleton, Skeleton, SkeletonCard, SkeletonRow } from "./ui/Skeleton";

// Error handling
export { ErrorBoundary } from "./ErrorBoundary";

// Wallet
export { AccountCard, AccountCardCompact } from "./AccountCard";
export type { AccountSidebarProps } from "./AccountSidebar";
export { AccountSidebar } from "./AccountSidebar";
export { BalanceList } from "./BalanceList";
export { WalletConnectButton } from "./WalletConnectButton";
export type { WalletConnectModalProps, WalletOption } from "./WalletConnectModal";
export {
  DEFAULT_WALLET_OPTIONS,
  WalletConnectModal,
} from "./WalletConnectModal";

// Assets
export type {
  AssetBadgeProps,
  AssetPillProps,
} from "./AssetBadge";
export {
  ASSET_COLORS,
  AssetBadge,
  AssetPill,
  getAssetColor,
  isKnownAsset,
} from "./AssetBadge";
export type { AssetItem, AssetMeta, SortKey, VerifiedFilter } from "./AssetFilter";
export { AssetFilter, AssetFilterSkeleton } from "./AssetFilter";

// Address
export { AddressDisplay } from "./AddressDisplay";

// Network
export type { BannerConfig } from "./NetworkBanner";
export { BANNER_CONFIG, NetworkBanner } from "./NetworkBanner";
export { NetworkSwitcher } from "./NetworkSwitcher";

// Allowances
export { AllowanceManager } from "./AllowanceManager";

// Transactions
export { ActivityTimeline } from "./ActivityTimeline";
export { ClaimableBalanceCard } from "./ClaimableBalanceCard";
export { FeeCell,FeeEstimator } from "./FeeEstimator";
export { GasOptimizer } from "./GasOptimizer";
export { MultiSigTransactionBuilder } from "./MultiSigTransactionBuilder";
export type {
  TransactionConfirmModalProps,
  TransactionFeeBreakdown,
  TransactionOperationSummary,
  TransactionPreviewData,
} from "./TransactionConfirmModal";
export { TransactionConfirmModal } from "./TransactionConfirmModal";
export { TransactionHistory } from "./TransactionHistory";
export type {
  SortDirection,
  SortField,
  TransactionFilters,
  TransactionHistoryTableProps,
} from "./TransactionHistoryTable";
export { TransactionHistoryTable } from "./TransactionHistoryTable";
export { TransactionPanel } from "./TransactionPanel";
export { TransactionStatusTracker } from "./TransactionStatusTracker";

// Soroban
export { ContractEventFeed } from "./ContractEventFeed";
export { ContractInteractionDebugger } from "./ContractInteractionDebugger";
export { SorobanInvokeButton } from "./SorobanInvokeButton";
export { SorobanPanel } from "./SorobanPanel";

// NFT Gallery
export type { NFTGalleryProps } from "./NFTGallery";
export { NFTCard, NFTGallery } from "./NFTGallery";

// Portfolio Rebalancer
export { PortfolioRebalancer } from "./PortfolioRebalancer";

// Staking Dashboard
export { AllocationInput } from "./AllocationInput";
export type { DelegationRowProps } from "./DelegationRow";
export { DelegationRow } from "./DelegationRow";
export { RebalancerHistory } from "./RebalancerHistory";
export type { RewardHistoryProps } from "./RewardHistory";
export { RewardHistory } from "./RewardHistory";
export type { RewardsPanelProps } from "./RewardsPanel";
export { RewardsPanel } from "./RewardsPanel";
export type { StakingDashboardProps } from "./StakingDashboard";
export { StakingDashboard } from "./StakingDashboard";
export { SwapExecutionTracker } from "./SwapExecutionTracker";
export { SwapRoute } from "./SwapRoute";
export type { PieChartProps, PieSlice } from "./ui/PieChart";
export { PieChart } from "./ui/PieChart";
export type { ValidatorCardProps } from "./ValidatorCard";
export { ValidatorCard } from "./ValidatorCard";
export type { ValidatorSearchProps } from "./ValidatorSearch";
export { ValidatorSearch } from "./ValidatorSearch";

// Utilities
export type {
  AllocationDiff,
  PortfolioAsset,
  RebalanceExecution,
  RebalanceRecord,
  SwapStatus,
  SwapSuggestion,
} from "../lib/rebalancer";
export {
  BASE_FEE_STROOPS,
  buildRebalanceRecord,
  computeAllocationDiffs,
  computeCurrentAllocations,
  createInitialExecution,
  DEFAULT_SWAP_FEE_PCT,
  estimateSlippagePct,
  estimateSwapCostUsd,
  formatPct,
  formatUsd,
  generateSwapSuggestions,
  isTargetValid,
  MIN_TRADE_USD,
  normaliseTargets,
  SLIPPAGE_BASE_PCT,
  SLIPPAGE_MARKET_IMPACT_PER_1K,
  totalFeeStroops,
  totalRebalanceCostUsd,
  updateSwapStatus,
  weightedAverageSlippage,
} from "../lib/rebalancer";
export { QRCode } from "./QRCode";
export { SwapSimulator } from "./SwapSimulator";

// Staking utilities
export type {
  DailyReward,
  Delegation,
  DelegationChangeRequest,
  DelegationChangeResult,
  RewardEvent,
  RewardScheduleEntry,
  SortDirection as StakingSortDirection,
  Validator,
  ValidatorFilter,
  ValidatorSortField,
  ValidatorStatus,
} from "../lib/staking";
export {
  aggregateDailyRewards,
  createDefaultFilter,
  DELEGATION_BASE_FEE_STROOPS,
  estimateDelegationFeeXlm,
  filterValidators,
  /** @alias formatPct from staking lib */
  formatPct as formatStakingPct,
  formatXlm,
  generateMockRewardHistory,
  MIN_DELEGATION_XLM,
  MOCK_DELEGATIONS,
  MOCK_REWARD_SCHEDULE,
  MOCK_VALIDATORS,
  REWARD_HISTORY_DAYS,
  STROOPS_PER_XLM,
  totalClaimableXlm,
  totalDelegatedXlm,
  totalPendingXlm,
  totalRewardHistoryXlm,
  validateDelegationAmount,
} from "../lib/staking";

// Wallet Status
export { WalletStatusBadge } from "./WalletStatusBadge";

// Transaction Fee Calculator
export { TransactionFeeCalculator } from "./TransactionFeeCalculator";

// Contract Interaction Builder
export type { ContractSpec } from "./ContractInteractionBuilder";
export { ContractInteractionBuilder } from "./ContractInteractionBuilder";

// Account Balance Chart
export { AccountBalanceChart } from "./AccountBalanceChart";

// Providers and hooks
export { SorokitProvider } from "../context/SorokitProvider";
export { useSorokit } from "../context/useSorokit";

// Types
export type { Toast, ToastType } from "../context/ToastContext";
export { ToastProvider, useToast } from "../context/ToastContext";
export type {
  AccountData,
  Balance,
  ClaimableBalance,
  ContractEvent,
  GroupedTransaction,
  InvokeParams,
  JsonValue,
  NetworkInfo,
  Nft,
  NftAttribute,
  NftCollection,
  NftMetadata,
  Operation,
  SorobanScVal,
  TimelineFilter,
  TimelineGroup,
  Transaction,
  TransactionParams,
} from "../lib/client";
export { ToastContainer } from "./ui/Toast";
export type { TooltipProps } from "./ui/Tooltip";
export { Tooltip } from "./ui/Tooltip";
