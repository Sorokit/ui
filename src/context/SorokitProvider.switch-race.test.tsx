import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProvider } from "@/__tests__/utils";
import type { SorokitClient } from "@/lib/client";

import { useSorokit } from "./useSorokit";

/**
 * Issue #537 — concurrent switchNetwork calls create a race condition.
 *
 * These tests use a controllable mock client whose switchNetwork can be
 * held pending, then verify:
 *  1. a second concurrent call is rejected while one is in flight,
 *  2. `isSwitchingNetwork` is exposed from the context,
 *  3. the flag clears after the switch settles.
 */

const NETWORK_A = {
  name: "testnet" as const,
  rpcUrl: "https://soroban-testnet.stellar.org",
  passphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
  status: "online",
};

const NETWORK_B = {
  name: "mainnet" as const,
  rpcUrl: "https://soroban.stellar.org",
  passphrase: "Public Global Stellar Network ; September 2015",
  horizonUrl: "https://horizon.stellar.org",
  status: "online",
};

function makeDeferredSwitchClient() {
  let resolveSwitch: ((result: { data: unknown; error: null }) => void) | null =
    null;
  let switchCalls = 0;

  const client: SorokitClient = {
    network: {
      getNetwork: vi.fn().mockResolvedValue({ data: NETWORK_A, error: null }),
      switchNetwork: vi.fn(
        () =>
          new Promise<{ data: unknown; error: null }>((resolve) => {
            switchCalls += 1;
            resolveSwitch = resolve;
          }),
      ),
    },
  } as unknown as SorokitClient;

  return {
    client,
    resolveNextSwitch: (result: { data: unknown; error: null }) => {
      resolveSwitch?.(result);
      resolveSwitch = null;
    },
    getSwitchCalls: () => switchCalls,
  };
}

const FlagsProbe = () => {
  const { switchNetwork, isSwitchingNetwork } = useSorokit();
  return (
    <div>
      <div data-testid="is-switching">{String(!!isSwitchingNetwork)}</div>
      <button onClick={() => void switchNetwork("mainnet")}>switch-a</button>
      <button onClick={() => void switchNetwork("futurenet")}>switch-b</button>
    </div>
  );
};

describe("SorokitProvider — switchNetwork concurrency (#537)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // A persisted preference is what makes the provider issue its mount-time
    // restore switch, which the "restore + A" call counts below depend on.
    window.localStorage.setItem("sorokit_network", "testnet");
  });

  it("exposes isSwitchingNetwork true while a switch is in flight and false after", async () => {
    const { client, resolveNextSwitch } = makeDeferredSwitchClient();
    renderWithProvider(<FlagsProbe />, { client });

    // Mount restore performs its own switch; resolve it first.
    await act(async () => {
      resolveNextSwitch({ data: NETWORK_A, error: null });
    });
    await waitFor(() => {
      expect(screen.getByTestId("is-switching")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByText("switch-a"));
    await waitFor(() => {
      expect(screen.getByTestId("is-switching")).toHaveTextContent("true");
    });

    await act(async () => {
      resolveNextSwitch({ data: NETWORK_B, error: null });
    });
    await waitFor(() => {
      expect(screen.getByTestId("is-switching")).toHaveTextContent("false");
    });
  });

  it("rejects a second switchNetwork call while the first is still in flight", async () => {
    const { client, resolveNextSwitch, getSwitchCalls } =
      makeDeferredSwitchClient();
    renderWithProvider(<FlagsProbe />, { client });

    // Resolve the mount-time restore switch.
    await act(async () => {
      resolveNextSwitch({ data: NETWORK_A, error: null });
    });
    await waitFor(() => {
      expect(screen.getByTestId("is-switching")).toHaveTextContent("false");
    });

    // Start switch A — held pending.
    fireEvent.click(screen.getByText("switch-a"));
    await waitFor(() => {
      expect(getSwitchCalls()).toBeGreaterThanOrEqual(2); // restore + A
    });

    // Attempt switch B while A is pending: the provider must refuse to call
    // the client again (only the restore + A calls exist).
    fireEvent.click(screen.getByText("switch-b"));
    expect(getSwitchCalls()).toBe(2);

    // Settle A; afterwards a new switch is allowed again.
    await act(async () => {
      resolveNextSwitch({ data: NETWORK_B, error: null });
    });
    await waitFor(() => {
      expect(screen.getByTestId("is-switching")).toHaveTextContent("false");
    });

    fireEvent.click(screen.getByText("switch-a"));
    await waitFor(() => {
      expect(getSwitchCalls()).toBe(3);
    });

    await act(async () => {
      resolveNextSwitch({ data: NETWORK_A, error: null });
    });
  });
});
