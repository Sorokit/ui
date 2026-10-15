import { describe, expect, it } from "vitest";

import type { AllocationDiff, PortfolioAsset, SwapSuggestion } from "./rebalancer";
import {
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
  totalFeeStroops,
  totalRebalanceCostUsd,
  updateSwapStatus,
  weightedAverageSlippage,
} from "./rebalancer";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PRICES = { XLM: 0.1, USDC: 1.0, BTC: 60000, ETH: 3000 };

function makeAsset(
  assetCode: string,
  balance: string,
  currentPct = 0,
): PortfolioAsset {
  return {
    asset: assetCode,
    assetCode,
    balance,
    usdValue: null,
    currentPct,
  };
}

// ─── computeCurrentAllocations ────────────────────────────────────────────────

describe("computeCurrentAllocations", () => {
  it("assigns correct USD values and percentages for two assets", () => {
    const assets = [
      { asset: "XLM", assetCode: "XLM", balance: "1000", usdValue: null, currentPct: 0 },
      { asset: "USDC", assetCode: "USDC", balance: "100", usdValue: null, currentPct: 0 },
    ];
    // XLM = $100, USDC = $100, total = $200 → each 50%
    const result = computeCurrentAllocations(assets, PRICES);
    expect(result[0].usdValue).toBeCloseTo(100);
    expect(result[1].usdValue).toBeCloseTo(100);
    expect(result[0].currentPct).toBeCloseTo(50);
    expect(result[1].currentPct).toBeCloseTo(50);
  });

  it("handles assets with unknown prices (defaults to 0 USD value and 0%)", () => {
    const assets = [
      { asset: "UNKNOWN", assetCode: "UNKNOWN", balance: "500", usdValue: null, currentPct: 0 },
      { asset: "USDC", assetCode: "USDC", balance: "200", usdValue: null, currentPct: 0 },
    ];
    const result = computeCurrentAllocations(assets, PRICES);
    expect(result[0].usdValue).toBeNull();
    expect(result[0].currentPct).toBe(0);
    expect(result[1].currentPct).toBeCloseTo(100);
  });

  it("returns all 0% when total USD is zero", () => {
    const assets = [
      { asset: "UNKNOWN", assetCode: "UNKNOWN", balance: "100", usdValue: null, currentPct: 0 },
    ];
    const result = computeCurrentAllocations(assets, {});
    expect(result[0].currentPct).toBe(0);
  });

  it("handles a single asset at 100%", () => {
    const assets = [
      { asset: "XLM", assetCode: "XLM", balance: "5000", usdValue: null, currentPct: 0 },
    ];
    const result = computeCurrentAllocations(assets, PRICES);
    expect(result[0].currentPct).toBeCloseTo(100);
  });

  it("handles 5+ assets correctly", () => {
    const assets = [
      { asset: "XLM", assetCode: "XLM", balance: "10000", usdValue: null, currentPct: 0 }, // $1000
      { asset: "USDC", assetCode: "USDC", balance: "1000", usdValue: null, currentPct: 0 }, // $1000
      { asset: "BTC", assetCode: "BTC", balance: "0.01", usdValue: null, currentPct: 0 },  // $600
      { asset: "ETH", assetCode: "ETH", balance: "0.1", usdValue: null, currentPct: 0 },   // $300
      { asset: "UNKNOWN", assetCode: "UNKNOWN", balance: "999", usdValue: null, currentPct: 0 }, // $0
    ];
    const result = computeCurrentAllocations(assets, PRICES);
    const total = result.reduce((s, a) => s + a.currentPct, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(result[4].currentPct).toBe(0); // unknown price
  });
});

// ─── normaliseTargets ─────────────────────────────────────────────────────────

describe("normaliseTargets", () => {
  it("normalises values summing to 200 → each halved", () => {
    const result = normaliseTargets({ XLM: 100, USDC: 100 });
    expect(result.XLM).toBeCloseTo(50);
    expect(result.USDC).toBeCloseTo(50);
  });

  it("already-valid targets (sum = 100) are returned unchanged proportionally", () => {
    const result = normaliseTargets({ XLM: 60, USDC: 40 });
    expect(result.XLM).toBeCloseTo(60);
    expect(result.USDC).toBeCloseTo(40);
  });

  it("clamps negative values to 0 before normalising", () => {
    const result = normaliseTargets({ XLM: -10, USDC: 50 });
    expect(result.XLM).toBe(0);
    expect(result.USDC).toBeCloseTo(100);
  });

  it("returns input unchanged when total is 0", () => {
    const input = { XLM: 0, USDC: 0 };
    const result = normaliseTargets(input);
    expect(result).toEqual(input);
  });

  it("handles a single asset", () => {
    const result = normaliseTargets({ XLM: 37 });
    expect(result.XLM).toBeCloseTo(100);
  });
});

// ─── isTargetValid ────────────────────────────────────────────────────────────

describe("isTargetValid", () => {
  it("returns true for targets summing to exactly 100", () => {
    expect(isTargetValid({ XLM: 50, USDC: 50 })).toBe(true);
  });

  it("returns true within ±0.01 tolerance", () => {
    expect(isTargetValid({ XLM: 50, USDC: 49.995 })).toBe(true);
  });

  it("returns false when sum is 99", () => {
    expect(isTargetValid({ XLM: 50, USDC: 49 })).toBe(false);
  });

  it("returns false when sum is 101", () => {
    expect(isTargetValid({ XLM: 60, USDC: 41 })).toBe(false);
  });

  it("returns false for empty targets (sum = 0)", () => {
    expect(isTargetValid({})).toBe(false);
  });
});

// ─── computeAllocationDiffs ───────────────────────────────────────────────────

describe("computeAllocationDiffs", () => {
  const assets: PortfolioAsset[] = [
    makeAsset("XLM", "1000", 70),
    makeAsset("USDC", "100", 30),
  ];

  it("computes positive diff for an asset that needs to grow", () => {
    const diffs = computeAllocationDiffs(assets, { XLM: 40, USDC: 60 }, 1000);
    const xlm = diffs.find((d) => d.assetCode === "XLM")!;
    const usdc = diffs.find((d) => d.assetCode === "USDC")!;
    expect(xlm.diffPct).toBeCloseTo(-30);
    expect(usdc.diffPct).toBeCloseTo(30);
  });

  it("diffUsd is proportional to total portfolio value", () => {
    const diffs = computeAllocationDiffs(assets, { XLM: 40, USDC: 60 }, 2000);
    const usdc = diffs.find((d) => d.assetCode === "USDC")!;
    // 30% of $2000 = $600
    expect(usdc.diffUsd).toBeCloseTo(600);
  });

  it("includes an asset from targets that is not in current holdings", () => {
    const diffs = computeAllocationDiffs(assets, { XLM: 40, USDC: 40, BTC: 20 }, 1000);
    const btc = diffs.find((d) => d.assetCode === "BTC")!;
    expect(btc).toBeDefined();
    expect(btc.currentPct).toBe(0);
    expect(btc.diffPct).toBeCloseTo(20);
  });

  it("treats assets missing from targets as 0% target (full sell)", () => {
    const diffs = computeAllocationDiffs(assets, { XLM: 100 }, 1000);
    const usdc = diffs.find((d) => d.assetCode === "USDC")!;
    expect(usdc.targetPct).toBe(0);
    expect(usdc.diffPct).toBeCloseTo(-30);
  });
});

// ─── estimateSlippagePct ──────────────────────────────────────────────────────

describe("estimateSlippagePct", () => {
  it("returns base slippage for a zero-size trade", () => {
    expect(estimateSlippagePct(0)).toBeCloseTo(SLIPPAGE_BASE_PCT);
  });

  it("increases linearly with trade size", () => {
    const small = estimateSlippagePct(1000);
    const large = estimateSlippagePct(2000);
    expect(large).toBeGreaterThan(small);
    expect(large - small).toBeCloseTo(0.05); // one extra $1k step
  });

  it("is always positive", () => {
    expect(estimateSlippagePct(-100)).toBeGreaterThanOrEqual(0);
  });
});

// ─── estimateSwapCostUsd ──────────────────────────────────────────────────────

describe("estimateSwapCostUsd", () => {
  it("returns combined swap fee + slippage cost", () => {
    const tradeUsd = 1000;
    const swapFeePct = DEFAULT_SWAP_FEE_PCT; // 0.3%
    const slippagePct = estimateSlippagePct(tradeUsd);
    const expected = tradeUsd * (swapFeePct / 100 + slippagePct / 100);
    expect(estimateSwapCostUsd(tradeUsd)).toBeCloseTo(expected);
  });

  it("scales with custom swap fee", () => {
    const lowFee = estimateSwapCostUsd(1000, 0.1);
    const highFee = estimateSwapCostUsd(1000, 1.0);
    expect(highFee).toBeGreaterThan(lowFee);
  });
});

// ─── generateSwapSuggestions ──────────────────────────────────────────────────

describe("generateSwapSuggestions", () => {
  const diffs: AllocationDiff[] = [
    { asset: "XLM", assetCode: "XLM", currentPct: 70, targetPct: 40, diffPct: -30, diffUsd: -300 },
    { asset: "USDC", assetCode: "USDC", currentPct: 30, targetPct: 60, diffPct: 30, diffUsd: 300 },
  ];

  it("generates one swap for a simple 2-asset rebalance", () => {
    const swaps = generateSwapSuggestions(diffs, PRICES);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].from).toBe("XLM");
    expect(swaps[0].to).toBe("USDC");
  });

  it("fromAmount reflects the XLM price correctly", () => {
    const swaps = generateSwapSuggestions(diffs, PRICES);
    // $300 of XLM at $0.10/XLM = 3000 XLM
    expect(swaps[0].fromAmount).toBeCloseTo(3000);
  });

  it("toAmountExpected accounts for slippage", () => {
    const swaps = generateSwapSuggestions(diffs, PRICES);
    const slippage = estimateSlippagePct(300);
    // $300 * (1 - slippage%) / $1.0 USDC
    const expected = (300 * (1 - slippage / 100)) / 1.0;
    expect(swaps[0].toAmountExpected).toBeCloseTo(expected);
  });

  it("returns empty array when all diffs are zero", () => {
    const zeroDiffs: AllocationDiff[] = [
      { asset: "XLM", assetCode: "XLM", currentPct: 50, targetPct: 50, diffPct: 0, diffUsd: 0 },
    ];
    expect(generateSwapSuggestions(zeroDiffs, PRICES)).toHaveLength(0);
  });

  it("skips swaps below the minimum trade threshold", () => {
    // diffUsd = $0.50, which is below MIN_TRADE_USD ($1)
    const tinyDiff: AllocationDiff[] = [
      { asset: "XLM", assetCode: "XLM", currentPct: 50.005, targetPct: 50, diffPct: -0.005, diffUsd: -0.5 },
      { asset: "USDC", assetCode: "USDC", currentPct: 49.995, targetPct: 50, diffPct: 0.005, diffUsd: 0.5 },
    ];
    expect(generateSwapSuggestions(tinyDiff, PRICES)).toHaveLength(0);
  });

  it("handles complex 5-asset rebalance without errors", () => {
    const complexDiffs: AllocationDiff[] = [
      { asset: "XLM", assetCode: "XLM", currentPct: 50, targetPct: 20, diffPct: -30, diffUsd: -300 },
      { asset: "USDC", assetCode: "USDC", currentPct: 20, targetPct: 30, diffPct: 10, diffUsd: 100 },
      { asset: "BTC", assetCode: "BTC", currentPct: 15, targetPct: 25, diffPct: 10, diffUsd: 100 },
      { asset: "ETH", assetCode: "ETH", currentPct: 10, targetPct: 20, diffPct: 10, diffUsd: 100 },
      { asset: "USDT", assetCode: "USDT", currentPct: 5, targetPct: 5, diffPct: 0, diffUsd: 0 },
    ];
    const swaps = generateSwapSuggestions(complexDiffs, { XLM: 0.1, USDC: 1, BTC: 60000, ETH: 3000, USDT: 1 });
    expect(swaps.length).toBeGreaterThan(0);
    // All swaps should be from XLM (the only seller)
    swaps.forEach((s) => expect(s.from).toBe("XLM"));
  });

  it("feeStroops equals BASE_FEE_STROOPS for each swap", () => {
    const swaps = generateSwapSuggestions(diffs, PRICES);
    swaps.forEach((s) => expect(s.feeStroops).toBe(BASE_FEE_STROOPS));
  });

  it("swapFeePct equals DEFAULT_SWAP_FEE_PCT for each swap", () => {
    const swaps = generateSwapSuggestions(diffs, PRICES);
    swaps.forEach((s) => expect(s.swapFeePct).toBe(DEFAULT_SWAP_FEE_PCT));
  });

  it("totalCostUsd includes the base fee passed in", () => {
    const baseFeeUsd = 0.05;
    const swaps = generateSwapSuggestions(diffs, PRICES, baseFeeUsd);
    const costWithoutBase = estimateSwapCostUsd(300);
    expect(swaps[0].totalCostUsd).toBeCloseTo(costWithoutBase + baseFeeUsd);
  });
});

