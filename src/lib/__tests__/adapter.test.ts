import { beforeEach,describe, expect, it } from 'vitest';

import { ClientAdapter, createClientAdapter } from '../adapter';

describe('ClientAdapter', () => {
  let adapter: ClientAdapter;

  beforeEach(() => {
    adapter = createClientAdapter();
  });

  describe('Connection', () => {
    it('should return error when no wallet is available', async () => {
      const result = await adapter.connect();
      expect(result.status).toBe('error');
      expect(result.error).toContain('No Stellar wallet found');
      expect(result.data).toBeNull();
    });

    it('should not use hardcoded mock address', async () => {
      const result = await adapter.connect();
      expect(result.data).not.toBe('GBAMQXTQ7IQKPZXJKZJQZJQ...');
    });
  });

  describe('Contract Invocation', () => {
    it('should return error if not connected', async () => {
      const result = await adapter.invokeContract('contract-id', 'method');
      expect(result.status).toBe('error');
      expect(result.error).toContain('Not connected');
      expect(result.data).toBeNull();
    });
  });

  describe('Event Fetching', () => {
    it('should return error if not connected', async () => {
      const result = await adapter.getEvents('contract-id');
      expect(result.status).toBe('error');
      expect(result.error).toContain('Not connected');
      expect(result.data).toBeNull();
    });

    it('should accept limit parameter', async () => {
      const result = await adapter.getEvents('contract-id', 50);
      expect(result).toBeDefined();
    });
  });

  describe('Disconnect', () => {
    it('should clear address on disconnect', async () => {
      adapter.disconnect();
      expect(adapter.getAddress()).toBeNull();
    });
  });
});
