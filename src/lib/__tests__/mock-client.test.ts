import { describe, expect,it } from 'vitest';

import { deterministicMock,DeterministicMockData } from '../deterministic-mock';
import { createMockClient,MOCK_ADDRESS, NETWORKS } from '../mock-client';

describe('Mock Client - Issue #30 Fixes', () => {
  describe('Fix 1: Valid MOCK_ADDRESS', () => {
    it('should have valid Stellar Ed25519 public key format', () => {
      // Stellar public keys start with G and are 56 characters
      expect(MOCK_ADDRESS).toMatch(/^G[A-Z0-9]{55}$/);
      expect(MOCK_ADDRESS.length).toBe(56);
    });

    it('should not contain repeating Z0J patterns', () => {
      // Old invalid address had "Z0J2Q" repeating
      expect(MOCK_ADDRESS).not.toMatch(/Z0J.*Z0J/);
    });
  });

  describe('Fix 2: switchNetwork error handling', () => {
    it('should return error for unknown network', () => {
      const result = createMockClient('invalidNetwork');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown network');
      expect(result.data).toBeNull();
    });

    it('should return error message with valid network list', () => {
      const result = createMockClient('badname');
      expect(result.error).toContain('testnet');
      expect(result.error).toContain('public');
    });

    it('should return valid config for known networks', () => {
      const result = createMockClient('testnet');
      expect(result.error).toBeNull();
      expect(result.data?.network).toEqual(NETWORKS.testnet);
    });

    it('should default to testnet when no network specified', () => {
      const result = createMockClient();
      expect(result.error).toBeNull();
      expect(result.data?.network).toEqual(NETWORKS.testnet);
    });

    it('should handle both testnet and public networks', () => {
      const testnet = createMockClient('testnet');
      const public_ = createMockClient('public');
      
      expect(testnet.error).toBeNull();
      expect(public_.error).toBeNull();
      expect(testnet.data?.network).not.toEqual(public_.data?.network);
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
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
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
});
