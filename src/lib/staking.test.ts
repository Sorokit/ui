/**
 * Unit tests for src/lib/staking.ts — pure utility functions.
 */

import { describe, expect, it } from "vitest";

import {
  aggregateDailyRewards,
  computeUptimePct,
  createDefaultFilter,
  estimateDelegationFeeXlm,
  filterValidators,
  formatPct,
  formatXlm,
  generateMockRewardHistory,
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
    expect(computeUptimePct({ uptimePct: Number.NaN })).toBeNull();
    expect(computeUptimePct({ uptimePct: Infinity })).toBeNull();
    expect(
      computeUptimePct({ uptimePct: 0, pingCount: Number.NaN }),
    ).toBeNull();
  });
});
