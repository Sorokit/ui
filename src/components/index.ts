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
export {
  AssetRowSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  SkeletonTable,
} from "./ui/Skeleton";

// Error handling
export { ErrorBoundary } from "./ErrorBoundary";

// Wallet
export { AccountCard, AccountCardCompact } from "./AccountCard";
export type { AccountSidebarProps } from "./AccountSidebar";
export { AccountSidebar } from "./AccountSidebar";
export { BalanceList } from "./BalanceList";
export { KeystoreBackup } from "./KeystoreBackup";
export type { OfflineBadgeProps } from "./OfflineBadge";
export { OfflineBadge } from "./OfflineBadge";
export type { RateLimitIndicatorProps } from "./RateLimitIndicator";
export { RateLimitIndicator, RateLimitSettings } from "./RateLimitIndicator";
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
export type { BannerConfig, NetworkBannerProps } from "./NetworkBanner";
export { BANNER_CONFIG, NetworkBanner } from "./NetworkBanner";
export { NetworkSwitcher } from "./NetworkSwitcher";

// Allowances
export { AllowanceManager } from "./AllowanceManager";

// Transactions
export { ActivityTimeline } from "./ActivityTimeline";
export { ClaimableBalanceCard } from "./ClaimableBalanceCard";
export { FeeCell,FeeEstimator } from "./FeeEstimator";
export type {
  GasOptimizerConfig,
  GasOptimizerProps,
  GasPresetConfig,
  GasPresetName,
} from "./GasOptimizer";
export {
  GAS_PRESETS,
  GasOptimizer,
  MAX_CPU_INSTRUCTIONS,
  MAX_MEMORY_BYTES,
  MIN_CPU_INSTRUCTIONS,
  MIN_MEMORY_BYTES,
  SOROBAN_MAX_INSTRUCTIONS,
  SOROBAN_MAX_MEMORY,
  SOROBAN_MIN_INSTRUCTIONS,
  SOROBAN_MIN_MEMORY,
  SOROBAN_PROTOCOL_LIMITS,
} from "./GasOptimizer";
export { MultiSigTransactionBuilder } from "./MultiSigTransactionBuilder";
export type { RecentTransactionsWidgetProps } from "./RecentTransactionsWidget";
export { RecentTransactionsWidget } from "./RecentTransactionsWidget";
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
export type {
  ScheduledTransaction,
  TransactionTemplate,
} from "./TransactionPanel";
export {
  loadScheduledTransactions,
  loadTemplates,
  saveScheduledTransactions,
  saveTemplates,
  SCHEDULED_TX_STORAGE_KEY,
  TEMPLATES_STORAGE_KEY,
  TransactionPanel,
} from "./TransactionPanel";
export { TransactionStatusTracker } from "./TransactionStatusTracker";

// Price Alerts
export type {
  AlertCondition,
  PriceAlert,
  PriceAlertHistoryItem,
  PriceAlertManagerProps,
} from "./PriceAlertManager";
export {
  loadPriceAlertHistory,
  loadPriceAlerts,
  PRICE_ALERT_HISTORY_STORAGE_KEY,
  PRICE_ALERTS_STORAGE_KEY,
  PriceAlertManager,
  savePriceAlertHistory,
  savePriceAlerts,
} from "./PriceAlertManager";

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
export { generateRewardHistoryCsv, RewardHistory } from "./RewardHistory";
export type { RewardsPanelProps } from "./RewardsPanel";
export { RewardsPanel } from "./RewardsPanel";
export type { StakingDashboardProps } from "./StakingDashboard";
export { StakingDashboard } from "./StakingDashboard";
export { SwapExecutionTracker } from "./SwapExecutionTracker";
export type {
  NormalizedHop,
  RouteHop,
  RouteValidationResult,
  SwapRouteProps,
} from "./SwapRoute";
export {
  detectCircularRoutes,
  formatFeeTier,
  formatPoolDepth,
  getIntermediateHops,
  getSwapPath,
  isCircularRoute,
  SwapRoute,
  validateSwapRoute,
} from "./SwapRoute";
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
  DEFAULT_XLM_PRICE_USD,
  DELEGATION_BASE_FEE_STROOPS,
  estimateDelegationFeeXlm,
  estimateHistoricalXlmPriceUsd,
  estimateRewardUsdValue,
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

// Governance
export type {
  GovernanceDashboardProps,
  GovernanceProposal,
  ProposalStatus,
  VoteChoice,
} from "./GovernanceDashboard";
export { GovernanceDashboard } from "./GovernanceDashboard";

// Account Balance Chart
export { AccountBalanceChart } from "./AccountBalanceChart";

// TopBar & Notification Center
export type { TopBarProps } from "./TopBar";
export { TopBar } from "./TopBar";

// Providers and hooks
export { SorokitProvider } from "../context/SorokitProvider";
export { useSorokit } from "../context/useSorokit";
export type { PendingActionItem } from "../hooks/usePendingActions";
export {
  loadStoredPendingActions,
  saveStoredPendingActions,
  usePendingActions,
} from "../hooks/usePendingActions";

// Types
export type { NotificationEntry, Toast, ToastType } from "../context/ToastContext";
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