// ─── totalRebalanceCostUsd ────────────────────────────────────────────────────

describe("totalRebalanceCostUsd", () => {
  const swaps: SwapSuggestion[] = [
    { from: "XLM", to: "USDC", fromAmount: 100, toAmountExpected: 10, slippagePct: 0.1, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 1.5 },
    { from: "XLM", to: "BTC", fromAmount: 200, toAmountExpected: 0.001, slippagePct: 0.15, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 2.5 },
  ];

  it("sums totalCostUsd across all swaps", () => {
    expect(totalRebalanceCostUsd(swaps)).toBeCloseTo(4.0);
  });

  it("returns 0 for empty swap list", () => {
    expect(totalRebalanceCostUsd([])).toBe(0);
  });
});

// ─── totalFeeStroops ──────────────────────────────────────────────────────────

describe("totalFeeStroops", () => {
  it("sums feeStroops across all swaps", () => {
    const swaps: SwapSuggestion[] = [
      { from: "XLM", to: "USDC", fromAmount: 1, toAmountExpected: 1, slippagePct: 0.1, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 1 },
      { from: "XLM", to: "BTC", fromAmount: 1, toAmountExpected: 1, slippagePct: 0.1, feeStroops: 200, swapFeePct: 0.3, totalCostUsd: 1 },
    ];
    expect(totalFeeStroops(swaps)).toBe(300);
  });

  it("returns 0 for empty list", () => {
    expect(totalFeeStroops([])).toBe(0);
  });
});

