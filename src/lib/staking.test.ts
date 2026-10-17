/**
 * Unit tests for src/lib/staking.ts — pure utility functions.
 */

import { describe, expect, it } from "vitest";

import {
  aggregateDailyRewards,
  calculateCompoundingYield,
  calculateEstimatedRewards,
  calculateNetApy,
  calculateNetRewardRate,
  calculatePartialRedelegationYield,
  calculateUnbondingCompletion,
  calculateUnbondingCompletionIso,
  computeUptimePct,
  createDefaultFilter,
  DEFAULT_EPOCH_DURATION_MS,
  DEFAULT_UNBONDING_DAYS,
  estimateDelegationFeeXlm,
  estimateUnbondingCompletion,
  estimateUnbondingCompletionIso,
  filterValidators,
  formatPct,
  formatXlm,
  generateMockRewardHistory,
  getEpochBoundaries,
  MOCK_DELEGATIONS,
  MOCK_VALIDATORS,
  REWARD_HISTORY_DAYS,
  totalClaimableXlm,
  totalDelegatedXlm,
  totalPendingXlm,
  totalRewardHistoryXlm,
  validateDelegationAmount,
} from "./staking";

// ─── formatXlm ────────────────────────────────────────────────────────────────

describe("formatXlm", () => {
  it("formats a number with default 4 decimals", () => {
    expect(formatXlm(1234.5)).toBe("1,234.5 XLM");
  });

  it("formats a string input", () => {
    expect(formatXlm("500")).toBe("500 XLM");
  });

  it("formats zero", () => {
    expect(formatXlm(0)).toBe("0 XLM");
  });

  it("uses custom decimal places", () => {
    expect(formatXlm(1.23456789, 2)).toBe("1.23 XLM");
  });

  it("handles NaN / non-finite gracefully", () => {
    expect(formatXlm(NaN)).toBe("0 XLM");
    expect(formatXlm(Infinity)).toBe("0 XLM");
  });
});

// ─── formatPct ────────────────────────────────────────────────────────────────

describe("formatPct", () => {
  it("formats a percentage with one decimal", () => {
    expect(formatPct(8.4)).toBe("8.4%");
  });

  it("formats zero", () => {
    expect(formatPct(0)).toBe("0.0%");
  });

  it("formats 100", () => {
    expect(formatPct(100)).toBe("100.0%");
  });
});

// ─── totalDelegatedXlm ────────────────────────────────────────────────────────

describe("totalDelegatedXlm", () => {
  it("sums amounts across delegations", () => {
    expect(totalDelegatedXlm(MOCK_DELEGATIONS)).toBeCloseTo(8500, 0);
  });

  it("returns 0 for empty list", () => {
    expect(totalDelegatedXlm([])).toBe(0);
  });

  it("handles a single delegation", () => {
    expect(
      totalDelegatedXlm([
        {
          validatorId: "V1",
          amount: "1000",
          pendingReward: "0",
          claimableReward: "0",
          delegatedAt: "",
        },
      ]),
    ).toBe(1000);
  });
});

// ─── totalClaimableXlm ───────────────────────────────────────────────────────

describe("totalClaimableXlm", () => {
  it("sums claimable rewards", () => {
    const total = totalClaimableXlm(MOCK_DELEGATIONS);
    // 12.875 + 6.12 + 2.43 = 21.425
    expect(total).toBeCloseTo(21.425, 2);
  });

  it("returns 0 for empty list", () => {
    expect(totalClaimableXlm([])).toBe(0);
  });
});

// ─── totalPendingXlm ─────────────────────────────────────────────────────────

describe("totalPendingXlm", () => {
  it("sums pending rewards", () => {
    const total = totalPendingXlm(MOCK_DELEGATIONS);
    // 3.421 + 1.98 + 0.61 = 6.011
    expect(total).toBeCloseTo(6.011, 2);
  });

  it("returns 0 for empty list", () => {
    expect(totalPendingXlm([])).toBe(0);
  });
});

