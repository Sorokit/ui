import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyFeeMultiplier,
  FeeCell,
  FeeEstimator,
  MIN_NETWORK_BASE_FEE,
  SURGE_FEE_THRESHOLD,
} from "./FeeEstimator";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

// Issue #442 / context refactor: the components read their client from
// SorokitContext, so the hook is routed at the same `getClient` mock every test
// below configures. Without this the mocked client never reaches the component.
// `network` is mutable so the #958 tests can simulate a network switch.
const sorokitState = vi.hoisted(() => ({
  network: null as { name: string; passphrase: string } | null,
}));

vi.mock("@/context/useSorokit", async () => {
  const { getClient } = await import("@/lib/client");
  return {
    useSorokit: () => ({
      client: getClient(),
      isConnected: true,
      address: "GTEST",
      network: sorokitState.network,
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

// ── Issue #670: Surge fee clamping, custom fee overrides, and retry on error ───
describe("FeeEstimator — issue #670", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fee clamping", () => {
    it("clamps negative or sub-minimum base fee and recommended fee to 100 stroops", async () => {
      const onFeeLoad = vi.fn();
      mockEstimateFee({
        data: { baseFee: "-20", recommended: "50" },
        error: null,
      });

      render(<FeeEstimator onFeeLoad={onFeeLoad} />);

      await waitFor(() => {
        const feeValues = screen.getAllByText(MIN_NETWORK_BASE_FEE.toString());
        expect(feeValues.length).toBeGreaterThanOrEqual(1);
      });

      expect(onFeeLoad).toHaveBeenCalledWith({
        baseFee: "100",
        recommended: "100",
      });
    });

    it("clamps zero or empty fee values to minimum 100 stroops", async () => {
      const onFeeLoad = vi.fn();
      mockEstimateFee({
        data: { baseFee: "0", recommended: "0" },
        error: null,
      });

      render(<FeeEstimator onFeeLoad={onFeeLoad} />);

      await waitFor(() => {
        expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(1);
      });

      expect(onFeeLoad).toHaveBeenCalledWith({
        baseFee: "100",
        recommended: "100",
      });
    });
  });

  describe("custom fee override input", () => {
    it("renders custom fee input and allows entering a valid override", async () => {
      mockEstimateFee({
        data: { baseFee: "100", recommended: "200" },
        error: null,
      });
      const onCustomFeeChange = vi.fn();

      render(<FeeEstimator onCustomFeeChange={onCustomFeeChange} />);

      await waitFor(() => expect(screen.getByText("Base Fee")).toBeInTheDocument());

      const input = screen.getByLabelText("Custom fee in stroops");
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "250" } });
      expect(input).toHaveValue(250);
      expect(onCustomFeeChange).toHaveBeenCalledWith("250");
      expect(screen.getByText("(≈ 0.0000250 XLM)")).toBeInTheDocument();
    });

    it("displays validation error when custom fee is below minimum 100 stroops", async () => {
      mockEstimateFee({
        data: { baseFee: "100", recommended: "200" },
        error: null,
      });
      const onCustomFeeChange = vi.fn();

      render(<FeeEstimator onCustomFeeChange={onCustomFeeChange} />);

      await waitFor(() => expect(screen.getByText("Base Fee")).toBeInTheDocument());

      const input = screen.getByLabelText("Custom fee in stroops");
      fireEvent.change(input, { target: { value: "50" } });

      expect(screen.getByRole("alert")).toHaveTextContent("Fee must be at least 100 stroops");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(onCustomFeeChange).toHaveBeenCalledWith("");
    });
  });

  describe("network failure, timeout and retry actions", () => {
    it("catches RPC timeout rejections, displays error message and retries on button click", async () => {
      const estimateFee = vi
        .fn()
        .mockRejectedValueOnce(new Error("Request timed out"))
        .mockResolvedValueOnce({
          data: { baseFee: "100", recommended: "300" },
          error: null,
        });

      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      render(<FeeEstimator />);

      await waitFor(() => {
        expect(screen.getByText("Request timed out")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: "Retry" });
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(estimateFee).toHaveBeenCalledTimes(2);
        expect(screen.getByText("300")).toBeInTheDocument();
      });
    });

    it("renders retry button in compact mode on error and triggers retry", async () => {
      const estimateFee = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: "Gateway Timeout" })
        .mockResolvedValueOnce({
          data: { baseFee: "100", recommended: "200" },
          error: null,
        });

      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      render(<FeeEstimator compact />);

      await waitFor(() => {
        expect(screen.getByText("Gateway Timeout")).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", { name: "Retry" });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(estimateFee).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/Base: 100 stroops/)).toBeInTheDocument();
      });
    });

    it("clears polling interval on unmount even when useIsVisible reported false at unmount time (#861)", async () => {
      vi.useFakeTimers();

      let observerCallback: IntersectionObserverCallback | null = null;
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            observerCallback = callback;
          }
          observe = vi.fn();
          disconnect = vi.fn();
          unobserve = vi.fn();
        },
      );

      const estimateFee = vi.fn().mockResolvedValue({
        data: { baseFee: "100", recommended: "500" },
        error: null,
      });
      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      const { unmount } = render(
        <FeeEstimator refreshInterval={1000} />,
      );

      // Initial load executes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(estimateFee).toHaveBeenCalledTimes(1);

      // First interval tick
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(estimateFee).toHaveBeenCalledTimes(2);

      // Component becomes invisible
      act(() => {
        observerCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

      // Unmount while invisible
      unmount();

      // Advance time by 5000ms -> assert no further polling calls occur
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(estimateFee).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });
});


