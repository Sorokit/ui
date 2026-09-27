import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient, Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";

import { TransactionHistory } from "../TransactionHistory";

// Issue #765: a network switch swaps SorokitProvider's `client` (see
// switchNetwork in SorokitProvider.tsx: it calls setCurrentClient(nextClient)
// after resetTransactionWatchers()), which TransactionHistory reads as
// `client: contextClient ?? getClient()`. The effect's cleanup sets a local
// `active = false` flag that guards its `.then()` from applying a result
// after the effect re-runs — this test proves that guard actually holds when
// the client reference changes mid-fetch, not just when the address changes
// (already covered by the neighboring #578 test in TransactionHistory.test.tsx).

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    getClient: vi.fn(),
  };
});

const ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

function makeTx(i: number, hashPrefix: string): Transaction {
  return {
    hash: `${hashPrefix}${String(i).padStart(56, "0")}`,
    ledger: 1000 + i,
    successful: true,
    createdAt: new Date("2024-01-01").toISOString(),
    memo: null,
  };
}

describe("TransactionHistory network switch (#765)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not let a stale in-flight fetch from the old network overwrite state after switching networks", async () => {
    // Two distinct client instances, one per network, matching how
    // switchNetwork actually replaces the client (not just the network
    // label) via createClientForNetworkRef / setCurrentClient.
    let resolveTestnet: (value: unknown) => void;
    const testnetPending = new Promise((resolve) => {
      resolveTestnet = resolve;
    });
    const testnetClient = {
      transaction: { getHistory: vi.fn().mockReturnValue(testnetPending) },
    } as unknown as SorokitClient;

    const mainnetTxs = [makeTx(1, "mainnet")];
    const mainnetClient = {
      transaction: {
        getHistory: vi.fn().mockResolvedValue({ data: mainnetTxs, error: null, total: 1 }),
      },
    } as unknown as SorokitClient;

    vi.mocked(getClient).mockReturnValue(testnetClient);
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      isConnected: true,
      network: { name: "testnet" },
      client: testnetClient,
    } as unknown as ReturnType<typeof useSorokit>);

    const { rerender } = render(<TransactionHistory />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // The testnet fetch is now in flight (its own effect has fired, its
    // getHistory promise is pending on `testnetPending`).
    expect(testnetClient.transaction.getHistory).toHaveBeenCalledWith(ADDRESS, 1, 10);

    // Switch networks: same address, new client, exactly what switchNetwork
    // produces. The old testnet fetch is still unresolved.
    vi.mocked(useSorokit).mockReturnValue({
      address: ADDRESS,
      isConnected: true,
      network: { name: "mainnet" },
      client: mainnetClient,
    } as unknown as ReturnType<typeof useSorokit>);

    rerender(<TransactionHistory />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // The new network's fetch should complete and render its own data.
    await waitFor(() => {
      expect(screen.getByText(/1 transaction/i)).toBeInTheDocument();
    });
    expect(mainnetClient.transaction.getHistory).toHaveBeenCalledWith(ADDRESS, 1, 10);

    // Now resolve the STALE testnet fetch. If the old effect's cleanup did
    // not set `active = false`, this stale `.then()` would still run and
    // could clobber the mainnet result already rendered.
    await act(async () => {
      resolveTestnet({
        data: [makeTx(1, "stale00"), makeTx(2, "stale00")],
        error: null,
        total: 2,
      });
      // Flush the promise microtask queue (the stale .then()/.finally()),
      // which fake timers alone do not advance.
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(0);
    });

    // The stale testnet result must never appear: no "2 transactions" count,
    // and the mainnet transaction must still be the one shown.
    expect(screen.queryByText(/2 transactions/i)).not.toBeInTheDocument();
    expect(screen.getByText(/1 transactions/i)).toBeInTheDocument();
  });
});
