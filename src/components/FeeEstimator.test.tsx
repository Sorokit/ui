import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { FeeCell,FeeEstimator } from "./FeeEstimator";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

// Issue #442 / context refactor: the components read their client from
// SorokitContext, so the hook is routed at the same `getClient` mock every test
// below configures. Without this the mocked client never reaches the component.
vi.mock("@/context/useSorokit", async () => {
  const { getClient } = await import("@/lib/client");
  return {
    useSorokit: () => ({
      client: getClient(),
      isConnected: true,
      address: "GTEST",
    }),
  };
});


import type { SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

function mockEstimateFee(result: { data: { baseFee: string; recommended: string } | null; error: string | null }) {
  vi.mocked(getClient).mockReturnValue({
    transaction: {
      estimateFee: vi.fn().mockResolvedValue(result),
    },
  } as unknown as SorokitClient);
}

describe("FeeEstimator", { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading skeleton before data arrives", () => {
    // Never resolves during this test
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateFee: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    } as unknown as SorokitClient);

    const { container } = render(<FeeEstimator />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders fee cell values after data loads", async () => {
    mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
    render(<FeeEstimator />);

    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("500")).toBeInTheDocument();
    });
    expect(screen.getByText("Base Fee")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("(≈ 0.0000100 XLM)")).toBeInTheDocument();
    expect(screen.getByText("(≈ 0.0000500 XLM)")).toBeInTheDocument();
  });

  it("renders the error message when the client returns an error", async () => {
    mockEstimateFee({ data: null, error: "Rate limit exceeded" });
    render(<FeeEstimator />);

    await waitFor(() => {
      expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
    });
  });

  it("clicking the refresh button triggers a new estimateFee call", async () => {
    const estimateFee = vi.fn().mockResolvedValue({
      data: { baseFee: "100", recommended: "500" },
      error: null,
    });
    vi.mocked(getClient).mockReturnValue({
      transaction: { estimateFee },
    } as unknown as SorokitClient);

    render(<FeeEstimator />);

    // Wait for initial load to complete
    await waitFor(() => expect(screen.getByText("100")).toBeInTheDocument());

    const refreshButton = screen.getByRole("button", { name: "Refresh fee estimate" });
    fireEvent.click(refreshButton);

    await waitFor(() => expect(estimateFee).toHaveBeenCalledTimes(2));
  });

  it("disables the refresh button while loading", async () => {
    // First call never resolves so component stays in loading state
    vi.mocked(getClient).mockReturnValue({
      transaction: {
        estimateFee: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    } as unknown as SorokitClient);

    render(<FeeEstimator />);
    const refreshButton = screen.getByRole("button", { name: "Refresh fee estimate" });
    expect(refreshButton).toBeDisabled();
  });

  it("renders the section title", async () => {
    mockEstimateFee({ data: { baseFee: "100", recommended: "200" }, error: null });
    render(<FeeEstimator />);
    expect(screen.getByText("Network Fee")).toBeInTheDocument();
  });

  it("shows a high-fee warning when recommended fee exceeds twice the base fee", async () => {
    mockEstimateFee({ data: { baseFee: "100", recommended: "201" }, error: null });
    render(<FeeEstimator />);

    expect(await screen.findByText("High fee")).toBeInTheDocument();
  });

  it("does not show a high-fee warning when recommended fee is at most twice the base fee", async () => {
    mockEstimateFee({ data: { baseFee: "100", recommended: "200" }, error: null });
    render(<FeeEstimator />);

    await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());
    expect(screen.queryByText("High fee")).not.toBeInTheDocument();
  });

  // ── Accessibility (#120) ──────────────────────────────────────────────────
  describe("accessibility", () => {
    it("exposes the fee estimate as a named landmark region", () => {
      mockEstimateFee({ data: { baseFee: "100", recommended: "200" }, error: null });
      render(<FeeEstimator />);

      expect(
        screen.getByRole("region", { name: "Network fee estimate" }),
      ).toBeInTheDocument();
    });

    it("labels the refresh button for screen readers", () => {
      mockEstimateFee({ data: { baseFee: "100", recommended: "200" }, error: null });
      render(<FeeEstimator />);
      // Announced via aria-label, not the (unreliable) title attribute.
      expect(
        screen.getByRole("button", { name: "Refresh fee estimate" }),
      ).toBeInTheDocument();
    });

    it("announces fee updates via a polite live region", async () => {
      mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
      const { container } = render(<FeeEstimator />);
      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute("aria-atomic", "true");
      await waitFor(() => expect(liveRegion).toHaveTextContent(/100/));
    });
  });

  describe("compact variant", () => {
    it("renders a single-line concise string when compact is true", async () => {
      mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
      render(<FeeEstimator compact />);

      await waitFor(() => {
        expect(
          screen.getByText(/Base: 100 stroops · Recommended: 500 stroops/),
        ).toBeInTheDocument();
      });
    });

    it("shows loading text while data is loading in compact mode", () => {
      vi.mocked(getClient).mockReturnValue({
        transaction: {
          estimateFee: vi.fn().mockReturnValue(new Promise(() => {})),
        },
      } as unknown as SorokitClient);

      render(<FeeEstimator compact />);
      expect(screen.getByText("Loading…")).toBeInTheDocument();
    });
  });

  describe("onFeeLoad callback", () => {
    it("fires onFeeLoad with expected fee data after loading", async () => {
      const onFeeLoad = vi.fn();
      mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
      render(<FeeEstimator onFeeLoad={onFeeLoad} />);

      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });
      expect(onFeeLoad).toHaveBeenCalledTimes(1);
      expect(onFeeLoad).toHaveBeenCalledWith({
        baseFee: "100",
        recommended: "500",
      });
    });

    it("does not call onFeeLoad when fee data has an error", async () => {
      const onFeeLoad = vi.fn();
      mockEstimateFee({ data: null, error: "Network error" });
      render(<FeeEstimator onFeeLoad={onFeeLoad} />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
      expect(onFeeLoad).not.toHaveBeenCalled();
    });
  });

  describe("auto-refresh and mount behavior", () => {
    it("fires only one call on initial mount (no double-fetch)", async () => {
      const estimateFee = vi.fn().mockResolvedValue({
        data: { baseFee: "100", recommended: "500" },
        error: null,
      });
      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      render(<FeeEstimator />);
      await waitFor(() => {
        expect(screen.getByText("100")).toBeInTheDocument();
      });

      expect(estimateFee).toHaveBeenCalledTimes(1);
    });

    it("triggers a second estimateFee call after fake timer advance of 5000ms with refreshInterval=5000", async () => {
      vi.useFakeTimers();
      const estimateFee = vi.fn().mockResolvedValue({
        data: { baseFee: "100", recommended: "500" },
        error: null,
      });
      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      render(<FeeEstimator refreshInterval={5000} />);

      // Let initial mount fetch trigger and resolve
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(estimateFee).toHaveBeenCalledTimes(1);

      // Advance timer by 5000ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(estimateFee).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("pauses polling while hidden and resumes when visible again (#533)", async () => {
      vi.useFakeTimers();
      const estimateFee = vi.fn().mockResolvedValue({
        data: { baseFee: "100", recommended: "500" },
        error: null,
      });
      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      let observerCallback: IntersectionObserverCallback | undefined;
      const observe = vi.fn();
      const disconnect = vi.fn();
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            observerCallback = callback;
          }
          observe = observe;
          disconnect = disconnect;
          unobserve = vi.fn();
        },
      );

      render(<FeeEstimator refreshInterval={5000} />);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(estimateFee).toHaveBeenCalledTimes(1);

      // Simulate Dashboard hiding this screen (the ContractEventFeed-style
      // "mount once, keep alive" pattern — see Dashboard.tsx).
      act(() => {
        observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

      // Time passes while hidden — no new calls should fire.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(estimateFee).toHaveBeenCalledTimes(1);

      // Becomes visible again — polling resumes.
      act(() => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(estimateFee).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(estimateFee).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });

  describe("FeeCell export", () => {
    it("can be imported directly from sorokit-ui (FeeEstimator module)", () => {
      expect(FeeCell).toBeDefined();
      expect(typeof FeeCell).toBe("function");
    });
  });
});

