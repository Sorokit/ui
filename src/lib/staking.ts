/**
 * Staking library — pure types, calculation utilities, and mock data.
 *
 * All functions are side-effect-free so they can be tested in isolation.
 * No direct blockchain logic lives here — everything is wired through
 * the SorokitClient staking namespace at runtime.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** On-chain staking network (e.g. Stellar validator set) */
export type StakingNetwork = "mainnet" | "testnet";

/** Status reported by the validator */
export type ValidatorStatus = "active" | "jailed" | "inactive";

/** A single validator in the registry */
export interface Validator {
  /** Unique validator identifier (e.g. public key or node ID) */
  id: string;
  /** Human-readable name */
  name: string;
  /** URL of the validator's logo image */
  logoUrl?: string;
  /** Commission rate as a percentage 0–100 */
  commissionPct: number;
  /** Annualised percentage yield offered to delegators */
  apyPct: number;
  /** Historical uptime as a percentage 0–100 */
  uptimePct: number;
  /**
   * Total uptime checks (pings) recorded for this validator. A newly
   * registered validator has 0, in which case uptime cannot be computed yet.
   */
  pingCount?: number;
  /** Number of recorded pings that succeeded. Used with `pingCount`. */
  successfulPings?: number;
  /** Total amount staked with this validator (in XLM) */
  totalStaked: string;
  /** Number of unique delegators */
  delegatorCount: number;
  /** Current operational status */
  status: ValidatorStatus;
  /** Rank by total stake (lower = larger) */
  rank: number;
  /** Validator's self-bond amount (in XLM) */
  selfBond: string;
  /** Optional website URL */
  website?: string;
  /** Optional description */
  description?: string;
}

/** A user's delegation to a specific validator */
export interface Delegation {
  /** Matches Validator.id */
  validatorId: string;
  /** Delegated amount in XLM */
  amount: string;
  /** Pending (not-yet-claimable) reward in XLM */
  pendingReward: string;
  /** Claimable reward in XLM */
  claimableReward: string;
  /** ISO-8601 timestamp of the most recent delegation change */
  delegatedAt: string;
  /** Unbonding amount (XLM), if an undelegation is in progress */
  unbondingAmount?: string;
  /** ISO-8601 timestamp when unbonding completes */
  unbondingEndsAt?: string;
}

/** A single reward payout event */
export interface RewardEvent {
  id: string;
  /** ISO-8601 date (YYYY-MM-DD) */
  date: string;
  /** Amount earned in XLM */
  amount: string;
  /** Validator that generated the reward */
  validatorId: string;
  /** Transaction hash for the payout */
  txHash?: string;
}

/** Aggregated daily reward bucket for the history chart */
export interface DailyReward {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Total XLM earned across all validators that day */
  totalXlm: number;
}

/** Pending reward schedule entry */
export interface RewardScheduleEntry {
  /** Estimated ISO-8601 date */
  estimatedDate: string;
  /** Estimated XLM amount */
  estimatedAmount: string;
  /** Associated validator */
  validatorId: string;
}

/** Claim result returned after a successful on-chain claim */
export interface ClaimResult {
  txHash: string;
  amount: string;
  validatorId: string;
  claimedAt: string;
}

/** Delegation change request (adjust/undelegate) */
export interface DelegationChangeRequest {
  validatorId: string;
  /** "delegate" increases; "undelegate" decreases */
  type: "delegate" | "undelegate";
  /** Amount to add or remove in XLM */
  amount: string;
}

/** Result of a delegation change */
export interface DelegationChangeResult {
  txHash: string;
  validatorId: string;
  type: "delegate" | "undelegate";
  amount: string;
  completedAt: string;
}

// ─── Sort / filter ────────────────────────────────────────────────────────────

export type ValidatorSortField = "apy" | "commission" | "uptime" | "totalStaked" | "rank";
export type SortDirection = "asc" | "desc";

export interface ValidatorFilter {
  query: string;
  minApy?: number;
  maxCommission?: number;
  minUptime?: number;
  status?: ValidatorStatus | "all";
  sortField: ValidatorSortField;
  sortDirection: SortDirection;
}

// ─── Protocol Epoch & Yield Types ───────────────────────────────────────────

