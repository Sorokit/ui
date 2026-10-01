import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { WalletConnectModal } from "./WalletConnectModal";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function getWalletButton(name: RegExp | string) {
  const grid = screen.getByRole("grid", { name: /available wallets/i });
  return within(grid).getByRole("button", { name });
}

function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
    address: null,
    isConnected: false,
    isConnecting: false,
    connectWallet: vi.fn(),
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
  const mockConnect = vi.fn();
  const mockClearError = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.queryByRole("button", { name: /Freighter/i })).not.toBeInTheDocument();
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
    expect(mockClearError).toHaveBeenCalledTimes(1);
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
    it("detects installed extensions and renders Installed badges", () => {
      // Mock window.freighter as installed
      (window as unknown as { freighter: object }).freighter = {};

      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const installedBadges = screen.getAllByTestId("installed-badge");
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

    it("displays deep link options when on a mobile device user agent", () => {
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
        configurable: true,
      });

      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const deepLinkBadges = screen.getAllByTestId("mobile-deep-link-option");
      expect(deepLinkBadges.length).toBeGreaterThan(0);

      Object.defineProperty(navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  // ── Arrow Key Navigation (#746) ───────────
  describe("Arrow Key Navigation", () => {
    it("supports arrow key navigation between wallet options", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const grid = screen.getByRole("grid", { name: /available wallets/i });
      const buttons = within(grid).getAllByRole("button");

      // Initially first wallet should be pressed
      expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
      expect(buttons[1]).toHaveAttribute("aria-pressed", "false");

      // ArrowDown moves to next wallet
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      expect(buttons[1]).toHaveFocus();

      // ArrowDown again moves to third wallet
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      expect(buttons[2]).toHaveFocus();

      // ArrowUp moves back to second wallet
      fireEvent.keyDown(grid, { key: "ArrowUp" });
      expect(buttons[1]).toHaveFocus();
    });

    it("wraps around when arrow key navigation reaches the end", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const grid = screen.getByRole("grid", { name: /available wallets/i });
      const buttons = within(grid).getAllByRole("button");

      // Move to last wallet
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      fireEvent.keyDown(grid, { key: "ArrowDown" });

      // Wrap around to first wallet
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      expect(buttons[0]).toHaveFocus();

      // Wrap backward from first to last
      fireEvent.keyDown(grid, { key: "ArrowUp" });
      expect(buttons[buttons.length - 1]).toHaveFocus();
    });

    it("selects wallet when Enter is pressed on focused option", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ connectWallet: mockConnect, isConnecting: true }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const grid = screen.getByRole("grid", { name: /available wallets/i });

      // Move to second wallet and press Enter
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      fireEvent.keyDown(grid, { key: "Enter" });

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent(/waiting for xbull approval/i);
    });

    it("selects wallet when Space is pressed on focused option", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({ connectWallet: mockConnect, isConnecting: true }),
      );
      render(<WalletConnectModal open={true} onClose={mockOnClose} />);

      const grid = screen.getByRole("grid", { name: /available wallets/i });

      // Move to second wallet and press Space
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      fireEvent.keyDown(grid, { key: " " });

      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent(/waiting for xbull approval/i);
    });
  });
});
