import { describe, expect, it } from 'vitest';

import type { SorokitClient } from '../client';
import { createMockClient } from '../mock-client';

describe('Mock Client - Issue #1077: Timeline getCoverage', () => {
  describe('getTimeline returns grouped timeline format', () => {
    it('returns timeline grouped by date with operation arrays', async () => {
      const client = createMockClient() as SorokitClient;
      const res = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
      });
      expect(res.error).toBeNull();
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.total).toBeGreaterThan(0);

      // Verify each group has a date and transactions array
      for (const group of res.data!) {
        expect(group).toHaveProperty('date');
        expect(Array.isArray(group.transactions)).toBe(true);
        expect(group.transactions.length).toBeGreaterThan(0);

        // Each transaction has operations array
        for (const tx of group.transactions) {
          expect(tx).toHaveProperty('operations');
          expect(Array.isArray(tx.operations)).toBe(true);
          expect(tx.operations.length).toBeGreaterThan(0);

          // Each operation has the expected shape
          for (const op of tx.operations) {
            expect(op).toHaveProperty('id');
            expect(op).toHaveProperty('txHash');
            expect(op).toHaveProperty('type');
            expect(op).toHaveProperty('source');
            expect(op).toHaveProperty('destination');
            expect(op).toHaveProperty('amount');
            expect(op).toHaveProperty('asset');
            expect(op).toHaveProperty('success');
            expect(op).toHaveProperty('createdAt');
          }
        }
      }
    });

    it('respects page and limit parameters', async () => {
      const client = createMockClient() as SorokitClient;
      const page1 = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        page: 1,
        limit: 2,
      });
      const page2 = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        page: 2,
        limit: 2,
      });

      expect(page1.error).toBeNull();
      expect(page2.error).toBeNull();
      expect(page1.data).toHaveLength(2);
      // Page 2 should have the remaining 1 group (total is 3 groups)
      expect(page2.data).toHaveLength(1);

      // Verify pagination: page 1 and page 2 should have different data
      const page1Dates = page1.data!.map((g) => g.date);
      const page2Dates = page2.data!.map((g) => g.date);
      expect(page1Dates).not.toEqual(page2Dates);
      expect(page1.total).toBeGreaterThan(0);
      expect(page2.total).toBeGreaterThan(0);
    });

    it('respects operationType filter', async () => {
      const client = createMockClient() as SorokitClient;
      const res = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        filters: { operationType: 'payment' },
      });
      expect(res.error).toBeNull();
      if (res.data) {
        for (const group of res.data) {
          for (const tx of group.transactions) {
            for (const op of tx.operations) {
              expect(op.type.toLowerCase()).toContain('payment');
            }
          }
        }
      }
    });

    it('respects searchQuery filter', async () => {
      const client = createMockClient() as SorokitClient;
      const res = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        filters: { searchQuery: 'XLM' },
      });
      expect(res.error).toBeNull();
      if (res.data) {
        for (const group of res.data) {
          for (const tx of group.transactions) {
            for (const op of tx.operations) {
              expect(op.asset.toLowerCase()).toContain('xlm') ||
                op.source.toLowerCase().includes('xlm') ||
                op.destination.toLowerCase().includes('xlm');
            }
          }
        }
      }
    });

    it('respects dateFrom filter', async () => {
      const client = createMockClient() as SorokitClient;
      const res = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        filters: { dateFrom: '2026-07-25' },
      });
      expect(res.error).toBeNull();
      if (res.data) {
        for (const group of res.data) {
          // ISO date strings sort lexicographically
          expect(group.date).toMatch(/^2026-07-2[5-9]/);
        }
      }
    });

    it('respects dateTo filter', async () => {
      const client = createMockClient() as SorokitClient;
      const res = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        filters: { dateTo: '2026-07-25' },
      });
      expect(res.error).toBeNull();
      if (res.data) {
        for (const group of res.data) {
          // ISO date strings sort lexicographically; filter keeps groups with date <= dateTo
          expect(group.date).toMatch(/^2026-07-2[0-5]/);
        }
      }
    });

    it('returns null data when no matches for filters', async () => {
      const client = createMockClient() as SorokitClient;
      const res = await client.operation.getTimeline({
        address: 'GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA',
        filters: { operationType: 'nonexistent_type' },
      });
      expect(res.error).toBeNull();
      expect(res.data).toBeNull();
      expect(res.total).toBe(0);
    });
  });
});