// ─── estimateDelegationFeeXlm ────────────────────────────────────────────────

describe("estimateDelegationFeeXlm", () => {
  it("converts 100 stroops to XLM correctly", () => {
    expect(estimateDelegationFeeXlm(100)).toBeCloseTo(0.00001, 6);
  });

  it("uses the default base fee when no arg given", () => {
    expect(estimateDelegationFeeXlm()).toBeCloseTo(0.00001, 6);
  });
});

// ─── validateDelegationAmount ────────────────────────────────────────────────

describe("validateDelegationAmount", () => {
  it("returns null for a valid delegate amount", () => {
    expect(validateDelegationAmount("100", 500, "delegate")).toBeNull();
  });

  it("returns an error for empty input", () => {
    expect(validateDelegationAmount("", 500, "delegate")).toBeTruthy();
  });

  it("returns an error for zero", () => {
    expect(validateDelegationAmount("0", 500, "delegate")).toBeTruthy();
  });

  it("returns an error when amount is below minimum", () => {
    expect(validateDelegationAmount("0.5", 500, "delegate")).toBeTruthy();
  });

  it("returns an error when delegate amount exceeds available balance", () => {
    expect(validateDelegationAmount("600", 500, "delegate")).toBeTruthy();
  });

  it("returns null when delegate amount equals available balance", () => {
    expect(validateDelegationAmount("500", 500, "delegate")).toBeNull();
  });

  it("returns an error when undelegate amount exceeds delegation", () => {
    expect(validateDelegationAmount("200", 9999, "undelegate", 100)).toBeTruthy();
  });

  it("returns null for valid undelegate amount", () => {
    expect(validateDelegationAmount("50", 9999, "undelegate", 100)).toBeNull();
  });

  it("returns an error for non-numeric input", () => {
    expect(validateDelegationAmount("abc", 500, "delegate")).toBeTruthy();
  });
});

// ─── aggregateDailyRewards ───────────────────────────────────────────────────

describe("aggregateDailyRewards", () => {
  it("returns an empty array for no events", () => {
    expect(aggregateDailyRewards([])).toEqual([]);
  });

  it("excludes events older than the cutoff", () => {
    const old = {
      id: "old",
      date: "2000-01-01",
      amount: "99",
      validatorId: "V1",
    };
    const result = aggregateDailyRewards([old]);
    expect(result).toHaveLength(0);
  });

  it("includes events from today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const event = { id: "e1", date: today, amount: "1.5", validatorId: "V1" };
    const result = aggregateDailyRewards([event]);
    expect(result).toHaveLength(1);
    expect(result[0].totalXlm).toBeCloseTo(1.5, 4);
  });

  it("aggregates multiple events on the same day", () => {
    const today = new Date().toISOString().slice(0, 10);
    const events = [
      { id: "e1", date: today, amount: "1.0", validatorId: "V1" },
      { id: "e2", date: today, amount: "2.5", validatorId: "V2" },
    ];
    const result = aggregateDailyRewards(events);
    expect(result).toHaveLength(1);
    expect(result[0].totalXlm).toBeCloseTo(3.5, 4);
  });

  it("returns entries sorted ascending by date", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const d0 = yesterday.toISOString().slice(0, 10);
    const d1 = today.toISOString().slice(0, 10);
    const events = [
      { id: "b", date: d1, amount: "1", validatorId: "V1" },
      { id: "a", date: d0, amount: "2", validatorId: "V1" },
    ];
    const result = aggregateDailyRewards(events);
    expect(result[0].date).toBe(d0);
    expect(result[1].date).toBe(d1);
  });
});

// ─── totalRewardHistoryXlm ───────────────────────────────────────────────────

