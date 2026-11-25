/**
 * Encrypted keystore backup (#1160).
 *
 * Packs the account data this app keeps locally into a single file encrypted
 * with a user-chosen password, and restores it later. Encryption is done with
 * the Web Crypto API: the password is stretched with PBKDF2-SHA-256 (random
 * salt) into an AES-256-GCM key (random IV). Nothing leaves the browser.
 *
 * The wallet extension owns the signing keys, so the backup only contains a
 * secret key if the user explicitly types one into the export form.
 */

export const KEYSTORE_FORMAT = "sorokit-keystore";
export const KEYSTORE_VERSION = 1;
export const KDF_ITERATIONS = 310_000;
export const MIN_PASSWORD_LENGTH = 8;

/** localStorage keys that make up the restorable app state. */
const STORAGE_KEY_NETWORK = "sorokit_network";
const STORAGE_KEY_CUSTOM_NETWORKS = "sorokit_custom_networks";
const PREFERENCE_KEYS = ["sorokit-theme", "sorokit-active-nav", "sorokit-sidebar-collapsed"];

/** Decrypted contents of a keystore file. */
export interface KeystorePayload {
  address: string;
  /** Network the account was on, a built-in name or a custom network object. */
  network: unknown;
  walletName: string | null;
  customNetworks: unknown[];
  preferences: Record<string, string>;
  /** Present only when the user chose to include a secret key. */
  secretKey?: string;
  exportedAt: string;
}

/** On-disk (encrypted) file format. */
export interface KeystoreFile {
  format: typeof KEYSTORE_FORMAT;
  version: number;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: { name: "AES-GCM"; iv: string };
  ciphertext: string;
}

export class KeystoreError extends Error {
  readonly code: "invalid-file" | "wrong-password" | "unsupported" | "no-crypto";

  constructor(
    message: string,
    code: "invalid-file" | "wrong-password" | "unsupported" | "no-crypto",
  ) {
    super(message);
    this.name = "KeystoreError";
    this.code = code;
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new KeystoreError(
      "Secure encryption is not available in this browser (a secure https context is required).",
      "no-crypto",
    );
  }
  return subtle;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt a payload with `password` into the keystore file format. */
export async function encryptKeystore(
  payload: KeystorePayload,
  password: string,
): Promise<KeystoreFile> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new KeystoreError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      "invalid-file",
    );
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  const ciphertext = await getSubtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return {
    format: KEYSTORE_FORMAT,
    version: KEYSTORE_VERSION,
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: toBase64(salt),
    },
    cipher: { name: "AES-GCM", iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/** Parse and validate the text of a keystore file (does not decrypt). */
export function parseKeystoreFile(text: string): KeystoreFile {
  let file: KeystoreFile;
  try {
    file = JSON.parse(text) as KeystoreFile;
  } catch {
    throw new KeystoreError("This file is not a valid keystore backup.", "invalid-file");
  }
  if (!file || file.format !== KEYSTORE_FORMAT) {
    throw new KeystoreError("This file is not a Sorokit keystore backup.", "invalid-file");
  }
  if (file.version !== KEYSTORE_VERSION) {
    throw new KeystoreError(
      `Unsupported keystore version ${String(file.version)}.`,
      "unsupported",
    );
  }
  if (
    !file.kdf?.salt ||
    !file.cipher?.iv ||
    !file.ciphertext ||
    !Number.isInteger(file.kdf.iterations) ||
    file.kdf.iterations < 1
  ) {
    throw new KeystoreError("The keystore file is incomplete or corrupted.", "invalid-file");
  }
  return file;
}

/** Decrypt a keystore file. A wrong password and a tampered file both fail the GCM auth check. */
export async function decryptKeystore(
  file: KeystoreFile,
  password: string,
): Promise<KeystorePayload> {
  try {
    const key = await deriveKey(password, fromBase64(file.kdf.salt), file.kdf.iterations);
    const plain = await getSubtle().decrypt(
      { name: "AES-GCM", iv: fromBase64(file.cipher.iv) },
      key,
      fromBase64(file.ciphertext),
    );
    const payload = JSON.parse(new TextDecoder().decode(plain)) as KeystorePayload;
    if (!payload || typeof payload.address !== "string") throw new Error("bad payload");
    return payload;
  } catch (e) {
    if (e instanceof KeystoreError) throw e;
    throw new KeystoreError("Incorrect password, or the backup file is corrupted.", "wrong-password");
  }
}

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Collect the restorable app state from this browser. */
export function buildPayload(opts: {
  address: string;
  network: unknown;
  walletName?: string | null;
  customNetworks?: unknown[];
  secretKey?: string;
}): KeystorePayload {
  const preferences: Record<string, string> = {};
  for (const key of PREFERENCE_KEYS) {
    const value = readItem(key);
    if (value !== null) preferences[key] = value;
  }
  const secretKey = opts.secretKey?.trim();
  return {
    address: opts.address,
    network: opts.network,
    walletName: opts.walletName ?? null,
    customNetworks: opts.customNetworks ?? [],
    preferences,
    ...(secretKey ? { secretKey } : {}),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Write a decrypted payload's settings back into localStorage. The provider
 * reads these on startup, so the app must be reloaded to pick them up.
 */
export function applyPayload(payload: KeystorePayload): void {
  try {
    if (payload.network) {
      window.localStorage.setItem(
        STORAGE_KEY_NETWORK,
        typeof payload.network === "string"
          ? payload.network
          : JSON.stringify(payload.network),
      );
    }
    if (Array.isArray(payload.customNetworks) && payload.customNetworks.length) {
      window.localStorage.setItem(
        STORAGE_KEY_CUSTOM_NETWORKS,
        JSON.stringify(payload.customNetworks),
      );
    }
    for (const [key, value] of Object.entries(payload.preferences ?? {})) {
      if (PREFERENCE_KEYS.includes(key) && typeof value === "string") {
        window.localStorage.setItem(key, value);
      }
    }
  } catch {
    throw new KeystoreError("Could not write the restored settings to this browser.", "invalid-file");
  }
}

/** Trigger a browser download of the encrypted keystore. */
export function downloadKeystore(file: KeystoreFile, address: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sorokit-keystore-${address.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
