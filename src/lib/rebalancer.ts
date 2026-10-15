/**
 * Portfolio Rebalancer — pure calculation utilities and types.
 *
 * All functions here are side-effect-free so they can be tested in isolation
 * and safely called from any component or hook.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** One asset's position in the current portfolio */
export interface PortfolioAsset {
  /** Canonical asset identifier used by the Stellar network (e.g. "XLM", "USDC") */
  asset: string;
  /** Human-readable ticker code (e.g. "XLM", "USDC") */
  assetCode: string;
  /** Raw balance string as returned by the network */
  balance: string;
  /** USD value of the balance, or null when price is unavailable */
  usdValue: number | null;
  /** Current allocation as a fraction 0–1 (set after computeCurrentAllocations) */
  currentPct: number;
}

/** A single suggested swap to move toward the target allocation */
export interface SwapSuggestion {
  /** Asset being sold */
  from: string;
  /** Asset being bought */
  to: string;
  /** Amount of `from` asset to sell */
  fromAmount: number;
  /** Expected amount of `to` asset to receive (accounting for slippage) */
  toAmountExpected: number;
  /** Slippage percentage estimate (0–100) */
  slippagePct: number;
  /** Estimated network fee in stroops */
  feeStroops: number;
  /** Swap fee as a percentage of the trade (e.g. 0.3 for 0.3%) */
  swapFeePct: number;
  /** Total cost of this swap in USD (fee + slippage impact) */
  totalCostUsd: number;
}

/** The result of a completed rebalance operation */
export interface RebalanceRecord {
  id: string;
  executedAt: string; // ISO-8601
  swaps: SwapSuggestion[];
  /** Allocations before rebalancing */
  before: Record<string, number>;
  /** Allocations after rebalancing */
  after: Record<string, number>;
  totalFeeUsd: number;
  /** Whether every swap completed successfully */
  successful: boolean;
  /** Per-swap execution results */
  txHashes: string[];
}

/** Status of an individual swap during execution */
export type SwapStatus = "pending" | "submitting" | "success" | "failed" | "skipped";

/** Live execution state for the rebalancer */
export interface RebalanceExecution {
  isRunning: boolean;
  currentSwapIndex: number;
  swapStatuses: SwapStatus[];
  txHashes: (string | null)[];
  errors: (string | null)[];
  /** ISO timestamp when execution started */
  startedAt: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Stellar network base fee in stroops */
export const BASE_FEE_STROOPS = 100;

/** Default AMM swap fee percentage */
export const DEFAULT_SWAP_FEE_PCT = 0.3;

/**
 * Minimum trade threshold in USD — swaps smaller than this are collapsed to
 * avoid dust trades that cost more in fees than they're worth.
 */
export const MIN_TRADE_USD = 1.0;

/**
 * Minimum asset trade amount (100 stroops = 0.00001 XLM) to prevent DEX dust
 * orders that fail minimum trade thresholds.
 */
export const MIN_ASSET_TRADE_AMOUNT = 0.00001;

/** Default Stellar asset decimal places (7 decimals = 10^7 stroops). */
export const DEFAULT_ASSET_DECIMALS = 7;

const USD_PRECISION_DECIMALS = 18;
const USD_SCALE = 10n ** BigInt(USD_PRECISION_DECIMALS);

/** Parse a decimal string or number into scaled BigInt base units without float drift. */
export function parseDecimalToBigInt(value: string | number, decimals = USD_PRECISION_DECIMALS): bigint {
  const raw = typeof value === "number" ? value.toFixed(Math.min(decimals, 18)) : String(value).trim();
  if (!raw || raw === "NaN" || raw === "Infinity" || raw === "-Infinity") return 0n;
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [intPartRaw = "0", fracPartRaw = ""] = unsigned.split(".");
  const intPart = intPartRaw.replace(/\D/g, "") || "0";
  const cleanFrac = fracPartRaw.replace(/\D/g, "");
  const paddedFrac = cleanFrac.padEnd(decimals + 1, "0");
  const mainFrac = paddedFrac.slice(0, decimals);
  const roundingDigit = Number(paddedFrac[decimals] ?? "0");
  let units = BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(mainFrac || "0");
  if (roundingDigit >= 5) units += 1n;
  return negative ? -units : units;
}

/** Round a numeric token amount to the asset's decimal precision using BigInt half-up rounding. */
export function roundToAssetDecimals(amount: number, decimals = DEFAULT_ASSET_DECIMALS): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  const clampedDecimals = Math.max(0, Math.min(18, Math.trunc(decimals)));
  const scaled = parseDecimalToBigInt(amount, clampedDecimals);
  return Number(scaled) / 10 ** clampedDecimals;
}

