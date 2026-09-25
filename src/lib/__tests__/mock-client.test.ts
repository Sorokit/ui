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
});

