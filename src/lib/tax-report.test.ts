import { describe, expect, it } from "vitest";

import type { Operation } from "@/lib/client";
import {
  buildTaxReport,
  priceKey,
  requiredPrices,
  taxReportToCsv,
} from "@/lib/tax-report";

const ME = "GME";
const OTHER = "GOTHER";

function op(
  id: string,
  createdAt: string,
  direction: "in" | "out",
  amount: string,
  asset = "XLM",
): Operation {
  return {
    id,
    txHash: `hash-${id}`,
    type: "payment",
    source: direction === "in" ? OTHER : ME,
    destination: direction === "in" ? ME : OTHER,
    amount,
    asset,
    fee: "100",
    success: true,
    createdAt,
  };
}

const OPS = [
  op("1", "2026-01-01T10:00:00Z", "in", "100"),
  op("2", "2026-02-01T10:00:00Z", "in", "100"),
  op("3", "2026-03-01T10:00:00Z", "out", "150"),
];
const PRICES = {
  [priceKey("XLM", "2026-01-01")]: 1,
  [priceKey("XLM", "2026-02-01")]: 2,
  [priceKey("XLM", "2026-03-01")]: 3,
};

describe("buildTaxReport", () => {
  it("matches disposals to the oldest lots first", () => {
    const disposal = buildTaxReport(OPS, ME, PRICES)[2];
    expect(disposal.proceeds).toBe(450);
    expect(disposal.costBasis).toBe(200);
    expect(disposal.gainLoss).toBe(250);
  });

  it("keeps earlier cost basis when the range excludes acquisitions", () => {
    const rows = buildTaxReport(OPS, ME, PRICES, { startDate: "2026-03-01" });
    expect(rows).toHaveLength(1);
    expect(rows[0].gainLoss).toBe(250);
  });

  it("leaves gain empty when a price is missing", () => {
    const partial = { ...PRICES };
    delete (partial as Record<string, unknown>)[priceKey("XLM", "2026-01-01")];
    const disposal = buildTaxReport(OPS, ME, partial)[2];
    expect(disposal.gainLoss).toBeNull();
    expect(disposal.note).toContain("Missing acquisition price");
  });

  it("flags disposals with no matching acquisition", () => {
    const rows = buildTaxReport([OPS[2]], ME, PRICES);
    expect(rows[0].gainLoss).toBeNull();
    expect(rows[0].note).toContain("Acquisition not in history");
  });

  it("ignores failed operations and self-transfers", () => {
    const failed = { ...OPS[0], success: false };
    const self = { ...OPS[0], source: ME, destination: ME };
    expect(buildTaxReport([failed, self], ME, PRICES)).toEqual([]);
  });
});

describe("requiredPrices", () => {
  it("lists unique asset/date pairs up to the end date", () => {
    expect(requiredPrices(OPS, ME, "2026-02-01")).toEqual([
      { asset: "XLM", date: "2026-01-01" },
      { asset: "XLM", date: "2026-02-01" },
    ]);
  });
});

describe("taxReportToCsv", () => {
  it("includes gain/loss and neutralises formula cells", () => {
    const rows = buildTaxReport(OPS, ME, PRICES);
    const csv = taxReportToCsv([{ ...rows[2], asset: "=EVIL" }]);
    expect(csv.split("\n")[0]).toContain("Gain/Loss");
    expect(csv).toContain("'=EVIL");
    expect(csv).toContain("250.00");
  });
});
