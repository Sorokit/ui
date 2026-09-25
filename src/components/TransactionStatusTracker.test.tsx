import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { TransactionStatusTracker } from "./TransactionStatusTracker";

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
});
