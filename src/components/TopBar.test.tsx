import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { TopBar } from "./TopBar";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const defaultSorokit = {
  error: null,
  clearError: vi.fn(),
  isConnected: false,
  isConnecting: false,
  address: null,
  network: { name: "testnet", status: "online", rpcUrl: "https://soroban-testnet.stellar.org" },
  initialNetwork: { name: "testnet", status: "online", rpcUrl: "https://soroban-testnet.stellar.org" },
  switchNetwork: vi.fn().mockResolvedValue(undefined),
  disconnectWallet: vi.fn().mockResolvedValue(undefined),
  isDisconnecting: false,
  customNetworks: [],
  addCustomNetwork: vi.fn(),
  resetTransactionWatchers: vi.fn(),
};

describe("TopBar", () => {
  const onMenuToggle = vi.fn();
  const clearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      ...defaultSorokit,
      clearError,
    } as unknown as ReturnType<typeof useSorokit>);
  });

  it("renders the title for the active section", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    expect(screen.getByRole("heading", { name: /wallet/i })).toBeInTheDocument();
  });

  it("renders the correct title for different active sections", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="network" onMenuToggle={onMenuToggle} />);
    expect(screen.getByRole("heading", { name: /network/i })).toBeInTheDocument();
  });

  it("does not render the error banner when error is null", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    expect(screen.queryByText(/network unavailable/i)).not.toBeInTheDocument();
  });

  it("renders the error banner with the error message when error is set", () => {
    vi.mocked(useSorokit).mockReturnValue({
      ...defaultSorokit,
      error: "Network unavailable",
      clearError,
    } as unknown as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    expect(screen.getAllByText("Network unavailable").length).toBeGreaterThanOrEqual(1);
  });

  it("calls clearError when the dismiss button in the error banner is clicked", () => {
    vi.mocked(useSorokit).mockReturnValue({
      ...defaultSorokit,
      error: "Something went wrong",
      clearError,
    } as unknown as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    const errorText = screen.getAllByText("Something went wrong")[0];
    const banner = errorText.closest("div.flex")!;
    const dismissButton = within(banner).getByRole("button");
    fireEvent.click(dismissButton);
    expect(clearError).toHaveBeenCalledTimes(1);
  });

  it("calls onMenuToggle when the mobile menu button is clicked", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the title as an h1 element", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    const { container } = render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(container.querySelector("h1")).toBe(heading);
  });

  it("renders the title text matching the active nav label", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="account" onMenuToggle={onMenuToggle} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Account");
  });

  it("renders only one h1 element", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    const { container } = render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("sets aria-expanded to true, aria-label to 'Close menu', and title tooltip to 'Close menu' when sidebarOpen is true", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} sidebarOpen={true} />);
    const button = screen.getByRole("button", { name: /close menu/i });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-label", "Close menu");
    expect(button).toHaveAttribute("title", "Close menu");
  });

  it("sets aria-expanded to false, aria-label to 'Open menu', and title tooltip to 'Open menu' when sidebarOpen is false", () => {
    vi.mocked(useSorokit).mockReturnValue({
      error: null,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} sidebarOpen={false} />);
    const button = screen.getByRole("button", { name: /open menu/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-label", "Open menu");
    expect(button).toHaveAttribute("title", "Open menu");
  });

  it("renders long Horizon error messages fully with word breaking without clipping", () => {
    const longError = "Error: Horizon returned status 400 Bad Request: Transaction failed due to tx_failed op_bad_auth (Account G... has insufficient signatures to satisfy threshold)";
    vi.mocked(useSorokit).mockReturnValue({
      error: longError,
      clearError,
    } as ReturnType<typeof useSorokit>);
    render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    const errorEl = screen.getAllByText(longError)[0];
    expect(errorEl).toBeInTheDocument();
    expect(errorEl.className).toContain("break-words");
  });

  it("uses min-h rather than fixed h for the header", () => {
    vi.mocked(useSorokit).mockReturnValue({
      ...defaultSorokit,
      error: null,
      clearError,
    } as unknown as ReturnType<typeof useSorokit>);
    const { container } = render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header!.className).toContain("min-h-[60px]");
    expect(header!.className).not.toMatch(/(?<!min-)h-\[/);
  });
});

describe("TopBar — issue #679", () => {
  const onMenuToggle = vi.fn();
  const disconnectWallet = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      ...defaultSorokit,
      isConnected: true,
      address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC",
      disconnectWallet,
      network: { name: "mainnet", status: "online", rpcUrl: "https://soroban.stellar.org" },
    } as unknown as ReturnType<typeof useSorokit>);
  });

  describe("mobile burger menu toggling", () => {
    it("toggles the mobile burger menu on click", () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} sidebarOpen={false} />);
      const btn = screen.getByRole("button", { name: "Open menu" });
      expect(btn).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(btn);
      expect(onMenuToggle).toHaveBeenCalledTimes(1);
    });

    it("toggles the mobile burger menu on touch events (touchstart / pointerdown)", () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} sidebarOpen={false} />);
      const btn = screen.getByRole("button", { name: "Open menu" });
      fireEvent.touchStart(btn);
      fireEvent.click(btn);
      expect(onMenuToggle).toHaveBeenCalled();
    });

    it("displays Close menu when sidebar is open and toggles closed", () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} sidebarOpen={true} />);
      const btn = screen.getByRole("button", { name: "Close menu" });
      expect(btn).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(btn);
      expect(onMenuToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect callbacks", () => {
    it("renders wallet dropdown and triggers disconnectWallet callback when Disconnect is clicked", async () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
      const walletBtn = screen.getByRole("button", { name: /wallet connected/i });
      expect(walletBtn).toBeInTheDocument();

      fireEvent.click(walletBtn);

      const disconnectItem = await screen.findByRole("menuitem", { name: /disconnect/i });
      expect(disconnectItem).toBeInTheDocument();

      fireEvent.click(disconnectItem);
      expect(disconnectWallet).toHaveBeenCalledTimes(1);
    });
  });

  describe("outside click and touch dismissal", () => {
    it("dismisses dropdown when tapping outside via touchstart", async () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
      const walletBtn = screen.getByRole("button", { name: /wallet connected/i });
      fireEvent.click(walletBtn);

      expect(await screen.findByRole("menuitem", { name: /disconnect/i })).toBeInTheDocument();

      fireEvent.touchStart(document.body, {
        changedTouches: [{ clientX: 0, clientY: 0 }],
        touches: [{ clientX: 0, clientY: 0 }],
      });

      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: /disconnect/i })).not.toBeInTheDocument();
      });
    });

    it("dismisses dropdown when tapping outside via pointerdown", async () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
      const walletBtn = screen.getByRole("button", { name: /wallet connected/i });
      fireEvent.click(walletBtn);

      expect(await screen.findByRole("menuitem", { name: /disconnect/i })).toBeInTheDocument();

      fireEvent.pointerDown(document.body);

      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: /disconnect/i })).not.toBeInTheDocument();
      });
    });
  });

  describe("accessible network status indicator and colorblind support", () => {
    it("provides accessible text label and high-contrast shape icon", () => {
      render(<TopBar active="wallet" onMenuToggle={onMenuToggle} />);
      expect(screen.getByTestId("network-status-icon")).toBeInTheDocument();
      expect(screen.getByTestId("network-status-label")).toHaveTextContent("Active");
    });
  });
});