describe("totalRewardHistoryXlm", () => {
  it("sums totalXlm across daily rewards", () => {
    const history = [
      { date: "2025-01-01", totalXlm: 1.5 },
      { date: "2025-01-02", totalXlm: 2.0 },
    ];
    expect(totalRewardHistoryXlm(history)).toBeCloseTo(3.5, 4);
  });

  it("returns 0 for empty array", () => {
    expect(totalRewardHistoryXlm([])).toBe(0);
  });
});

// ─── generateMockRewardHistory ───────────────────────────────────────────────

describe("generateMockRewardHistory", () => {
  it("generates events for the last 30 days", () => {
    const events = generateMockRewardHistory();
    expect(events.length).toBeGreaterThan(0);
    // 3 validators × 30 days = 90 events
    expect(events.length).toBe(REWARD_HISTORY_DAYS * 3);
  });

  it("all events have a positive amount", () => {
    const events = generateMockRewardHistory();
    for (const e of events) {
      expect(parseFloat(e.amount)).toBeGreaterThan(0);
    }
  });

  it("all events have a date within the last 30 days", () => {
    const events = generateMockRewardHistory();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REWARD_HISTORY_DAYS - 1);
    for (const e of events) {
      expect(new Date(e.date).getTime()).toBeGreaterThan(cutoff.getTime());
    }
  });
});

// ─── filterValidators ────────────────────────────────────────────────────────

describe("filterValidators", () => {
  const defaultFilter = createDefaultFilter();

  it("returns all validators with no filters", () => {
    expect(filterValidators(MOCK_VALIDATORS, defaultFilter)).toHaveLength(
      MOCK_VALIDATORS.length,
    );
  });

  it("filters by name query (case-insensitive)", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      query: "alpha",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VALIDATOR_ALPHA");
  });

  it("filters by validator id", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      query: "VALIDATOR_BETA",
    });
    expect(result).toHaveLength(1);
  });

  it("returns empty array when query matches nothing", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      query: "zzz_no_match",
    });
    expect(result).toHaveLength(0);
  });

  it("filters by minApy", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      minApy: 8,
    });
    // Alpha (8.4), Gamma (9.1) — Beta (7.9), Delta (7.2), Epsilon (6.8), Zeta (0) are excluded
    expect(result.every((v) => v.apyPct >= 8)).toBe(true);
  });

  it("filters by maxCommission", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      maxCommission: 5,
    });
    expect(result.every((v) => v.commissionPct <= 5)).toBe(true);
  });

  it("filters by status=active", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      status: "active",
    });
    expect(result.every((v) => v.status === "active")).toBe(true);
    expect(result.find((v) => v.id === "VALIDATOR_ZETA")).toBeUndefined();
  });

  it("filters by status=jailed", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      status: "jailed",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("VALIDATOR_ZETA");
  });

  it("sorts by APY descending by default", () => {
    const result = filterValidators(MOCK_VALIDATORS, defaultFilter);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].apyPct).toBeGreaterThanOrEqual(result[i + 1].apyPct);
    }
  });

  it("sorts by commission ascending", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      sortField: "commission",
      sortDirection: "asc",
    });
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].commissionPct).toBeLessThanOrEqual(
        result[i + 1].commissionPct,
      );
    }
  });

  it("sorts by rank ascending", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      sortField: "rank",
      sortDirection: "asc",
    });
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].rank).toBeLessThanOrEqual(result[i + 1].rank);
    }
  });

  it("sorts by uptime descending", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      sortField: "uptime",
      sortDirection: "desc",
    });
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].uptimePct).toBeGreaterThanOrEqual(
        result[i + 1].uptimePct,
      );
    }
  });

  it("sorts by totalStaked descending", () => {
    const result = filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      sortField: "totalStaked",
      sortDirection: "desc",
    });
    for (let i = 0; i < result.length - 1; i++) {
      expect(parseFloat(result[i].totalStaked)).toBeGreaterThanOrEqual(
        parseFloat(result[i + 1].totalStaked),
      );
    }
  });

  it("does not mutate the original array", () => {
    const original = [...MOCK_VALIDATORS];
    filterValidators(MOCK_VALIDATORS, {
      ...defaultFilter,
      sortField: "rank",
      sortDirection: "asc",
    });
    expect(MOCK_VALIDATORS).toEqual(original);
  });
});