/** Protocol epoch configuration */
export interface ProtocolEpochConfig {
  /** Epoch duration in milliseconds (default: 24h = 86,400,000 ms) */
  epochDurationMs?: number;
  /** Epoch duration in hours (convenience shorthand) */
  epochDurationHours?: number;
  /** Epoch duration in days (convenience shorthand) */
  epochDurationDays?: number;
  /** Reference timestamp / genesis for epoch cycle alignment (default: 0 / UTC epoch boundary) */
  epochReferenceTime?: Date | string | number;
  /** Current epoch index if known */
  currentEpoch?: number;
}

/** Options for estimating unbonding completion timestamp */
export interface UnbondingEstimateOptions extends ProtocolEpochConfig {
  /** Base unbonding period in days (default: 21) */
  unbondingDays?: number;
  /** Base unbonding period in epochs (overrides unbondingDays if provided) */
  unbondingEpochs?: number;
  /** Desired return format: "date" (returns Date) or "iso" (returns ISO string). Default is "date" */
  format?: "date" | "iso";
}

/** Parameters for reward yield calculation */
export interface EstimatedRewardsOptions {
  /** Delegated principal amount in XLM */
  amount?: number | string;
  /** Gross annual yield percentage (0–100) or reward rate */
  grossReward?: number;
  /** Alias for grossReward */
  grossApy?: number;
  /** Alias for grossReward */
  apyPct?: number;
  /** Validator commission rate (0–100) */
  validatorCommission?: number;
  /** Alias for validatorCommission */
  commissionPct?: number;
  /** Staking period in days (defaults to 365 for annual reward calculation) */
  days?: number;
  /** Whether to calculate compounding returns */
  compound?: boolean;
  /** Number of compounding periods per year (defaults to 365 for daily compounding) */
  compoundingPeriodsPerYear?: number;
}

/** Parameters for partial redelegation yield calculation */
export interface PartialRedelegationInput {
  /** Total or current delegation amount with the source validator */
  currentDelegationAmount: number | string;
  /** Amount to redelegate to the new target validator */
  redelegationAmount: number | string;
  /** Source validator or rates */
  sourceValidator: Pick<Validator, "apyPct" | "commissionPct">;
  /** Target validator or rates */
  targetValidator: Pick<Validator, "apyPct" | "commissionPct">;
  /** Staking duration in days (default: 365) */
  days?: number;
  /** Compounding frequency per year (default: 365 for daily) */
  compoundingPeriodsPerYear?: number;
  /** Whether to compound rewards (default: true) */
  compound?: boolean;
}

/** Result of a partial redelegation yield calculation */
export interface PartialRedelegationYieldResult {
  /** Amount remaining with the source validator */
  remainingAmount: number;
  /** Amount redelegated to the target validator */
  redelegatedAmount: number;
  /** Net APY of source validator after commission deduction */
  sourceNetApy: number;
  /** Net APY of target validator after commission deduction */
  targetNetApy: number;
  /** Yield earned on remaining stake */
  remainingYield: number;
  /** Yield earned on redelegated stake */
  redelegatedYield: number;
  /** Combined total yield across both validators */
  totalYield: number;
  /** Blended / effective net APY across the split position */
  blendedNetApy: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Delegation change fee estimate in stroops (100 = 0.00001 XLM base fee) */
export const DELEGATION_BASE_FEE_STROOPS = 100;

/** Stroops per XLM */
export const STROOPS_PER_XLM = 10_000_000;

/** Minimum delegation amount in XLM */
export const MIN_DELEGATION_XLM = 1;

/** Number of days shown in the reward history */
export const REWARD_HISTORY_DAYS = 30;

/** Default unbonding period in days when not checking custom epoch config */
export const DEFAULT_UNBONDING_DAYS = 21;

/** Default protocol epoch duration in milliseconds (24 hours = 1 day) */
export const DEFAULT_EPOCH_DURATION_MS = 24 * 60 * 60 * 1000;

// ─── Pure utility functions ───────────────────────────────────────────────────

/**
 * Sum all delegated amounts (in XLM) across a delegation list.
 */
export function totalDelegatedXlm(delegations: Delegation[]): number {
  return delegations.reduce((sum, d) => sum + parseFloat(d.amount), 0);
}

/**
 * Sum all claimable rewards across delegations.
 */
export function totalClaimableXlm(delegations: Delegation[]): number {
  return delegations.reduce((sum, d) => sum + parseFloat(d.claimableReward), 0);
}

/**
 * Sum all pending (not yet claimable) rewards.
 */
export function totalPendingXlm(delegations: Delegation[]): number {
  return delegations.reduce((sum, d) => sum + parseFloat(d.pendingReward), 0);
}

/**
 * Estimate the delegation change fee in XLM from a stroops base fee.
 */
export function estimateDelegationFeeXlm(baseFeeStroops = DELEGATION_BASE_FEE_STROOPS): number {
  return baseFeeStroops / STROOPS_PER_XLM;
}

/**
 * Format a number as XLM with up to `decimals` decimal places.
 */
export function formatXlm(value: number | string, decimals = 4): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(num)) return "0 XLM";
  return `${num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })} XLM`;
}

