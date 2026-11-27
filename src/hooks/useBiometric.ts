import { useCallback, useState } from "react";

import {
  authenticateBiometric,
  disableBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  registerBiometric,
} from "@/lib/biometric";

export interface BiometricState {
  /** Whether this browser can register a platform authenticator. */
  supported: boolean;
  /** Whether the user has registered one and left quick unlock enabled. */
  enabled: boolean;
  /** Request permission and register the credential. Returns false on failure. */
  enable: () => Promise<boolean>;
  /** Disable quick unlock and clear the stored credential id. */
  disable: () => void;
  /** Verify a biometric assertion before continuing to wallet connect. */
  authenticate: () => Promise<boolean>;
}

/**
 * Small state wrapper around the biometric helpers so settings and the
 * connect screen share one source of truth (#1152).
 */
export function useBiometric(): BiometricState {
  const [supported] = useState(isBiometricSupported);
  const [enabled, setEnabled] = useState(isBiometricEnabled);

  const enable = useCallback(async () => {
    const ok = await registerBiometric();
    setEnabled(ok);
    return ok;
  }, []);

  const disable = useCallback(() => {
    disableBiometric();
    setEnabled(false);
  }, []);

  const authenticate = useCallback(() => authenticateBiometric(), []);

  return { supported, enabled, enable, disable, authenticate };
}
