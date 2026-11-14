/**
 * Deterministic mock data generation for reproducible tests.
 * Uses a seeded LCG random number generator for consistent snapshots,
 * a controllable mock clock for deterministic timestamps, and a sequential
 * error-injection queue for resilience testing.
 */

export type FailureSequenceStep = Error | string | null | "success";

export class DeterministicMockData {
  private initialSeed: number;
  private seed: number;
  private initialTimeMs: number;
  private currentTimeMs: number;
  private failureSequence: FailureSequenceStep[] = [];

  constructor(seedValue: number = 12345, initialTimeMs: number = 1700000000000) {
    this.initialSeed = seedValue;
    this.seed = seedValue;
    this.initialTimeMs = initialTimeMs;
    this.currentTimeMs = initialTimeMs;
  }

  /** Reset the seed, mock clock, and failure sequence back to initial state. */
  reset(): void {
    this.seed = this.initialSeed;
    this.currentTimeMs = this.initialTimeMs;
    this.failureSequence = [];
  }

  /**
   * Configure a sequence of transient errors or successes to inject into mock operations.
   * For example: `[new Error('timeout'), new Error('rate_limit'), 'success']`.
   */
  setFailureSequence(sequence: FailureSequenceStep[]): void {
    this.failureSequence = [...sequence];
  }

  /** Return the number of remaining entries in the failure sequence. */
  getRemainingFailures(): number {
    return this.failureSequence.length;
  }

  /**
   * Consume the next step in the failure sequence.
   * Throws an Error if the next step is an Error or error string, or returns null if it succeeds.
   */
  consumeNextStep(): Error | null {
    if (this.failureSequence.length === 0) {
      return null;
    }
    const next = this.failureSequence.shift()!;
    if (next === null || next === "success") {
      return null;
    }
    const err = next instanceof Error ? next : new Error(String(next));
    throw err;
  }

  /**
   * Execute an operation with the configured failure sequence applied.
   * If the current step in the sequence is a failure, throws that Error; otherwise runs `fn`.
   */
  async executeWithFailureSequence<T>(fn: () => T | Promise<T>): Promise<T> {
    this.consumeNextStep();
    return await fn();
  }

  /** Return the current mock clock timestamp in milliseconds. */
  getCurrentTime(): number {
    return this.currentTimeMs;
  }

  /** Return the current mock clock timestamp as an ISO-8601 string. */
  getCurrentIsoTime(): string {
    return new Date(this.currentTimeMs).toISOString();
  }

  /** Set the mock clock to a specific timestamp in milliseconds. */
  setCurrentTime(timestampMs: number): void {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      throw new Error("Mock clock timestamp must be a non-negative finite number");
    }
    this.currentTimeMs = timestampMs;
  }

  /** Advance the mock clock deterministically by `ms` milliseconds. */
  advanceTime(ms: number): number {
    if (!Number.isFinite(ms)) {
      throw new Error("Time delta must be a finite number");
    }
    this.currentTimeMs += ms;
    return this.currentTimeMs;
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
    let result = "";
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
   * Generate mock transaction history with deterministic values and mock clock timestamps
   */
  generateMockHistory(count: number = 5) {
    const history = [];
    for (let i = 0; i < count; i++) {
      history.push({
        hash: this.generateTransactionHash(),
        ledger: 12345 - i,
        createdAt: new Date(this.currentTimeMs - i * 1000).toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      });
    }
    return history;
  }

  /**
   * Generate mock events with deterministic values and mock clock timestamps
   */
  generateMockEvents(count: number = 3) {
    const events = [];
    for (let i = 0; i < count; i++) {
      events.push({
        id: this.generateEventId(),
        contractId: this.generateHex(56),
        type: "contract",
        ledger: 12345 - i,
        createdAt: new Date(this.currentTimeMs - i * 500).toISOString(),
        topics: [this.generateHex(32), this.generateHex(32)],
        value: this.generateHex(64),
      });
    }
    return events;
  }
}

/** Singleton with a fixed seed for consistent test data across imports. */
export const deterministicMock = new DeterministicMockData(12345);
