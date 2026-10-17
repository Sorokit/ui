import { encodeAccountAddress, encodeContractAddress } from "@/lib/utils";

/**
 * Minimal, dependency-free decoder for base64 XDR `ScVal` values as returned in
 * Soroban event topics. Only the scalar types that commonly appear in topics
 * are handled; anything else (or anything that isn't valid XDR) makes
 * {@link decodeScValTopic} hand back the original string untouched.
 *
 * Deliberately re-implemented instead of importing `@stellar/stellar-sdk` —
 * this package has no blockchain-logic dependency by design (see README).
 */

// ScValType discriminants from Stellar-contract.x.
const SCV_BOOL = 0;
const SCV_VOID = 1;
const SCV_U32 = 3;
const SCV_I32 = 4;
const SCV_U64 = 5;
const SCV_I64 = 6;
const SCV_TIMEPOINT = 7;
const SCV_DURATION = 8;
const SCV_U128 = 9;
const SCV_I128 = 10;
const SCV_BYTES = 13;
const SCV_STRING = 14;
const SCV_SYMBOL = 15;
const SCV_ADDRESS = 18;

// ScAddressType discriminants.
const SC_ADDRESS_TYPE_ACCOUNT = 0;
const SC_ADDRESS_TYPE_CONTRACT = 1;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const SYMBOL_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

class XdrReader {
  private offset = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get done(): boolean {
    return this.offset === this.bytes.length;
  }

  private ensure(length: number) {
    if (this.offset + length > this.bytes.length) {
      throw new RangeError("XDR buffer underflow");
    }
  }

  uint32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.offset);
    this.offset += 4;
    return value;
  }

  int32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.offset);
    this.offset += 4;
    return value;
  }

  uint64(): bigint {
    this.ensure(8);
    const value = this.view.getBigUint64(this.offset);
    this.offset += 8;
    return value;
  }

  int64(): bigint {
    this.ensure(8);
    const value = this.view.getBigInt64(this.offset);
    this.offset += 8;
    return value;
  }

  fixed(length: number): Uint8Array {
    this.ensure(length);
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  /** Variable-length opaque: uint32 length, bytes, zero padding to 4. */
  opaque(): Uint8Array {
    const length = this.uint32();
    const value = this.fixed(length);
    const padding = (4 - (length % 4)) % 4;
    const pad = this.fixed(padding);
    if (pad.some((byte) => byte !== 0)) throw new RangeError("Invalid XDR padding");
    return value;
  }
}

function base64ToBytes(value: string): Uint8Array | null {
  if (value.length < 8 || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    return null;
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function readScVal(reader: XdrReader): string {
  const type = reader.int32();
  switch (type) {
    case SCV_BOOL: {
      const value = reader.uint32();
      if (value > 1) throw new RangeError("Invalid bool");
      return value === 1 ? "true" : "false";
    }
    case SCV_VOID:
      return "void";
    case SCV_U32:
      return String(reader.uint32());
    case SCV_I32:
      return String(reader.int32());
    case SCV_U64:
    case SCV_TIMEPOINT:
    case SCV_DURATION:
      return reader.uint64().toString();
    case SCV_I64:
      return reader.int64().toString();
    case SCV_U128: {
      const hi = reader.uint64();
      const lo = reader.uint64();
      return ((hi << 64n) | lo).toString();
    }
    case SCV_I128: {
      const hi = reader.int64();
      const lo = reader.uint64();
      return ((hi << 64n) | lo).toString();
    }
    case SCV_BYTES:
      return `0x${toHex(reader.opaque())}`;
    case SCV_STRING:
      return decodeUtf8(reader.opaque());
    case SCV_SYMBOL: {
      const symbol = decodeUtf8(reader.opaque());
      if (!SYMBOL_PATTERN.test(symbol)) throw new RangeError("Invalid symbol");
      return symbol;
    }
    case SCV_ADDRESS: {
      const addressType = reader.int32();
      if (addressType === SC_ADDRESS_TYPE_ACCOUNT) {
        // AccountID = PublicKey union; only ED25519 (0) exists.
        if (reader.int32() !== 0) throw new RangeError("Unsupported key type");
        return encodeAccountAddress(reader.fixed(32));
      }
      if (addressType === SC_ADDRESS_TYPE_CONTRACT) {
        return encodeContractAddress(reader.fixed(32));
      }
      throw new RangeError("Unsupported address type");
    }
    default:
      throw new RangeError(`Unsupported ScVal type ${type}`);
  }
}

/**
 * Decode a base64-encoded XDR `ScVal` topic into a human-readable string:
 * symbols and strings as text, addresses as `G...`/`C...` StrKeys, integers
 * as decimal strings. Returns `null` when the input isn't a supported ScVal.
 */
export function tryDecodeScVal(topic: string): string | null {
  const bytes = base64ToBytes(topic.trim());
  if (!bytes) return null;
  try {
    const reader = new XdrReader(bytes);
    const decoded = readScVal(reader);
    // Reject partial matches so arbitrary base64-looking strings (e.g. hex
    // hashes) aren't mistaken for XDR.
    return reader.done ? decoded : null;
  } catch {
    return null;
  }
}

/** Like {@link tryDecodeScVal}, but falls back to the original topic. */
export function decodeScValTopic(topic: string): string {
  return tryDecodeScVal(topic) ?? topic;
}
