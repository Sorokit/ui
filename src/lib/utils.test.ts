import { describe, expect, it } from "vitest";

import { cn, truncateAddress, validateStellarAddress } from "./utils";

describe("truncateAddress", () => {
  const STELLAR_ADDRESS_56 =
    "GABCDEF123456789012345678901234567890123456789012345WXYZ";

  it("truncates a 56-char Stellar address with default params (start=6, end=4)", () => {
    // 56 characters total -> start 6 chars ("GABCDE"), end 4 chars ("WXYZ")
    const result = truncateAddress(STELLAR_ADDRESS_56);
    expect(result).toBe("GABCDE...WXYZ");
    expect(result.startsWith("GABCDE")).toBe(true);
    expect(result.endsWith("WXYZ")).toBe(true);
  });

  it("truncates with custom start/end values (14, 6) as used in WalletScreen", () => {
    const result = truncateAddress(STELLAR_ADDRESS_56, 14, 6);
    expect(result).toBe("GABCDEF1234567...45WXYZ");
  });

  it("returns an empty string when given an empty string", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("returns an empty string when given null or undefined", () => {
    expect(truncateAddress(null)).toBe("");
    expect(truncateAddress(undefined)).toBe("");
  });

  it("does not throw and returns full string when input length is shorter than or equal to start + end", () => {
    const shortAddress = "GABC";
    expect(() => truncateAddress(shortAddress, 6, 4)).not.toThrow();
    expect(truncateAddress(shortAddress, 6, 4)).toBe("GABC");

    const exactLength = "1234567890"; // 10 chars, equal to start=6 + end=4
    expect(truncateAddress(exactLength, 6, 4)).toBe("1234567890");
  });

  it("handles strings shorter than start + end + 3 without throwing", () => {
    const elevenCharString = "12345678901"; // 11 chars (start+end=10, start+end+3=13)
    expect(() => truncateAddress(elevenCharString, 6, 4)).not.toThrow();
    expect(truncateAddress(elevenCharString, 6, 4)).toBe("123456...8901");
  });
});

describe("validateStellarAddress (#535)", () => {
  // A well-known, publicly documented Stellar Development Foundation
  // address — a real StrKey-encoded ED25519 public key, not a synthetic
  // fixture, so this exercises the real base32 + CRC16/XMODEM checksum
  // algorithm against ground truth rather than a value this test invented.
  const VALID_ADDRESS =
    "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";

  it("accepts a real, checksum-valid Stellar address", () => {
    expect(validateStellarAddress(VALID_ADDRESS)).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateStellarAddress(`  ${VALID_ADDRESS}  `)).toBe(true);
  });

  it("rejects a single mutated character even though length and charset still match", () => {
    // Second character changed (C -> D): still 56 chars, still valid
    // base32 alphabet, starts with G — a format-only regex check would
    // accept this. The checksum must not.
    const mutated = "GDEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
    expect(validateStellarAddress(mutated)).toBe(false);
  });

  it("rejects a mutated character near the end of the payload", () => {
    const mutated = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JA";
    expect(validateStellarAddress(mutated)).toBe(false);
  });

  it("rejects strings not starting with G", () => {
    expect(
      validateStellarAddress(
        "SCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
      ),
    ).toBe(false);
  });

  it("rejects a Soroban contract address (C-prefixed) as a payment destination", () => {
    // A contract address's StrKey version byte produces a 'C' prefix, so
    // this is already caught by the format regex — kept as an explicit
    // case since it's the specific confusion the issue calls out (an
    // Ethereum-style or wrong-type address slipping through).
    expect(
      validateStellarAddress(
        "CCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ",
      ),
    ).toBe(false);
  });

  it("rejects a different StrKey type that also happens to start with 'G' (e.g. a signed-payload key)", () => {
    // StrKey version bytes 48-55 all base32-encode to a 'G' first
    // character - only 48 (0x30) is ED25519_PUBLIC_KEY. This address is a
    // real, valid StrKey encoding (correct checksum, correct length) for
    // ED25519_SIGNED_PAYLOAD (version 49/0x31) - the format regex alone
    // cannot distinguish it from a payable account address, only decoding
    // the version byte can.
    const signedPayloadTypeAddress =
      "GEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCO3K";
    expect(signedPayloadTypeAddress).toHaveLength(56);
    expect(validateStellarAddress(signedPayloadTypeAddress)).toBe(false);
  });

  it("rejects strings shorter than 56 characters", () => {
    expect(validateStellarAddress("GABC")).toBe(false);
  });

  it("rejects strings longer than 56 characters", () => {
    expect(validateStellarAddress(`${VALID_ADDRESS}X`)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateStellarAddress("")).toBe(false);
  });

  it("rejects non-Stellar-address strings entirely (e.g. an Ethereum address)", () => {
    expect(
      validateStellarAddress("0x71C7656EC7ab88b098defB751B7401B5f6d8976"),
    ).toBe(false);
  });

  it("rejects lowercase input even if it would be valid uppercase", () => {
    // StrKey's base32 alphabet is uppercase-only; lowercase must not be
    // silently case-folded and accepted.
    expect(validateStellarAddress(VALID_ADDRESS.toLowerCase())).toBe(false);
  });

  it("rejects characters outside the base32 alphabet (e.g. '0', '1', '8', '9')", () => {
    // 56 characters total, matching length, but '0'/'1'/'8'/'9' are not in
    // StrKey's base32 alphabet (A-Z, 2-7) — the format regex alone would
    // already reject this too, but this test pins down that the character
    // set is actually enforced, not just the length.
    const withInvalidChars = `G0189A${"A".repeat(50)}`;
    expect(withInvalidChars).toHaveLength(56);
    expect(validateStellarAddress(withInvalidChars)).toBe(false);
  });
});

describe("cn utility", () => {
  it("correctly merges conflicting Tailwind classes", () => {
    const result = cn("bg-red-500", "bg-blue-500");
    expect(result).toContain("bg-blue-500");
    expect(result).not.toContain("bg-red-500");

    const resultShort = cn("bg-red", "bg-blue");
    expect(resultShort).toContain("bg-blue");
    expect(resultShort).not.toContain("bg-red");
  });

  it("handles undefined and null values without throwing", () => {
    expect(() => cn(undefined, "text-sm")).not.toThrow();
    expect(cn(undefined, "text-sm")).toBe("text-sm");
    expect(cn(null, "text-sm", undefined)).toBe("text-sm");
  });

  it("handles false, 0, and empty strings without throwing", () => {
    const isHidden = false;
    const count = 0;
    expect(cn(isHidden && "hidden", "p-4", "", count && "text-lg")).toBe("p-4");
  });

  it("handles arrays and conditional class objects", () => {
    expect(cn(["px-2", "py-1"], { "font-bold": true, italic: false })).toBe(
      "px-2 py-1 font-bold",
    );
  });
});