/**
 * Format a percentage value to one decimal place.
 */
/**
 * Resolve a validator's uptime percentage, or `null` when there is no data to
 * base it on yet — a newly registered validator with 0 recorded pings, or an
 * upstream value that isn't a finite number. Never returns NaN, so callers
 * can't end up rendering "NaN%".
 */
export function computeUptimePct(
  validator: Pick<Validator, "uptimePct" | "pingCount" | "successfulPings">,
): number | null {
  const { uptimePct, pingCount, successfulPings } = validator;
  if (pingCount !== undefined) {
    if (!Number.isFinite(pingCount) || pingCount <= 0) return null;
    if (successfulPings !== undefined && Number.isFinite(successfulPings)) {
      const pct = (successfulPings / pingCount) * 100;
      return Math.min(100, Math.max(0, pct));
    }
  }
  return Number.isFinite(uptimePct) ? uptimePct : null;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Compute the net reward rate after deducting validator commission:
 *   grossReward * (1 - validatorCommission / 100)
 *
 * Clamps commission to [0, 100] to prevent negative or inverted yields.
 */
export function calculateNetRewardRate(
  grossReward: number,
  validatorCommission = 0,
): number {
  if (!Number.isFinite(grossReward) || grossReward <= 0) return 0;
  const commission = Math.min(
    100,
    Math.max(0, Number.isFinite(validatorCommission) ? validatorCommission : 0),
  );
  return grossReward * (1 - commission / 100);
}

/** Alias for calculateNetRewardRate */
export const calculateNetApy = calculateNetRewardRate;

/**
 * Calculate compounded yield on an amount over `days` days at `grossReward` APY
 * after deducting `validatorCommission`.
 *
 * Formula: P * ((1 + r / n)^(n * t) - 1)
 * where r = netRewardRate / 100, t = days / 365, n = compoundingPeriodsPerYear.
 */
export function calculateCompoundingYield(
  principal: number | string,
  grossReward: number,
  validatorCommission = 0,
  days = 365,
  compoundingPeriodsPerYear = 365,
): number {
  const p = typeof principal === "string" ? parseFloat(principal) : principal;
  if (!Number.isFinite(p) || p <= 0) return 0;
  const netRate = calculateNetRewardRate(grossReward, validatorCommission);
  if (netRate <= 0) return 0;

  const r = netRate / 100;
  const t = days / 365;
  const n = compoundingPeriodsPerYear > 0 ? compoundingPeriodsPerYear : 365;

  return p * (Math.pow(1 + r / n, n * t) - 1);
}

export function calculateEstimatedRewards(
  options: EstimatedRewardsOptions,
): number;
export function calculateEstimatedRewards(
  grossReward: number,
  validatorCommission: number,
): number;
export function calculateEstimatedRewards(
  amount: number | string,
  validator: Pick<Validator, "apyPct" | "commissionPct">,
  days?: number,
  compound?: boolean,
  compoundingPeriodsPerYear?: number,
): number;
export function calculateEstimatedRewards(
  amount: number | string,
  grossReward: number,
  validatorCommission?: number,
  days?: number,
  compound?: boolean,
  compoundingPeriodsPerYear?: number,
): number;
export function calculateEstimatedRewards(
  amountOrGrossOrOptions: number | string | EstimatedRewardsOptions,
  grossRewardOrValidatorOrCommission?: number | Pick<Validator, "apyPct" | "commissionPct">,
  validatorCommissionOrDays?: number,
  daysOrCompound?: number | boolean,
  compound?: boolean | number,
  compoundingPeriodsPerYear = 365,
): number {
  // Case A: Options object
  if (typeof amountOrGrossOrOptions === "object" && amountOrGrossOrOptions !== null) {
    const opts = amountOrGrossOrOptions;
    const gross = opts.grossReward ?? opts.grossApy ?? opts.apyPct ?? 0;
    const comm = opts.validatorCommission ?? opts.commissionPct ?? 0;
    const netRate = calculateNetRewardRate(gross, comm);

    if (opts.amount === undefined || opts.amount === null || opts.amount === "") {
      return netRate;
    }

    const p = typeof opts.amount === "string" ? parseFloat(opts.amount) : opts.amount;
    if (!Number.isFinite(p) || p <= 0) return 0;

    const d = opts.days ?? 365;
    if (opts.compound) {
      const n = opts.compoundingPeriodsPerYear ?? 365;
      return calculateCompoundingYield(p, gross, comm, d, n);
    }
    return p * (netRate / 100) * (d / 365);
  }

  // Case B: amount + validator object
  if (
    typeof grossRewardOrValidatorOrCommission === "object" &&
    grossRewardOrValidatorOrCommission !== null
  ) {
    const p =
      typeof amountOrGrossOrOptions === "string"
        ? parseFloat(amountOrGrossOrOptions)
        : amountOrGrossOrOptions;
    const gross = grossRewardOrValidatorOrCommission.apyPct ?? 0;
    const comm = grossRewardOrValidatorOrCommission.commissionPct ?? 0;
    const d = typeof validatorCommissionOrDays === "number" ? validatorCommissionOrDays : 365;
    const isComp = typeof daysOrCompound === "boolean" ? daysOrCompound : false;
    const periods =
      typeof compound === "number" ? compound : (compoundingPeriodsPerYear ?? 365);

    if (isComp) {
      return calculateCompoundingYield(p, gross, comm, d, periods);
    }
    const netRate = calculateNetRewardRate(gross, comm);
    return p * (netRate / 100) * (d / 365);
  }

  // Case C: two number arguments (grossReward, validatorCommission)
  if (
    typeof amountOrGrossOrOptions === "number" &&
    typeof grossRewardOrValidatorOrCommission === "number" &&
    validatorCommissionOrDays === undefined
  ) {
    return calculateNetRewardRate(amountOrGrossOrOptions, grossRewardOrValidatorOrCommission);
  }

  // Case D: (amount, grossReward, validatorCommission, days, compound, compoundingPeriodsPerYear)
  const p =
    typeof amountOrGrossOrOptions === "string"
      ? parseFloat(amountOrGrossOrOptions)
      : amountOrGrossOrOptions;
  const gross =
    typeof grossRewardOrValidatorOrCommission === "number"
      ? grossRewardOrValidatorOrCommission
      : 0;
  const comm = typeof validatorCommissionOrDays === "number" ? validatorCommissionOrDays : 0;
  const d = typeof daysOrCompound === "number" ? daysOrCompound : 365;
  const isComp = typeof compound === "boolean" ? compound : false;
  const periods = compoundingPeriodsPerYear ?? 365;

  if (isComp) {
    return calculateCompoundingYield(p, gross, comm, d, periods);
  }
  const netRate = calculateNetRewardRate(gross, comm);
  return p * (netRate / 100) * (d / 365);
}

/**
 * Helper to resolve epoch duration in milliseconds.
 */
function resolveEpochDurationMs(config?: ProtocolEpochConfig): number {
  if (config?.epochDurationDays && config.epochDurationDays > 0) {
    return config.epochDurationDays * 24 * 60 * 60 * 1000;
  }
  if (config?.epochDurationHours && config.epochDurationHours > 0) {
    return config.epochDurationHours * 60 * 60 * 1000;
  }
  if (config?.epochDurationMs && config.epochDurationMs > 0) {
    return config.epochDurationMs;
  }
  return DEFAULT_EPOCH_DURATION_MS;
}

/**
 * Calculate current epoch boundaries (start, close, index) for a given timestamp.
 */
export function getEpochBoundaries(
  timestamp: Date | string | number = new Date(),
  config?: ProtocolEpochConfig,
): {
  currentEpoch: number;
  epochStart: Date;
  epochClose: Date;
  epochDurationMs: number;
} {
  const time = new Date(timestamp).getTime();
  const durationMs = resolveEpochDurationMs(config);
  const refTime = config?.epochReferenceTime
    ? new Date(config.epochReferenceTime).getTime()
    : 0;

  const elapsed = time - refTime;
  const epochIndex = Math.floor(elapsed / durationMs);
  const epochStartMs = refTime + epochIndex * durationMs;
  const epochCloseMs = epochStartMs + durationMs;

  return {
    currentEpoch: config?.currentEpoch ?? epochIndex,
    epochStart: new Date(epochStartMs),
    epochClose: new Date(epochCloseMs),
    epochDurationMs: durationMs,
  };
}

/**
 * Estimate unbonding completion time accounting for protocol epoch close cycles.
 *
 * Instead of assuming a static 21-day period from the exact moment of request,
 * unbonding begins at the close of the current protocol epoch and releases
 * on the epoch close cycle following the unbonding duration.
 */
export function estimateUnbondingCompletion(
  requestDate: Date | string | number = new Date(),
  options?: UnbondingEstimateOptions,
): Date {
  const reqTime = new Date(requestDate).getTime();
  const epochDurationMs = resolveEpochDurationMs(options);
  const refTime = options?.epochReferenceTime
    ? new Date(options.epochReferenceTime).getTime()
    : 0;

  // Unbonding takes effect at the close of the current epoch
  const elapsed = reqTime - refTime;
  const currentEpochIndex = Math.floor(elapsed / epochDurationMs);
  const currentEpochCloseTime =
    elapsed % epochDurationMs === 0
      ? reqTime
      : refTime + (currentEpochIndex + 1) * epochDurationMs;

  // Base unbonding duration in ms
  let unbondingDurationMs: number;
  if (options?.unbondingEpochs !== undefined && options.unbondingEpochs > 0) {
    unbondingDurationMs = options.unbondingEpochs * epochDurationMs;
  } else {
    const unbondingDays = options?.unbondingDays ?? DEFAULT_UNBONDING_DAYS;
    unbondingDurationMs = unbondingDays * 24 * 60 * 60 * 1000;
  }

  const targetEndTime = currentEpochCloseTime + unbondingDurationMs;
  const elapsedAtEnd = targetEndTime - refTime;
  const remainder = elapsedAtEnd % epochDurationMs;
  const finalCompletionTime =
    remainder === 0 ? targetEndTime : targetEndTime + (epochDurationMs - remainder);

  return new Date(finalCompletionTime);
}

/** Alias for estimateUnbondingCompletion */
export const calculateUnbondingCompletion = estimateUnbondingCompletion;

/**
 * Format the unbonding completion estimate as an ISO-8601 string.
 */
export function estimateUnbondingCompletionIso(
  requestDate: Date | string | number = new Date(),
  options?: UnbondingEstimateOptions,
): string {
  return estimateUnbondingCompletion(requestDate, options).toISOString();
}

/** Alias for estimateUnbondingCompletionIso */
export const calculateUnbondingCompletionIso = estimateUnbondingCompletionIso;

/**
 * Calculate compounding and simple yields when partially redelegating from one validator to another.
 *
 * Divides the initial stake between remaining stake at source validator and
 * redelegated stake at target validator, computing net yield on both positions
 * after deducting each validator's commission.
 */
export function calculatePartialRedelegationYield(
  input: PartialRedelegationInput,
): PartialRedelegationYieldResult {
  const currentTotal =
    typeof input.currentDelegationAmount === "string"
      ? parseFloat(input.currentDelegationAmount)
      : input.currentDelegationAmount;

  const redelegated =
    typeof input.redelegationAmount === "string"
      ? parseFloat(input.redelegationAmount)
      : input.redelegationAmount;

  if (!Number.isFinite(currentTotal) || currentTotal <= 0) {
    throw new Error("Invalid current delegation amount");
  }
  if (!Number.isFinite(redelegated) || redelegated < 0) {
    throw new Error("Redelegation amount cannot be negative");
  }
  if (redelegated > currentTotal) {
    throw new Error("Redelegation amount exceeds current delegation");
  }

  const remaining = currentTotal - redelegated;
  const days = input.days ?? 365;
  const compound = input.compound ?? true;
  const periods = input.compoundingPeriodsPerYear ?? 365;

  const sourceNetApy = calculateNetRewardRate(
    input.sourceValidator.apyPct,
    input.sourceValidator.commissionPct,
  );
  const targetNetApy = calculateNetRewardRate(
    input.targetValidator.apyPct,
    input.targetValidator.commissionPct,
  );

  const remainingYield = compound
    ? calculateCompoundingYield(
        remaining,
        input.sourceValidator.apyPct,
        input.sourceValidator.commissionPct,
        days,
        periods,
      )
    : remaining * (sourceNetApy / 100) * (days / 365);

  const redelegatedYield = compound
    ? calculateCompoundingYield(
        redelegated,
        input.targetValidator.apyPct,
        input.targetValidator.commissionPct,
        days,
        periods,
      )
    : redelegated * (targetNetApy / 100) * (days / 365);

  const totalYield = remainingYield + redelegatedYield;
  const blendedNetApy =
    currentTotal > 0
      ? (remaining * sourceNetApy + redelegated * targetNetApy) / currentTotal
      : 0;

  return {
    remainingAmount: remaining,
    redelegatedAmount: redelegated,
    sourceNetApy,
    targetNetApy,
    remainingYield,
    redelegatedYield,
    totalYield,
    blendedNetApy,
  };
}

/**
 * Aggregate raw reward events into daily buckets over the last `days` days.
 * Entries are sorted ascending by date.
 */
export function aggregateDailyRewards(
  events: RewardEvent[],
  days = REWARD_HISTORY_DAYS,
): DailyReward[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const buckets: Record<string, number> = {};

  for (const event of events) {
    const d = new Date(event.date);
    if (d < cutoff) continue;
    const key = event.date.slice(0, 10);
    buckets[key] = (buckets[key] ?? 0) + parseFloat(event.amount);
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, totalXlm]) => ({ date, totalXlm }));
}

