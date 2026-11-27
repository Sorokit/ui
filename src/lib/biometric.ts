/**
 * Platform authenticator (fingerprint / Face ID) helpers for quick unlock
 * (#1152).
 *
 * Biometrics are used only as a local gate in front of the existing wallet
 * connection flow: no keys, session tokens, or salary data are stored here.
 * If WebAuthn is unavailable or the assertion fails, the caller falls back to
 * the normal wallet connect button.
 */

export const BIOMETRIC_ENABLED_KEY = "sorokit_biometric_enabled";
export const BIOMETRIC_CREDENTIAL_KEY = "sorokit_biometric_credential";

const RP_NAME = "Sorokit";
const USER_NAME = "sorokit-user";
const USER_DISPLAY_NAME = "Sorokit user";
const TIMEOUT_MS = 60_000;

function hasCrypto(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto?.getRandomValues === "function"
  );
}

/** True when a platform authenticator can be registered in this browser. */
export function isBiometricSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function" &&
    hasCrypto()
  );
}

/** True when a credential was registered and the user left the toggle on. */
export function isBiometricEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true" &&
      Boolean(window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY))
    );
  } catch {
    return false;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Ask the platform authenticator to register a credential and persist only
 * its id locally. Returns false on rejection, unsupported hardware, or
 * storage failure so the settings toggle can stay off.
 */
export async function registerBiometric(): Promise<boolean> {
  if (!isBiometricSupported()) return false;

  try {
    const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const userId = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: RP_NAME },
        user: {
          id: userId,
          name: USER_NAME,
          displayName: USER_DISPLAY_NAME,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: TIMEOUT_MS,
        attestation: "none",
      },
    });

    if (!credential) return false;

    const rawId = (credential as PublicKeyCredential).rawId;
    window.localStorage.setItem(
      BIOMETRIC_CREDENTIAL_KEY,
      toBase64(new Uint8Array(rawId)),
    );
    window.localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

/** Verify a biometric assertion. Returns false on failure or cancellation. */
export async function authenticateBiometric(): Promise<boolean> {
  if (!isBiometricSupported()) return false;

  let credentialId: string | null;
  try {
    credentialId = window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  } catch {
    return false;
  }
  if (!credentialId) return false;

  try {
    const challenge = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { type: "public-key", id: fromBase64(credentialId) },
        ],
        userVerification: "required",
        timeout: TIMEOUT_MS,
      },
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

/** Turn the quick-unlock gate off and forget the local credential id. */
export function disableBiometric(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    window.localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
