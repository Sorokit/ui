import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeeEstimator } from "./FeeEstimator";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

import { getClient } from "@/lib/client";
import type { SorokitClient } from "@/lib/client";

function mockEstimateFee(result: { data: { baseFee: string; recommended: string } | null; error: string | null }) {
  vi.mocked(getClient).mockReturnValue({
    transaction: {
      estimateFee: vi.fn().mockResolvedValue(result),
    },
  } as unknown as SorokitClient);
}

describe("FeeEstimator", () => {
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

    const refreshButton = screen.getByTitle("Refresh");
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
    const refreshButton = screen.getByTitle("Refresh");
    expect(refreshButton).toBeDisabled();
  });

  it("renders the section title", async () => {
    mockEstimateFee({ data: { baseFee: "100", recommended: "200" }, error: null });
    render(<FeeEstimator />);
    expect(screen.getByText("Network Fee")).toBeInTheDocument();
  });

  // ── Accessibility (#120) ──────────────────────────────────────────────────
  describe("accessibility", () => {
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
});
