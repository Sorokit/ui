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

/**
 * Truncate an address adaptively for compact or mobile viewports.
 * @param address Stellar address, contract ID, or tx hash
 * @param options Configuration for compact / responsive truncation.
 *                `compact: true` uses (3, 3) e.g. "GAB...WXYZ" for narrow/mobile containers (<360px).
 */
export function truncateAddressResponsive(
  address: string | null | undefined,
  options?: { compact?: boolean; start?: number; end?: number },
): string {
  if (!address) return "";
  if (options?.compact) {
    return truncateAddress(address, options.start ?? 3, options.end ?? 3);
  }
  return truncateAddress(address, options?.start ?? 6, options?.end ?? 4);
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

/**
 * Encodes raw bytes as RFC 4648 base32 without padding — the inverse of
 * {@link base32Decode}, used to rebuild a G-address from a muxed account.
 */
function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];

  return output;
}

/** StrKey version byte for an ED25519 public key ('G...' addresses). */
const STRKEY_VERSION_ED25519_PUBLIC_KEY = 6 << 3; // 0x30
/** StrKey version byte for a muxed ED25519 account ('M...' addresses, SEP-23). */
const STRKEY_VERSION_MUXED_ACCOUNT = 12 << 3; // 0x60

/** Length of a standard G-address StrKey. */
export const STELLAR_ADDRESS_LENGTH = 56;
/** Length of a muxed M-address StrKey (32-byte key + 8-byte ID). */
export const MUXED_ADDRESS_LENGTH = 69;

/**
 * Decodes a StrKey and verifies its version byte, total length and
 * CRC16/XMODEM checksum. Returns the payload (key bytes, plus the 8-byte ID
 * for a muxed account) or `null` when any part of the encoding is invalid.
 */
function decodeStrKey(
  encoded: string,
  expectedVersion: number,
  payloadLength: number,
): Uint8Array | null {
  const decoded = base32Decode(encoded);
  // version byte + payload + 2 checksum bytes.
  if (!decoded || decoded.length !== payloadLength + 3) return null;
  if (decoded[0] !== expectedVersion) return null;

  const checksumOffset = payloadLength + 1;
  const versionAndPayload = decoded.subarray(0, checksumOffset);
  const expectedChecksum =
    decoded[checksumOffset] | (decoded[checksumOffset + 1] << 8); // little-endian
  if (crc16xmodem(versionAndPayload) !== expectedChecksum) return null;

  return decoded.slice(1, checksumOffset);
}

/** Encodes `payload` as a StrKey with the given version byte and checksum. */
function encodeStrKey(version: number, payload: Uint8Array): string {
  const versionAndPayload = new Uint8Array(payload.length + 1);
  versionAndPayload[0] = version;
  versionAndPayload.set(payload, 1);
  const checksum = crc16xmodem(versionAndPayload);
  const full = new Uint8Array(versionAndPayload.length + 2);
  full.set(versionAndPayload);
  full[versionAndPayload.length] = checksum & 0xff;
  full[versionAndPayload.length + 1] = checksum >> 8;
  return base32Encode(full);
}

export interface MuxedAccount {
  /** The underlying G-address the muxed account routes to. */
  baseAddress: string;
  /** The 64-bit multiplexing ID, as a decimal string (exceeds Number range). */
  id: string;
}

/**
 * Decode a 69-character muxed account (SEP-23 `M...` address) into its base
 * G-address and 64-bit ID. Returns `null` for anything that isn't a valid,
 * checksummed muxed account.
 */
export function decodeMuxedAccount(address: string): MuxedAccount | null {
  const trimmed = address.trim();
  if (!/^M[A-Z2-7]{68}$/.test(trimmed)) return null;

  // 32-byte ED25519 key followed by a big-endian uint64 ID.
  const payload = decodeStrKey(trimmed, STRKEY_VERSION_MUXED_ACCOUNT, 40);
  if (!payload) return null;

  let id = 0n;
  for (const byte of payload.subarray(32)) id = (id << 8n) | BigInt(byte);

  return {
    baseAddress: encodeStrKey(
      STRKEY_VERSION_ED25519_PUBLIC_KEY,
      payload.subarray(0, 32),
    ),
    id: id.toString(),
  };
}

/** True when `address` is a valid, checksummed muxed (`M...`) account. */
export function isMuxedAccount(address: string): boolean {
  return decodeMuxedAccount(address) !== null;
}

