import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { WalletStatusBadge } from "./WalletStatusBadge";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("WalletStatusBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      ...overrides,
    };
  }

  it("renders disconnected state when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());

    render(<WalletStatusBadge />);
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Wallet disconnected"),
    ).toBeInTheDocument();
  });

  it("renders connected state with wallet name and truncated address", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: "Freighter",
      }),
    );

    render(<WalletStatusBadge />);
    expect(screen.getByText("Freighter")).toBeInTheDocument();
    expect(screen.getByText("GABC12...WXYZ")).toBeInTheDocument();
  });

  it("renders 'Wallet' as fallback name when walletName is null", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: null,
      }),
    );

    render(<WalletStatusBadge />);
    expect(screen.getByText("Wallet")).toBeInTheDocument();
  });

  it("renders loading state when connecting", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ isConnecting: true }),
    );

    render(<WalletStatusBadge />);
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Connecting wallet" }),
    ).toBeInTheDocument();
  });

  it("calls onOpen when clicked in connected state", () => {
    const onOpen = vi.fn();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: "xBull",
      }),
    );

    render(<WalletStatusBadge onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("has accessible aria-label in connected state", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        walletName: "Lobstr",
      }),
    );

    render(<WalletStatusBadge />);
    expect(
      screen.getByRole("button", {
        name: /Wallet connected: Lobstr.*GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ.*Click to manage/,
      }),
    ).toBeInTheDocument();
  });
});
