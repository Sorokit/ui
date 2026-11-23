import { describe, expect, it } from "vitest";

import type { Balance, Operation } from "@/lib/client";
import {
  buildHoldingsSeries,
  buildValueSeries,
  rankPerformers,
} from "@/lib/portfolio-analytics";

const ME = "GME";
const balances: Balance[] = [
  { asset: "XLM", balance: "150", assetType: "native" },
  { asset: "USDC:GISSUER", assetCode: "USDC", balance: "50", assetType: "credit_alphanum4" },
];
const base = { type: "payment", fee: "100", success: true };
const operations: Operation[] = [
  { ...base, id: "1", txHash: "a", source: "GX", destination: ME, amount: "50", asset: "native", createdAt: "2026-01-02T12:00:00Z" },
  { ...base, id: "2", txHash: "b", source: ME, destination: "GX", amount: "25", asset: "USDC:GISSUER", createdAt: "2026-01-03T12:00:00Z" },
];

describe("portfolio analytics", () => {
  const series = buildHoldingsSeries(balances, operations, ME, "2026-01-01", "2026-01-03");

  it("reconstructs daily holdings from current balances", () => {
    expect(series.holdings.XLM).toEqual([100, 150, 150]);
    expect(series.holdings.USDC).toEqual([75, 75, 50]);
  });

  it("values the portfolio at supplied prices", () => {
    const values = buildValueSeries(series, { XLM: 2, USDC: 1 });
    expect(values.map((point) => point.value)).toEqual([275, 375, 350]);
  });

  it("ranks priced assets by value change", () => {
    const ranked = rankPerformers(series, { XLM: 2, USDC: 1 });
    expect(ranked.map((item) => item.asset)).toEqual(["XLM", "USDC"]);
    expect(ranked[0].change).toBe(100);
    expect(ranked[0].changePct).toBe(50);
  });
});
