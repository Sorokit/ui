import { type ClassValue,clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Truncate a Stellar address, Soroban contract ID (C…), or tx hash for display.
 * Contract IDs are 56 characters like account addresses and truncate the same way.
 */
export function truncateAddress(address: string | null | undefined, start = 6, end = 4): string {
  if (!address) return "";
  const chars = Array.from(address);
  if (chars.length <= start + end) return address;
  return `${chars.slice(0, start).join("")}...${chars.slice(-end).join("")}`;
}

export function safeFormat(balance: string): string {
  const n = parseFloat(balance);
  if (!balance || isNaN(n)) return "0.00";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decodes an RFC 4648 base32 (no padding) string to raw bytes. Returns
 * `null` for a string containing characters outside the base32 alphabet,
 * or whose bit length doesn't cleanly resolve to a whole number of bytes
 * with only zero-padding bits left over (a malformed encoding — a real
 * StrKey never produces this).
 */
function base32Decode(input: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of input) {
    const charValue = BASE32_ALPHABET.indexOf(char);
    if (charValue === -1) return null;
    value = (value << 5) | charValue;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  // Any bits left over must be zero padding, never real data — a decoder
  // that ignores this would silently accept a corrupted encoding.
  const remainderMask = (1 << bits) - 1;
  if (bits >= 8 || (value & remainderMask) !== 0) return null;

  return new Uint8Array(bytes);
}

/**
 * CRC16/XMODEM (poly 0x1021, init 0x0000) over `bytes` — the checksum
 * algorithm StrKey uses. Matches the reference implementation in
 * stellar/js-stellar-base's strkey.ts.
 */
function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/** StrKey version byte for an ED25519 public key ('G...' addresses). */
const STRKEY_VERSION_ED25519_PUBLIC_KEY = 6 << 3; // 0x30

/**
 * Validate a Stellar public address: decodes the full StrKey encoding
 * (base32 → version byte → 32-byte raw key → CRC16/XMODEM checksum) rather
 * than only checking the surface format. A string that merely matches
 * `/^G[A-Z2-7]{55}$/` can still fail this — e.g. a single mistyped
 * character produces a different checksum, so a format-only check would
 * accept it and let it reach the network, where it fails with an opaque
 * error rather than a clear one at input time.
 *
 * Deliberately re-implemented here (not imported from `@stellar/stellar-sdk`
 * or another blockchain library) — this package has no blockchain-logic
 * dependency by design (see README); StrKey decoding is pure data
 * validation, not chain interaction, so it stays in scope for that
 * constraint without pulling in a full SDK for one function.
 */
export function validateStellarAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!/^G[A-Z2-7]{55}$/.test(trimmed)) return false;

  const decoded = base32Decode(trimmed);
  // 1 version byte + 32 key bytes + 2 checksum bytes = 35.
  if (!decoded || decoded.length !== 35) return false;

  const [version] = decoded;
  if (version !== STRKEY_VERSION_ED25519_PUBLIC_KEY) return false;

  const payload = decoded.subarray(0, 33); // version byte + key
  const expectedChecksum = decoded[33] | (decoded[34] << 8); // little-endian
  return crc16xmodem(payload) === expectedChecksum;
}

const STROOPS_PER_XLM = 10_000_000;

/**
 * Convert a stroop amount (the smallest Stellar unit) to an XLM string
 * formatted to 7 decimal places. Returns "0.0000000" for invalid input.
 */
export function toXLM(stroops: string): string {
  const n = parseInt(stroops, 10);
  if (Number.isNaN(n)) return (0).toFixed(7);
  return (n / STROOPS_PER_XLM).toFixed(7);
}

export function friendlyError(message: string): string {
  const normalizedMessage = message.trim().toLowerCase();

  if (
    normalizedMessage.includes("op_underfunded") ||
    normalizedMessage.includes("underfunded")
  ) {
    return "Insufficient balance to submit this transaction. Add more XLM and try again.";
  }

  if (
    normalizedMessage.includes("tx_bad_seq") ||
    normalizedMessage.includes("bad sequence")
  ) {
    return "Your account sequence is out of date. Refresh and try again.";
  }

  if (
    normalizedMessage.includes("simulation failed") ||
    normalizedMessage.includes("simulate transaction") ||
    normalizedMessage.includes("rpc") ||
    normalizedMessage.includes("execution failed")
  ) {
    return "The contract call could not be simulated. Please review the inputs and try again.";
  }

  if (
    normalizedMessage.includes("account not found") ||
    normalizedMessage.includes("contract not found") ||
    normalizedMessage.includes("resource not found") ||
    normalizedMessage.includes("not found")
  ) {
    return "The account or contract could not be found on this network.";
  }

  if (
    normalizedMessage.includes("resource limit") ||
    normalizedMessage.includes("fee limit") ||
    normalizedMessage.includes("insufficient fee") ||
    normalizedMessage.includes("resource")
  ) {
    return "This transaction used too many network resources. Try again with a simpler request.";
  }

  return "Something went wrong while invoking the contract. Please try again.";
}
