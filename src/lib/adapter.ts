interface FreighterWallet {
  requestAccess: () => Promise<{ error?: string }>;
  getPublicKey: () => Promise<string>;
}

interface XBullWallet {
  requestPublicKey: () => Promise<string>;
}

interface AlbedoWallet {
  publicKey: () => Promise<{ publicKey: string }>;
}

export interface ClientAdapterConfig {
  network?: 'testnet' | 'public';
}

export type SorobanClientFactory = () => {
  invokeContract: (params: InvokeParams) => Promise<unknown>;
  getEvents: (params: { contractId: string; limit: number; fromLedger?: number }) => Promise<unknown[]>;
};

export interface AdapterResponse<T> {
  data: T | null;
  error: string | null;
  status: "success" | "error" | "pending";
}

import type { InvokeParams } from "./client";

/**
 * Universal client adapter for Stellar wallet connections
 * Supports Freighter, xBull, Albedo, and testnet mocking
 */
export class ClientAdapter {
  private soroban: {
    invokeContract: (params: InvokeParams) => Promise<unknown>;
    getEvents: (params: { contractId: string; limit: number; fromLedger?: number }) => Promise<unknown[]>;
  } | null = null;
  private userAddress: string | null = null;
  private sorobanFactory: SorobanClientFactory | null = null;

  constructor(sorobanClientOrFactory?: {
    invokeContract: (params: InvokeParams) => Promise<unknown>;
    getEvents: (params: { contractId: string; limit: number; fromLedger?: number }) => Promise<unknown[]>;
  } | SorobanClientFactory) {
    if (sorobanClientOrFactory) {
      if (typeof sorobanClientOrFactory === "function") {
        this.sorobanFactory = sorobanClientOrFactory;
      } else {
        this.soroban = sorobanClientOrFactory;
      }
    }
  }

  /**
   * Connect to user's wallet
   * @returns User's public key or error
   */
  async connect(): Promise<AdapterResponse<string>> {
    try {
      // Check for browser wallet extensions
      if (typeof window === 'undefined') {
        return {
          data: null,
          error: 'Wallet connection not available in non-browser environment',
          status: 'error',
        };
      }

      // Try to connect to installed wallet
      let connectedAddress: string | null = null;
      const win = window as unknown as Record<string, unknown>;

      // Check Freighter
      const freighter = win.freighter as FreighterWallet | undefined;
      if (freighter) {
        try {
          const result = await freighter.requestAccess();
          if (result.error) {
            throw new Error(result.error);
          }
          const pk = await freighter.getPublicKey();
          connectedAddress = pk;
        } catch (e) {
          console.debug('Freighter not available:', e);
        }
      }

      // Check xBull
      const xBull = win.xBull as XBullWallet | undefined;
      if (!connectedAddress && xBull) {
        try {
          const pk = await xBull.requestPublicKey();
          connectedAddress = pk;
        } catch (e) {
          console.debug('xBull not available:', e);
        }
      }

      // Check Albedo
      const albedo = win.albedo as AlbedoWallet | undefined;
      if (!connectedAddress && albedo) {
        try {
          const result = await albedo.publicKey();
          connectedAddress = result.publicKey;
        } catch (e) {
          console.debug('Albedo not available:', e);
        }
      }

      if (!connectedAddress) {
        return {
          data: null,
          error: 'No Stellar wallet found. Install Freighter, xBull, or Albedo.',
          status: 'error',
        };
      }

      this.userAddress = connectedAddress;

      // Initialize the Soroban client from the factory if one was provided
      // and no direct client was passed in the constructor.
      if (!this.soroban && this.sorobanFactory) {
        this.soroban = this.sorobanFactory();
      }

      return {
        data: connectedAddress,
        error: null,
        status: 'success',
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: (err instanceof Error) ? err.message : 'Connection failed',
        status: 'error',
      };
    }
  }

  /**
   * Invoke a Soroban smart contract
   * @param contractId - Contract ID
   * @param method - Method name
   * @param params - Method parameters
   */
  async invokeContract(
    params: InvokeParams
  ): Promise<AdapterResponse<unknown>>;
  async invokeContract(
    contractId: string | InvokeParams,
    method?: string,
    params: unknown[] = []
  ): Promise<AdapterResponse<unknown>> {
    try {
      if (!this.userAddress) {
        return {
          data: null,
          error: 'Not connected. Call connect() first.',
          status: 'error',
        };
      }

      if (!this.soroban) {
        return {
          data: null,
          error: 'Soroban client not initialized',
          status: 'error',
        };
      }

      const invokeParams: InvokeParams =
        typeof contractId === "object"
          ? contractId
          : { contractId, method: method ?? "", args: params };

      const result = await this.soroban.invokeContract(invokeParams);

      return {
        data: result,
        error: null,
        status: 'success',
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: `Contract invocation failed: ${(err instanceof Error) ? err.message : 'Unknown error'}`,
        status: 'error',
      };
    }
  }

  /**
   * Get events from a Soroban contract
   * @param contractId - Contract ID
   * @param limit - Maximum number of events
   */
  async getEvents(
    contractId: string,
    limit: number = 100,
    fromLedger?: number
  ): Promise<AdapterResponse<unknown[]>> {
    try {
      if (!this.userAddress) {
        return {
          data: null,
          error: 'Not connected. Call connect() first.',
          status: 'error',
        };
      }

      if (!this.soroban) {
        return {
          data: null,
          error: 'Soroban client not initialized',
          status: 'error',
        };
      }

      const events = await this.soroban.getEvents({
        contractId,
        limit,
        ...(fromLedger !== undefined ? { fromLedger } : {}),
      });

      return {
        data: events,
        error: null,
        status: 'success',
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: `Failed to fetch events: ${(err instanceof Error) ? err.message : 'Unknown error'}`,
        status: 'error',
      };
    }
  }

