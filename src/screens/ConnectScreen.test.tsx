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
});