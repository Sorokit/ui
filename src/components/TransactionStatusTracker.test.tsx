import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import {
  computeBackoffDelayMs,
  isRateLimitError,
  isTimeoutExpiredError,
  TransactionStatusTracker,
} from "./TransactionStatusTracker";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/client")>("@/lib/client");
  return {
    ...actual,
    getClient: vi.fn(),
  };
});

const mockUseSorokit = vi.mocked(useSorokit);
const mockGetClient = vi.mocked(getClient);

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("TransactionStatusTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseSorokit.mockReturnValue({
      network: { name: "testnet", rpcUrl: "", horizonUrl: "", passphrase: "" },
      get client() { return getClient(); }
    } as unknown as ReturnType<typeof useSorokit>);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("shows pending and confirmed states while polling until resolution", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({ data: "pending", error: null })
      .mockResolvedValueOnce({ data: "success", error: null });
    mockGetClient.mockReturnValue({
      transaction: { getStatus },
    } as unknown as ReturnType<typeof getClient>);

    await act(async () => {
      render(<TransactionStatusTracker hash="tx-123" pollIntervalMs={1000} />);
    });

    await flushAsyncUpdates();

    expect(
      screen.getByText("Pending", { selector: "span" }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await flushAsyncUpdates();

    expect(
      screen.getByText(/Confirmed/i, { selector: "span" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /block explorer/i }),
    ).toHaveAttribute("href", expect.stringContaining("tx-123"));
    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  it("renders a failure message and stops polling once the transaction resolves", async () => {
    const getStatus = vi.fn().mockResolvedValue({
      data: "failed",
      error: "The transaction was rejected",
    });
    mockGetClient.mockReturnValue({
      transaction: { getStatus },
    } as unknown as ReturnType<typeof getClient>);

    await act(async () => {
      render(<TransactionStatusTracker hash="tx-456" pollIntervalMs={1000} />);
    });

    await flushAsyncUpdates();
    expect(
      screen.getByText(/Failed/i, { selector: "span" }),
    ).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/The transaction was rejected/i),
    ).toBeInTheDocument();
  });

  it("tracks several hashes concurrently and supports copying the hash", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({ data: "pending", error: null })
      .mockResolvedValueOnce({ data: "pending", error: null });
    mockGetClient.mockReturnValue({
      transaction: { getStatus },
    } as unknown as ReturnType<typeof getClient>);

    await act(async () => {
      render(
        <TransactionStatusTracker
          hashes={["hash-a", "hash-b"]}
          pollIntervalMs={1000}
        />,
      );
    });

    await flushAsyncUpdates();

    expect(screen.getByText(/hash-a/i)).toBeInTheDocument();
    expect(screen.getByText(/hash-b/i)).toBeInTheDocument();

    const copyButtons = screen.getAllByRole("button", {
      name: /copy transaction hash/i,
    });
    expect(copyButtons).toHaveLength(2);

    await act(async () => {
      copyButtons[0].click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hash-a");
  });

  it("shows a graceful network error and keeps polling", async () => {
    const getStatus = vi.fn().mockRejectedValue(new Error("RPC unavailable"));
    mockGetClient.mockReturnValue({
      transaction: { getStatus },
    } as unknown as ReturnType<typeof getClient>);

    await act(async () => {
      render(<TransactionStatusTracker hash="tx-789" pollIntervalMs={1000} />);
    });

    await flushAsyncUpdates();
    expect(screen.getByText(/network issue/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(getStatus).toHaveBeenCalledTimes(2);
  });

  describe("exponential backoff on 429/503 (#687)", () => {
    it("backs off and stops polling immediately on the next interval tick after a 429", async () => {
      // Force full jitter to its maximum on every strike. Two consecutive
      // 429s bring the entry to strike 2, whose ceiling is
      // 2 * pollIntervalMs = 2000ms - comfortably longer than the very next
      // 1000ms interval tick, so that tick must be skipped.
      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);
      const getStatus = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: "429 Too Many Requests" })
        .mockResolvedValueOnce({ data: null, error: "429 Too Many Requests" })
        .mockResolvedValue({ data: "pending", error: null });
      mockGetClient.mockReturnValue({
        transaction: { getStatus },
      } as unknown as ReturnType<typeof getClient>);

      await act(async () => {
        render(<TransactionStatusTracker hash="tx-rl" pollIntervalMs={1000} />);
      });
      await flushAsyncUpdates();
      expect(getStatus).toHaveBeenCalledTimes(1);

      // First backoff window (~1000ms from strike 1) has elapsed by the next
      // tick, so this second 429 fires and raises the entry to strike 2.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await flushAsyncUpdates();
      expect(getStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();

      // Strike 2's ~2000ms backoff window outlasts the next 1000ms tick.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      await flushAsyncUpdates();
      expect(getStatus).toHaveBeenCalledTimes(2);

      // Advance well past strike 2's backoff window so polling resumes.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      await flushAsyncUpdates();
      expect(getStatus.mock.calls.length).toBeGreaterThan(2);
      randomSpy.mockRestore();
    });

    it("resumes polling once the backoff window elapses", async () => {
      const getStatus = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: "503 Service Unavailable" })
        .mockResolvedValue({ data: "success", error: null });
      mockGetClient.mockReturnValue({
        transaction: { getStatus },
      } as unknown as ReturnType<typeof getClient>);

      await act(async () => {
        render(<TransactionStatusTracker hash="tx-rl-2" pollIntervalMs={1000} />);
      });
      await flushAsyncUpdates();
      expect(getStatus).toHaveBeenCalledTimes(1);

      // Advance well past any possible backoff window (capped at 30s) so the
      // entry is eligible for polling again regardless of jitter.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(35_000);
      });
      await flushAsyncUpdates();

      expect(getStatus.mock.calls.length).toBeGreaterThan(1);
      expect(screen.getByText(/Confirmed/i, { selector: "span" })).toBeInTheDocument();
    });

    it("does not treat a 429 as a terminal failure", async () => {
      const getStatus = vi.fn().mockResolvedValue({ data: null, error: "429 rate limit exceeded" });
      mockGetClient.mockReturnValue({
        transaction: { getStatus },
      } as unknown as ReturnType<typeof getClient>);

      await act(async () => {
        render(<TransactionStatusTracker hash="tx-rl-3" pollIntervalMs={1000} />);
      });
      await flushAsyncUpdates();

      expect(screen.queryByText("Failed", { selector: "span" })).not.toBeInTheDocument();
      expect(screen.getByText("Pending", { selector: "span" })).toBeInTheDocument();
    });
  });

  describe("timeout ledger expiry (#687)", () => {
    it("shows an 'Expired' status and explanatory message when the timeout ledger passes", async () => {
      const getStatus = vi.fn().mockResolvedValue({
        data: null,
        error: "tx_too_late: the transaction's timebounds expired before it was included",
      });
      mockGetClient.mockReturnValue({
        transaction: { getStatus },
      } as unknown as ReturnType<typeof getClient>);

      await act(async () => {
        render(<TransactionStatusTracker hash="tx-timeout" pollIntervalMs={1000} />);
      });
      await flushAsyncUpdates();

      expect(screen.getByText("Expired", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText(/timeout was reached/i)).toBeInTheDocument();
    });

    it("stops polling once a transaction is marked expired", async () => {
      const getStatus = vi.fn().mockResolvedValue({
        data: null,
        error: "ledger sequence expired for this transaction",
      });
      mockGetClient.mockReturnValue({
        transaction: { getStatus },
      } as unknown as ReturnType<typeof getClient>);

      await act(async () => {
        render(<TransactionStatusTracker hash="tx-timeout-2" pollIntervalMs={1000} />);
      });
      await flushAsyncUpdates();
      expect(getStatus).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it("still treats a plain failure (no timeout wording) as Failed, not Expired", async () => {
      const getStatus = vi.fn().mockResolvedValue({
        data: "failed",
        error: "op_underfunded",
      });
      mockGetClient.mockReturnValue({
        transaction: { getStatus },
      } as unknown as ReturnType<typeof getClient>);

      await act(async () => {
        render(<TransactionStatusTracker hash="tx-plain-fail" pollIntervalMs={1000} />);
      });
      await flushAsyncUpdates();

      expect(screen.getByText("Failed", { selector: "span" })).toBeInTheDocument();
      expect(screen.queryByText("Expired", { selector: "span" })).not.toBeInTheDocument();
    });
  });
});

describe("isRateLimitError (#687)", () => {
  it("detects a 429 status mentioned in the error text", () => {
    expect(isRateLimitError("429 Too Many Requests")).toBe(true);
  });

  it("detects a 503 status mentioned in the error text", () => {
    expect(isRateLimitError("503 Service Unavailable")).toBe(true);
  });

  it("detects a 'rate limit' phrase regardless of status code", () => {
    expect(isRateLimitError("rate limit exceeded, try again later")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isRateLimitError("TOO MANY REQUESTS")).toBe(true);
  });

  it("returns false for an unrelated error", () => {
    expect(isRateLimitError("op_underfunded")).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe("isTimeoutExpiredError (#687)", () => {
  it("detects 'timeout' wording", () => {
    expect(isTimeoutExpiredError("request timeout while waiting for inclusion")).toBe(true);
  });

  it("detects tx_too_late", () => {
    expect(isTimeoutExpiredError("tx_too_late")).toBe(true);
  });

  it("detects 'ledger' combined with 'expir'", () => {
    expect(isTimeoutExpiredError("the ledger sequence expired")).toBe(true);
  });

  it("does not misclassify an unrelated failure", () => {
    expect(isTimeoutExpiredError("op_underfunded")).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(isTimeoutExpiredError(null)).toBe(false);
    expect(isTimeoutExpiredError(undefined)).toBe(false);
  });
});

describe("computeBackoffDelayMs (#687)", () => {
  it("returns 0 for zero or negative strikes", () => {
    expect(computeBackoffDelayMs(0)).toBe(0);
    expect(computeBackoffDelayMs(-1)).toBe(0);
  });

  it("returns a delay within [0, baseMs] for the first strike", () => {
    const delay = computeBackoffDelayMs(1, 1000);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(1000);
  });

  it("doubles the ceiling with each additional strike", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(1); // force the max of the range
    expect(computeBackoffDelayMs(1, 1000)).toBe(1000);
    expect(computeBackoffDelayMs(2, 1000)).toBe(2000);
    expect(computeBackoffDelayMs(3, 1000)).toBe(4000);
    spy.mockRestore();
  });

  it("caps the delay at 30 seconds even with many strikes", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(1);
    expect(computeBackoffDelayMs(10, 1000)).toBe(30_000);
    spy.mockRestore();
  });
});
