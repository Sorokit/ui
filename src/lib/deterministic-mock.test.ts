import { describe, expect, it } from "vitest";

import { DeterministicMockData } from "./deterministic-mock";

describe("DeterministicMockData (#975)", () => {
  describe("Sequential error injection", () => {
    it("injects sequential transient errors before succeeding", async () => {
      const mock = new DeterministicMockData(12345);
      mock.setFailureSequence([
        new Error("Transient network timeout #1"),
        new Error("Transient rate limit #2"),
        "success",
      ]);

      expect(mock.getRemainingFailures()).toBe(3);

      await expect(
        mock.executeWithFailureSequence(() => "ok"),
      ).rejects.toThrow("Transient network timeout #1");
      expect(mock.getRemainingFailures()).toBe(2);

      await expect(
        mock.executeWithFailureSequence(() => "ok"),
      ).rejects.toThrow("Transient rate limit #2");
      expect(mock.getRemainingFailures()).toBe(1);

      const res = await mock.executeWithFailureSequence(() => "recovered-ok");
      expect(res).toBe("recovered-ok");
      expect(mock.getRemainingFailures()).toBe(0);

      // Subsequent calls continue to succeed once queue is drained
      const resAfter = await mock.executeWithFailureSequence(() => "still-ok");
      expect(resAfter).toBe("still-ok");
    });

    it("supports string error messages and resets failure sequence on reset()", async () => {
      const mock = new DeterministicMockData(999);
      mock.setFailureSequence(["horizon_503"]);
      mock.reset();
      expect(mock.getRemainingFailures()).toBe(0);
      await expect(mock.executeWithFailureSequence(() => 42)).resolves.toBe(42);
    });
  });

  describe("Controllable mock clock", () => {
    it("advances time deterministically without real timers and reflects in generated items", () => {
      const initialMs = 1700000000000;
      const mock = new DeterministicMockData(12345, initialMs);

      expect(mock.getCurrentTime()).toBe(initialMs);
      const historyBefore = mock.generateMockHistory(1);
      expect(historyBefore[0].createdAt).toBe(new Date(initialMs).toISOString());

      mock.advanceTime(60_000);
      expect(mock.getCurrentTime()).toBe(initialMs + 60_000);

      const historyAfter = mock.generateMockHistory(1);
      expect(historyAfter[0].createdAt).toBe(
        new Date(initialMs + 60_000).toISOString(),
      );

      mock.reset();
      expect(mock.getCurrentTime()).toBe(initialMs);
    });

    it("validates setCurrentTime and advanceTime inputs", () => {
      const mock = new DeterministicMockData(12345);
      expect(() => mock.setCurrentTime(-1)).toThrow(/non-negative/);
      expect(() => mock.advanceTime(Number.NaN)).toThrow(/finite/);
    });
  });

  describe("Seed reproducibility across runs", () => {
    it("produces identical hashes, history, and events for identical seeds", () => {
      const runA = new DeterministicMockData(77777, 1700000000000);
      const runB = new DeterministicMockData(77777, 1700000000000);

      expect(runA.generateMockHistory(10)).toEqual(runB.generateMockHistory(10));
      expect(runA.generateMockEvents(5)).toEqual(runB.generateMockEvents(5));

      runA.reset();
      const firstPass = runA.generateMockHistory(4);
      runA.reset();
      const secondPass = runA.generateMockHistory(4);
      expect(firstPass).toEqual(secondPass);
    });
  });
});
