import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SorokitClient } from '../client';
import { deterministicMock,DeterministicMockData } from '../deterministic-mock';
import { createMockClient,MOCK_ADDRESS } from '../mock-client';
import { fetchWithRetry, formatStellarError } from '../rpc';

afterEach(() => vi.unstubAllGlobals());

describe('RPC retry behavior', () => {
  it('retries network dropouts with exponential backoff and jitter', async () => {
    const wait = vi.fn(async (_milliseconds: number, _signal?: AbortSignal) =>
      Promise.resolve(),
    );
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ status: 200 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithRetry('https://rpc.example', undefined, {
      baseDelayMs: 100,
      random: () => 0.25,
      wait,
    });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      75,
      150,
    ]);
  });

  it.each([429, 502, 503, 504])('retries HTTP %i responses', async (status) => {
    const wait = vi.fn(async (_milliseconds: number, _signal?: AbortSignal) =>
      Promise.resolve(),
    );
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status } as Response)
      .mockResolvedValueOnce({ status: 200 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithRetry('https://rpc.example', undefined, {
      baseDelayMs: 100,
      random: () => 0.5,
      wait,
    });

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(100, undefined);
  });

  it('stops after three retries when the endpoint remains unavailable', async () => {
    const wait = vi.fn(async (_milliseconds: number, _signal?: AbortSignal) =>
      Promise.resolve(),
    );
    const fetchMock = vi.fn().mockResolvedValue({ status: 503 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithRetry('https://rpc.example', undefined, {
      baseDelayMs: 100,
      random: () => 0.5,
      wait,
    });

    expect(result.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([
      100,
      200,
      400,
    ]);
  });

  it('exposes Horizon operation result codes alongside the detail', () => {
    expect(
      formatStellarError({
        detail: 'Transaction failed',
        extras: {
          result_codes: {
            operations: ['op_underfunded', 'op_bad_auth'],
          },
        },
      }),
    ).toBe(
      'Transaction failed (operation codes: op_underfunded, op_bad_auth)',
    );
  });
});

describe('Mock Client - Issue #30 Fixes', () => {
  describe('Fix 1: Valid MOCK_ADDRESS', () => {
    it('should have valid Stellar Ed25519 public key format', () => {
      // Stellar public keys start with G and are 56 characters total
      expect(MOCK_ADDRESS).toMatch(/^G[A-Z0-9]{55}$/);
      expect(MOCK_ADDRESS.length).toBe(56);
    });

    it('should not contain repeating Z0J patterns', () => {
      // Old invalid address had "Z0J2Q" repeating
      expect(MOCK_ADDRESS).not.toMatch(/Z0J.*Z0J/);
    });
  });

  describe('Fix 2: switchNetwork error handling', () => {
    it('should return error for unknown network', async () => {
      const result = createMockClient('invalidNetwork');
      expect(result).not.toHaveProperty('wallet');
      if (!('wallet' in result)) {
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Unknown network');
        expect(result.data).toBeNull();
      }
    });

    it('should return error message with valid network list', () => {
      const result = createMockClient('badname');
      if (!('wallet' in result)) {
        expect(result.error).toContain('testnet');
        expect(result.error).toContain('public');
      }
    });

    it('should return valid config for known networks', async () => {
      const client = createMockClient('testnet') as SorokitClient;
      const { data, error } = await client.network.getNetwork();
      expect(error).toBeNull();
      expect(data?.name).toBe('testnet');
    });

    it('should default to testnet when no network specified', async () => {
      const client = createMockClient() as SorokitClient;
      const { data, error } = await client.network.getNetwork();
      expect(error).toBeNull();
      expect(data?.name).toBe('testnet');
    });

    it('should handle both testnet and public networks', async () => {
      const testnetClient = createMockClient('testnet') as SorokitClient;
      const publicClient = createMockClient('public') as SorokitClient;
      
      const testnetInfo = await testnetClient.network.getNetwork();
      const publicInfo = await publicClient.network.getNetwork();
      expect(testnetInfo.error).toBeNull();
      expect(publicInfo.error).toBeNull();
      expect(testnetInfo.data?.name).not.toEqual(publicInfo.data?.name);
    });
  });

  describe('Fix 3: Deterministic mock data', () => {
    it('should generate consistent hex with same seed', () => {
      const mock1 = new DeterministicMockData(12345);
      const mock2 = new DeterministicMockData(12345);

      expect(mock1.generateHex(32)).toBe(mock2.generateHex(32));
    });

    it('should generate different hex with different seeds', () => {
      const mock1 = new DeterministicMockData(12345);
      const mock2 = new DeterministicMockData(54321);

      expect(mock1.generateHex(32)).not.toBe(mock2.generateHex(32));
    });

    it('should generate valid transaction hashes', () => {
      const hash = deterministicMock.generateTransactionHash();
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate valid event IDs', () => {
      const id = deterministicMock.generateEventId();
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate reproducible history', () => {
      const mock = new DeterministicMockData(12345);
      const history1 = mock.generateMockHistory(3);

      const mock2 = new DeterministicMockData(12345);
      const history2 = mock2.generateMockHistory(3);

      expect(history1).toEqual(history2);
    });

    it('should generate reproducible events', () => {
      const mock = new DeterministicMockData(12345);
      const events1 = mock.generateMockEvents(2);

      const mock2 = new DeterministicMockData(12345);
      const events2 = mock2.generateMockEvents(2);

      expect(events1).toEqual(events2);
    });

    it('snapshots should be reproducible', () => {
      const mock1 = new DeterministicMockData(12345);
      const snapshot1 = {
        history: mock1.generateMockHistory(5),
        events: mock1.generateMockEvents(3),
      };
      
      const mock2 = new DeterministicMockData(12345);
      const snapshot2 = {
        history: mock2.generateMockHistory(5),
        events: mock2.generateMockEvents(3),
      };

      expect(snapshot1).toEqual(snapshot2);
    });

    it('produces identical responses from separately created clients with the same seed', async () => {
      const client1 = createMockClient({ seed: 8128 });
      const client2 = createMockClient({ seed: 8128 });

      const [response1, history1, response2, history2] = await Promise.all([
        client1.transaction.submit(),
        client1.transaction.getHistory(MOCK_ADDRESS),
        client2.transaction.submit(),
        client2.transaction.getHistory(MOCK_ADDRESS),
      ]);

      expect(response1).toEqual(response2);
      expect(history1).toEqual(history2);
    });

    it('advances mock ledger timestamps without using real time', async () => {
      const client = createMockClient();
      const before = await client.transaction.getHistory(MOCK_ADDRESS, 1, 1);
      const initialTimestamp = Date.parse(before.data![0].createdAt);

      expect(client.advanceTime(60_000)).toBe(1700000060000);

      const after = await client.transaction.getHistory(MOCK_ADDRESS, 1, 1);
      expect(Date.parse(after.data![0].createdAt)).toBe(initialTimestamp + 60_000);
    });
  });

  describe('Mock operation failure injection', () => {
    it('plays through sequential errors before allowing the operation to succeed', async () => {
      const client = createMockClient();
      const firstError = new Error('temporary failure 1');
      const secondError = new Error('temporary failure 2');
      client.setFailureSequence(
        [firstError, secondError, 'success'],
        'transaction.submit',
      );

      await expect(client.transaction.submit()).rejects.toBe(firstError);
      await expect(client.transaction.submit()).rejects.toBe(secondError);
      const result = await client.transaction.submit();

      expect(result.error).toBeNull();
      expect(result.data).not.toBeNull();
    });
  });

  describe('Fix 4: Pagination support in getHistory (Issue #588)', () => {
    it('should paginate results by page and limit with accurate total', async () => {
      const client = createMockClient() as SorokitClient;

      const page1 = await client.transaction.getHistory('GADDR', 1, 10);
      const page2 = await client.transaction.getHistory('GADDR', 2, 10);
      const page3 = await client.transaction.getHistory('GADDR', 3, 10);

      expect(page1.data).toHaveLength(10);
      expect(page2.data).toHaveLength(10);
      expect(page3.data).toHaveLength(5);

      expect(page1.total).toBe(25);
      expect(page2.total).toBe(25);
      expect(page3.total).toBe(25);

      // Verify that page 1 and page 2 return completely different transactions
      const page1Ids = page1.data?.map(t => t.hash);
      const page2Ids = page2.data?.map(t => t.hash);
      expect(page1Ids).not.toEqual(page2Ids);
    });
  });
});