  /**
   * Get connected user's address
   */
  getAddress(): string | null {
    return this.userAddress;
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.userAddress = null;
    this.soroban = null;
  }

  /**
   * Test-only hook: inject a Soroban client without going through the
   * wallet connect flow. `soroban` is `private` and never assigned in the
   * constructor today (see #714), so tests that want to exercise the
   * happy path of `invokeContract` / `getEvents` need a way to set it.
   *
   * Not part of the public API. Do not call from application code.
   *
   * @internal
   */
  __setSorobanForTests(
    soroban: ClientAdapter['soroban']
  ): void {
    this.soroban = soroban;
  }
}

export const HARDWARE_CONNECT_TIMEOUT_MS = 15_000;
export const DEFAULT_BACKOFF_BASE_MS = 500;
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 3;

const LEDGER_ERROR_MESSAGES: Record<string, string> = {
  "0x6804": "Ledger device is locked or the Stellar app is not open. Unlock your Ledger and open the Stellar app.",
  "0x6985": "Action rejected on Ledger device. Please review and approve the prompt on your hardware wallet.",
  "0x6b00": "Invalid parameter sent to Ledger device. Update the Stellar app on Ledger Live and try again.",
  "0x6d00": "Stellar app is not open on your Ledger device. Open the Stellar app and retry.",
  "0x6e00": "Unsupported app open on Ledger. Quit the current app and open the Stellar app.",
  "0x6700": "Invalid payload length for Ledger transaction. Check transaction size or blind-signing settings.",
  "0x6a80": "Blind signing is disabled on the Ledger Stellar app. Enable hash/blind signing in the app settings.",
};

/**
 * Translate raw hardware wallet hex status words (e.g. `0x6804`) into plain,
 * actionable troubleshooting instructions for the user.
 */
export function translateHardwareError(error: unknown): string {
  const raw =
    typeof error === "number"
      ? `0x${error.toString(16).toLowerCase()}`
      : error instanceof Error
        ? error.message
        : String(error ?? "Unknown hardware wallet error");

  const hexMatch = raw.match(/0x[0-9a-fA-F]{4}/);
  if (hexMatch) {
    const code = hexMatch[0].toLowerCase();
    if (LEDGER_ERROR_MESSAGES[code]) {
      return `${LEDGER_ERROR_MESSAGES[code]} (${code})`;
    }
    return `Hardware wallet returned error ${code}. Ensure your device is unlocked and the Stellar app is open.`;
  }

  return raw;
}

/**
 * Wrap a hardware wallet connection promise with a hard timeout (default 15s)
 * so WebUSB/HID calls do not hang indefinitely when the device is locked.
 */
export function withConnectionTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = HARDWARE_CONNECT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Hardware wallet connection timed out after ${Math.round(timeoutMs / 1000)} seconds. Unlock your device and open the Stellar app.`,
        ),
      );
    }, timeoutMs);

    operation().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export interface BackoffOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  onDelay?: (delayMs: number, attempt: number) => Promise<void> | void;
}

/**
 * Execute a connection function with per-attempt timeout and exponential backoff
 * (`baseDelayMs * 2^(attempt - 1)`).
 */
export async function connectWithBackoff<T>(
  connectFn: () => Promise<T>,
  options: BackoffOptions = {},
): Promise<T> {
  const {
    maxAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    baseDelayMs = DEFAULT_BACKOFF_BASE_MS,
    timeoutMs = HARDWARE_CONNECT_TIMEOUT_MS,
    onDelay,
  } = options;

  let lastError: unknown;
  const attempts = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withConnectionTimeout(connectFn, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const delayMs = baseDelayMs * 2 ** (attempt - 1);
        if (onDelay) {
          await onDelay(delayMs, attempt);
        } else {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
  }

  throw new Error(translateHardwareError(lastError));
}

export interface LedgerTransportProvider {
  getPublicKey: () => Promise<string>;
}

/**
 * Hardware wallet adapter with 15-second connection timeout, exponential
 * reconnection backoff, and human-readable Ledger status code translation.
 */
export class LedgerAdapter {
  private address: string | null = null;

  constructor(
    private readonly transport: LedgerTransportProvider,
    private readonly options: BackoffOptions = {},
  ) {}

  async connect(): Promise<AdapterResponse<string>> {
    try {
      const publicKey = await connectWithBackoff(
        () => this.transport.getPublicKey(),
        this.options,
      );
      this.address = publicKey;
      return {
        data: publicKey,
        error: null,
        status: "success",
      };
    } catch (err: unknown) {
      return {
        data: null,
        error: translateHardwareError(err),
        status: "error",
      };
    }
  }

  getAddress(): string | null {
    return this.address;
  }

  disconnect(): void {
    this.address = null;
  }
}

// Factory for creating adapters
export function createClientAdapter(
  sorobanClientOrFactory?: {
    invokeContract: (params: InvokeParams) => Promise<unknown>;
    getEvents: (params: { contractId: string; limit: number; fromLedger?: number }) => Promise<unknown[]>;
  } | SorobanClientFactory,
): ClientAdapter {
  return new ClientAdapter(sorobanClientOrFactory);
}
