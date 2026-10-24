import { describe, expect, it } from "vitest";

import {
  cn,
  decodeMuxedAccount,
  formatTokenAmount,
  isMuxedAccount,
  toXLM,
  truncateAddress,
  truncateAddressResponsive,
  truncateToUtf8ByteLength,
  utf8ByteLength,
  validateStellarAddress,
} from "./utils";

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

describe("truncateAddressResponsive (#887)", () => {
  const STELLAR_ADDRESS_56 =
    "GABCDEF123456789012345678901234567890123456789012345WXYZ";

  it("truncates with compact bounds (3, 3) for narrow mobile viewports", () => {
    const compactResult = truncateAddressResponsive(STELLAR_ADDRESS_56, { compact: true });
    expect(compactResult).toBe("GAB...XYZ");
    expect(compactResult.length).toBe(9);
  });

  it("defaults to standard bounds (6, 4) when compact is omitted or false", () => {
    const standardResult = truncateAddressResponsive(STELLAR_ADDRESS_56);
    expect(standardResult).toBe("GABCDE...WXYZ");
  });

  it("respects custom start and end bounds in responsive mode", () => {
    const customResult = truncateAddressResponsive(STELLAR_ADDRESS_56, { compact: true, start: 4, end: 4 });
    expect(customResult).toBe("GABC...WXYZ");
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(truncateAddressResponsive(null)).toBe("");
    expect(truncateAddressResponsive(undefined)).toBe("");
    expect(truncateAddressResponsive("")).toBe("");
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

describe("utf8ByteLength (#686)", () => {
  it("counts plain ASCII characters as 1 byte each", () => {
    expect(utf8ByteLength("hello")).toBe(5);
  });

  it("returns 0 for an empty string", () => {
    expect(utf8ByteLength("")).toBe(0);
  });

  it("counts a multi-byte character as more than 1 byte", () => {
    // "é" (U+00E9) is 2 bytes in UTF-8.
    expect(utf8ByteLength("é")).toBe(2);
  });

  it("counts an emoji (surrogate pair) as 4 bytes", () => {
    // "😀" (U+1F600) is 4 bytes in UTF-8.
    expect(utf8ByteLength("😀")).toBe(4);
  });

  it("matches character length only for pure ASCII text", () => {
    const text = "payment for invoice #42";
    expect(utf8ByteLength(text)).toBe(text.length);
  });
});

describe("truncateToUtf8ByteLength (#686)", () => {
  it("returns the text unchanged when already within the byte limit", () => {
    expect(truncateToUtf8ByteLength("hello", 28)).toBe("hello");
  });

  it("truncates ASCII text to exactly maxBytes characters", () => {
    const text = "a".repeat(40);
    const result = truncateToUtf8ByteLength(text, 28);
    expect(result).toHaveLength(28);
    expect(utf8ByteLength(result)).toBe(28);
  });

  it("never splits a multi-byte character in half", () => {
    // 14 "é" characters = 28 bytes exactly; a 15th would overflow to 30.
    const text = "é".repeat(15);
    const result = truncateToUtf8ByteLength(text, 28);
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(28);
    // Every remaining character must be a complete, valid "é" — not a
    // mangled half-character — so re-encoding round-trips losslessly.
    expect(result).toBe("é".repeat(14));
  });

  it("never splits a 4-byte emoji in half", () => {
    const text = "😀".repeat(10); // 40 bytes
    const result = truncateToUtf8ByteLength(text, 28);
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(28);
    expect(result).toBe("😀".repeat(7)); // 28 bytes exactly
  });

  it("returns an empty string when maxBytes is 0", () => {
    expect(truncateToUtf8ByteLength("hello", 0)).toBe("");
  });
});

describe("validateStellarAddress — muxed accounts (#956)", () => {
  // Test vectors from SEP-23 (Muxed Account Strkeys): the same base account
  // multiplexed with ID 0 and with ID 2^63.
  const BASE_ADDRESS = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
  const MUXED_ID_0 =
    "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ";
  const MUXED_ID_2_63 =
    "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK";

  it("accepts 69-character muxed M-addresses", () => {
    expect(MUXED_ID_0).toHaveLength(69);
    expect(validateStellarAddress(MUXED_ID_0)).toBe(true);
    expect(validateStellarAddress(MUXED_ID_2_63)).toBe(true);
    expect(validateStellarAddress(`  ${MUXED_ID_0}  `)).toBe(true);
  });

  it("still accepts standard G-addresses", () => {
    expect(validateStellarAddress(BASE_ADDRESS)).toBe(true);
  });

  it("rejects a muxed address with a corrupted checksum", () => {
    const mutated = `${MUXED_ID_2_63.slice(0, -1)}J`;
    expect(validateStellarAddress(mutated)).toBe(false);
  });

  it("rejects a muxed address with a mutated payload character", () => {
    const mutated = `MB${MUXED_ID_0.slice(2)}`;
    expect(validateStellarAddress(mutated)).toBe(false);
  });

  it("rejects muxed addresses of the wrong length or case", () => {
    expect(validateStellarAddress(MUXED_ID_0.slice(0, 68))).toBe(false);
    expect(validateStellarAddress(`${MUXED_ID_0}A`)).toBe(false);
    expect(validateStellarAddress(MUXED_ID_0.toLowerCase())).toBe(false);
  });

  it("rejects a G-address payload re-labelled with an M prefix", () => {
    expect(validateStellarAddress(`M${BASE_ADDRESS.slice(1)}`)).toBe(false);
  });

  describe("decodeMuxedAccount", () => {
    it("recovers the base G-address and ID 0", () => {
      expect(decodeMuxedAccount(MUXED_ID_0)).toEqual({
        baseAddress: BASE_ADDRESS,
        id: "0",
      });
    });

    it("decodes a 64-bit ID beyond Number.MAX_SAFE_INTEGER exactly", () => {
      expect(decodeMuxedAccount(MUXED_ID_2_63)).toEqual({
        baseAddress: BASE_ADDRESS,
        id: "9223372036854775808",
      });
    });

    it("returns null for G-addresses and malformed input", () => {
      expect(decodeMuxedAccount(BASE_ADDRESS)).toBeNull();
      expect(decodeMuxedAccount("")).toBeNull();
      expect(decodeMuxedAccount(`${MUXED_ID_0.slice(0, -1)}A`)).toBeNull();
    });

    it("the decoded base address round-trips through validation", () => {
      const decoded = decodeMuxedAccount(MUXED_ID_2_63);
      expect(decoded && validateStellarAddress(decoded.baseAddress)).toBe(true);
    });
  });

  it("isMuxedAccount distinguishes M-addresses from G-addresses", () => {
    expect(isMuxedAccount(MUXED_ID_0)).toBe(true);
    expect(isMuxedAccount(BASE_ADDRESS)).toBe(false);
  });
});

describe("formatTokenAmount (#956)", () => {
  it("formats stroops to exactly 7 decimal places", () => {
    expect(formatTokenAmount("10000000")).toBe("1.0000000");
    expect(formatTokenAmount("12345678")).toBe("1.2345678");
    expect(formatTokenAmount("100")).toBe("0.0000100");
  });

  it("handles zero and a single stroop", () => {
    expect(formatTokenAmount("0")).toBe("0.0000000");
    expect(formatTokenAmount("1")).toBe("0.0000001");
  });

  it("formats amounts beyond 2^53 without floating-point loss", () => {
    // Number("9007199254740993") rounds to ...992 — the old Number division
    // path dropped the final stroop.
    expect(formatTokenAmount("9007199254740993")).toBe("900719925.4740993");
    // Max int64 — the largest possible classic balance.
    expect(formatTokenAmount("9223372036854775807")).toBe("922337203685.4775807");
  });

  it("formats i128-sized Soroban token amounts", () => {
    expect(formatTokenAmount("170141183460469231731687303715884105727")).toBe(
      "17014118346046923173168730371588.4105727",
    );
  });

  it("handles negative amounts", () => {
    expect(formatTokenAmount("-1")).toBe("-0.0000001");
    expect(formatTokenAmount("-12345678")).toBe("-1.2345678");
  });

  it("accepts bigint and safe-integer number input", () => {
    expect(formatTokenAmount(25_000_000n)).toBe("2.5000000");
    expect(formatTokenAmount(5)).toBe("0.0000005");
    expect(formatTokenAmount(Number.MAX_SAFE_INTEGER + 2)).toBeNull();
  });

  it("supports other decimal precisions", () => {
    expect(formatTokenAmount("123456", 2)).toBe("1234.56");
    expect(formatTokenAmount("5", 0)).toBe("5");
  });

  it("returns null for non-integer input", () => {
    expect(formatTokenAmount("")).toBeNull();
    expect(formatTokenAmount("1.5")).toBeNull();
    expect(formatTokenAmount("abc")).toBeNull();
    expect(formatTokenAmount("1e7")).toBeNull();
  });

  it("round-trips: formatted output parses back to the original stroops", () => {
    for (const stroops of ["1", "999", "10000001", "9007199254740993", "123456789012345678"]) {
      const formatted = formatTokenAmount(stroops) as string;
      expect(BigInt(formatted.replace(".", ""))).toBe(BigInt(stroops));
    }
  });
});

describe("toXLM", () => {
  it("formats stroops losslessly", () => {
    expect(toXLM("500")).toBe("0.0000500");
    expect(toXLM("9007199254740993")).toBe("900719925.4740993");
  });

  it("keeps parseInt-style leading-digit parsing and the invalid-input fallback", () => {
    expect(toXLM("100abc")).toBe("0.0000100");
    expect(toXLM("abc")).toBe("0.0000000");
    expect(toXLM("")).toBe("0.0000000");
  });
});