/** Slippage model: 0.1% base + 0.05% per $1 000 of trade size */
export const SLIPPAGE_BASE_PCT = 0.1;
export const SLIPPAGE_MARKET_IMPACT_PER_1K = 0.05;

// ─── Allocation helpers ───────────────────────────────────────────────────────

/**
 * Compute the current allocation percentages for each asset given USD prices.
 *
 * Uses 18-decimal BigInt fixed-point math so portfolios mixing 7-decimal
 * native Stellar assets and 18-decimal wrapped tokens compute USD weights
 * without floating-point precision drift.
 *
 * @returns a new array with `currentPct` populated on every entry.
 */
export function computeCurrentAllocations(
  assets: Omit<PortfolioAsset, "currentPct">[],
  prices: Record<string, number>,
  assetDecimals: Record<string, number> = {},
): PortfolioAsset[] {
  const scaledValues = assets.map((a) => {
    const price = prices[a.assetCode];
    if (price == null || !Number.isFinite(price) || price < 0) {
      return { asset: a, usdScaled: null as bigint | null, usdValue: null as number | null };
    }
    const dec = assetDecimals[a.assetCode] ?? DEFAULT_ASSET_DECIMALS;
    const balUnits = parseDecimalToBigInt(a.balance, dec);
    const priceUnits = parseDecimalToBigInt(price, USD_PRECISION_DECIMALS);
    const usdScaled = (balUnits * priceUnits) / 10n ** BigInt(dec);
    const usdValue = Number(usdScaled) / Number(USD_SCALE);
    return { asset: a, usdScaled: usdScaled > 0n ? usdScaled : 0n, usdValue };
  });

  const totalUsdScaled = scaledValues.reduce((sum, item) => sum + (item.usdScaled ?? 0n), 0n);

  if (totalUsdScaled <= 0n) {
    return scaledValues.map(({ asset, usdValue }) => ({
      ...asset,
      usdValue,
      currentPct: 0,
    }));
  }

  return scaledValues.map(({ asset, usdScaled, usdValue }) => {
    const pctBasis = ((usdScaled ?? 0n) * 100n * USD_SCALE) / totalUsdScaled;
    return {
      ...asset,
      usdValue,
      currentPct: Number(pctBasis) / Number(USD_SCALE),
    };
  });
}

/**
 * Normalise a target allocation map so all values sum to exactly 100.
 *
 * If the total is 0 the map is returned unchanged (division by zero guard).
 */
export function normaliseTargets(targets: Record<string, number>): Record<string, number> {
  const total = Object.values(targets).reduce((s, v) => s + Math.max(0, v), 0);
  if (total === 0) return targets;
  return Object.fromEntries(
    Object.entries(targets).map(([k, v]) => [k, (Math.max(0, v) / total) * 100]),
  );
}

/**
 * Returns true when target allocations sum to approximately 100 (±0.01 tolerance
 * to handle floating-point rounding).
 */
export function isTargetValid(targets: Record<string, number>): boolean {
  const sum = Object.values(targets).reduce((s, v) => s + v, 0);
  return Math.abs(sum - 100) < 0.01;
}

// ─── Difference calculation ───────────────────────────────────────────────────

export interface AllocationDiff {
  asset: string;
  assetCode: string;
  currentPct: number;
  targetPct: number;
  /** Positive = need to buy, negative = need to sell */
  diffPct: number;
  /** USD value that needs to move (positive = buy, negative = sell) */
  diffUsd: number;
}

/**
 * Calculate the allocation differences between current holdings and targets.
 *
 * Assets in `targets` that are not in `current` are treated as 0% current.
 * Assets in `current` that are not in `targets` are treated as 0% target
 * (i.e. sell everything).
 */
export function computeAllocationDiffs(
  current: PortfolioAsset[],
  targets: Record<string, number>,
  totalUsd: number,
): AllocationDiff[] {
  const allAssets = new Set([
    ...current.map((a) => a.assetCode),
    ...Object.keys(targets),
  ]);

  const safeTotalUsd = Number.isFinite(totalUsd) && totalUsd > 0 ? totalUsd : 0;
  const totalUsdScaled = parseDecimalToBigInt(safeTotalUsd, USD_PRECISION_DECIMALS);

  return Array.from(allAssets).map((code) => {
    const cur = current.find((a) => a.assetCode === code);
    const currentPct = cur?.currentPct ?? 0;
    const targetPct = targets[code] ?? 0;
    const curPctScaled = parseDecimalToBigInt(currentPct, USD_PRECISION_DECIMALS);
    const tgtPctScaled = parseDecimalToBigInt(targetPct, USD_PRECISION_DECIMALS);
    const diffPctScaled = tgtPctScaled - curPctScaled;
    const diffPct = Number(diffPctScaled) / Number(USD_SCALE);
    const diffUsdScaled = (diffPctScaled * totalUsdScaled) / (100n * USD_SCALE);
    const diffUsd = safeTotalUsd === 0 ? 0 : Number(diffUsdScaled) / Number(USD_SCALE);
    return {
      asset: cur?.asset ?? code,
      assetCode: code,
      currentPct,
      targetPct,
      diffPct,
      diffUsd,
    };
  });
}

