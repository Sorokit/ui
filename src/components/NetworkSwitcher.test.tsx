import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { NetworkInfo } from "@/lib/client";

import { NETWORK_SWITCHER_SHORTCUT, NetworkSwitcher } from "./NetworkSwitcher";

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

const MAINNET_NETWORK: NetworkInfo = {
  name: "mainnet",
  rpcUrl: "https://soroban.stellar.org",
  passphrase: "Public Global Stellar Network ; September 2015",
  horizonUrl: "https://horizon.stellar.org",
  status: "online",
};

const CUSTOM_NETWORK: NetworkInfo = {
  name: "Local Dev",
  rpcUrl: "http://localhost:8000/soroban/rpc",
  passphrase: "Standalone Network ; February 2017",
  horizonUrl: "http://localhost:8000",
  status: "online",
};

describe("NetworkSwitcher", { timeout: 15000 }, () => {
  let switchNetwork: ReturnType<typeof vi.fn>;
  let addCustomNetwork: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    switchNetwork = vi.fn().mockResolvedValue(undefined);
    addCustomNetwork = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [],
      addCustomNetwork,
    } as unknown as ReturnType<typeof useSorokit>);
  });

  it("shows the active network name in the trigger button", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });

  it("displays the correct dot color for the active network", () => {
    render(<NetworkSwitcher />);
    const dot = screen.getByText("Testnet status").parentElement;
    expect(dot).toHaveClass("bg-orange");
  });

  it("advertises the Alt+N shortcut on the trigger button", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    expect(trigger).toHaveAttribute("aria-keyshortcuts", NETWORK_SWITCHER_SHORTCUT);
  });

  it("opens dropdown and lists standard networks when trigger is clicked", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.getByText("Select Network")).toBeInTheDocument();
    expect(screen.getByText("Standard Networks")).toBeInTheDocument();
    expect(screen.getAllByText("Mainnet").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Futurenet").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Localnet").length).toBeGreaterThanOrEqual(1);
  });

  it("selecting a different network option calls switchNetwork with the network name", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    // Find and click the Mainnet menu item
    const mainnetOption = screen.getByRole("menuitem", { name: /mainnet/i });
    await act(async () => {
      fireEvent.click(mainnetOption);
    });

    expect(switchNetwork).toHaveBeenCalledWith("mainnet");
  });

  it("displays mismatch badge when current network differs from initialNetwork", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: MAINNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [],
      addCustomNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    expect(screen.getByTestId("network-mismatch-badge")).toBeInTheDocument();
    expect(screen.getByText("Mismatch")).toBeInTheDocument();
  });

  it("renders custom networks in the dropdown menu", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [CUSTOM_NETWORK],
      addCustomNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.getByText("Custom Networks")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /local dev/i })).toBeInTheDocument();
  });

  it("selecting a custom network calls switchNetwork with custom network config", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [CUSTOM_NETWORK],
      addCustomNetwork,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const customOption = screen.getByRole("menuitem", { name: /local dev/i });
    await act(async () => {
      fireEvent.click(customOption);
    });
    expect(switchNetwork).toHaveBeenCalledWith(CUSTOM_NETWORK);
  });

  it("opens add custom network modal and submits new custom network", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    // Click "Add Custom Network..."
    const addCustomTrigger = screen.getByText("Add Custom Network...");
    fireEvent.click(addCustomTrigger);

    expect(screen.getByText("Add Custom Network")).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/network name \*/i);
    const rpcInput = screen.getByLabelText(/rpc endpoint url \*/i);

    fireEvent.change(nameInput, { target: { value: "My Standalone" } });
    fireEvent.change(rpcInput, { target: { value: "http://127.0.0.1:8000/soroban/rpc" } });

    const submitBtn = screen.getByRole("button", { name: /add & switch network/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(addCustomNetwork).toHaveBeenCalledWith({
      name: "My Standalone",
      rpcUrl: "http://127.0.0.1:8000/soroban/rpc",
      horizonUrl: "http://localhost:8000",
      passphrase: "Standalone Network ; February 2017",
      status: "online",
    });
  });

  it("shows form error when adding custom network with empty fields", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const addCustomTrigger = screen.getByText("Add Custom Network...");
    fireEvent.click(addCustomTrigger);

    const form = screen.getByRole("button", { name: /add & switch network/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("Network name is required")).toBeInTheDocument();
  });

  it("toggles dropdown when Alt+N shortcut key is pressed", () => {
    render(<NetworkSwitcher />);

    // Initially dropdown content is not present
    expect(screen.queryByText("Select Network")).not.toBeInTheDocument();

    // Trigger Alt+N
    fireEvent.keyDown(document, { key: "n", altKey: true });
    expect(screen.getByText("Select Network")).toBeInTheDocument();

    // Press Alt+N again to toggle closed
    fireEvent.keyDown(document, { key: "n", altKey: true });
    expect(screen.queryByText("Select Network")).not.toBeInTheDocument();
  });
});
