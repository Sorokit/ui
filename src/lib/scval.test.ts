import { describe, expect, it } from "vitest";

import { decodeScValTopic, tryDecodeScVal } from "./scval";

describe("tryDecodeScVal", () => {
  it("decodes a Symbol", () => {
    expect(tryDecodeScVal("AAAADwAAAAh0cmFuc2Zlcg==")).toBe("transfer");
  });

  it("decodes a U32", () => {
    expect(tryDecodeScVal("AAAAAwAAACo=")).toBe("42");
  });

  it("decodes a negative I128", () => {
    expect(tryDecodeScVal("AAAACv////////////////////s=")).toBe("-5");
  });

  it("decodes account and contract addresses to StrKeys", () => {
    expect(
      tryDecodeScVal("AAAAEgAAAAAAAAAAAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="),
    ).toBe("GAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB7JZX");
    expect(
      tryDecodeScVal("AAAAEgAAAAEAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHw=="),
    ).toBe("CAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6N4O");
  });

  it("returns null for non-XDR input", () => {
    expect(tryDecodeScVal("not base64!")).toBeNull();
    expect(tryDecodeScVal("ab".repeat(32))).toBeNull();
    // Valid U32 followed by trailing bytes is rejected.
    expect(tryDecodeScVal("AAAAAwAAACoAAAAA")).toBeNull();
  });
});

describe("decodeScValTopic", () => {
  it("falls back to the raw topic when decoding fails", () => {
    expect(decodeScValTopic("GA...from")).toBe("GA...from");
  });
});
