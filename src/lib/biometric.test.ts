import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  authenticateBiometric,
  BIOMETRIC_CREDENTIAL_KEY,
  BIOMETRIC_ENABLED_KEY,
  disableBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  registerBiometric,
} from "./biometric";

/** Install a minimal WebAuthn-shaped navigator.credentials object. */
function setWebAuthn(supported: boolean, handlers: {
  create?: (...args: unknown[]) => Promise<unknown>;
  get?: (...args: unknown[]) => Promise<unknown>;
} = {}) {
  const win = window as unknown as { PublicKeyCredential?: unknown };
  if (supported) {
    win.PublicKeyCredential = class {};
  } else {
    delete win.PublicKeyCredential;
  }
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: supported
      ? { create: vi.fn(handlers.create), get: vi.fn(handlers.get) }
      : undefined,
  });
}

describe("biometric helpers (#1152)", () => {
  beforeEach(() => {
    localStorage.clear();
    setWebAuthn(true);
    if (!globalThis.crypto?.getRandomValues) {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {
          getRandomValues: (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i += 1) arr[i] = i;
            return arr;
          },
        },
      });
    }
  });

  it("reports support only when the platform authenticator APIs exist", () => {
    expect(isBiometricSupported()).toBe(true);
    setWebAuthn(false);
    expect(isBiometricSupported()).toBe(false);
  });

  it("registers a credential and enables the toggle", async () => {
    const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
    setWebAuthn(true, { create: async () => ({ rawId }) });

    await expect(registerBiometric()).resolves.toBe(true);
    expect(localStorage.getItem(BIOMETRIC_ENABLED_KEY)).toBe("true");
    expect(localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)).toBeTruthy();
    expect(isBiometricEnabled()).toBe(true);
  });

  it("does not enable the toggle when the user rejects registration", async () => {
    setWebAuthn(true, { create: async () => Promise.reject(new Error("NotAllowedError")) });

    await expect(registerBiometric()).resolves.toBe(false);
    expect(isBiometricEnabled()).toBe(false);
  });

  it("returns false when no credential is registered", async () => {
    await expect(authenticateBiometric()).resolves.toBe(false);
  });

  it("verifies an assertion for the stored credential", async () => {
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, btoa("credential-id"));
    setWebAuthn(true, { get: async () => ({ id: "credential-id" }) });

    await expect(authenticateBiometric()).resolves.toBe(true);
    expect(navigator.credentials?.get).toHaveBeenCalledOnce();
  });

  it("returns false when the assertion is rejected", async () => {
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, btoa("credential-id"));
    setWebAuthn(true, { get: async () => Promise.reject(new Error("NotAllowedError")) });

    await expect(authenticateBiometric()).resolves.toBe(false);
  });

  it("clears both keys when disabled", () => {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, "abc");
    disableBiometric();

    expect(isBiometricEnabled()).toBe(false);
    expect(localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY)).toBeNull();
  });
});