// ─── createDefaultFilter ─────────────────────────────────────────────────────

describe("createDefaultFilter", () => {
  it("returns a filter with empty query and desc APY sort", () => {
    const f = createDefaultFilter();
    expect(f.query).toBe("");
    expect(f.sortField).toBe("apy");
    expect(f.sortDirection).toBe("desc");
    expect(f.status).toBe("all");
  });
});

describe("computeUptimePct (#689)", () => {
  it("returns null for a new validator with 0 recorded pings", () => {
    expect(
      computeUptimePct({ uptimePct: 0, pingCount: 0, successfulPings: 0 }),
    ).toBeNull();
  });

  it("returns null when pingCount is 0 even if uptimePct is set", () => {
    expect(computeUptimePct({ uptimePct: 100, pingCount: 0 })).toBeNull();
  });

  it("derives the percentage from ping counts", () => {
    expect(
      computeUptimePct({ uptimePct: 0, pingCount: 400, successfulPings: 398 }),
    ).toBeCloseTo(99.5);
  });

  it("clamps inconsistent ping counts into 0–100", () => {
    expect(
      computeUptimePct({ uptimePct: 0, pingCount: 10, successfulPings: 12 }),
    ).toBe(100);
    expect(
      computeUptimePct({ uptimePct: 0, pingCount: 10, successfulPings: -1 }),
    ).toBe(0);
  });

  it("falls back to uptimePct when only pingCount is known", () => {
    expect(computeUptimePct({ uptimePct: 97.2, pingCount: 50 })).toBe(97.2);
  });

  it("uses uptimePct when no ping data is provided", () => {
    expect(computeUptimePct({ uptimePct: 99.9 })).toBe(99.9);
  });

  it("returns null instead of NaN or Infinity", () => {
    expect(
      computeUptimePct({ uptimePct: 0, pingCount: Number.NaN }),
    ).toBeNull();
  });
});

// ─── calculateNetRewardRate & calculateNetApy (#972) ──────────────────────────

describe("calculateNetRewardRate & calculateNetApy (#972)", () => {
  it("deducts validator commission percentage: grossReward * (1 - validatorCommission / 100)", () => {
    // 10% gross APY with 10% commission = 9% net
    expect(calculateNetRewardRate(10, 10)).toBeCloseTo(9, 6);

    // 8.4% gross APY with 5% commission = 7.98% net
    expect(calculateNetRewardRate(8.4, 5)).toBeCloseTo(7.98, 6);

    // 12% gross APY with 25% commission = 9% net
    expect(calculateNetRewardRate(12, 25)).toBeCloseTo(9, 6);
  });

  it("returns the full gross reward rate when validator commission is 0%", () => {
    expect(calculateNetRewardRate(8.5, 0)).toBeCloseTo(8.5, 6);
    expect(calculateNetApy(12.0, 0)).toBeCloseTo(12.0, 6);
  });

  it("returns 0% net reward rate when validator commission is 100%", () => {
    expect(calculateNetRewardRate(10, 100)).toBe(0);
    expect(calculateNetApy(15, 100)).toBe(0);
  });

  it("clamps validator commission within 0–100%", () => {
    // Commission > 100% is clamped to 100% -> 0% net
    expect(calculateNetRewardRate(10, 150)).toBe(0);
    // Negative commission is clamped to 0% -> full gross
    expect(calculateNetRewardRate(10, -5)).toBeCloseTo(10, 6);
  });

  it("handles non-finite or non-positive gross rewards gracefully", () => {
    expect(calculateNetRewardRate(0, 10)).toBe(0);
    expect(calculateNetRewardRate(-5, 10)).toBe(0);
    expect(calculateNetRewardRate(NaN, 10)).toBe(0);
    expect(calculateNetRewardRate(Infinity, 10)).toBe(0);
  });

  it("calculateNetApy is an identical alias for calculateNetRewardRate", () => {
    expect(calculateNetApy(9.1, 3)).toBe(calculateNetRewardRate(9.1, 3));
    expect(calculateNetApy(9.1, 3)).toBeCloseTo(9.1 * (1 - 0.03), 6);
  });
});

