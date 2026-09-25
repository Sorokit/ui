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
  let resetTransactionWatchers: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    switchNetwork = vi.fn().mockResolvedValue(undefined);
    addCustomNetwork = vi.fn().mockResolvedValue(undefined);
    resetTransactionWatchers = vi.fn();

    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [],
      addCustomNetwork,
      resetTransactionWatchers,
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

  it("selecting a different network option calls switchNetwork and resets transaction watchers", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    // Find and click the Mainnet menu item
    const mainnetOption = screen.getByRole("menuitem", { name: /mainnet/i });
    await act(async () => {
      fireEvent.click(mainnetOption);
    });

    expect(resetTransactionWatchers).toHaveBeenCalledTimes(1);
    expect(switchNetwork).toHaveBeenCalledWith("mainnet");
  });

  it("displays mismatch badge when current network differs from initialNetwork", () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: MAINNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [],
      addCustomNetwork,
      resetTransactionWatchers,
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
      resetTransactionWatchers,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.getByText("Custom Networks")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /local dev/i })).toBeInTheDocument();
  });

  it("selecting a custom network calls switchNetwork and resets transaction watchers", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      network: TESTNET_NETWORK,
      initialNetwork: TESTNET_NETWORK,
      switchNetwork,
      customNetworks: [CUSTOM_NETWORK],
      addCustomNetwork,
      resetTransactionWatchers,
    } as unknown as ReturnType<typeof useSorokit>);

    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const customOption = screen.getByRole("menuitem", { name: /local dev/i });
    await act(async () => {
      fireEvent.click(customOption);
    });
    expect(resetTransactionWatchers).toHaveBeenCalledTimes(1);
    expect(switchNetwork).toHaveBeenCalledWith(CUSTOM_NETWORK);
  });

  it("opens add custom network modal and submits new custom network with valid URL", async () => {
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

    expect(resetTransactionWatchers).toHaveBeenCalledTimes(1);
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

  it("shows form error when adding custom network with empty RPC URL", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    fireEvent.click(screen.getByText("Add Custom Network..."));

    fireEvent.change(screen.getByLabelText(/network name \*/i), {
      target: { value: "Custom Net" },
    });

    const form = screen.getByRole("button", { name: /add & switch network/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("RPC URL is required")).toBeInTheDocument();
    expect(addCustomNetwork).not.toHaveBeenCalled();
  });

  it("validates RPC URL protocol and rejects non-HTTP(S) endpoints (e.g. ftp:// or ws://)", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    fireEvent.click(screen.getByText("Add Custom Network..."));

    const nameInput = screen.getByLabelText(/network name \*/i);
    const rpcInput = screen.getByLabelText(/rpc endpoint url \*/i);

    fireEvent.change(nameInput, { target: { value: "FTP Node" } });
    fireEvent.change(rpcInput, { target: { value: "ftp://soroban.node:8000/rpc" } });

    const form = screen.getByRole("button", { name: /add & switch network/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("RPC URL must be a valid HTTP or HTTPS URL")).toBeInTheDocument();
    expect(addCustomNetwork).not.toHaveBeenCalled();
  });

  it("validates RPC URL rejects malformed non-URL strings", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    fireEvent.click(screen.getByText("Add Custom Network..."));

    const nameInput = screen.getByLabelText(/network name \*/i);
    const rpcInput = screen.getByLabelText(/rpc endpoint url \*/i);

    fireEvent.change(nameInput, { target: { value: "Invalid Node" } });
    fireEvent.change(rpcInput, { target: { value: "not-a-valid-url" } });

    const form = screen.getByRole("button", { name: /add & switch network/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("RPC URL must be a valid HTTP or HTTPS URL")).toBeInTheDocument();
    expect(addCustomNetwork).not.toHaveBeenCalled();
  });

  it("validates Horizon URL protocol if provided", async () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    fireEvent.click(screen.getByText("Add Custom Network..."));

    const nameInput = screen.getByLabelText(/network name \*/i);
    const rpcInput = screen.getByLabelText(/rpc endpoint url \*/i);
    const horizonInput = screen.getByLabelText(/horizon url \(optional\)/i);

    fireEvent.change(nameInput, { target: { value: "Valid RPC Bad Horizon" } });
    fireEvent.change(rpcInput, { target: { value: "https://soroban-testnet.stellar.org" } });
    fireEvent.change(horizonInput, { target: { value: "ftp://horizon.invalid" } });

    const form = screen.getByRole("button", { name: /add & switch network/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText("Horizon URL must be a valid HTTP or HTTPS URL")).toBeInTheDocument();
    expect(addCustomNetwork).not.toHaveBeenCalled();
  });

  it("closes the custom network dialog when Escape key is pressed", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    fireEvent.click(screen.getByText("Add Custom Network..."));
    expect(screen.getByText("Add Custom Network")).toBeInTheDocument();

    // Press Escape key on document
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Add Custom Network")).not.toBeInTheDocument();
  });

  it("closes the custom network dialog when Escape key is pressed from within an input", () => {
    render(<NetworkSwitcher />);
    const trigger = screen.getByRole("button", { name: /current network: testnet/i });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    fireEvent.click(screen.getByText("Add Custom Network..."));
    const rpcInput = screen.getByLabelText(/rpc endpoint url \*/i);

    // Press Escape key while focused on input
    fireEvent.keyDown(rpcInput, { key: "Escape" });
    expect(screen.queryByText("Add Custom Network")).not.toBeInTheDocument();
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
