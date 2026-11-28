import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { WalletConnectModal } from "./WalletConnectModal";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function getWalletButton(name: RegExp | string) {
  const radiogroup = screen.getByRole("radiogroup", { name: /available wallets/i });
  return within(radiogroup).getByRole("radio", { name });
}

function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
    address: null,
    isConnected: false,
    isConnecting: false,
    connectWallet: vi.fn(() => Promise.resolve()),
    disconnectWallet: vi.fn(),
    account: null,
    balances: [],
    isLoadingAccount: false,
    refreshAccount: vi.fn(),
    network: null,
    switchNetwork: vi.fn(),
    error: null,
    clearError: vi.fn(),
    ...overrides,
  };
}

describe("WalletConnectModal", () => {
  const mockConnect = vi.fn(() => Promise.resolve());
  const mockClearError = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const win = window as unknown as Record<string, unknown>;
    for (const key of ["freighter", "isFreighter", "xbull", "xBull", "albedo", "lobstr"]) {
      delete win[key];
    }
  });

  it("renders nothing when closed", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<WalletConnectModal open={false} onClose={mockOnClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the adapter selection grid when open", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);
    expect(screen.getByRole("dialog", { name: /connect a wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: /available wallets/i })).toBeInTheDocument();
    expect(getWalletButton(/Freighter/i)).toBeInTheDocument();
    expect(getWalletButton(/xBull/i)).toBeInTheDocument();
    expect(getWalletButton(/Lobstr/i)).toBeInTheDocument();
    expect(getWalletButton(/Albedo/i)).toBeInTheDocument();
  });

  it("supports a custom wallet option list", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(
      <WalletConnectModal
        open={true}
        onClose={mockOnClose}
        walletOptions={[{ id: "rabet", name: "Rabet", initial: "R", color: "#000" }]}
      />,
    );
    expect(getWalletButton(/Rabet/i)).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Freighter/i })).not.toBeInTheDocument();
  });

  it("calls connectWallet and shows a connecting state when a wallet is selected", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ connectWallet: mockConnect, isConnecting: true }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(getWalletButton(/Freighter/i));

    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent(/waiting for freighter approval/i);
  });

  it("shows a success screen with the connected address once connecting finishes", async () => {
    const address = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP";
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ connectWallet: mockConnect, isConnecting: false, address }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(getWalletButton(/Freighter/i));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /connected/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/GABCDE/)).toBeInTheDocument();
  });

  it("shows an error screen with a retry action once connecting fails", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        connectWallet: mockConnect,
        isConnecting: false,
        error: "Connection rejected by user",
        clearError: mockClearError,
      }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(getWalletButton(/Freighter/i));

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: /connection failed/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Connection rejected by user");

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockClearError).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: /connect a wallet/i })).toBeInTheDocument();
  });

  it("shows install guidance for a 'not found' style error", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        connectWallet: mockConnect,
        isConnecting: false,
        error: "No Stellar wallet found. Install Freighter, xBull, or Albedo.",
      }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(getWalletButton(/Freighter/i));

    await waitFor(() =>
      expect(screen.getByText(/install the freighter browser extension/i)).toBeInTheDocument(),
    );
  });

  it("calls onClose when the close button is clicked", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Done is clicked on the success screen", async () => {
    const address = "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOP";
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ connectWallet: mockConnect, isConnecting: false, address }),
    );
    render(<WalletConnectModal open={true} onClose={mockOnClose} />);

    fireEvent.click(getWalletButton(/Freighter/i));
    await waitFor(() => screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  // ── Extension Detection, Focus Trap, Mobile Deep Links (#692) ───────────
  describe("Extension Detection, Focus Trap & Mobile Deep Links", () => {
    it("detects installed extensions and renders Installed badges", async () => {
      // Mock window.freighter as installed
      (window as unknown as { freighter: object }).freighter = {};

      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const installedBadges = await screen.findAllByTestId("installed-badge");
      expect(installedBadges.length).toBeGreaterThan(0);
      expect(installedBadges[0]).toHaveTextContent("Installed");

      delete (window as unknown as { freighter?: object }).freighter;
    });

    it("retains focus within dialog content when clicking external install link", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          connectWallet: mockConnect,
          isConnecting: false,
          error: "Freighter extension not found",
        }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      fireEvent.click(getWalletButton(/Freighter/i));

      await waitFor(() =>
        expect(screen.getByTestId("install-wallet-link")).toBeInTheDocument(),
      );

      const installLink = screen.getByTestId("install-wallet-link");
      expect(installLink).toHaveAttribute("target", "_blank");

      fireEvent.click(installLink);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("displays deep link options when on a mobile device user agent", async () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
        configurable: true,
      });

      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const deepLinkBadges = await screen.findAllByTestId("mobile-deep-link-option");
      expect(deepLinkBadges.length).toBeGreaterThan(0);

      Object.defineProperty(navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    });

    it("picks up extensions injected after the modal opens via events", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);
      expect(screen.queryByTestId("installed-badge")).not.toBeInTheDocument();

      act(() => {
        (window as unknown as Record<string, unknown>).freighter = {};
        window.dispatchEvent(new Event("stellar#initialized"));
      });

      expect(screen.getAllByTestId("installed-badge").length).toBeGreaterThan(0);
    });

    it("re-checks injected extensions on a polling fallback", () => {
      vi.useFakeTimers();
      try {
        vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
        render(<WalletConnectModal open={true} onClose={mockOnClose} />);
        expect(screen.queryByTestId("installed-badge")).not.toBeInTheDocument();

        act(() => {
          (window as unknown as Record<string, unknown>).freighter = {};
          vi.advanceTimersByTime(250);
        });

        expect(screen.getAllByTestId("installed-badge").length).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("re-checks installed extensions every time the modal opens", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      const { rerender } = render(
        <WalletConnectModal open={false} onClose={mockOnClose} />,
      );
      expect(screen.queryByTestId("installed-badge")).not.toBeInTheDocument();

      (window as unknown as Record<string, unknown>).freighter = {};
      rerender(<WalletConnectModal open={true} onClose={mockOnClose} />);

      expect(screen.getAllByTestId("installed-badge").length).toBeGreaterThan(0);
    });

    it("detects late-injected extensions when modal is opened, closed, injected, and re-opened (#1098)", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      const { rerender } = render(
        <WalletConnectModal open={true} onClose={mockOnClose} />,
      );
      expect(screen.queryByTestId("installed-badge")).not.toBeInTheDocument();

      // Close modal
      rerender(<WalletConnectModal open={false} onClose={mockOnClose} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // Late-inject extensions on window
      (window as unknown as Record<string, unknown>).freighter = {};
      (window as unknown as Record<string, unknown>).xbull = {};

      // Re-open modal
      rerender(<WalletConnectModal open={true} onClose={mockOnClose} />);

      // Assert late-injected extensions are now detected
      const badges = screen.getAllByTestId("installed-badge");
      expect(badges.length).toBeGreaterThanOrEqual(2);
      expect(badges[0]).toHaveTextContent("Installed");
    });

    it("detects extensions injected with delayed timing after modal opens (#1098)", () => {
      vi.useFakeTimers();
      try {
        vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
        render(<WalletConnectModal open={true} onClose={mockOnClose} />);
        expect(screen.queryByTestId("installed-badge")).not.toBeInTheDocument();

        // Late injection occurs at 600ms (between polling intervals)
        act(() => {
          vi.advanceTimersByTime(600);
          (window as unknown as Record<string, unknown>).albedo = {};
          vi.advanceTimersByTime(250);
        });

        const badges = screen.getAllByTestId("installed-badge");
        expect(badges.length).toBeGreaterThan(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("detects mobile via maxTouchPoints when iPadOS Safari reports a desktop user agent", () => {
      const originalUserAgent = navigator.userAgent;
      const originalTouchDescriptor = Object.getOwnPropertyDescriptor(
        navigator,
        "maxTouchPoints",
      );
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        configurable: true,
      });
      Object.defineProperty(navigator, "maxTouchPoints", {
        value: 5,
        configurable: true,
      });

      try {
        vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
        render(<WalletConnectModal open={true} onClose={mockOnClose} />);
        expect(screen.getAllByTestId("mobile-deep-link-option").length).toBeGreaterThan(0);
      } finally {
        Object.defineProperty(navigator, "userAgent", {
          value: originalUserAgent,
          configurable: true,
        });
        if (originalTouchDescriptor) {
          Object.defineProperty(navigator, "maxTouchPoints", originalTouchDescriptor);
        } else {
          delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
        }
      }
    });
  });

  describe("Error Severity & Clear Error", () => {
    it("clears a stale context error as soon as the modal opens", () => {
      const clearError = vi.fn();
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ error: "Previous attempt failed", clearError }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);
      expect(clearError).toHaveBeenCalledTimes(1);
    });

    it("shows the context error inline below the wallet options", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          error: "Connection was cancelled. Please try again.",
          errorSeverity: "info",
        }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const inline = screen.getByTestId("wallet-connect-inline-error");
      expect(inline).toHaveTextContent("Connection was cancelled");
      expect(inline).toHaveAttribute("data-severity", "info");
      expect(inline).toHaveClass("text-warning");
    });

    it("uses a soft No wallet selected state for info-severity errors", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          connectWallet: mockConnect,
          isConnecting: false,
          error: "Connection was cancelled. Please try again.",
          errorSeverity: "info",
        }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      fireEvent.click(getWalletButton(/Freighter/i));

      await waitFor(() =>
        expect(
          screen.getByRole("dialog", { name: /no wallet selected/i }),
        ).toBeInTheDocument(),
      );
      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("data-severity", "info");
      expect(alert).toHaveClass("text-warning");
      expect(alert).not.toHaveClass("text-red");
    });
  });

  // ── Arrow Key Navigation (#746, #877) ───────────
  describe("Arrow Key Navigation", () => {
    it("supports arrow key navigation between wallet options with radiogroup semantics", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const radiogroup = screen.getByRole("radiogroup", { name: /available wallets/i });
      const options = within(radiogroup).getAllByRole("radio");

      // Verify role="radiogroup" and role="radio"
      expect(radiogroup).toBeInTheDocument();
      expect(options).toHaveLength(4);

      // Initially first wallet should be checked
      expect(options[0]).toHaveAttribute("aria-checked", "true");
      expect(options[1]).toHaveAttribute("aria-checked", "false");

      // ArrowDown moves to next wallet
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      expect(options[1]).toHaveFocus();
      expect(options[1]).toHaveAttribute("aria-checked", "true");

      // ArrowDown again moves to third wallet
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      expect(options[2]).toHaveFocus();
      expect(options[2]).toHaveAttribute("aria-checked", "true");

      // ArrowUp moves back to second wallet
      fireEvent.keyDown(radiogroup, { key: "ArrowUp" });
      expect(options[1]).toHaveFocus();
      expect(options[1]).toHaveAttribute("aria-checked", "true");
    });

    it("wraps around when arrow key navigation reaches the end", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const radiogroup = screen.getByRole("radiogroup", { name: /available wallets/i });
      const options = within(radiogroup).getAllByRole("radio");

      // Move to last wallet
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });

      // Wrap around to first wallet
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      expect(options[0]).toHaveFocus();
      expect(options[0]).toHaveAttribute("aria-checked", "true");

      // Wrap backward from first to last
      fireEvent.keyDown(radiogroup, { key: "ArrowUp" });
      expect(options[options.length - 1]).toHaveFocus();
      expect(options[options.length - 1]).toHaveAttribute("aria-checked", "true");
    });

    it("selects wallet when Enter is pressed on focused option", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ connectWallet: mockConnect, isConnecting: true }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const radiogroup = screen.getByRole("radiogroup", { name: /available wallets/i });

      // Move to second wallet and press Enter
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      fireEvent.keyDown(radiogroup, { key: "Enter" });

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent(/waiting for xbull approval/i);
    });

    it("selects wallet when Space is pressed on focused option", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ connectWallet: mockConnect, isConnecting: true }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const radiogroup = screen.getByRole("radiogroup", { name: /available wallets/i });

      // Move to second wallet and press Space
      fireEvent.keyDown(radiogroup, { key: "ArrowDown" });
      fireEvent.keyDown(radiogroup, { key: " " });

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent(/waiting for xbull approval/i);
    });
  });
});
