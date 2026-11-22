import { describe, expect,it } from 'vitest';

import type { SorokitClient } from '../client';
import { deterministicMock,DeterministicMockData } from '../deterministic-mock';
import { createMockClient,MOCK_ADDRESS } from '../mock-client';

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

  describe('Edge Case Handling (Issue #1140)', () => {
    describe('Zero balance cases', () => {
      it('returns empty balance array for GZERO address without crashing', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.account.getBalances('GZERO');
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
      });

      it('returns zero XLM balance when configured with zero balance address', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.account.getBalances('GZEROBALANCE');
        expect(res.error).toBeNull();
        expect(res.data).toEqual([
          { asset: 'XLM', balance: '0.0000000', assetType: 'native' },
        ]);
      });

      it('allows configuring a mock client instance with custom zero balances', async () => {
        const client = createMockClient({
          balances: [{ asset: 'XLM', balance: '0', assetType: 'native' }],
        }) as SorokitClient;
        const res = await client.account.getBalances();
        expect(res.error).toBeNull();
        expect(res.data).toHaveLength(1);
        expect(res.data?.[0].balance).toBe('0');
      });

      it('allows configuring an empty balance array without crashing', async () => {
        const client = createMockClient({ balances: [] }) as SorokitClient;
        const res = await client.account.getBalances();
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
      });
    });

    describe('Empty arrays and empty collections', () => {
      it('returns empty array when transaction history is empty', async () => {
        const client = createMockClient({ history: [] }) as SorokitClient;
        const res = await client.transaction.getHistory('GADDR', 1, 10);
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
        expect(res.total).toBe(0);
      });

      it('returns empty array for GEMPTY address', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.transaction.getHistory('GEMPTY');
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
        expect(res.total).toBe(0);
      });

      it('returns empty array when limit is 0', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.transaction.getHistory('GADDR', 1, 0);
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
        expect(res.total).toBe(0);
      });

      it('returns empty array for claimable balances', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.account.getClaimableBalances('GADDR');
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
      });

      it('returns empty array for NFTs', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.nft.getNfts('GADDR');
        expect(res.error).toBeNull();
        expect(res.data).toEqual([]);
      });

      it('returns null data when getOperations finds no matching operations', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.operation.getOperations('non-existent-hash');
        expect(res.error).toBeNull();
        expect(res.data).toBeNull();
      });

      it('returns null data when getTimeline has no matches for filters', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.operation.getTimeline({
          filters: { searchQuery: 'impossible-query-with-zero-results' },
        });
        expect(res.error).toBeNull();
        expect(res.data).toBeNull();
        expect(res.total).toBe(0);
      });
    });

    describe('Null and undefined parameter handling', () => {
      it('handles null and undefined address in account and balances without crashing', async () => {
        const client = createMockClient() as SorokitClient;
        const balRes = await client.account.getBalances(undefined as unknown as string);
        expect(balRes.error).toBeNull();
        expect(Array.isArray(balRes.data)).toBe(true);

        const claimRes = await client.account.getClaimableBalances(undefined as unknown as string);
        expect(claimRes.error).toBeNull();
        expect(claimRes.data).toEqual([]);
      });

      it('handles null/empty balanceId in claimBalance with error instead of throwing', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.account.claimBalance('');
        expect(res.data).toBeNull();
        expect(res.error).toContain('Invalid claimable balance ID');

        const resNull = await client.account.claimBalance(undefined as unknown as string);
        expect(resNull.data).toBeNull();
        expect(resNull.error).toContain('Invalid claimable balance ID');
      });

      it('handles null txHash in getOperations without throwing', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.operation.getOperations(undefined as unknown as string);
        expect(res.error).toBeNull();
        expect(res.data).toBeNull();
      });

      it('handles null/undefined params in getTimeline without crashing', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.operation.getTimeline(undefined as unknown as any);
        expect(res.error).toBeNull();
      });

      it('handles null/undefined param in switchNetwork with an error instead of throwing', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.network.switchNetwork(undefined as unknown as any);
        expect(res.data).toBeNull();
        expect(res.error).toBeDefined();
      });

      it('handles GNOTFOUND account with structured error response', async () => {
        const client = createMockClient() as SorokitClient;
        const res = await client.account.getAccount('GNOTFOUND');
        expect(res.data).toBeNull();
        expect(res.status).toBe('error');
        expect(res.error).toBe('Account not found');
      });

      it('handles transactions with null or undefined memos and metadata gracefully', async () => {
        const client = createMockClient({
          history: [
            {
              hash: 'tx-null-memo',
              ledger: 100,
              createdAt: '2026-01-01T00:00:00Z',
              successful: true,
              operationCount: 1,
              feePaid: '100',
              memo: undefined,
              operationType: undefined,
            },
          ],
        }) as SorokitClient;

        const res = await client.transaction.getHistory('GADDR', 1, 10);
        expect(res.error).toBeNull();
        expect(res.data).toHaveLength(1);
        expect(res.data?.[0].memo).toBeUndefined();
      });
    });
  });
});

