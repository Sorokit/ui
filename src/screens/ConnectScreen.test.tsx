import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { ConnectScreen } from "./ConnectScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("ConnectScreen", () => {
  it("renders connect button and calls connectWallet on click", () => {
    const connectWallet = vi.fn();
    vi.mocked(useSorokit).mockReturnValue({
      connectWallet,
      isConnecting: false,
      error: null,
      clearError: vi.fn(),
    } as unknown as ReturnType<typeof useSorokit>);

    render(<ConnectScreen />);
    const btn = screen.getByRole("button", { name: /Connect Wallet/i });
    expect(btn).toBeInTheDocument();
    
    fireEvent.click(btn);
    expect(connectWallet).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state and disables the CTA while connecting", () => {
    vi.mocked(useSorokit).mockReturnValue({
      connectWallet: vi.fn(),
      isConnecting: true,
      error: null,
      clearError: vi.fn(),
    } as unknown as ReturnType<typeof useSorokit>);

    render(<ConnectScreen />);

    const btn = screen.getByRole("button", { name: /Connecting/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText("Connecting to your wallet…")).toBeInTheDocument();
  });

  it("announces connection errors to assistive technology", () => {
    vi.mocked(useSorokit).mockReturnValue({
      connectWallet: vi.fn(),
      isConnecting: false,
      error: "Wallet connection failed",
      clearError: vi.fn(),
    } as unknown as ReturnType<typeof useSorokit>);

    render(<ConnectScreen />);

    expect(screen.getByRole("alert")).toHaveTextContent("Wallet connection failed");
  });

  it("resets the document title to the disconnected default (#551)", () => {
    vi.mocked(useSorokit).mockReturnValue({
      connectWallet: vi.fn(),
      isConnecting: false,
      error: null,
      clearError: vi.fn(),
    } as unknown as ReturnType<typeof useSorokit>);

    // Simulate the tab still showing the last dashboard screen.
    document.title = "Transactions - Sorokit";

    render(<ConnectScreen />);

    expect(document.title).toBe("Connect - Sorokit");
  });

  // ── Query-param auto-connect (#893) ─────────────────────────────────────
  describe("query-param auto-connect (#893)", () => {
    const originalLocation = window.location;

    afterEach(() => {
      Object.defineProperty(window, "location", {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    function setSearch(search: string) {
      Object.defineProperty(window, "location", {
        value: { ...originalLocation, search },
        writable: true,
        configurable: true,
      });
    }

    it("auto-connects when a recognized provider is given via ?provider=", () => {
      setSearch("?provider=freighter");
      const connectWallet = vi.fn();
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet,
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<ConnectScreen />);

      expect(connectWallet).toHaveBeenCalledTimes(1);
    });

    it("matches provider ids case-insensitively", () => {
      setSearch("?provider=FREIGHTER");
      const connectWallet = vi.fn();
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet,
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<ConnectScreen />);

      expect(connectWallet).toHaveBeenCalledTimes(1);
    });

    it("does not auto-connect for an unrecognized provider id", () => {
      setSearch("?provider=not-a-real-wallet");
      const connectWallet = vi.fn();
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet,
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<ConnectScreen />);

      expect(connectWallet).not.toHaveBeenCalled();
    });

    it("does not auto-connect when no provider param is present", () => {
      setSearch("");
      const connectWallet = vi.fn();
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet,
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<ConnectScreen />);

      expect(connectWallet).not.toHaveBeenCalled();
    });

    it("only auto-connects once even if the component re-renders", () => {
      setSearch("?provider=xbull");
      const connectWallet = vi.fn();
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet,
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      const { rerender } = render(<ConnectScreen />);
      rerender(<ConnectScreen />);

      expect(connectWallet).toHaveBeenCalledTimes(1);
    });
  });

  // ── Actionable rejection errors (#893) ──────────────────────────────────
  describe("actionable troubleshooting for connection errors (#893)", () => {
    function renderWithError(error: string) {
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet: vi.fn(),
        isConnecting: false,
        error,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);
      return render(<ConnectScreen />);
    }

    it("suggests unlocking the extension for a locked-wallet error", () => {
      renderWithError("Wallet is locked");
      expect(
        screen.getByText(/unlock your wallet extension/i),
      ).toBeInTheDocument();
    });

    it("suggests approving the request for a user-rejected error", () => {
      renderWithError("User rejected the request");
      expect(
        screen.getByText(/declined.*approve the connection request/is),
      ).toBeInTheDocument();
    });

    it("suggests installing a wallet when none is detected", () => {
      renderWithError("No wallet extension found");
      expect(
        screen.getByText(/install one of the wallets below/i),
      ).toBeInTheDocument();
    });

    it("suggests retrying for a timeout error", () => {
      renderWithError("Connection request timed out");
      expect(screen.getByRole("alert")).toHaveTextContent("Connection request timed out");
      expect(screen.getByText(/responsive and try again/i)).toBeInTheDocument();
    });

    it("still shows the raw error with no extra guidance for an unrecognized message", () => {
      renderWithError("Something completely unexpected happened");
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something completely unexpected happened",
      );
      // No troubleshooting paragraph should be appended for an unmatched error.
      expect(screen.queryByText(/unlock your wallet/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/install one of the wallets/i)).not.toBeInTheDocument();
    });
  });

  // ── Mobile deep links (#893) ────────────────────────────────────────────
  describe("mobile wallet deep links (#893)", () => {
    const originalUserAgent = window.navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(window.navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    });

    function setUserAgent(ua: string) {
      Object.defineProperty(window.navigator, "userAgent", {
        value: ua,
        configurable: true,
      });
    }

    it("shows mobile wallet deep links on a mobile user agent", () => {
      setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      );
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet: vi.fn(),
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<ConnectScreen />);

      expect(screen.getByRole("link", { name: /open lobstr app/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /open albedo app/i })).toBeInTheDocument();
    });

    it("does not show mobile wallet deep links on a desktop user agent", () => {
      setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      );
      vi.mocked(useSorokit).mockReturnValue({
        connectWallet: vi.fn(),
        isConnecting: false,
        error: null,
        clearError: vi.fn(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<ConnectScreen />);

      expect(screen.queryByRole("link", { name: /open lobstr app/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /open albedo app/i })).not.toBeInTheDocument();
    });
  });
});