/**
 * Total XLM earned over a DailyReward series.
 */
export function totalRewardHistoryXlm(history: DailyReward[]): number {
  return history.reduce((s, d) => s + d.totalXlm, 0);
}

/**
 * Filter and sort validators based on a ValidatorFilter.
 */
export function filterValidators(
  validators: Validator[],
  filter: ValidatorFilter,
): Validator[] {
  const q = filter.query.toLowerCase().trim();

  let result = validators.filter((v) => {
    if (q && !v.name.toLowerCase().includes(q) && !v.id.toLowerCase().includes(q)) {
      return false;
    }
    if (filter.minApy != null && v.apyPct < filter.minApy) return false;
    if (filter.maxCommission != null && v.commissionPct > filter.maxCommission) return false;
    if (filter.minUptime != null && v.uptimePct < filter.minUptime) return false;
    if (filter.status && filter.status !== "all" && v.status !== filter.status) return false;
    return true;
  });

  result = [...result].sort((a, b) => {
    let cmp = 0;
    switch (filter.sortField) {
      case "apy":
        cmp = a.apyPct - b.apyPct;
        break;
      case "commission":
        cmp = a.commissionPct - b.commissionPct;
        break;
      case "uptime":
        cmp = a.uptimePct - b.uptimePct;
        break;
      case "totalStaked":
        cmp = parseFloat(a.totalStaked) - parseFloat(b.totalStaked);
        break;
      case "rank":
        cmp = a.rank - b.rank;
        break;
    }
    return filter.sortDirection === "desc" ? -cmp : cmp;
  });

  return result;
}

