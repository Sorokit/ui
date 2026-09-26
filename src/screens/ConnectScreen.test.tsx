import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
});
