/**
 * Deterministic mock data generation for reproducible tests.
 * Uses a seeded LCG random number generator for consistent snapshots.
 *
 * Design: each high-level generator (generateMockHistory, generateMockEvents)
 * resets the internal seed before running so that calling them in any order
 * always produces the same output. The low-level generateHex / generateEventId /
 * generateTransactionHash methods DO advance the seed sequentially; only use
 * them directly when you need a continuous sequence.
 */

export const DEFAULT_MOCK_TIMESTAMP = 1700000000000;

export class DeterministicMockData {
  private initialSeed: number;
  private seed: number;
	private readonly clock: DeterministicMockClock;

	constructor(
		seedValue: number = 12345,
		clock: DeterministicMockClock = new DeterministicMockClock(),
	) {
    this.initialSeed = seedValue;
    this.seed = seedValue;
		this.clock = clock;
  }

	/** Current deterministic time in milliseconds since the Unix epoch. */
	now(): number {
		return this.clock.now();
	}

	/** Advance this data generator's clock without waiting in real time. */
	advanceTime(milliseconds: number): number {
		return this.clock.advanceTime(milliseconds);
	}

  /** Reset the seed back to its initial value. */
  reset(): void {
    this.seed = this.initialSeed;
  }

  /**
   * Seeded pseudo-random number generator (Linear Congruential Generator).
   * Same seed always produces the same sequence.
   */
  private seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate a deterministic lowercase hex string.
   * @param length - Number of hex characters to generate.
   */
  generateHex(length: number = 64): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(this.seededRandom() * 16).toString(16);
    }
    return result;
  }

	/**
	 * Generate deterministic transaction hash
	 */
	generateTransactionHash(): string {
		return this.generateHex(64);
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
				hash: this.generateTransactionHash(),
				ledger: 12345 - i,
				createdAt: new Date(this.clock.now() - i * 1000).toISOString(),
				successful: true,
				operationCount: 1,
				feePaid: '100',
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
				contractId: this.generateHex(56),
				type: 'contract',
				ledger: 12345 - i,
				createdAt: new Date(this.clock.now() - i * 500).toISOString(),
				topics: [this.generateHex(32), this.generateHex(32)],
				value: this.generateHex(64),
			});
		}
		return events;
	}
}

/** Manual clock shared by deterministic mock data generators and clients. */
export class DeterministicMockClock {
	private currentTime: number;

	constructor(initialTime: number = DEFAULT_MOCK_TIMESTAMP) {
		if (!Number.isFinite(initialTime)) {
			throw new RangeError("Mock clock time must be a finite number.");
		}
		this.currentTime = initialTime;
	}

	now(): number {
		return this.currentTime;
	}

	advanceTime(milliseconds: number): number {
		if (!Number.isFinite(milliseconds) || milliseconds < 0) {
			throw new RangeError("Mock clock can only advance by a finite non-negative duration.");
		}
		this.currentTime += milliseconds;
		return this.currentTime;
	}
}

/** Singleton with a fixed seed for consistent test data across imports. */
export const deterministicMock = new DeterministicMockData(12345);