/**
 * Build the default filter state.
 */
export function createDefaultFilter(): ValidatorFilter {
  return {
    query: "",
    minApy: undefined,
    maxCommission: undefined,
    minUptime: undefined,
    status: "all",
    sortField: "apy",
    sortDirection: "desc",
  };
}

/**
 * Validate a delegation amount string.
 * Returns an error message, or null if valid.
 */
export function validateDelegationAmount(
  raw: string,
  availableXlm: number,
  type: "delegate" | "undelegate",
  currentDelegation = 0,
): string | null {
  const val = parseFloat(raw);
  if (!raw || isNaN(val)) return "Enter an amount";
  if (val <= 0) return "Amount must be greater than zero";
  if (val < MIN_DELEGATION_XLM) return `Minimum is ${MIN_DELEGATION_XLM} XLM`;
  if (type === "delegate" && val > availableXlm) return "Insufficient balance";
  if (type === "undelegate" && val > currentDelegation) return "Exceeds delegated amount";
  return null;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

/** Deterministic stub validators for UI development and testing. */
export const MOCK_VALIDATORS: Validator[] = [
  {
    id: "VALIDATOR_ALPHA",
    name: "Alpha Staking",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=alpha",
    commissionPct: 5,
    apyPct: 8.4,
    uptimePct: 99.95,
    totalStaked: "12500000",
    delegatorCount: 842,
    status: "active",
    rank: 1,
    selfBond: "250000",
    website: "https://alpha-staking.example",
    description: "Top-tier validator with 5 years of uptime excellence.",
  },
  {
    id: "VALIDATOR_BETA",
    name: "Beta Nodes",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=beta",
    commissionPct: 8,
    apyPct: 7.9,
    uptimePct: 99.80,
    totalStaked: "9800000",
    delegatorCount: 631,
    status: "active",
    rank: 2,
    selfBond: "180000",
    website: "https://betanodes.example",
    description: "Enterprise-grade infrastructure based in three data centres.",
  },
  {
    id: "VALIDATOR_GAMMA",
    name: "Gamma Validator",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=gamma",
    commissionPct: 3,
    apyPct: 9.1,
    uptimePct: 99.50,
    totalStaked: "7200000",
    delegatorCount: 412,
    status: "active",
    rank: 3,
    selfBond: "100000",
    description: "Community-run validator with the lowest commission on the network.",
  },
  {
    id: "VALIDATOR_DELTA",
    name: "Delta Infrastructure",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=delta",
    commissionPct: 10,
    apyPct: 7.2,
    uptimePct: 98.90,
    totalStaked: "5500000",
    delegatorCount: 289,
    status: "active",
    rank: 4,
    selfBond: "75000",
    description: "Institutional validator serving custodians and funds.",
  },
  {
    id: "VALIDATOR_EPSILON",
    name: "Epsilon Network",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=epsilon",
    commissionPct: 12,
    apyPct: 6.8,
    uptimePct: 97.20,
    totalStaked: "3100000",
    delegatorCount: 155,
    status: "active",
    rank: 5,
    selfBond: "40000",
  },
  {
    id: "VALIDATOR_ZETA",
    name: "Zeta Node (Jailed)",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=zeta",
    commissionPct: 7,
    apyPct: 0,
    uptimePct: 72.00,
    totalStaked: "800000",
    delegatorCount: 44,
    status: "jailed",
    rank: 6,
    selfBond: "10000",
    description: "Currently jailed due to downtime. Avoid delegating.",
  },
];

/** Stub delegations for the connected wallet. */
export const MOCK_DELEGATIONS: Delegation[] = [
  {
    validatorId: "VALIDATOR_ALPHA",
    amount: "5000",
    pendingReward: "3.4210",
    claimableReward: "12.8750",
    delegatedAt: "2024-11-15T10:30:00Z",
  },
  {
    validatorId: "VALIDATOR_GAMMA",
    amount: "2500",
    pendingReward: "1.9800",
    claimableReward: "6.1200",
    delegatedAt: "2024-12-01T08:00:00Z",
  },
  {
    validatorId: "VALIDATOR_DELTA",
    amount: "1000",
    pendingReward: "0.6100",
    claimableReward: "2.4300",
    delegatedAt: "2025-01-10T14:15:00Z",
    unbondingAmount: "500",
    unbondingEndsAt: "2025-02-10T14:15:00Z",
  },
];

/** Generate stub reward event history for the last 30 days. */
export function generateMockRewardHistory(): RewardEvent[] {
  const events: RewardEvent[] = [];
  const validatorIds = ["VALIDATOR_ALPHA", "VALIDATOR_GAMMA", "VALIDATOR_DELTA"];
  const amounts = [0.18, 0.09, 0.035];
  const now = new Date();

  for (let i = REWARD_HISTORY_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    validatorIds.forEach((vid, idx) => {
      // Simulate small daily variance (±10%)
      const base = amounts[idx];
      const jitter = base * 0.1 * (Math.sin(i * idx + 1) * 0.5 + 0.5);
      events.push({
        id: `reward-${dateStr}-${vid}`,
        date: dateStr,
        amount: (base + jitter).toFixed(6),
        validatorId: vid,
      });
    });
  }

  return events;
}

/** Stub reward schedule (next 7 days of estimated payouts). */
export const MOCK_REWARD_SCHEDULE: RewardScheduleEntry[] = [
  {
    estimatedDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    })(),
    estimatedAmount: "0.42",
    validatorId: "VALIDATOR_ALPHA",
  },
  {
    estimatedDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      return d.toISOString().slice(0, 10);
    })(),
    estimatedAmount: "0.20",
    validatorId: "VALIDATOR_GAMMA",
  },
  {
    estimatedDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().slice(0, 10);
    })(),
    estimatedAmount: "0.08",
    validatorId: "VALIDATOR_DELTA",
  },
];