// ── Issue #442: `load` identity must not depend on an inline onFeeLoad ───────
describe("FeeEstimator — issue #442", () => {
  function mockFee() {
    const estimateFee = vi
      .fn()
      .mockResolvedValue({ data: { baseFee: "100", recommended: "500" }, error: null });
    vi.mocked(getClient).mockReturnValue({
      transaction: { estimateFee },
    } as unknown as SorokitClient);
    return estimateFee;
  }

  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes exactly one request on mount", async () => {
    const estimateFee = mockFee();
    render(<FeeEstimator />);
    await waitFor(() => expect(estimateFee).toHaveBeenCalledTimes(1));
    await settle();
    expect(estimateFee).toHaveBeenCalledTimes(1);
  });

  it("does not refetch when the parent re-renders with a new inline onFeeLoad", async () => {
    const estimateFee = mockFee();
    const seen = vi.fn();

    const { rerender } = render(<FeeEstimator onFeeLoad={(f) => seen(f)} />);
    await waitFor(() => expect(estimateFee).toHaveBeenCalledTimes(1));

    // A fresh arrow on each render used to rebuild `load` and refetch.
    rerender(<FeeEstimator onFeeLoad={(f) => seen(f)} />);
    rerender(<FeeEstimator onFeeLoad={(f) => seen(f)} />);
    await settle();

    expect(estimateFee).toHaveBeenCalledTimes(1);
  });

  it("calls the latest onFeeLoad, not the one captured at mount", async () => {
    mockFee();
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = render(<FeeEstimator onFeeLoad={first} />);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));

    rerender(<FeeEstimator onFeeLoad={second} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh fee estimate" }));

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).toHaveBeenCalledTimes(1);
  });
});
