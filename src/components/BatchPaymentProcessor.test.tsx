import { describe, expect, it } from "vitest";

import { parseCSV, validateEntries } from "./BatchPaymentProcessor";

const VALID_ADDR = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
const VALID_ADDR2 = "GBXGQJWVLWHKUXJW2GLKZOMHCPZN5RPKXRM4QYQRDDXQJ2DCXKLMWQM";

describe("parseCSV — field parsing", () => {
  it("parses a plain two-column CSV with no quotes", () => {
    const csv = `address,amount\n${VALID_ADDR},100\n`;
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].address).toBe(VALID_ADDR);
    expect(entries[0].amount).toBe("100");
  });

  it("handles quoted fields containing commas without splitting them", () => {
    const memo = '"hello, world"';
    const csv = `address,amount,memo\n${VALID_ADDR},50,${memo}\n`;
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].memo).toBe("hello, world");
  });

  it("extracts optional asset and memo columns when present in header", () => {
    const csv = `address,amount,asset,memo\n${VALID_ADDR},200,USDC,invoice-42\n`;
    const entries = parseCSV(csv);
    expect(entries[0].asset).toBe("USDC");
    expect(entries[0].memo).toBe("invoice-42");
  });

  it("returns empty array when required address or amount column is absent", () => {
    const csv = `wallet,value\n${VALID_ADDR},100\n`;
    expect(parseCSV(csv)).toHaveLength(0);
  });

  it("returns empty array for a header-only CSV", () => {
    expect(parseCSV("address,amount\n")).toHaveLength(0);
  });
});

describe("validateEntries — validation rules", () => {
  it("passes a well-formed entry", () => {
    const errors = validateEntries([{ address: VALID_ADDR, amount: "100", asset: "XLM", memo: "" }]);
    expect(errors).toHaveLength(0);
  });

  it("rejects an invalid Stellar address", () => {
    const errors = validateEntries([{ address: "BADADDR", amount: "1", asset: "", memo: "" }]);
    expect(errors.some((e) => e.includes("Invalid Stellar address"))).toBe(true);
  });

  it("rejects a memo that exceeds 28 UTF-8 bytes", () => {
    const longMemo = "this-memo-is-definitely-too-long-for-stellar";
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo: longMemo }]);
    expect(errors.some((e) => e.includes("28 bytes"))).toBe(true);
  });

  it("accepts a memo of exactly 28 bytes", () => {
    const memo28 = "a".repeat(28);
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo: memo28 }]);
    expect(errors.every((e) => !e.includes("28 bytes"))).toBe(true);
  });

  it("rejects duplicate addresses", () => {
    const entries = [
      { address: VALID_ADDR, amount: "1", asset: "", memo: "" },
      { address: VALID_ADDR, amount: "2", asset: "", memo: "" },
    ];
    const errors = validateEntries(entries);
    expect(errors.some((e) => e.includes("Duplicate address"))).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    const errors = validateEntries([{ address: VALID_ADDR, amount: "0", asset: "", memo: "" }]);
    expect(errors.some((e) => e.includes("Invalid amount"))).toBe(true);
  });

  it("accumulates errors for multiple invalid rows", () => {
    const entries = [
      { address: "BAD1", amount: "abc", asset: "", memo: "" },
      { address: VALID_ADDR2, amount: "10", asset: "", memo: "x".repeat(30) },
    ];
    const errors = validateEntries(entries);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