// ── Issue #958: network switch, surge pricing, speed multipliers ─────────────
describe("FeeEstimator — issue #958", () => {
  const TESTNET = { name: "testnet", passphrase: "Test SDF Network ; September 2015" };
  const MAINNET = { name: "mainnet", passphrase: "Public Global Stellar Network ; September 2015" };

  beforeEach(() => {
    vi.clearAllMocks();
    sorokitState.network = TESTNET;
  });

  afterEach(() => {
    sorokitState.network = null;
  });

  describe("network switch", () => {
    it("clears the previous network's fees immediately and fetches fresh ones", async () => {
      let resolveMainnet: (v: unknown) => void = () => {};
      const estimateFee = vi
        .fn()
        .mockResolvedValueOnce({ data: { baseFee: "111", recommended: "222" }, error: null })
        .mockReturnValueOnce(new Promise((r) => { resolveMainnet = r; }));
      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      const { rerender, container } = render(<FeeEstimator refreshInterval={30_000} />);
      await waitFor(() => expect(screen.getByText("111")).toBeInTheDocument());

      sorokitState.network = MAINNET;
      rerender(<FeeEstimator refreshInterval={30_000} />);

      // Stale testnet values are gone at once — no waiting for the 30s poll.
      await waitFor(() => expect(screen.queryByText("111")).not.toBeInTheDocument());
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
      expect(estimateFee).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveMainnet({ data: { baseFee: "150", recommended: "450" }, error: null });
      });
      expect(await screen.findByText("150")).toBeInTheDocument();
      expect(screen.getByText("450")).toBeInTheDocument();
    });

    it("discards a response from the old network that resolves after the switch", async () => {
      let resolveTestnet: (v: unknown) => void = () => {};
      const estimateFee = vi
        .fn()
        .mockReturnValueOnce(new Promise((r) => { resolveTestnet = r; }))
        .mockResolvedValueOnce({ data: { baseFee: "150", recommended: "450" }, error: null });
      vi.mocked(getClient).mockReturnValue({
        transaction: { estimateFee },
      } as unknown as SorokitClient);

      const { rerender } = render(<FeeEstimator />);
      await waitFor(() => expect(estimateFee).toHaveBeenCalledTimes(1));

      sorokitState.network = MAINNET;
      rerender(<FeeEstimator />);
      expect(await screen.findByText("150")).toBeInTheDocument();

      // The testnet request finally answers — it must not overwrite mainnet.
      await act(async () => {
        resolveTestnet({ data: { baseFee: "999", recommended: "9999" }, error: null });
      });
      expect(screen.queryByText("999")).not.toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    it("does not refetch when the network object is re-created with the same values", async () => {
      mockEstimateFee({ data: { baseFee: "100", recommended: "200" }, error: null });
      const { rerender } = render(<FeeEstimator />);
      await waitFor(() => expect(screen.getByText("200")).toBeInTheDocument());

      sorokitState.network = { ...TESTNET };
      rerender(<FeeEstimator />);
      const estimateFee = vi.mocked(getClient)().transaction.estimateFee;
      expect(estimateFee).toHaveBeenCalledTimes(1);
    });
  });

  describe("surge pricing warning", () => {
    it("treats more than 3x the minimum base fee as surge pricing", () => {
      expect(SURGE_FEE_THRESHOLD).toBe(300);
    });

    it("shows a prominent alert when the base fee exceeds 300 stroops", async () => {
      mockEstimateFee({ data: { baseFee: "450", recommended: "900" }, error: null });
      render(<FeeEstimator />);

      const banner = await screen.findByTestId("surge-warning");
      expect(banner).toHaveAttribute("role", "alert");
      expect(banner).toHaveTextContent("Surge pricing");
      expect(banner).toHaveTextContent("4.5x the minimum");
      expect(banner).toHaveTextContent(/competing on fee/);
    });

    it("does not warn at exactly 300 stroops", async () => {
      mockEstimateFee({ data: { baseFee: "300", recommended: "600" }, error: null });
      render(<FeeEstimator />);

      await screen.findByText("600");
      expect(screen.queryByTestId("surge-warning")).not.toBeInTheDocument();
    });

    it("shows a surge badge in the compact variant", async () => {
      mockEstimateFee({ data: { baseFee: "301", recommended: "700" }, error: null });
      render(<FeeEstimator compact />);

      expect(await screen.findByRole("alert")).toHaveTextContent("Surge pricing");
    });
  });

  describe("speed multipliers", () => {
    it("renders 1.2x, 1.5x and 2.0x toggle buttons, none selected by default", async () => {
      mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
      render(<FeeEstimator />);

      for (const label of ["1.2x", "1.5x", "2.0x"]) {
        expect(await screen.findByRole("button", { name: label })).toHaveAttribute(
          "aria-pressed",
          "false",
        );
      }
      expect(screen.queryByTestId("multiplied-fee")).not.toBeInTheDocument();
    });

    it("applies the selected multiplier to the recommended fee", async () => {
      const onMultiplierChange = vi.fn();
      mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
      render(<FeeEstimator onMultiplierChange={onMultiplierChange} />);

      fireEvent.click(await screen.findByRole("button", { name: "1.2x" }));
      expect(screen.getByRole("button", { name: "1.2x" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("multiplied-fee")).toHaveTextContent("600 stroops");
      expect(onMultiplierChange).toHaveBeenLastCalledWith(1.2, "600");

      fireEvent.click(screen.getByRole("button", { name: "2.0x" }));
      expect(screen.getByRole("button", { name: "1.2x" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("multiplied-fee")).toHaveTextContent("1000 stroops");
      expect(onMultiplierChange).toHaveBeenLastCalledWith(2, "1000");
    });

    it("clears the multiplier when the active button is clicked again", async () => {
      const onMultiplierChange = vi.fn();
      mockEstimateFee({ data: { baseFee: "100", recommended: "500" }, error: null });
      render(<FeeEstimator onMultiplierChange={onMultiplierChange} />);

      const button = await screen.findByRole("button", { name: "1.5x" });
      fireEvent.click(button);
      expect(screen.getByTestId("multiplied-fee")).toHaveTextContent("750 stroops");
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByTestId("multiplied-fee")).not.toBeInTheDocument();
      expect(onMultiplierChange).toHaveBeenLastCalledWith(null, null);
    });

    it("applyFeeMultiplier rounds up without floating-point artifacts", () => {
      // 500 * 1.2 is 600.0000000000001 as a float — must not become 601.
      expect(applyFeeMultiplier("500", 1.2)).toBe("600");
      expect(applyFeeMultiplier("101", 1.5)).toBe("152");
      expect(applyFeeMultiplier("100", 2)).toBe("200");
      expect(applyFeeMultiplier("abc", 2)).toBe("abc");
    });
  });
});
