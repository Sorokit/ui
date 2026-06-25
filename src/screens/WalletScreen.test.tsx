import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WalletScreen } from "./WalletScreen";
import { useSorokit } from "@/context/useSorokit";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("WalletScreen", () => {
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders active connected state and handles disconnect confirmation", () => {
    (useSorokit as any).mockReturnValue({
      address: "GABC123456",
      isConnected: true,
      disconnectWallet: mockDisconnect,
      network: { name: "testnet", rpcUrl: "https://rpc.com" },
    });

    render(<WalletScreen />);
    
    // Check initial connect state is visible
    expect(screen.getByText("Connected")).toBeInTheDocument();
    
    // Disconnect button should start as "Disconnect"
    const disconnectBtn = screen.getByRole("button", { name: "Disconnect" });
    expect(disconnectBtn).toBeInTheDocument();
    expect(disconnectBtn.className).toContain("border-line-2"); // secondary style classes

    // First click should switch button label to "Disconnect?"
    fireEvent.click(disconnectBtn);
    expect(mockDisconnect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Disconnect?" })).toBeInTheDocument();

    // Second click should execute disconnectWallet
    fireEvent.click(screen.getByRole("button", { name: "Disconnect?" }));
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("resets confirmation state to Disconnect after 3 seconds", () => {
    (useSorokit as any).mockReturnValue({
      address: "GABC123456",
      isConnected: true,
      disconnectWallet: mockDisconnect,
      network: null,
    });

    render(<WalletScreen />);
    
    const disconnectBtn = screen.getByRole("button", { name: "Disconnect" });
    
    // First click
    fireEvent.click(disconnectBtn);
    expect(screen.getByRole("button", { name: "Disconnect?" })).toBeInTheDocument();

    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Label should reset back to "Disconnect"
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });
});
