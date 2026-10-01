import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { NetworkScreen } from "./NetworkScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: "div",
  Loading01Icon: "div",
}));

const TESTNET_NETWORK = {
  name: "testnet" as const,
  passphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
};

describe("NetworkScreen — switch-in-flight disabling (#537)", () => {
  let switchNetwork: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    switchNetwork = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      switchNetwork,
    } as unknown as ReturnType<typeof useSorokit>);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("disables all non-active network options while isSwitchingNetwork is true", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      switchNetwork,
      isSwitchingNetwork: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkScreen />);

    const mainnetButton = screen.getByRole("button", { name: /mainnet/i });
    const futurenetButton = screen.getByRole("button", { name: /futurenet/i });
    const localnetButton = screen.getByRole("button", { name: /localnet/i });

    expect(mainnetButton).toBeDisabled();
    expect(futurenetButton).toBeDisabled();
    expect(localnetButton).toBeDisabled();
  });

  it("does not call switchNetwork when a provider-wide switch is already in flight", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      switchNetwork,
      isSwitchingNetwork: true,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkScreen />);
    fireEvent.click(screen.getByRole("button", { name: /mainnet/i }));

    expect(switchNetwork).not.toHaveBeenCalled();
  });

  it("re-enables the options once the switch completes", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      switchNetwork,
      isSwitchingNetwork: false,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkScreen />);
    const mainnetButton = screen.getByRole("button", { name: /mainnet/i });
    expect(mainnetButton).toBeEnabled();

    fireEvent.click(mainnetButton);
    expect(switchNetwork).toHaveBeenCalledWith("mainnet");

    await waitFor(() => {
      expect(mainnetButton).toBeEnabled();
    });
  });

  it("marks the switching option with aria-busy", async () => {
    let resolveSwitch: (value: unknown) => void;
    switchNetwork.mockReturnValue(
      new Promise((resolve) => {
        resolveSwitch = resolve;
      }),
    );

    render(<NetworkScreen />);
    fireEvent.click(screen.getByRole("button", { name: /mainnet/i }));

    expect(
      screen.getByRole("button", { name: /mainnet/i }),
    ).toHaveAttribute("aria-busy", "true");

    // The deferred switch has to settle before the option can leave its busy
    // state, so resolve it before waiting on aria-busy to flip back.
    await act(async () => {
      resolveSwitch?.(undefined);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /mainnet/i }),
      ).toHaveAttribute("aria-busy", "false");
    });
  });
});
