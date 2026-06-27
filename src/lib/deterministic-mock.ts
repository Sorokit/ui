/**
 * Deterministic mock data generation for reproducible tests
 * Uses seeded random number generator for consistent snapshots
 */

export class DeterministicMockData {
  private seed: number;

  constructor(seedValue: number = 12345) {
    this.seed = seedValue;
  }

  /**
   * Seeded pseudo-random number generator (Linear Congruential Generator)
   * Same seed always produces same sequence
   */
  private seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate deterministic hex string
   * @param length - Length of hex string
   * @returns Reproducible hex string
   */
  generateHex(length: number = 64): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const hex = Math.floor(this.seededRandom() * 16).toString(16);
      result += hex;
    }
    return result;
  }

  /**
   * Generate deterministic transaction hash
   */
  generateTransactionHash(): string {
    return '0x' + this.generateHex(64);
  }

  /**
   * Generate deterministic event ID
   */
  generateEventId(): string {
    return this.generateHex(32);
  }

  /**
   * Generate mock transaction history with deterministic values
   */
  generateMockHistory(count: number = 5) {
    const history = [];
    for (let i = 0; i < count; i++) {
      history.push({
        id: this.generateTransactionHash(),
        timestamp: 1700000000000 - i * 1000, // Fixed base time
        status: 'success',
        type: 'contract_invoke',
      });
    }
    return history;
  }

  /**
   * Generate mock events with deterministic values
   */
  generateMockEvents(count: number = 3) {
    const events = [];
    for (let i = 0; i < count; i++) {
      events.push({
        id: this.generateEventId(),
        type: 'contract_event',
        timestamp: 1700000000000 - i * 500,
        data: {
          contractId: this.generateHex(56),
          topics: [this.generateHex(32), this.generateHex(32)],
          value: this.generateHex(64),
        },
      });
    }
    return events;
  }
}

// Export singleton with fixed seed for consistent test data
export const deterministicMock = new DeterministicMockData(12345);