// ─── calculateEstimatedRewards (#972) ─────────────────────────────────────────

describe("calculateEstimatedRewards (#972)", () => {
  it("reflects validator commission deductions when computing net reward rate", () => {
    // When called with 2 numbers (grossReward, validatorCommission)
    const netRate = calculateEstimatedRewards(10, 10);
    expect(netRate).toBeCloseTo(9, 6);
  });

  it("calculates estimated XLM rewards on an amount with commission deducted", () => {
    // 10,000 XLM at 10% gross APY with 10% commission over 1 year (365 days)
    // Net APY = 9% -> Expected reward = 900 XLM (without commission deduction it would be 1000 XLM)
    const reward = calculateEstimatedRewards(10000, 10, 10);
    expect(reward).toBeCloseTo(900, 4);
  });

  it("calculates rewards for a custom duration (e.g. 30 days)", () => {
    // 10,000 XLM at 10% gross with 10% commission (9% net) for 30 days
    // 10000 * 0.09 * (30 / 365) = 73.9726 XLM
    const reward = calculateEstimatedRewards(10000, 10, 10, 30);
    expect(reward).toBeCloseTo(10000 * 0.09 * (30 / 365), 4);
  });

  it("supports passing a Validator object", () => {
    const alphaValidator = MOCK_VALIDATORS[0]; // apyPct: 8.4, commissionPct: 5
    // Net rate = 8.4 * (1 - 0.05) = 7.98%
    // 5000 XLM * 7.98% = 399 XLM
    const reward = calculateEstimatedRewards(5000, alphaValidator);
    expect(reward).toBeCloseTo(399, 4);
  });

  it("supports options object parameter", () => {
    const result = calculateEstimatedRewards({
      amount: "10000",
      grossReward: 10,
      validatorCommission: 10,
      days: 365,
    });
    expect(result).toBeCloseTo(900, 4);
  });

  it("returns net rate if amount is omitted from options", () => {
    const netApy = calculateEstimatedRewards({
      grossReward: 8.0,
      validatorCommission: 10,
    });
    expect(netApy).toBeCloseTo(7.2, 6);
  });

  it("supports compounding option in calculateEstimatedRewards", () => {
    // 10,000 XLM at 10% gross APY with 10% commission (9% net) with daily compounding
    // Daily compounding: 10000 * ((1 + 0.09/365)^365 - 1) ≈ 941.62 XLM
    const compoundReward = calculateEstimatedRewards({
      amount: 10000,
      grossReward: 10,
      validatorCommission: 10,
      compound: true,
      days: 365,
    });
    const simpleReward = calculateEstimatedRewards({
      amount: 10000,
      grossReward: 10,
      validatorCommission: 10,
      compound: false,
      days: 365,
    });

    expect(compoundReward).toBeCloseTo(941.62, 1);
    expect(simpleReward).toBeCloseTo(900.0, 1);
    expect(compoundReward).toBeGreaterThan(simpleReward);
  });
});

// ─── calculateCompoundingYield (#972) ─────────────────────────────────────────

