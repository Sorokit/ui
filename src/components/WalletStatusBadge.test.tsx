import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { WalletStatusBadge } from "./WalletStatusBadge";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const ADDRESS = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NETWORK = {
  name: "testnet",
  passphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
};

describe("WalletStatusBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      ...overrides,
    };
  }

  it("renders disconnected state when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());

    render(<WalletStatusBadge />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Wallet disconnected"),
    ).toBeInTheDocument();
  });

  it("renders connected state with wallet name and truncated address", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: "Freighter",
      }),
    );

    render(<WalletStatusBadge />);
    expect(screen.getByText("Freighter")).toBeInTheDocument();
    expect(screen.getByText("GABC12...WXYZ")).toBeInTheDocument();
  });

  it("renders 'Wallet' as fallback name when walletName is null", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: null,
      }),
    );

    render(<WalletStatusBadge />);
    expect(screen.getByText("Wallet")).toBeInTheDocument();
  });

  it("renders loading state when connecting", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ isConnecting: true }),
    );

    render(<WalletStatusBadge />);
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Connecting wallet" }),
    ).toBeInTheDocument();
  });

  it("calls onOpen when clicked in connected state", () => {
    const onOpen = vi.fn();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: "xBull",
      }),
    );

    render(<WalletStatusBadge onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("has accessible aria-label in connected state", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: "Lobstr",
      }),
    );

    render(<WalletStatusBadge />);
    expect(
      screen.getByRole("button", {
        name: /Wallet connected: Lobstr.*GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ.*Click to copy address/,
      }),
    ).toBeInTheDocument();
  });

  describe("reduced motion", () => {
    it("only pulses the connecting indicator when motion is allowed", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ isConnecting: true }),
      );

      render(<WalletStatusBadge />);
      const dot = screen.getByTestId("wallet-status-dot");
      const classes = dot.className.split(/\s+/);
      // The bare utility would animate even under prefers-reduced-motion: reduce.
      expect(classes).toContain("motion-safe:animate-pulse");
      expect(classes).not.toContain("animate-pulse");
    });

    it("never uses an unconditional pulse in any state", () => {
      const states = [
        mockUseSorokit(),
        mockUseSorokit({ isConnecting: true }),
        mockUseSorokit({ isConnected: true, address: ADDRESS }),
        mockUseSorokit({
          isConnected: true,
          address: ADDRESS,
          network: { ...NETWORK, status: "degraded" },
        }),
      ];
      for (const state of states) {
        vi.mocked(useSorokit).mockReturnValue(state);
        const { unmount } = render(<WalletStatusBadge />);
        const classes = screen
          .getByTestId("wallet-status-dot")
          .className.split(/\s+/);
        expect(classes).not.toContain("animate-pulse");
        unmount();
      }
    });
  });

  describe("network status", () => {
    it("shows a green dot and no status label when the network is online", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: ADDRESS,
          walletName: "Freighter",
          network: { ...NETWORK, status: "online" },
        }),
      );

      render(<WalletStatusBadge />);
      expect(screen.getByTestId("wallet-status-dot")).toHaveClass("bg-green");
      expect(screen.queryByText("Degraded")).not.toBeInTheDocument();
      expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    it("indicates a degraded network with an orange pulsing dot and label", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: ADDRESS,
          walletName: "Freighter",
          network: { ...NETWORK, status: "degraded" },
        }),
      );

      render(<WalletStatusBadge />);
      const dot = screen.getByTestId("wallet-status-dot");
      expect(dot).toHaveClass("bg-orange", "motion-safe:animate-pulse");
      expect(screen.getByText("Degraded")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Network degraded/ }),
      ).toBeInTheDocument();
    });

    it("indicates an offline network with a red dot and label", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: ADDRESS,
          walletName: "Freighter",
          network: { ...NETWORK, status: "offline" },
        }),
      );

      render(<WalletStatusBadge />);
      const dot = screen.getByTestId("wallet-status-dot");
      expect(dot).toHaveClass("bg-red");
      expect(dot).not.toHaveClass("bg-green");
      expect(screen.getByText("Offline")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Network offline/ }),
      ).toBeInTheDocument();
    });

    it("falls back to the healthy indicator when network is unknown", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ isConnected: true, address: ADDRESS, network: null }),
      );

      render(<WalletStatusBadge />);
      expect(screen.getByTestId("wallet-status-dot")).toHaveClass("bg-green");
    });
  });

  describe("click to copy", () => {
    let writeText: ReturnType<typeof vi.fn>;
    const originalClipboard = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: ADDRESS,
          walletName: "Freighter",
        }),
      );
    });

    afterEach(() => {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
    });

    it("copies the full address and shows a confirmation checkmark", async () => {
      render(<WalletStatusBadge />);
      expect(
        screen.queryByTestId("wallet-copy-confirmation"),
      ).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(writeText).toHaveBeenCalledWith(ADDRESS);
      expect(screen.getByTestId("wallet-copy-confirmation")).toBeInTheDocument();
      expect(screen.getByText("Copied")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Address copied to clipboard",
      );
    });

    it("hides the confirmation again after a short delay", async () => {
      vi.useFakeTimers();
      render(<WalletStatusBadge />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });
      expect(screen.getByTestId("wallet-copy-confirmation")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(
        screen.queryByTestId("wallet-copy-confirmation"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("GABC12...WXYZ")).toBeInTheDocument();
    });

    it("still calls onOpen alongside copying", async () => {
      const onOpen = vi.fn();
      render(<WalletStatusBadge onOpen={onOpen} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(ADDRESS);
    });

    it("is keyboard operable because the badge is a native button", async () => {
      render(<WalletStatusBadge />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
      button.focus();
      expect(button).toHaveFocus();
    });

    it("does not show a confirmation when the clipboard write is rejected", async () => {
      writeText.mockRejectedValueOnce(new Error("denied"));
      render(<WalletStatusBadge />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(
        screen.queryByTestId("wallet-copy-confirmation"),
      ).not.toBeInTheDocument();
    });

    it("does not throw when the Clipboard API is unavailable", async () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: undefined,
      });
      const onOpen = vi.fn();
      render(<WalletStatusBadge onOpen={onOpen} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button"));
      });

      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByTestId("wallet-copy-confirmation"),
      ).not.toBeInTheDocument();
    });
  });
});