// ─── Slippage & fee estimation ────────────────────────────────────────────────

/**
 * Estimate slippage for a trade of the given USD size.
 *
 * Uses a simple linear market-impact model:
 *   slippage = BASE + (tradeUsd / 1000) * IMPACT_PER_1K
 */
export function estimateSlippagePct(tradeUsd: number): number {
  return SLIPPAGE_BASE_PCT + (tradeUsd / 1000) * SLIPPAGE_MARKET_IMPACT_PER_1K;
}

/**
 * Estimate the total cost of a swap in USD, including swap fee and slippage
 * impact.
 */
export function estimateSwapCostUsd(tradeUsd: number, swapFeePct = DEFAULT_SWAP_FEE_PCT): number {
  const slippage = estimateSlippagePct(tradeUsd);
  return tradeUsd * (swapFeePct / 100 + slippage / 100);
}

// ─── Swap path generation ─────────────────────────────────────────────────────

/**
 * Generate an optimal list of swap suggestions to move from the current
 * allocation to the target allocation.
 *
 * Strategy (greedy matching):
 * 1. Identify "sell" assets (current > target) and "buy" assets (current < target).
 * 2. Sort sellers by largest surplus first, buyers by largest deficit first.
 * 3. Greedily match each seller to buyers until the surplus is consumed.
 * 4. Skip any individual swap whose trade size is below MIN_TRADE_USD or
 *    MIN_ASSET_TRADE_AMOUNT to avoid dust trades.
 *
 * @param diffs          - from `computeAllocationDiffs`
 * @param prices         - map of assetCode → USD price
 * @param baseFeeUsd     - estimated network fee per transaction in USD
 * @param assetDecimals  - optional map of assetCode → decimal places (default 7)
 */
export function generateSwapSuggestions(
  diffs: AllocationDiff[],
  prices: Record<string, number>,
  baseFeeUsd = 0.01,
  assetDecimals: Record<string, number> = {},
): SwapSuggestion[] {
  if (!Array.isArray(diffs) || diffs.length === 0) return [];

  // Split into sellers (need to reduce) and buyers (need to increase)
  const sellers = diffs
    .filter((d) => d.diffPct < 0 && Math.abs(d.diffUsd) >= MIN_TRADE_USD)
    .map((d) => ({ ...d, remainingScaled: parseDecimalToBigInt(Math.abs(d.diffUsd), USD_PRECISION_DECIMALS) }))
    .sort((a, b) => (b.remainingScaled > a.remainingScaled ? 1 : b.remainingScaled < a.remainingScaled ? -1 : 0));

  const buyers = diffs
    .filter((d) => d.diffPct > 0 && d.diffUsd >= MIN_TRADE_USD)
    .map((d) => ({ ...d, remainingScaled: parseDecimalToBigInt(d.diffUsd, USD_PRECISION_DECIMALS) }))
    .sort((a, b) => (b.remainingScaled > a.remainingScaled ? 1 : b.remainingScaled < a.remainingScaled ? -1 : 0));

  if (sellers.length === 0 || buyers.length === 0) return [];

  const minTradeScaled = parseDecimalToBigInt(MIN_TRADE_USD, USD_PRECISION_DECIMALS);
  const suggestions: SwapSuggestion[] = [];

  for (const seller of sellers) {
    for (const buyer of buyers) {
      if (seller.remainingScaled < minTradeScaled) break;
      if (buyer.remainingScaled < minTradeScaled) continue;

      const tradeScaled =
        seller.remainingScaled < buyer.remainingScaled
          ? seller.remainingScaled
          : buyer.remainingScaled;
      if (tradeScaled < minTradeScaled) continue;

      const tradeUsd = Number(tradeScaled) / Number(USD_SCALE);
      const fromPrice = prices[seller.assetCode] ?? 1;
      const toPrice = prices[buyer.assetCode] ?? 1;
      if (!Number.isFinite(fromPrice) || fromPrice <= 0 || !Number.isFinite(toPrice) || toPrice <= 0) {
        continue;
      }

      const fromDecimals = assetDecimals[seller.assetCode] ?? DEFAULT_ASSET_DECIMALS;
      const toDecimals = assetDecimals[buyer.assetCode] ?? DEFAULT_ASSET_DECIMALS;

      const fromAmount = roundToAssetDecimals(tradeUsd / fromPrice, fromDecimals);
      const slippagePct = estimateSlippagePct(tradeUsd);
      const toAmountExpected = roundToAssetDecimals(
        (tradeUsd * (1 - slippagePct / 100)) / toPrice,
        toDecimals,
      );

      // Prune dust orders below minimum DEX trade thresholds (< 0.00001 units)
      if (fromAmount < MIN_ASSET_TRADE_AMOUNT || toAmountExpected < MIN_ASSET_TRADE_AMOUNT) {
        continue;
      }

      const totalCostUsd = estimateSwapCostUsd(tradeUsd) + baseFeeUsd;

      suggestions.push({
        from: seller.assetCode,
        to: buyer.assetCode,
        fromAmount,
        toAmountExpected,
        slippagePct,
        feeStroops: BASE_FEE_STROOPS,
        swapFeePct: DEFAULT_SWAP_FEE_PCT,
        totalCostUsd,
      });

      seller.remainingScaled -= tradeScaled;
      buyer.remainingScaled -= tradeScaled;
    }
  }

  return suggestions;
}