describe("calculateCompoundingYield (#972)", () => {
  it("computes daily compounding yield after commission deduction", () => {
    // 10,000 XLM at 10% gross APY, 10% commission -> 9% net
    // Formula: 10000 * ((1 + 0.09/365)^365 - 1) ≈ 941.62
    const yieldAmount = calculateCompoundingYield(10000, 10, 10, 365, 365);
    expect(yieldAmount).toBeCloseTo(941.62, 1);
  });

  it("compounds over a partial year (e.g. 180 days)", () => {
    const yield180 = calculateCompoundingYield(10000, 10, 10, 180, 365);
    const expected = 10000 * (Math.pow(1 + 0.09 / 365, 365 * (180 / 365)) - 1);
    expect(yield180).toBeCloseTo(expected, 4);
  });

  it("supports monthly compounding (12 periods per year)", () => {
    // 10,000 XLM at 12% gross, 0% commission -> 12% net, 12 periods
    // 10000 * ((1 + 0.12/12)^12 - 1) = 10000 * (1.01^12 - 1) ≈ 1268.25
    const monthlyYield = calculateCompoundingYield(10000, 12, 0, 365, 12);
    expect(monthlyYield).toBeCloseTo(1268.25, 1);
  });

  it("returns 0 for non-positive principals or 100% commission", () => {
    expect(calculateCompoundingYield(0, 10, 10)).toBe(0);
    expect(calculateCompoundingYield(-1000, 10, 10)).toBe(0);
    expect(calculateCompoundingYield(1000, 10, 100)).toBe(0);
    expect(calculateCompoundingYield(1000, 0, 0)).toBe(0);
  });
});

// ─── Protocol Epoch Boundaries & Unbonding Completion (#972) ───────────────────