// ─── weightedAverageSlippage ──────────────────────────────────────────────────

describe("weightedAverageSlippage", () => {
  it("returns 0 for empty list", () => {
    expect(weightedAverageSlippage([])).toBe(0);
  });

  it("returns the single swap's slippage when there is only one swap", () => {
    const swaps: SwapSuggestion[] = [
      { from: "XLM", to: "USDC", fromAmount: 100, toAmountExpected: 10, slippagePct: 0.25, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 1 },
    ];
    expect(weightedAverageSlippage(swaps)).toBeCloseTo(0.25);
  });

  it("weights by fromAmount", () => {
    const swaps: SwapSuggestion[] = [
      { from: "XLM", to: "USDC", fromAmount: 100, toAmountExpected: 10, slippagePct: 0.1, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 1 },
      { from: "XLM", to: "BTC", fromAmount: 300, toAmountExpected: 1, slippagePct: 0.5, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 1 },
    ];
    // (100 * 0.1 + 300 * 0.5) / 400 = (10 + 150) / 400 = 0.4
    expect(weightedAverageSlippage(swaps)).toBeCloseTo(0.4);
  });
});

// ─── createInitialExecution ───────────────────────────────────────────────────

describe("createInitialExecution", () => {
  it("creates correct initial state for 3 swaps", () => {
    const exec = createInitialExecution(3);
    expect(exec.isRunning).toBe(false);
    expect(exec.currentSwapIndex).toBe(0);
    expect(exec.swapStatuses).toEqual(["pending", "pending", "pending"]);
    expect(exec.txHashes).toEqual([null, null, null]);
    expect(exec.errors).toEqual([null, null, null]);
    expect(exec.startedAt).toBeNull();
  });

  it("creates empty arrays for 0 swaps", () => {
    const exec = createInitialExecution(0);
    expect(exec.swapStatuses).toHaveLength(0);
    expect(exec.txHashes).toHaveLength(0);
  });
});

