import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";
import { truncateAddress } from "@/lib/utils";

import { WalletConnectButton } from "./WalletConnectButton";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function getWalletButton(name: RegExp | string) {
  const container =
    screen.queryByRole("radiogroup", { name: /available wallets/i }) ??
    screen.getByRole("grid", { name: /available wallets/i });
  return (
    within(container).queryByRole("radio", { name }) ??
    within(container).getByRole("button", { name })
  );
}

describe("WalletConnectButton", () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockUseSorokit(
    overrides: Partial<ReturnType<typeof useSorokit>> = {},
  ) {
    return {
      get client() { return getClient(); },
      address: null,
      walletName: null,
      isHardware: false,
      isConnected: false,
      isConnecting: false,
      isLoading: false,
      isDisconnecting: false,
      connectWallet: vi.fn().mockResolvedValue(undefined),
      disconnectWallet: vi.fn().mockResolvedValue(undefined),
      account: null,
      balances: [],
      isLoadingAccount: false,
      refreshAccount: vi.fn().mockResolvedValue(undefined),
      network: null,
      switchNetwork: vi.fn().mockResolvedValue(undefined),
      error: null,
      errorHistory: [],
      clearError: vi.fn(),
      ...overrides,
    };
  }

  describe("Disconnected State", () => {
    it("renders 'Connect Wallet' text when not connected", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
          isConnecting: false,
          address: null,
          connectWallet: mockConnect,
          clearError: mockClearError,
        }),
      );

      render(<WalletConnectButton />);
      expect(
        screen.getByRole("button", { name: "Connect Wallet" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Connect Wallet")).toBeInTheDocument();
    });

    it("opens the wallet connect modal on click", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
          connectWallet: mockConnect,
          clearError: mockClearError,
        }),
      );

      render(<WalletConnectButton />);
      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
      await waitFor(() =>
        expect(
          screen.getByRole("dialog", { name: /connect a wallet/i }),
        ).toBeInTheDocument(),
      );
    });

    it("triggers connectWallet from context when a wallet is selected in the modal", async () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
          connectWallet: mockConnect,
          clearError: mockClearError,
        }),
      );

      render(<WalletConnectButton />);
      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
      await waitFor(() =>
        expect(
          screen.getByRole("dialog", { name: /connect a wallet/i }),
        ).toBeInTheDocument(),
      );

      fireEvent.click(getWalletButton(/Freighter/i));
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });

  describe("Connecting State", () => {
    it("renders button text showing 'Connecting…' when connecting", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
          isConnecting: true,
          connectWallet: mockConnect,
          clearError: mockClearError,
        }),
      );

      render(<WalletConnectButton />);
      expect(
        screen.getByRole("button", { name: /connecting…/i }),
      ).toBeInTheDocument();
      expect(screen.getByText("Connecting…")).toBeInTheDocument();
    });

    it("renders loading indicator and spinner while isConnecting is true", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
          isConnecting: true,
          connectWallet: mockConnect,
          clearError: mockClearError,
        }),
      );

      const { container } = render(<WalletConnectButton />);
      const button = screen.getByRole("button", { name: /connecting…/i });

      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button).toBeDisabled();
      expect(screen.getByText("Loading")).toBeInTheDocument();
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Connected State", () => {
    const fullAddress = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    it("renders truncated wallet address in the pill using truncateAddress()", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: fullAddress,
          connectWallet: mockConnect,
          clearError: mockClearError,
        }),
      );

      const { container } = render(<WalletConnectButton />);
      const expectedTruncated = truncateAddress(fullAddress);

      expect(expectedTruncated).toBe("GABC12...WXYZ");
      expect(screen.getByText(expectedTruncated)).toBeInTheDocument();

      const addressSpan = container.querySelector("[data-address]");
      expect(addressSpan).toHaveTextContent(expectedTruncated);
    });

    it("renders connected state with correct aria-label and green indicator dot", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: fullAddress,
        }),
      );

      const { container } = render(<WalletConnectButton />);
      const button = screen.getByRole("button", {
        name: `Wallet connected: ${fullAddress}. Click to manage.`,
      });
      expect(button).toBeInTheDocument();

      const statusDot = container.querySelector(".bg-green");
      expect(statusDot).toBeInTheDocument();
    });

    it("calls onOpenModal when address pill is clicked and skips DropdownMenu entirely", () => {
      const mockOnOpenModal = vi.fn();
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: fullAddress,
        }),
      );

      render(<WalletConnectButton onOpenModal={mockOnOpenModal} />);
      const addressPill = screen.getByRole("button", {
        name: `Wallet connected: ${fullAddress}. Click to manage.`,
      });

      // Plain button: should not have DropdownMenu trigger attributes
      expect(addressPill).not.toHaveAttribute("aria-haspopup");
      expect(addressPill).not.toHaveAttribute("aria-expanded");

      fireEvent.click(addressPill);
      expect(mockOnOpenModal).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

      // Repeated clicks invoke onOpenModal without Radix state confusion
      fireEvent.click(addressPill);
      expect(mockOnOpenModal).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("renders DropdownMenu and toggles dropdown flow when onOpenModal is absent", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: fullAddress,
          disconnectWallet: mockDisconnect,
        }),
      );

      render(<WalletConnectButton />);
      const addressPill = screen.getByRole("button", {
        name: `Wallet connected: ${fullAddress}. Click to manage.`,
      });

      expect(addressPill).toHaveAttribute("aria-haspopup", "menu");
      expect(addressPill).toHaveAttribute("aria-expanded", "false");

      // Clicking opens the dropdown menu
      fireEvent.click(addressPill);
      expect(addressPill).toHaveAttribute("aria-expanded", "true");

      const disconnectBtn = screen.getByRole("menuitem", { name: /disconnect/i });
      expect(disconnectBtn).toBeInTheDocument();

      // Clicking again closes the dropdown
      fireEvent.click(addressPill);
      expect(addressPill).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("menuitem", { name: /disconnect/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Error & Disconnect Handling", () => {
    it("renders inline error message and handles clearError", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          connectWallet: mockConnect,
          error: "Connection failed",
          clearError: mockClearError,
        }),
      );

      render(<WalletConnectButton />);
      expect(screen.getByText("Connection failed")).toBeInTheDocument();

      const clearBtn = screen.getByRole("button", { name: "Clear error" });
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);
      expect(mockClearError).toHaveBeenCalledTimes(1);
    });

    it("renders disconnect loading state when isDisconnecting is true", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          disconnectWallet: mockDisconnect,
          isDisconnecting: true,
        }),
      );

      render(<WalletConnectButton />);
      fireEvent.click(screen.getByRole("button", { name: /wallet connected/i }));
      expect(screen.getByText("Disconnecting…")).toBeInTheDocument();
      expect(
        screen.getByRole("menuitem", { name: /disconnect/i }),
      ).toHaveAttribute("aria-disabled", "true");
    });

    it("clears the error banner after a successful connect clears the error", () => {
      const { rerender } = render(<WalletConnectButton />);

      // Simulate error state
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          connectWallet: mockConnect,
          error: "Previous error",
          clearError: mockClearError,
        }),
      );
      rerender(<WalletConnectButton />);
      expect(screen.getByText("Previous error")).toBeInTheDocument();

      // Simulate successful connect (error is cleared, connected state shown)
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          error: null,
          clearError: mockClearError,
        }),
      );
      rerender(<WalletConnectButton />);
      expect(screen.queryByText("Previous error")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /wallet connected/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls onOpenModal when connected address pill is clicked", () => {
    const mockOnOpenModal = vi.fn();
    const fullAddress = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({
      isConnected: true,
      address: fullAddress,
      connectWallet: mockConnect,
      clearError: mockClearError,
    }));

    render(<WalletConnectButton onOpenModal={mockOnOpenModal} />);
    const addressPill = screen.getByRole("button", {
      name: `Wallet connected: ${fullAddress}. Click to manage.`,
    });
    fireEvent.click(addressPill);
    expect(mockOnOpenModal).toHaveBeenCalledTimes(1);
  });

  // ── Hardware Wallet & Disconnect Cleanup (#691) ──────────────────────────
  describe("Hardware Wallet & Disconnect Storage Purge", () => {
    it("renders Ledger/Hardware badge when connected to a hardware wallet", () => {
      const fullAddress = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: fullAddress,
          walletName: "Ledger Nano X",
          isHardware: true,
        }),
      );

      render(<WalletConnectButton />);
      expect(screen.getByTestId("hardware-badge")).toHaveTextContent("Ledger");
    });

    // #845 — "Ledger Nano X" is the acceptance-criteria case: a name that does
    // not contain the bare word "Ledger" at position 0, and one the button must
    // not be re-deriving itself. `isHardware` comes from context only, so if the
    // provider says true the badge shows regardless of the exact name.
    it("shows the badge for a hardware wallet named 'Ledger Nano X' (#845)", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          walletName: "Ledger Nano X",
          isHardware: true,
        }),
      );

      render(<WalletConnectButton />);
      expect(screen.getByTestId("hardware-badge")).toHaveTextContent("Ledger");
    });

    // The regression the issue is really about: the button used to fall back to
    // string-matching `walletName`, so a consumer that set `isHardware: false`
    // for a hardware-named wallet would still get a badge. Context is now the
    // only input, so the two can no longer disagree.
    it("does not show the badge for a software wallet (#845)", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          walletName: "Freighter",
          isHardware: false,
        }),
      );

      render(<WalletConnectButton />);
      expect(screen.queryByTestId("hardware-badge")).toBeNull();
    });

    it("purges cached wallet session keys from localStorage on disconnect", async () => {
      localStorage.setItem("sorokit_wallet_session", "test-session-token");
      localStorage.setItem("walletconnect", "wc-data");

      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          disconnectWallet: mockDisconnect,
        }),
      );

      render(<WalletConnectButton />);
      fireEvent.click(
        screen.getByRole("button", { name: /wallet connected/i }),
      );

      const disconnectBtn = screen.getByRole("menuitem", { name: /disconnect/i });
      fireEvent.click(disconnectBtn);

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("sorokit_wallet_session")).toBeNull();
        expect(localStorage.getItem("walletconnect")).toBeNull();
      });
    });

    it("displays error alert when wallet connection is rejected by user", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
          isConnecting: false,
          error: "Connection rejected by user",
          clearError: mockClearError,
        }),
      );

      render(<WalletConnectButton />);
      expect(screen.getByTestId("connection-error-alert")).toHaveTextContent(
        "Connection rejected by user",
      );
    });

    it("stops click event bubbling to parent containers when clicked in disconnected state (#887)", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
        }),
      );

      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <WalletConnectButton />
        </div>,
      );

      fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
      expect(parentClick).not.toHaveBeenCalled();
    });

    it("stops click event bubbling to parent containers when clicked in connected state (#887)", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        }),
      );

      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <WalletConnectButton />
        </div>,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /wallet connected/i }),
      );
      expect(parentClick).not.toHaveBeenCalled();
    });

    it("stops click event bubbling when onOpenModal is provided (#887)", () => {
      const mockOnOpen = vi.fn();
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        }),
      );

      const parentClick = vi.fn();
      render(
        <div onClick={parentClick}>
          <WalletConnectButton onOpenModal={mockOnOpen} />
        </div>,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /wallet connected/i }),
      );
      expect(mockOnOpen).toHaveBeenCalledTimes(1);
      expect(parentClick).not.toHaveBeenCalled();
    });

    it("has accessible attributes aria-haspopup='dialog' and aria-expanded when disconnected (#887)", () => {
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: false,
        }),
      );

      render(<WalletConnectButton />);
      const btn = screen.getByRole("button", { name: "Connect Wallet" });
      expect(btn).toHaveAttribute("aria-haspopup", "dialog");
      expect(btn).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(btn);
      expect(btn).toHaveAttribute("aria-expanded", "true");
    });

    it("renders compact address on mobile (<360px) and standard address on larger viewports (#887)", () => {
      const fullAddr = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      vi.mocked(useSorokit).mockReturnValue(
        mockUseSorokit({
          isConnected: true,
          address: fullAddr,
        }),
      );

      const { container } = render(<WalletConnectButton />);
      const compactSpan = container.querySelector("[data-address-compact]");
      const standardSpan = container.querySelector("[data-address]");

      expect(compactSpan).toBeInTheDocument();
      expect(compactSpan).toHaveTextContent("GAB...XYZ");
      expect(standardSpan).toBeInTheDocument();
      expect(standardSpan).toHaveTextContent("GABC12...WXYZ");
    });
  });
});
