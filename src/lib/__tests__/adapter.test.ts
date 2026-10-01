import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

    it('should pass fromLedger parameter to underlying soroban.getEvents when provided', async () => {
      const getEventsMock = vi.fn().mockResolvedValue([{ id: '1' }]);
      (adapter as unknown as { userAddress: string }).userAddress = 'GABC...';
      (adapter as unknown as { soroban: { getEvents: typeof getEventsMock } }).soroban = {
        getEvents: getEventsMock,
      };

      const result = await adapter.getEvents('contract-id', 50, 12345);
      expect(result.status).toBe('success');
      expect(getEventsMock).toHaveBeenCalledWith({
        contractId: 'contract-id',
        limit: 50,
        fromLedger: 12345,
      });
    });

    it('should omit fromLedger from underlying call when omitted', async () => {
      const getEventsMock = vi.fn().mockResolvedValue([{ id: '1' }]);
      (adapter as unknown as { userAddress: string }).userAddress = 'GABC...';
      (adapter as unknown as { soroban: { getEvents: typeof getEventsMock } }).soroban = {
        getEvents: getEventsMock,
      };

      const result = await adapter.getEvents('contract-id', 50);
      expect(result.status).toBe('success');
      expect(getEventsMock).toHaveBeenCalledWith({
        contractId: 'contract-id',
        limit: 50,
      });
    });
  });

  describe('Disconnect', () => {
    it('should clear address on disconnect', async () => {
      adapter.disconnect();
      expect(adapter.getAddress()).toBeNull();
    });
  });
});


// =============================================================================
// Happy-path coverage (issue #814)
//
// Prior to these tests, the only assertions on invokeContract / getEvents
// exercised the two early-return branches ("Not connected" and "soroban
// null"). #714 fixes the initialization so the happy paths become reachable;
// these tests lock in the correct behavior so a future regression can't
// silently re-break them.
//
// `window.freighter` is stubbed with vi.stubGlobal; the Soroban client is
// injected via ClientAdapter.__setSorobanForTests, which is a test-only
// hook (the field is private and has no public setter).
// =============================================================================

