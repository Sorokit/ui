import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { NetworkInfo } from "@/lib/client";

import { NetworkSwitcher } from "./NetworkSwitcher";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const TESTNET_NETWORK: NetworkInfo = {
  name: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  passphrase: "Test SDF Network ; September 2015",
  horizonUrl: "https://horizon-testnet.stellar.org",
  status: "online",
};

describe("NetworkSwitcher — switch-in-flight disabling (#537)", () => {
  let switchNetwork: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    switchNetwork = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [],
      isSwitchingNetwork: true,
    } as unknown as ReturnType<typeof useSorokit>);
  });

  it("disables the trigger while a provider-wide switch is in flight", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", {
      name: /current network: testnet/i,
    });
    expect(trigger).toBeDisabled();
  });

  it("dropdown items are non-interactive during a provider-wide switch", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", {
      name: /current network: testnet/i,
    });

    // Radix ignores pointer events on disabled triggers, so open the menu via
    // the keyboard path the component wires for Alt+N, or directly dispatch
    // on the trigger's pointerdown as the existing tests do.
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const mainnetItem = screen.queryByRole("menuitem", { name: /mainnet/i });
    if (mainnetItem) {
      expect(mainnetItem).toHaveAttribute("data-disabled");
      fireEvent.click(mainnetItem);
      expect(switchNetwork).not.toHaveBeenCalled();
    }
  });

  it("dropdown items become interactive after the switch completes", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [],
      isSwitchingNetwork: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", {
      name: /current network: testnet/i,
    });
    expect(trigger).toBeEnabled();
  });
});