/**
 * Validate a Stellar account address — either a standard 56-character
 * G-address or a 69-character muxed M-address (SEP-23). Decodes the full
 * StrKey encoding (base32 → version byte → raw key [+ 8-byte ID] →
 * CRC16/XMODEM checksum) rather than only checking the surface format. A
 * string that merely matches `/^G[A-Z2-7]{55}$/` can still fail this — e.g. a
 * single mistyped character produces a different checksum, so a format-only
 * check would accept it and let it reach the network, where it fails with an
 * opaque error rather than a clear one at input time.
 *
 * Deliberately re-implemented here (not imported from `@stellar/stellar-sdk`
 * or another blockchain library) — this package has no blockchain-logic
 * dependency by design (see README); StrKey decoding is pure data
 * validation, not chain interaction, so it stays in scope for that
 * constraint without pulling in a full SDK for one function. The decoding
 * mirrors `StrKey.isValidEd25519PublicKey` / `StrKey.isValidMed25519PublicKey`
 * in stellar/js-stellar-base.
 */
export function validateStellarAddress(address: string): boolean {
  const trimmed = address.trim();
  if (/^G[A-Z2-7]{55}$/.test(trimmed)) {
    return decodeStrKey(trimmed, STRKEY_VERSION_ED25519_PUBLIC_KEY, 32) !== null;
  }
  return isMuxedAccount(trimmed);
}

/** Decimal places of XLM and of most Stellar classic assets. */
export const STELLAR_DECIMALS = 7;

/**
 * Convert an integer amount in the smallest unit (stroops for XLM) to a
 * token-unit string with exactly `decimals` places, e.g. `"12345678"` →
 * `"1.2345678"`.
 *
 * Works on the decimal string with BigInt rather than `Number(stroops) / 1e7`:
 * a double only holds integers exactly up to 2^53, so large balances (and
 * i128 Soroban token amounts) picked up rounding artifacts in the last
 * digits. Returns `null` when `amount` isn't an integer.
 */
export function formatTokenAmount(
  amount: string | bigint | number,
  decimals: number = STELLAR_DECIMALS,
): string | null {
  let value: bigint;
  if (typeof amount === "bigint") {
    value = amount;
  } else if (typeof amount === "number") {
    if (!Number.isSafeInteger(amount)) return null;
    value = BigInt(amount);
  } else {
    const trimmed = amount.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) return null;
    value = BigInt(trimmed);
  }

  const negative = value < 0n;
  const digits = (negative ? -value : value).toString();
  if (decimals <= 0) return `${negative ? "-" : ""}${digits}`;

  const padded = digits.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Convert a stroop amount (the smallest Stellar unit) to an XLM string
 * formatted to 7 decimal places. Returns "0.0000000" for invalid input.
 * Leading integer digits are used like `parseInt` (e.g. "100abc" → 100).
 */
export function toXLM(stroops: string): string {
  const match = /^\s*([+-]?\d+)/.exec(stroops);
  return (match && formatTokenAmount(match[1])) ?? (0).toFixed(7);
}

/**
 * Number of bytes `text` occupies when UTF-8 encoded. Stellar's `MEMO_TEXT`
 * limit (28 bytes) is a byte limit, not a character count — a single
 * multi-byte character (e.g. emoji, most non-Latin scripts) can consume up
 * to 4 bytes, so `.length` alone silently under-counts and lets Horizon
 * reject the transaction after submission instead of catching it at input
 * time.
 */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Truncate `text` so its UTF-8 encoding fits within `maxBytes`, never
 * splitting a multi-byte character in half. Used to enforce Stellar's
 * 28-byte `MEMO_TEXT` limit as the user types.
 */
export function truncateToUtf8ByteLength(text: string, maxBytes: number): string {
  if (utf8ByteLength(text) <= maxBytes) return text;

  const chars = Array.from(text);
  let bytes = 0;
  let result = "";
  for (const char of chars) {
    const charBytes = new TextEncoder().encode(char).length;
    if (bytes + charBytes > maxBytes) break;
    bytes += charBytes;
    result += char;
  }
  return result;
}

/** Whether a raw submission error indicates the account's sequence number is stale. */
export function isSequenceError(message: string): boolean {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage.includes("tx_bad_seq") ||
    normalizedMessage.includes("bad sequence")
  );
}

export function friendlyError(message: string): string {
  const normalizedMessage = message.trim().toLowerCase();

  if (
    normalizedMessage.includes("op_underfunded") ||
    normalizedMessage.includes("underfunded") ||
    normalizedMessage.includes("insufficient balance")
  ) {
    return "Insufficient balance to submit this transaction. Add more XLM and try again.";
  }

  if (isSequenceError(message)) {
    return "Your account sequence is out of date. Refreshing and trying again may help.";
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