describe("estimateUnbondingCompletion & Protocol Epoch Boundaries (#972)", () => {
  it("determines epoch start and close boundaries", () => {
    // Reference epoch: 2026-01-01T00:00:00.000Z
    const ref = new Date("2026-01-01T00:00:00.000Z").getTime();
    const testTime = new Date("2026-01-01T14:30:00.000Z");

    const boundaries = getEpochBoundaries(testTime, {
      epochReferenceTime: ref,
      epochDurationMs: DEFAULT_EPOCH_DURATION_MS,
    });

    expect(boundaries.epochStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(boundaries.epochClose.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(boundaries.epochDurationMs).toBe(DEFAULT_EPOCH_DURATION_MS);
  });

  it("does NOT assume a static 21-day period from request time when submitted mid-epoch", () => {
    // Request is made on Day 1 at 15:30:00 UTC
    const requestDate = new Date("2026-05-01T15:30:00.000Z");

    // A static 21-day calculator would blindly add 21 days:
    // 2026-05-01T15:30:00.000Z + 21 days = 2026-05-22T15:30:00.000Z (mid-day!)
    const staticCompletionTime = new Date("2026-05-22T15:30:00.000Z");

    const epochCompletion = estimateUnbondingCompletion(requestDate, {
      unbondingDays: 21,
      epochDurationDays: 1,
      epochReferenceTime: "2026-05-01T00:00:00.000Z",
    });

    // With protocol epoch cycles:
    // Unbonding takes effect at the current epoch close (2026-05-02T00:00:00.000Z),
    // and locks for 21 days, completing at the epoch close boundary: 2026-05-23T00:00:00.000Z!
    expect(epochCompletion.toISOString()).toBe("2026-05-23T00:00:00.000Z");
    expect(epochCompletion.getTime()).not.toBe(staticCompletionTime.getTime());
    expect(epochCompletion.getTime()).toBeGreaterThan(staticCompletionTime.getTime());
  });

  it("completes exactly on the epoch boundary when requested at an epoch boundary", () => {
    // Request made exactly at epoch boundary 00:00:00.000Z
    const requestDate = new Date("2026-06-01T00:00:00.000Z");

    const epochCompletion = estimateUnbondingCompletion(requestDate, {
      unbondingDays: 21,
      epochDurationDays: 1,
      epochReferenceTime: "2026-06-01T00:00:00.000Z",
    });

    // 2026-06-01 00:00 + 21 days = 2026-06-22 00:00:00.000Z
    expect(epochCompletion.toISOString()).toBe("2026-06-22T00:00:00.000Z");
  });

  it("handles custom epoch durations (e.g. 12-hour epochs)", () => {
    // Request at 05:00 UTC (during the 00:00 - 12:00 epoch)
    const requestDate = new Date("2026-07-01T05:00:00.000Z");

    const completion = estimateUnbondingCompletion(requestDate, {
      unbondingDays: 2, // 48 hours
      epochDurationHours: 12,
      epochReferenceTime: "2026-07-01T00:00:00.000Z",
    });

    // Current epoch closes at 12:00 UTC on 2026-07-01.
    // 48 hours later = 2026-07-03T12:00:00.000Z (which aligns with a 12h epoch close!)
    expect(completion.toISOString()).toBe("2026-07-03T12:00:00.000Z");
  });

  it("handles weekly protocol epochs (7 days)", () => {
    // Request on Day 3 of Week 1
    const ref = new Date("2026-01-01T00:00:00.000Z");
    const requestDate = new Date("2026-01-04T10:00:00.000Z");

    const completion = estimateUnbondingCompletion(requestDate, {
      unbondingEpochs: 3, // 3 epochs = 21 days
      epochDurationDays: 7,
      epochReferenceTime: ref,
    });

    // Epoch 0 closes at Day 7 (2026-01-08T00:00:00.000Z).
    // Plus 3 epochs (21 days) = Day 28 (2026-01-29T00:00:00.000Z).
    expect(completion.toISOString()).toBe("2026-01-29T00:00:00.000Z");
  });

  it("calculateUnbondingCompletion is an identical alias for estimateUnbondingCompletion", () => {
    const request = "2026-09-01T12:00:00.000Z";
    const res1 = estimateUnbondingCompletion(request);
    const res2 = calculateUnbondingCompletion(request);
    expect(res1.getTime()).toBe(res2.getTime());
  });

  it("estimateUnbondingCompletionIso and calculateUnbondingCompletionIso return valid ISO-8601 strings", () => {
    const iso1 = estimateUnbondingCompletionIso("2026-09-01T12:00:00.000Z");
    const iso2 = calculateUnbondingCompletionIso("2026-09-01T12:00:00.000Z");
    expect(typeof iso1).toBe("string");
    expect(iso1).toBe(iso2);
    expect(new Date(iso1).toISOString()).toBe(iso1);
    expect(DEFAULT_UNBONDING_DAYS).toBe(21);
  });
});

// ─── Partial Redelegation & Compounding Tests (#972) ──────────────────────────

describe("calculatePartialRedelegationYield (#972)", () => {
  const sourceValidator = {
    id: "VALIDATOR_SOURCE",
    name: "Source Validator",
    apyPct: 8.0, // 8% gross
    commissionPct: 5.0, // 5% commission -> 7.6% net APY
  };

  const targetValidator = {
    id: "VALIDATOR_TARGET",
    name: "Target Validator",
    apyPct: 10.0, // 10% gross
    commissionPct: 10.0, // 10% commission -> 9.0% net APY
  };

  it("calculates partial redelegation yield with validator commission deductions", () => {
    // Initial stake: 10,000 XLM
    // Redelegate: 4,000 XLM to target validator
    // Remaining: 6,000 XLM with source validator
    const result = calculatePartialRedelegationYield({
      currentDelegationAmount: 10000,
      redelegationAmount: 4000,
      sourceValidator,
      targetValidator,
      days: 365,
      compound: false, // Simple yield verification
    });

    expect(result.remainingAmount).toBe(6000);
    expect(result.redelegatedAmount).toBe(4000);

    // Source net APY = 8.0 * (1 - 0.05) = 7.6%
    expect(result.sourceNetApy).toBeCloseTo(7.6, 6);

    // Target net APY = 10.0 * (1 - 0.10) = 9.0%
    expect(result.targetNetApy).toBeCloseTo(9.0, 6);

    // Remaining simple yield: 6000 * 0.076 = 456 XLM
    expect(result.remainingYield).toBeCloseTo(456, 4);

    // Redelegated simple yield: 4000 * 0.09 = 360 XLM
    expect(result.redelegatedYield).toBeCloseTo(360, 4);

    // Total yield: 456 + 360 = 816 XLM
    expect(result.totalYield).toBeCloseTo(816, 4);

    // Blended net APY: (6000 * 7.6 + 4000 * 9.0) / 10000 = 8.16%
    expect(result.blendedNetApy).toBeCloseTo(8.16, 6);
  });

  it("verifies compounding yield on both remaining and redelegated portions", () => {
    // With daily compounding (compound: true)
    const result = calculatePartialRedelegationYield({
      currentDelegationAmount: 10000,
      redelegationAmount: 4000,
      sourceValidator,
      targetValidator,
      days: 365,
      compound: true,
      compoundingPeriodsPerYear: 365,
    });

    // 6,000 XLM at 7.6% net compounded daily:
    // 6000 * ((1 + 0.076/365)^365 - 1) ≈ 473.86 XLM (vs 456 XLM simple)
    const expectedRemainingYield =
      6000 * (Math.pow(1 + 0.076 / 365, 365) - 1);
    expect(result.remainingYield).toBeCloseTo(expectedRemainingYield, 2);

    // 4,000 XLM at 9.0% net compounded daily:
    // 4000 * ((1 + 0.09/365)^365 - 1) ≈ 376.65 XLM (vs 360 XLM simple)
    const expectedRedelegatedYield =
      4000 * (Math.pow(1 + 0.09 / 365, 365) - 1);
    expect(result.redelegatedYield).toBeCloseTo(expectedRedelegatedYield, 2);

    // Total compounding yield is strictly greater than simple yield
    expect(result.totalYield).toBeCloseTo(
      expectedRemainingYield + expectedRedelegatedYield,
      2,
    );
    expect(result.totalYield).toBeGreaterThan(816);
  });

  it("handles 0 redelegation (100% remaining with source validator)", () => {
    const result = calculatePartialRedelegationYield({
      currentDelegationAmount: 10000,
      redelegationAmount: 0,
      sourceValidator,
      targetValidator,
      days: 365,
      compound: false,
    });

    expect(result.remainingAmount).toBe(10000);
    expect(result.redelegatedAmount).toBe(0);
    expect(result.redelegatedYield).toBe(0);
    expect(result.remainingYield).toBeCloseTo(760, 4);
    expect(result.totalYield).toBeCloseTo(760, 4);
    expect(result.blendedNetApy).toBeCloseTo(7.6, 6);
  });

  it("handles 100% redelegation (0 remaining with source validator)", () => {
    const result = calculatePartialRedelegationYield({
      currentDelegationAmount: 10000,
      redelegationAmount: 10000,
      sourceValidator,
      targetValidator,
      days: 365,
      compound: false,
    });

    expect(result.remainingAmount).toBe(0);
    expect(result.redelegatedAmount).toBe(10000);
    expect(result.remainingYield).toBe(0);
    expect(result.redelegatedYield).toBeCloseTo(900, 4);
    expect(result.totalYield).toBeCloseTo(900, 4);
    expect(result.blendedNetApy).toBeCloseTo(9.0, 6);
  });

  it("throws an error when redelegation amount exceeds delegation amount", () => {
    expect(() =>
      calculatePartialRedelegationYield({
        currentDelegationAmount: 1000,
        redelegationAmount: 1500,
        sourceValidator,
        targetValidator,
      }),
    ).toThrow(/exceeds/i);
  });

  it("throws an error for negative or invalid delegation amounts", () => {
    expect(() =>
      calculatePartialRedelegationYield({
        currentDelegationAmount: 1000,
        redelegationAmount: -50,
        sourceValidator,
        targetValidator,
      }),
    ).toThrow(/negative/i);

    expect(() =>
      calculatePartialRedelegationYield({
        currentDelegationAmount: -100,
        redelegationAmount: 50,
        sourceValidator,
        targetValidator,
      }),
    ).toThrow(/invalid/i);
  });
});