// ─── Summary helpers ──────────────────────────────────────────────────────────

/**
 * Sum the total estimated cost of all swaps in USD.
 */
export function totalRebalanceCostUsd(swaps: SwapSuggestion[]): number {
  return swaps.reduce((sum, s) => sum + s.totalCostUsd, 0);
}

/**
 * Sum the total fee in stroops across all swaps.
 */
export function totalFeeStroops(swaps: SwapSuggestion[]): number {
  return swaps.reduce((sum, s) => sum + s.feeStroops, 0);
}

/**
 * Weighted average slippage across all swaps (weighted by fromAmount).
 * Returns 0 when the swap list is empty.
 */
export function weightedAverageSlippage(swaps: SwapSuggestion[]): number {
  const totalAmount = swaps.reduce((sum, s) => sum + s.fromAmount, 0);
  if (totalAmount === 0) return 0;
  return swaps.reduce((sum, s) => sum + s.slippagePct * s.fromAmount, 0) / totalAmount;
}

// ─── Execution helpers ────────────────────────────────────────────────────────

/** Create the initial execution state for a set of swaps */
export function createInitialExecution(swapCount: number): RebalanceExecution {
  return {
    isRunning: false,
    currentSwapIndex: 0,
    swapStatuses: Array.from({ length: swapCount }, () => "pending" as SwapStatus),
    txHashes: Array.from({ length: swapCount }, () => null),
    errors: Array.from({ length: swapCount }, () => null),
    startedAt: null,
  };
}

/** Return a new execution state with the status of one swap updated */
export function updateSwapStatus(
  exec: RebalanceExecution,
  index: number,
  status: SwapStatus,
  txHash?: string | null,
  error?: string | null,
): RebalanceExecution {
  const swapStatuses = [...exec.swapStatuses];
  const txHashes = [...exec.txHashes];
  const errors = [...exec.errors];
  swapStatuses[index] = status;
  if (txHash !== undefined) txHashes[index] = txHash;
  if (error !== undefined) errors[index] = error;
  return { ...exec, swapStatuses, txHashes, errors };
}

// ─── History helpers ──────────────────────────────────────────────────────────

/** Derive a RebalanceRecord from a completed execution run */
export function buildRebalanceRecord(
  id: string,
  swaps: SwapSuggestion[],
  exec: RebalanceExecution,
  beforeAllocations: Record<string, number>,
  afterAllocations: Record<string, number>,
  totalFeeUsd: number,
): RebalanceRecord {
  return {
    id,
    executedAt: exec.startedAt ?? new Date().toISOString(),
    swaps,
    before: beforeAllocations,
    after: afterAllocations,
    totalFeeUsd,
    successful: exec.swapStatuses.every((s) => s === "success" || s === "skipped"),
    txHashes: exec.txHashes.filter((h): h is string => h !== null),
  };
}

/** Format a USD amount for display, e.g. "$1,234.56" */
export function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a percentage for display, e.g. "12.34%" */
export function formatPct(pct: number, decimals = 2): string {
  return `${pct.toFixed(decimals)}%`;
}
