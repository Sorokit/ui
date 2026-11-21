import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SorokitContext,
  type SorokitState,
} from "@/context/SorokitContext";
import type { NetworkInfo, SorokitClient, Transaction } from "@/lib/client";

import { TransactionHistory } from "./TransactionHistory";

const ADDRESS_A = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
const ADDRESS_B = "GBBD7PQPDHFWD6Q5CFF3J4L3R75EAE6Z4NZZ2QY6M2G4K4W4P6N3X2B1";
const PAGE_SIZE = 10;

function makeTx(i: number): Transaction {
  return {
    hash: `hash${String(i).padStart(56, "0")}`,
    ledger: 1000 + i,
    createdAt: new Date("2024-01-01").toISOString(),
    successful: true,
    operationCount: 1,
    feePaid: "100",
  };
}

const PENDING = () => new Promise<never>(() => {});

/**
 * A lightweight stand-in for `SorokitProvider` that exposes the real
 * `SorokitContext` so `TransactionHistory` runs through its actual
 * `useSorokit()` path. Tests control `address`, `isConnected`, `network`,
 * and the `client` directly, then flip the address by re-rendering — the
 * only way to exercise the component's address-change reset from inside a
 * provider.
 */
function MockSorokitProvider({
  client,
  address,
  networkName,
  children,
}: {
  client: SorokitClient;
  address: string | null;
  networkName?: string;
  children: React.ReactNode;
}) {
  const value: SorokitState = {
    client,
    address,
    walletName: null,
    isConnected: address != null,
    isConnecting: false,
    isLoading: false,
    connectWallet: PENDING,
    disconnectWallet: PENDING,
    isDisconnecting: false,
    account: null,
    balances: [],
    isLoadingAccount: false,
    refreshAccount: PENDING,
    network: networkName
      ? ({ name: networkName } as NetworkInfo)
      : null,
    switchNetwork: PENDING,
    error: null,
    errorHistory: [],
    clearError: vi.fn(),
  };

  return (
    <SorokitContext.Provider value={value}>{children}</SorokitContext.Provider>
  );
}

describe("TransactionHistory inside a mock SorokitProvider (#554)", () => {
  let getHistory: ReturnType<typeof vi.fn>;
  let client: SorokitClient;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    getHistory = vi.fn().mockResolvedValue({
      data: Array.from({ length: PAGE_SIZE }, (_, i) => makeTx(i)),
      error: null,
      total: 25, // 3 pages with the default page size
    });
    client = { transaction: { getHistory } } as unknown as SorokitClient;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderAt(
    address: string | null,
    networkName?: string,
    overrides?: Partial<ReturnType<typeof render>>,
  ) {
    return render(
      <MockSorokitProvider client={client} address={address} networkName={networkName}>
        <TransactionHistory />
      </MockSorokitProvider>,
      overrides,
    );
  }

  it("requests page 1 on first render", async () => {
    renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(getHistory).toHaveBeenCalledWith(ADDRESS_A, 1, PAGE_SIZE);
    });
  });

  it("renders transactions after data is returned", async () => {
    renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(screen.getAllByRole("article")).toHaveLength(PAGE_SIZE);
    });
    expect(screen.getByText(`${PAGE_SIZE} shown`)).toBeInTheDocument();
  });

  it("renders the loading skeleton while the first fetch is pending", async () => {
    getHistory.mockReturnValue(PENDING());
    renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // 5 skeleton placeholder rows should be visible while loading.
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("disables Prev on page 1", async () => {
    renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => screen.getByText("Next"));

    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
  });

  it("clicking Next requests page 2", async () => {
    renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => screen.getByText("Next"));
    expect(getHistory).toHaveBeenLastCalledWith(ADDRESS_A, 1, PAGE_SIZE);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(getHistory).toHaveBeenLastCalledWith(ADDRESS_A, 2, PAGE_SIZE);
    });
  });

  it("renders the error message when the fetch fails", async () => {
    getHistory.mockResolvedValue({
      data: null,
      error: "Network request failed",
      total: 0,
    });
    renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(screen.getByText("Network request failed")).toBeInTheDocument();
    });
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("resets to page 1 when the wallet address changes", async () => {
    const { rerender } = renderAt(ADDRESS_A);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => screen.getByText("Next"));

    // Reach page 2 for the original address.
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => {
      expect(getHistory).toHaveBeenLastCalledWith(ADDRESS_A, 2, PAGE_SIZE);
    });

    getHistory.mockClear();
    getHistory.mockResolvedValue({
      data: [makeTx(0)],
      error: null,
      total: 1,
    });

    // Switch wallets — the component must restart at page 1 and must never
    // reuse the page it last requested for the previous address.
    rerender(
      <MockSorokitProvider client={client} address={ADDRESS_B}>
        <TransactionHistory />
      </MockSorokitProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(getHistory).not.toHaveBeenCalledWith(ADDRESS_B, 2, PAGE_SIZE);
    await waitFor(() => {
      expect(getHistory).toHaveBeenCalledWith(ADDRESS_B, 1, PAGE_SIZE);
    });
    expect(screen.queryByText(/page \d+ of/i)).not.toBeInTheDocument();
  });

  it("renders 'Connect your wallet' when no address is connected", () => {
    renderAt(null);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(getHistory).not.toHaveBeenCalled();
  });
});