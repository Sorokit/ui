import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { usePendingActions } from "@/hooks/usePendingActions";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("usePendingActions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      address: "GTEST123",
      isConnected: true,
      client: {
        account: {
          getClaimableBalances: vi.fn().mockResolvedValue({
            data: [{ id: "claim-1" }, { id: "claim-2" }],
            error: null,
          }),
        },
      },
    } as unknown as ReturnType<typeof useSorokit>);
  });

  it("loads pending actions from scheduled transactions in localStorage", async () => {
    localStorage.setItem(
      "sorokit:scheduled-transactions",
      JSON.stringify([
        {
          id: "sched-1",
          status: "pending",
          destination: "GDEST",
          amount: "10",
          asset: "XLM",
          scheduledTime: "2026-12-01T10:00",
        },
      ]),
    );

    const { result } = renderHook(() => usePendingActions());

    await act(async () => {
      await result.current.refreshPendingActions();
    });

    const hasScheduled = result.current.pendingActions.some(
      (a) => a.type === "scheduled_tx",
    );
    expect(hasScheduled).toBe(true);
    expect(result.current.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it("loads claimable balances from client", async () => {
    const { result } = renderHook(() => usePendingActions());

    await act(async () => {
      await result.current.refreshPendingActions();
    });

    const claimAction = result.current.pendingActions.find(
      (a) => a.type === "claimable_balance",
    );
    expect(claimAction).toBeDefined();
    expect(claimAction?.count).toBe(2);
    expect(claimAction?.targetScreen).toBe("account");
  });

  it("supports adding and clearing custom pending actions", async () => {
    const { result } = renderHook(() => usePendingActions());

    act(() => {
      result.current.addPendingAction({
        id: "swap-pending-1",
        type: "pending_swap",
        title: "Swap in progress",
        description: "100 XLM to USDC",
        targetScreen: "farming",
      });
    });

    expect(
      result.current.pendingActions.some((a) => a.id === "swap-pending-1"),
    ).toBe(true);

    act(() => {
      result.current.clearPendingAction("swap-pending-1");
    });

    expect(
      result.current.pendingActions.some((a) => a.id === "swap-pending-1"),
    ).toBe(false);
  });
});
