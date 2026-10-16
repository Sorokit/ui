import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SorokitState } from "@/context/sorokit-context";
import { useSorokit } from "@/context/useSorokit";

import { WalletScreen } from "./WalletScreen";

// jsdom has no canvas 2D context by default, which would make QRCode render
// its "failed to load" text fallback for every test in this file. Mock the
// qrcode lib and stub getContext so QRCode renders its real <canvas>, matching
// the setup already established in QRCode.test.tsx.
vi.mock("qrcode", () => ({
  default: {
    toCanvas: vi.fn((canvas, value, options, callback) => {
      if (typeof callback === "function") callback(null);
      return Promise.resolve();
    }),
  },
}));

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const successToast = vi.fn();
vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ success: successToast }),
}));

function createMockState(overrides?: Partial<SorokitState>): SorokitState {
  return {
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

describe("WalletScreen", () => {
  const mockDisconnect = vi.fn();
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({} as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    getContextSpy.mockRestore();
    vi.useRealTimers();
  });

  it("renders active connected state and handles disconnect confirmation", () => {
    vi.mocked(useSorokit).mockReturnValue(createMockState({
      address: "GABC123456",
      isConnected: true,
      disconnectWallet: mockDisconnect,
      network: { name: "testnet", rpcUrl: "https://rpc.com" },
    }));

    render(<WalletScreen />);
    
    expect(screen.getByText("Connected")).toBeInTheDocument();
    
    const disconnectBtn = screen.getByRole("button", { name: "Disconnect" });
    expect(disconnectBtn).toBeInTheDocument();
    expect(disconnectBtn.className).toContain("border-line-2");

    fireEvent.click(disconnectBtn);
    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Disconnect?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect?" }));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  describe("Show QR modal", () => {
    const connectedState = () =>
      createMockState({
        address: "GABC123456",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
      });

    it("renders a Show QR button when connected", () => {
      vi.mocked(useSorokit).mockReturnValue(connectedState());
      render(<WalletScreen />);
      expect(screen.getByRole("button", { name: "Show QR" })).toBeInTheDocument();
    });

    it("opens a full-size QR dialog when Show QR is clicked", () => {
      vi.mocked(useSorokit).mockReturnValue(connectedState());
      render(<WalletScreen />);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
      });

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAccessibleName("Receive Funds");
      // jsdom has no canvas backend, so QRCode renders its address fallback
      // rather than a painted code — assert on the figure it always emits.
      expect(dialog.querySelector("figure")).toBeInTheDocument();
      // The full address is shown alongside the code for manual entry.
      expect(dialog).toHaveTextContent("GABC123456");
    });

    it("closes the QR dialog from the Close button", () => {
      vi.mocked(useSorokit).mockReturnValue(connectedState());
      render(<WalletScreen />);

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
      });
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes the QR dialog on Escape", () => {
      vi.mocked(useSorokit).mockReturnValue(connectedState());
      render(<WalletScreen />);

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Show QR" }));
      });
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      act(() => {
        fireEvent.keyDown(document, { key: "Escape" });
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("hides the Show QR button when not connected", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState());
      render(<WalletScreen />);
      expect(
        screen.queryByRole("button", { name: "Show QR" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("account details", () => {
    it("renders the home domain when the account has one", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        account: {
          address: "GABC123456",
          sequence: "1",
          subentryCount: 0,
          homeDomain: "example.com",
        },
      }));

      render(<WalletScreen />);
      expect(screen.getByText("Home Domain")).toBeInTheDocument();
      expect(screen.getByText("example.com")).toBeInTheDocument();
    });

    it("omits the home domain cell when the account has none", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        account: { address: "GABC123456", sequence: "1", subentryCount: 0 },
      }));

      render(<WalletScreen />);
      expect(screen.queryByText("Home Domain")).not.toBeInTheDocument();
    });

    it("renders the year the account has been active since", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        account: {
          address: "GABC123456",
          sequence: "1",
          subentryCount: 0,
          createdAt: "2021-06-15T10:30:00Z",
        },
      }));

      render(<WalletScreen />);
      expect(screen.getByText("Active Since")).toBeInTheDocument();
      expect(screen.getByText("2021")).toBeInTheDocument();
    });

    it("omits the active-since cell when createdAt is absent", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        account: { address: "GABC123456", sequence: "1", subentryCount: 0 },
      }));

      render(<WalletScreen />);
      expect(screen.queryByText("Active Since")).not.toBeInTheDocument();
    });

    it("omits the active-since cell for an unparseable createdAt", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        account: {
          address: "GABC123456",
          sequence: "1",
          subentryCount: 0,
          createdAt: "not-a-date",
        },
      }));

      render(<WalletScreen />);
      expect(screen.queryByText("Active Since")).not.toBeInTheDocument();
      expect(screen.queryByText("NaN")).not.toBeInTheDocument();
    });
  });

  it("resets confirmation state to Disconnect after 3 seconds", () => {
    vi.mocked(useSorokit).mockReturnValue(createMockState({
      address: "GABC123456",
      isConnected: true,
      disconnectWallet: mockDisconnect,
      network: null,
    }));

    render(<WalletScreen />);

    const disconnectBtn = screen.getByRole("button", { name: "Disconnect" });

    fireEvent.click(disconnectBtn);
    expect(screen.getByRole("button", { name: "Disconnect?" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  describe("AddressDisplay integration", () => {
    it("renders wallet address using AddressDisplay in the header", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTGOBJZOTMr123456789",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
      }));

      render(<WalletScreen />);

      const addressElements = document.querySelectorAll("[data-address]");
      expect(addressElements.length).toBeGreaterThanOrEqual(1);

      // Header should show truncated address using AddressDisplay default start=8, end=6
      expect(screen.getByText("GBRPYHIL...456789")).toBeInTheDocument();

      // Copy button is present
      const copyButtons = screen.getAllByRole("button", { name: /copy address/i });
      expect(copyButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("copies address to clipboard when copy button in AddressDisplay is clicked", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
        configurable: true,
      });

      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTGOBJZOTMr123456789",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
      }));

      render(<WalletScreen />);

      const copyButtons = screen.getAllByRole("button", { name: /copy address/i });
      await act(async () => {
        fireEvent.click(copyButtons[0]);
      });

      expect(writeTextMock).toHaveBeenCalledWith("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFTGOBJZOTMr123456789");
    });
  });

  describe("manual refresh (#965)", () => {
    it("renders a Refresh button when connected and calls refreshAccount on click", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
        refreshAccount: mockRefresh,
      }));

      render(<WalletScreen />);

      const refreshBtn = screen.getByRole("button", { name: "Refresh account data" });
      expect(refreshBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(refreshBtn);
      });

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("hides the Refresh button when not connected", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState());
      render(<WalletScreen />);
      expect(
        screen.queryByRole("button", { name: "Refresh account data" }),
      ).not.toBeInTheDocument();
    });

    it("shows a loading state on the Refresh button while isLoadingAccount is true", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
        isLoadingAccount: true,
      }));

      render(<WalletScreen />);
      const refreshBtn = screen.getByRole("button", { name: "Refresh account data" });
      expect(refreshBtn).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("pull-to-refresh (#965)", () => {
    function connectedState(overrides?: Partial<SorokitState>) {
      return createMockState({
        address: "GABC123456",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
        ...overrides,
      });
    }

    it("shows a pull indicator and calls refreshAccount when pulled past the threshold", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSorokit).mockReturnValue(connectedState({ refreshAccount: mockRefresh }));

      render(<WalletScreen />);
      const container = screen.getByTestId("wallet-screen-scroll-container");
      Object.defineProperty(container, "scrollTop", { value: 0, configurable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 0 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 100 }] });

      expect(screen.getByTestId("pull-to-refresh-indicator")).toHaveTextContent(
        "Release to refresh",
      );

      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("does not call refreshAccount when the pull distance stays under the threshold", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSorokit).mockReturnValue(connectedState({ refreshAccount: mockRefresh }));

      render(<WalletScreen />);
      const container = screen.getByTestId("wallet-screen-scroll-container");
      Object.defineProperty(container, "scrollTop", { value: 0, configurable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 0 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 20 }] });

      expect(screen.getByTestId("pull-to-refresh-indicator")).toHaveTextContent(
        "Pull to refresh",
      );

      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("does not arm the pull gesture when the container is already scrolled down", async () => {
      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSorokit).mockReturnValue(connectedState({ refreshAccount: mockRefresh }));

      render(<WalletScreen />);
      const container = screen.getByTestId("wallet-screen-scroll-container");
      Object.defineProperty(container, "scrollTop", { value: 50, configurable: true });

      fireEvent.touchStart(container, { touches: [{ clientY: 0 }] });
      fireEvent.touchMove(container, { touches: [{ clientY: 100 }] });

      await act(async () => {
        fireEvent.touchEnd(container);
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe("QR modal accessibility (#965)", () => {
    it("traps focus inside the QR dialog and restores it to the trigger on close", () => {
      vi.mocked(useSorokit).mockReturnValue(createMockState({
        address: "GABC123456",
        isConnected: true,
        network: { name: "testnet", rpcUrl: "https://rpc.com" },
      }));

      render(<WalletScreen />);
      const showQrBtn = screen.getByRole("button", { name: "Show QR" });

      act(() => {
        showQrBtn.focus();
        fireEvent.click(showQrBtn);
      });

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      // Radix Dialog moves focus into the dialog's content on open.
      expect(dialog.contains(document.activeElement)).toBe(true);

      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
      });

      // Radix Dialog's focus-scope restores focus to the triggering element
      // inside a setTimeout(0) on cleanup (see @radix-ui/react-focus-scope),
      // which this file's own beforeEach runs under fake timers for -
      // advancing them is what actually flushes that restore.
      act(() => {
        vi.runAllTimers();
      });

      expect(document.activeElement).toBe(showQrBtn);
    });
  });
});
