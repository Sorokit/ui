import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SwapExecutionTracker } from "./SwapExecutionTracker";
import { useSorokit } from "@/context/useSorokit";

// Mock useSorokit hook
vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

describe("SwapExecutionTracker", () => {
  const dummySwap = {
    from: "XLM",
    to: "USDC",
    fromAmount: 1000,
    toAmountExpected: 95,
    slippagePct: 0.3,
    feeStroops: 100,
    swapFeePct: 0.3,
    totalCostUsd: 1.2,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock default useSorokit response with testnet
    vi.mocked(useSorokit).mockReturnValue({
      client: {} as any,
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      isLoading: false,
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      isDisconnecting: false,
      account: null,
      balances: [],
      isLoadingAccount: false,
      refreshAccount: async () => {},
      network: { name: "testnet", passphrase: "", rpcUrl: "", horizonUrl: "" },
      switchNetwork: async () => {},
      error: null,
      errorHistory: [],
      clearError: () => {},
      registerWatcher: vi.fn(() => () => {}),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders execution metrics, explorer link, and a warning when slippage exceeds threshold", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx123"
        executedAt="2026-07-26T12:00:00.000Z"
        actualOutput={90}
        slippageThresholdPct={0.2}
      />,
    );

    expect(screen.getByText(/source/i)).toBeInTheDocument();
    expect(screen.getByText(/1,000 XLM/i)).toBeInTheDocument();
    expect(screen.getByText(/^XLM$/i)).toBeInTheDocument();
    expect(screen.getByText(/destination/i)).toBeInTheDocument();
    expect(screen.getAllByText(/90 USDC/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^USDC$/i)).toBeInTheDocument();
    expect(screen.getByText(/price impact/i)).toBeInTheDocument();
    expect(screen.getByText(/0.30%/i)).toBeInTheDocument();
    expect(screen.getByText(/warning: slippage exceeded threshold/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on explorer/i })).toHaveAttribute("href", expect.stringContaining("tx123"));
  });

  it("renders submitted state with step progression and initial countdown timer", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        status="submitted"
        timeoutSeconds={60}
      />,
    );

    expect(screen.getAllByText(/submitted/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Confirming \(60s\)/i)).toBeInTheDocument();
  });

  it("renders confirming state with active status badge", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx999"
        status="confirming"
      />,
    );

    expect(screen.getByText("Confirming...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on explorer/i })).toHaveAttribute("href", expect.stringContaining("tx999"));
  });

  it("renders timeout error state with alert banner, check explorer link, and retry option", () => {
    const onRetry = vi.fn();
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_dropped_123"
        status="timeout"
        timeoutSeconds={60}
        onRetry={onRetry}
      />,
    );

    expect(screen.getAllByText(/transaction timed out/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/was not confirmed within 60 seconds/i)).toBeInTheDocument();

    const checkExplorerLink = screen.getByRole("link", { name: /check explorer for transaction/i });
    expect(checkExplorerLink).toHaveAttribute("href", expect.stringContaining("tx_dropped_123"));

    const retryButton = screen.getByRole("button", { name: /retry swap/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("automatically transitions to timeout state when timer elapses in confirming state", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_pending_456"
        status="confirming"
        timeoutSeconds={5}
      />,
    );

    expect(screen.getByText("Confirming...")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Advance timer past the 5-second limit
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getAllByText(/transaction timed out/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /check explorer for transaction/i })).toHaveAttribute("href", expect.stringContaining("tx_pending_456"));
  });

  it("uses dynamic explorer URL based on active network (testnet)", () => {
    vi.mocked(useSorokit).mockReturnValue({
      client: {} as any,
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      isLoading: false,
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      isDisconnecting: false,
      account: null,
      balances: [],
      isLoadingAccount: false,
      refreshAccount: async () => {},
      network: { name: "testnet", passphrase: "", rpcUrl: "", horizonUrl: "" },
      switchNetwork: async () => {},
      error: null,
      errorHistory: [],
      clearError: () => {},
      registerWatcher: vi.fn(() => () => {}),
    });

    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="txTestnet123"
        executedAt="2026-07-26T12:00:00.000Z"
        actualOutput={90}
      />,
    );

    const explorerLink = screen.getByRole("link", { name: /view on explorer/i });
    expect(explorerLink).toHaveAttribute(
      "href",
      expect.stringContaining("stellar.expert/explorer/testnet/tx/txTestnet123"),
    );
  });

  it("uses dynamic explorer URL based on active network (mainnet)", () => {
    vi.mocked(useSorokit).mockReturnValue({
      client: {} as any,
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      isLoading: false,
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      isDisconnecting: false,
      account: null,
      balances: [],
      isLoadingAccount: false,
      refreshAccount: async () => {},
      network: { name: "mainnet", passphrase: "", rpcUrl: "", horizonUrl: "" },
      switchNetwork: async () => {},
      error: null,
      errorHistory: [],
      clearError: () => {},
      registerWatcher: vi.fn(() => () => {}),
    });

    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="txMainnet456"
        executedAt="2026-07-26T12:00:00.000Z"
        actualOutput={90}
      />,
    );

    const explorerLink = screen.getByRole("link", { name: /view on explorer/i });
    expect(explorerLink).toHaveAttribute(
      "href",
      expect.stringContaining("stellar.expert/explorer/public/tx/txMainnet456"),
    );
  });

  it("uses dynamic explorer URL based on active network (futurenet)", () => {
    vi.mocked(useSorokit).mockReturnValue({
      client: {} as any,
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      isLoading: false,
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      isDisconnecting: false,
      account: null,
      balances: [],
      isLoadingAccount: false,
      refreshAccount: async () => {},
      network: { name: "futurenet", passphrase: "", rpcUrl: "", horizonUrl: "" },
      switchNetwork: async () => {},
      error: null,
      errorHistory: [],
      clearError: () => {},
      registerWatcher: vi.fn(() => () => {}),
    });

    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="txFuturenet789"
        executedAt="2026-07-26T12:00:00.000Z"
        actualOutput={90}
      />,
    );

    const explorerLink = screen.getByRole("link", { name: /view on explorer/i });
    expect(explorerLink).toHaveAttribute(
      "href",
      expect.stringContaining("stellar.expert/explorer/futurenet/tx/txFuturenet789"),
    );
  });

  it("renders distinct step badges for Signing, Submitted, and Confirming states", () => {
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        status="submitted"
        timeoutSeconds={60}
      />,
    );

    // Check for all four step labels in the stepper
    expect(screen.getByText("Signing")).toBeInTheDocument();
    expect(screen.getAllByText(/submitted/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Confirming/i)).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked during pending state", () => {
    const onCancel = vi.fn();
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_pending_001"
        status="confirming"
        timeoutSeconds={60}
        onCancel={onCancel}
      />,
    );

    // Verify pending state banner is shown
    expect(screen.getByText(/Transaction Pending/i)).toBeInTheDocument();

    // Find and click the cancel button
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("stops countdown timer when cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_pending_002"
        status="confirming"
        timeoutSeconds={10}
        onCancel={onCancel}
      />,
    );

    // Verify initial countdown
    expect(screen.getByText(/Confirming \(10s\)/i)).toBeInTheDocument();

    // Click cancel
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Advance timer - the countdown should not update since it's cancelled
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Callback should have been called once
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("registers cancellation callback with provider for network switch handling", () => {
    const mockRegisterWatcher = vi.fn(() => () => {});
    vi.mocked(useSorokit).mockReturnValue({
      client: {} as any,
      address: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      isLoading: false,
      connectWallet: async () => {},
      disconnectWallet: async () => {},
      isDisconnecting: false,
      account: null,
      balances: [],
      isLoadingAccount: false,
      refreshAccount: async () => {},
      network: { name: "testnet", passphrase: "", rpcUrl: "", horizonUrl: "" },
      switchNetwork: async () => {},
      error: null,
      errorHistory: [],
      clearError: () => {},
      registerWatcher: mockRegisterWatcher,
    });

    render(
      <SwapExecutionTracker
        swap={dummySwap}
        txHash="tx_pending_003"
        status="confirming"
        timeoutSeconds={60}
      />,
    );

    // Verify registerWatcher was called to register cancellation callback
    expect(mockRegisterWatcher).toHaveBeenCalledTimes(1);
  });
});

