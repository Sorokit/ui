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

const WALLET_CONNECT_TIMEOUT_MS = 15_000;
const MAX_WALLET_CONNECT_ATTEMPTS = 3;
const WALLET_CONNECT_BACKOFF_MS = 250;

const LEDGER_ERROR_GUIDANCE: Record<string, string> = {
  "6804": "Open the Stellar app on your Ledger, unlock the device, and try again.",
  "6985": "The request was rejected on your Ledger. Approve the request on the device and try again.",
  "6a80": "Ledger rejected the request data. Reconnect the device, open the Stellar app, and try again.",
  "6d00": "The Stellar app is not open. Open it on your Ledger and try again.",
  "6e00": "The wrong app is open. Open the Stellar app on your Ledger and try again.",
};

function getLedgerErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown; statusCode?: unknown }).code ??
      (error as { statusCode?: unknown }).statusCode;
    if (typeof code === "number") return code.toString(16).toLowerCase();
    if (typeof code === "string") {
      const match = code.match(/(?:0x)?([0-9a-f]{4})/i);
      if (match) return match[1].toLowerCase();
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.match(/0x([0-9a-f]{4})/i)?.[1].toLowerCase() ?? null;
}

function formatWalletConnectionError(error: unknown): string {
  const code = getLedgerErrorCode(error);
  const guidance = code ? LEDGER_ERROR_GUIDANCE[code] : null;
  if (guidance) return `Ledger error 0x${code}: ${guidance}`;
  return error instanceof Error ? error.message : String(error);
}

function isDeviceActionRequired(error: unknown): boolean {
  const code = getLedgerErrorCode(error);
  return code !== null && code in LEDGER_ERROR_GUIDANCE;
}

async function withWalletConnectTimeout<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error(
            `Wallet connection timed out after ${WALLET_CONNECT_TIMEOUT_MS / 1000} seconds. Unlock your wallet and open the Stellar app if using Ledger.`,
          );
          error.name = "TimeoutError";
          reject(error);
        }, WALLET_CONNECT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

async function connectWithBackoff<T>(
  operation: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await withWalletConnectTimeout(operation);
    } catch (error) {
      if (
        (error instanceof Error && error.name === "TimeoutError") ||
        isDeviceActionRequired(error) ||
        attempt >= MAX_WALLET_CONNECT_ATTEMPTS - 1
      ) {
        throw error;
      }

      const jitter = 0.5 + Math.random();
      await new Promise<void>((resolve) => {
        setTimeout(
          resolve,
          WALLET_CONNECT_BACKOFF_MS * 2 ** attempt * jitter,
        );
      });
    }
  }
}

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
      let connectionError: string | null = null;
      const win = window as unknown as Record<string, unknown>;

      // Check Freighter
      const freighter = win.freighter as FreighterWallet | undefined;
      if (freighter) {
        try {
          connectedAddress = await connectWithBackoff(async () => {
            const result = await freighter.requestAccess();
            if (result.error) throw new Error(result.error);
            return freighter.getPublicKey();
          });
        } catch (e) {
          connectionError = formatWalletConnectionError(e);
          console.debug('Freighter not available:', e);
        }
      }

      // Check xBull
      const xBull = win.xBull as XBullWallet | undefined;
      if (!connectedAddress && xBull) {
        try {
          connectedAddress = await connectWithBackoff(() =>
            xBull.requestPublicKey(),
          );
        } catch (e) {
          connectionError = formatWalletConnectionError(e);
          console.debug('xBull not available:', e);
        }
      }

      // Check Albedo
      const albedo = win.albedo as AlbedoWallet | undefined;
      if (!connectedAddress && albedo) {
        try {
          connectedAddress = await connectWithBackoff(async () => {
            const result = await albedo.publicKey();
            return result.publicKey;
          });
        } catch (e) {
          connectionError = formatWalletConnectionError(e);
          console.debug('Albedo not available:', e);
        }
      }

      if (!connectedAddress) {
        return {
          data: null,
          error:
            connectionError ??
            'No Stellar wallet found. Install Freighter, xBull, or Albedo.',
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

// Factory for creating adapters
export function createClientAdapter(
  sorobanClientOrFactory?: {
    invokeContract: (params: InvokeParams) => Promise<unknown>;
    getEvents: (params: { contractId: string; limit: number; fromLedger?: number }) => Promise<unknown[]>;
  } | SorobanClientFactory,
): ClientAdapter {
  return new ClientAdapter(sorobanClientOrFactory);
}