describe('Happy-path flows (issue #814)', () => {
  const TEST_ADDRESS = 'GBAMQXTQ7IQKPZXJKZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQ';
  const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  let adapter: ClientAdapter;

  beforeEach(() => {
    vi.unstubAllGlobals();
    adapter = createClientAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('invokeContract returns the result on the happy path after connect', async () => {
    vi.stubGlobal('window', {
      freighter: {
        requestAccess: vi.fn(async () => ({})),
        getPublicKey: vi.fn(async () => TEST_ADDRESS),
      },
    });

    const expectedResult = { ok: true, value: 42 };
    const invokeContractMock = vi.fn(async () => expectedResult);

    const connectResult = await adapter.connect();
    expect(connectResult.status).toBe('success');
    expect(connectResult.data).toBe(TEST_ADDRESS);
    expect(connectResult.error).toBeNull();

    adapter.__setSorobanForTests({
      invokeContract: invokeContractMock,
      getEvents: vi.fn(),
    });

    const result = await adapter.invokeContract(CONTRACT_ID, 'balance', []);

    expect(result.status).toBe('success');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(expectedResult);
    expect(invokeContractMock).toHaveBeenCalledTimes(1);
    expect(invokeContractMock).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      method: 'balance',
      args: [],
    });
  });

  it('getEvents returns an array on the happy path after connect', async () => {
    vi.stubGlobal('window', {
      freighter: {
        requestAccess: vi.fn(async () => ({})),
        getPublicKey: vi.fn(async () => TEST_ADDRESS),
      },
    });

    const expectedEvents = [
      { id: 'evt-1', contractId: CONTRACT_ID, type: 'transfer', ledger: 1 },
      { id: 'evt-2', contractId: CONTRACT_ID, type: 'mint', ledger: 2 },
    ];
    const getEventsMock = vi.fn(async () => expectedEvents);

    const connectResult = await adapter.connect();
    expect(connectResult.status).toBe('success');

    adapter.__setSorobanForTests({
      invokeContract: vi.fn(),
      getEvents: getEventsMock,
    });

    const result = await adapter.getEvents(CONTRACT_ID, 50);

    expect(result.status).toBe('success');
    expect(result.error).toBeNull();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toEqual(expectedEvents);
    expect(getEventsMock).toHaveBeenCalledTimes(1);
    expect(getEventsMock).toHaveBeenCalledWith({
      contractId: CONTRACT_ID,
      limit: 50,
    });
  });

  it('invokeContract returns "Not connected" after disconnect()', async () => {
    vi.stubGlobal('window', {
      freighter: {
        requestAccess: vi.fn(async () => ({})),
        getPublicKey: vi.fn(async () => TEST_ADDRESS),
      },
    });

    const connectResult = await adapter.connect();
    expect(connectResult.status).toBe('success');

    adapter.__setSorobanForTests({
      invokeContract: vi.fn(async () => ({ ok: true })),
      getEvents: vi.fn(async () => []),
    });

    const before = await adapter.invokeContract(CONTRACT_ID, 'balance', []);
    expect(before.status).toBe('success');

    adapter.disconnect();
    expect(adapter.getAddress()).toBeNull();

    const after = await adapter.invokeContract(CONTRACT_ID, 'balance', []);
    expect(after.status).toBe('error');
    expect(after.data).toBeNull();
    expect(after.error).toContain('Not connected');
  });

  it('constructor-injected client is available after connect', async () => {
    vi.stubGlobal('window', {
      freighter: {
        requestAccess: vi.fn(async () => ({})),
        getPublicKey: vi.fn(async () => TEST_ADDRESS),
      },
    });

    const invokeMock = vi.fn(async () => ({ value: 99 }));
    const adapterWithClient = createClientAdapter({
      invokeContract: invokeMock,
      getEvents: vi.fn(),
    });

    await adapterWithClient.connect();
    const result = await adapterWithClient.invokeContract(CONTRACT_ID, 'balance', []);
    expect(result.status).toBe('success');
    expect(result.data).toEqual({ value: 99 });
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('factory-injected client is created on connect', async () => {
    vi.stubGlobal('window', {
      freighter: {
        requestAccess: vi.fn(async () => ({})),
        getPublicKey: vi.fn(async () => TEST_ADDRESS),
      },
    });

    const invokeMock = vi.fn(async () => ({ value: 77 }));
    const factory = vi.fn(() => ({
      invokeContract: invokeMock,
      getEvents: vi.fn(),
    }));

    const adapterWithFactory = createClientAdapter(factory);

    // Before connect, soroban is null
    const before = await adapterWithFactory.invokeContract(CONTRACT_ID, 'balance', []);
    expect(before.status).toBe('error');

    await adapterWithFactory.connect();
    expect(factory).toHaveBeenCalledTimes(1);

    const after = await adapterWithFactory.invokeContract(CONTRACT_ID, 'balance', []);
    expect(after.status).toBe('success');
    expect(after.data).toEqual({ value: 77 });
  });

  it('disconnect clears the soroban reference', async () => {
    vi.stubGlobal('window', {
      freighter: {
        requestAccess: vi.fn(async () => ({})),
        getPublicKey: vi.fn(async () => TEST_ADDRESS),
      },
    });

    const adapterWithClient = createClientAdapter({
      invokeContract: vi.fn(async () => ({ ok: true })),
      getEvents: vi.fn(async () => []),
    });

    await adapterWithClient.connect();
    const before = await adapterWithClient.invokeContract(CONTRACT_ID, 'balance', []);
    expect(before.status).toBe('success');

    adapterWithClient.disconnect();
    const after = await adapterWithClient.invokeContract(CONTRACT_ID, 'balance', []);
    expect(after.status).toBe('error');
    expect(after.error).toContain('Not connected');
  });
});
