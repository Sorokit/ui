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

// Factory for creating adapters
export function createClientAdapter(
  sorobanClientOrFactory?: {
    invokeContract: (params: InvokeParams) => Promise<unknown>;
    getEvents: (params: { contractId: string; limit: number; fromLedger?: number }) => Promise<unknown[]>;
  } | SorobanClientFactory,
): ClientAdapter {
  return new ClientAdapter(sorobanClientOrFactory);
}