// ─── updateSwapStatus ─────────────────────────────────────────────────────────

describe("updateSwapStatus", () => {
  it("updates the status at the given index immutably", () => {
    const exec = createInitialExecution(3);
    const updated = updateSwapStatus(exec, 1, "success", "hash123");
    expect(updated.swapStatuses[1]).toBe("success");
    expect(updated.txHashes[1]).toBe("hash123");
    // Original unchanged
    expect(exec.swapStatuses[1]).toBe("pending");
  });

  it("stores error message when status is failed", () => {
    const exec = createInitialExecution(2);
    const updated = updateSwapStatus(exec, 0, "failed", null, "Insufficient balance");
    expect(updated.errors[0]).toBe("Insufficient balance");
    expect(updated.swapStatuses[0]).toBe("failed");
  });

  it("leaves other indices unchanged", () => {
    const exec = createInitialExecution(3);
    const updated = updateSwapStatus(exec, 2, "submitting");
    expect(updated.swapStatuses[0]).toBe("pending");
    expect(updated.swapStatuses[1]).toBe("pending");
    expect(updated.swapStatuses[2]).toBe("submitting");
  });
});

// ─── buildRebalanceRecord ─────────────────────────────────────────────────────

describe("buildRebalanceRecord", () => {
  const swaps: SwapSuggestion[] = [
    { from: "XLM", to: "USDC", fromAmount: 100, toAmountExpected: 10, slippagePct: 0.1, feeStroops: 100, swapFeePct: 0.3, totalCostUsd: 0.5 },
  ];

  it("marks record as successful when all swaps are 'success'", () => {
    const exec = { ...createInitialExecution(1), swapStatuses: ["success" as const], txHashes: ["hash1"], startedAt: new Date().toISOString() };
    const record = buildRebalanceRecord("id1", swaps, exec, { XLM: 70 }, { XLM: 40, USDC: 30 }, 0.5);
    expect(record.successful).toBe(true);
    expect(record.txHashes).toEqual(["hash1"]);
  });

  it("marks record as unsuccessful when any swap failed", () => {
    const exec = { ...createInitialExecution(1), swapStatuses: ["failed" as const], txHashes: [null], startedAt: new Date().toISOString() };
    const record = buildRebalanceRecord("id2", swaps, exec, {}, {}, 0);
    expect(record.successful).toBe(false);
  });

  it("marks record as successful when all swaps are 'skipped'", () => {
    const exec = { ...createInitialExecution(1), swapStatuses: ["skipped" as const], txHashes: [null], startedAt: new Date().toISOString() };
    const record = buildRebalanceRecord("id3", swaps, exec, {}, {}, 0);
    expect(record.successful).toBe(true);
  });

  it("stores before/after allocations and total fee", () => {
    const exec = { ...createInitialExecution(1), swapStatuses: ["success" as const], txHashes: ["h"], startedAt: "2024-01-01T00:00:00.000Z" };
    const record = buildRebalanceRecord("id4", swaps, exec, { XLM: 100 }, { XLM: 40, USDC: 60 }, 1.23);
    expect(record.before).toEqual({ XLM: 100 });
    expect(record.after).toEqual({ XLM: 40, USDC: 60 });
    expect(record.totalFeeUsd).toBe(1.23);
    expect(record.executedAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("filters out null txHashes", () => {
    const exec = {
      ...createInitialExecution(2),
      swapStatuses: ["success" as const, "failed" as const],
      txHashes: ["hash-a", null],
      startedAt: new Date().toISOString(),
    };
    const twoSwaps = [...swaps, ...swaps];
    const record = buildRebalanceRecord("id5", twoSwaps, exec, {}, {}, 0);
    expect(record.txHashes).toEqual(["hash-a"]);
  });
});

// ─── formatUsd ────────────────────────────────────────────────────────────────

describe("formatUsd", () => {
  it("formats integer amounts with two decimals", () => {
    expect(formatUsd(1234)).toMatch(/1,234\.00/);
  });

  it("formats fractional amounts correctly", () => {
    expect(formatUsd(0.5)).toMatch(/0\.50/);
  });

  it("includes a currency symbol", () => {
    const result = formatUsd(100);
    // Currency symbol varies by locale; just check it's not purely numeric
    expect(result).toMatch(/\d/);
    expect(result.length).toBeGreaterThan(3);
  });
});

// ─── formatPct ────────────────────────────────────────────────────────────────

describe("formatPct", () => {
  it("formats with 2 decimal places by default", () => {
    expect(formatPct(12.345)).toBe("12.35%");
  });

  it("respects custom decimals argument", () => {
    expect(formatPct(12.345, 1)).toBe("12.3%");
    expect(formatPct(12.345, 0)).toBe("12%");
  });

  it("handles zero", () => {
    expect(formatPct(0)).toBe("0.00%");
  });

  it("handles negative values", () => {
    expect(formatPct(-5.5)).toBe("-5.50%");
  });
});

// ─── MIN_TRADE_USD constant sanity check ──────────────────────────────────────

describe("constants", () => {
  it("MIN_TRADE_USD is positive", () => {
    expect(MIN_TRADE_USD).toBeGreaterThan(0);
  });

  it("BASE_FEE_STROOPS is 100", () => {
    expect(BASE_FEE_STROOPS).toBe(100);
  });

  it("DEFAULT_SWAP_FEE_PCT is 0.3", () => {
    expect(DEFAULT_SWAP_FEE_PCT).toBe(0.3);
  });
});

// ─── Precision & Zero-Balance Edge Cases (#970) ───────────────────────────────

describe("rebalancer precision and zero-balance edge cases (#970)", () => {
  it("returns an empty suggestion array without throwing when initial portfolio balance is zero", () => {
    const emptyAssets = [
      makeAsset("XLM", "0"),
      makeAsset("USDC", "0"),
    ];
    const allocated = computeCurrentAllocations(emptyAssets, PRICES);
    expect(allocated.every((a) => a.currentPct === 0)).toBe(true);

    const diffs = computeAllocationDiffs(allocated, { XLM: 50, USDC: 50 }, 0);
    expect(diffs.every((d) => d.diffUsd === 0)).toBe(true);

    const suggestions = generateSwapSuggestions(diffs, PRICES);
    expect(suggestions).toEqual([]);
  });

  it("balances 7-decimal native XLM and 18-decimal wrapped tokens without rounding drift", () => {
    const assets = [
      makeAsset("XLM", "1000.1234567"),
      makeAsset("WETH", "0.033337448556666667"),
    ];
    const decimals = { XLM: 7, WETH: 18 };
    const prices = { XLM: 0.1, WETH: 3000 };
    const allocated = computeCurrentAllocations(assets, prices, decimals);
    const pctSum = allocated.reduce((s, a) => s + a.currentPct, 0);
    expect(pctSum).toBeCloseTo(100, 10);

    const totalUsd = allocated.reduce((s, a) => s + (a.usdValue ?? 0), 0);
    const diffs = computeAllocationDiffs(allocated, { XLM: 25, WETH: 75 }, totalUsd);
    const swaps = generateSwapSuggestions(diffs, prices, 0.01, decimals);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].from).toBe("XLM");
    expect(swaps[0].to).toBe("WETH");
  });

  it("prunes dust orders whose token amount falls below 0.00001 units", () => {
    const diffs: AllocationDiff[] = [
      { asset: "XLM", assetCode: "XLM", currentPct: 60, targetPct: 50, diffPct: -10, diffUsd: -1.5 },
      { asset: "HYPER", assetCode: "HYPER", currentPct: 40, targetPct: 50, diffPct: 10, diffUsd: 1.5 },
    ];
    // At $500,000 per HYPER, $1.50 buys ~0.000003 HYPER (< 0.00001 dust threshold)
    const swaps = generateSwapSuggestions(diffs, { XLM: 0.1, HYPER: 500_000 });
    expect(swaps).toEqual([]);
  });
});
