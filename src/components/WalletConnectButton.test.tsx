import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";
import { truncateAddress } from "@/lib/utils";

import { WalletConnectButton } from "./WalletConnectButton";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

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

      fireEvent.click(screen.getByRole("button", { name: "Freighter" }));
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

    it("calls onOpenModal when address pill is clicked and the prop is provided", () => {
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

      fireEvent.click(addressPill);
      expect(mockOnOpenModal).toHaveBeenCalledTimes(1);
    });

    it("does not crash and toggles dropdown when address pill is clicked without onOpenModal", () => {
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

      expect(() => {
        fireEvent.click(addressPill);
      }).not.toThrow();

      // Dropdown with disconnect button appears
      const disconnectBtn = screen.getByRole("menuitem", { name: /disconnect/i });
      expect(disconnectBtn).toBeInTheDocument();

      // Clicking again closes the dropdown
      fireEvent.click(addressPill);
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
});
