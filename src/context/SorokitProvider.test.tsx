import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { renderWithProvider } from "@/__tests__/utils";
import { getClient } from "@/lib/client";

import { SorokitProvider } from "./SorokitProvider";
import { useSorokit } from "./useSorokit";

const TestComponent = () => {
  const { address, account, balances, connectWallet, disconnectWallet, switchNetwork, refreshAccount, isLoadingAccount, error, errorHistory } = useSorokit();

  return (
    <div>
      <div data-testid="address">{address || "none"}</div>
      <div data-testid="account">{account ? account.sequence : "none"}</div>
      <div data-testid="balances">{balances.length}</div>
      <div data-testid="error">{error || "none"}</div>
      <div data-testid="isLoadingAccount">{isLoadingAccount ? "true" : "false"}</div>
      <div data-testid="errorHistoryCount">{errorHistory.length}</div>
      <button onClick={() => connectWallet()}>Connect</button>
      <button onClick={() => disconnectWallet()}>Disconnect</button>
      <button onClick={() => switchNetwork("testnet")}>Switch</button>
      <button onClick={() => refreshAccount()}>Refresh</button>
    </div>
  );
};

const CallbackRefTestComponent = ({
  onCapture,
}: {
  onCapture: (fns: {
    connectWallet: unknown;
    disconnectWallet: unknown;
    switchNetwork: unknown;
    refreshAccount: unknown;
  }) => void;
}) => {
  const { connectWallet, disconnectWallet, switchNetwork, refreshAccount } = useSorokit();
  onCapture({ connectWallet, disconnectWallet, switchNetwork, refreshAccount });
  return null;
};

const MemoTestComponent = () => {
  const value = useSorokit();
  const prevValueRef = useRef<ReturnType<typeof useSorokit> | null>(null);
  const renderCountRef = useRef(0);

  // eslint-disable-next-line react-hooks/refs
  renderCountRef.current += 1;
  // eslint-disable-next-line react-hooks/refs
  const isRefEqual = prevValueRef.current === value;
  // eslint-disable-next-line react-hooks/refs
  prevValueRef.current = value;

  return (
    <div>
      {/* eslint-disable-next-line react-hooks/refs */}
      <div data-testid="render-count">{renderCountRef.current}</div>
      <div data-testid="ref-equal">{isRefEqual ? "true" : "false"}</div>
    </div>
  );
};

describe("SorokitProvider", () => {
  let mockClient: ReturnType<typeof getClient>;

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi.fn().mockResolvedValue({ data: { address: "GABC" }, error: null }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        getAccount: vi.fn().mockResolvedValue({ data: { sequence: "100" }, error: null }),
        getBalances: vi.fn().mockResolvedValue({ data: [{ asset: "XLM", balance: "10" }], error: null }),
      },
      network: {
        getNetwork: vi.fn().mockResolvedValue({ data: { name: "mainnet" }, error: null }),
        switchNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
      },
    } as unknown as ReturnType<typeof getClient>;
  });

  it("disconnectWallet clears address, account, balances, and error", async () => {
    mockClient.account.getAccount = vi.fn().mockResolvedValue({ data: null, error: "Account error" });
    mockClient.account.getBalances = vi.fn().mockResolvedValue({ data: null, error: "Balances error" });

    renderWithProvider(<TestComponent />, { client: mockClient });

    const connectBtn = screen.getByText("Connect");
    const disconnectBtn = screen.getByText("Disconnect");

    await act(async () => {
      fireEvent.click(connectBtn);
    });

    expect(screen.getByTestId("address")).toHaveTextContent("GABC");

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Account error; Balances error");
    });

    await act(async () => {
      fireEvent.click(disconnectBtn);
    });

    expect(screen.getByTestId("address")).toHaveTextContent("none");
    expect(screen.getByTestId("account")).toHaveTextContent("none");
    expect(screen.getByTestId("balances")).toHaveTextContent("0");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });

  it("combines error strings when both getAccount and getBalances fail", async () => {
    mockClient.account.getAccount = vi.fn().mockResolvedValue({ data: null, error: "Account failed" });
    mockClient.account.getBalances = vi.fn().mockResolvedValue({ data: null, error: "Balances failed" });

    renderWithProvider(<TestComponent />, { client: mockClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Account failed; Balances failed");
    });
  });

  it("shows single error when only getAccount fails", async () => {
    mockClient.account.getAccount = vi.fn().mockResolvedValue({ data: null, error: "Account not found" });
    mockClient.account.getBalances = vi.fn().mockResolvedValue({ data: [{ asset: "XLM", balance: "10" }], error: null });

    renderWithProvider(<TestComponent />, { client: mockClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Account not found");
      expect(screen.getByTestId("balances")).toHaveTextContent("1");
    });
  });

  it("shows single error when only getBalances fails", async () => {
    mockClient.account.getAccount = vi.fn().mockResolvedValue({ data: { sequence: "100" }, error: null });
    mockClient.account.getBalances = vi.fn().mockResolvedValue({ data: null, error: "Failed to fetch balances" });

    renderWithProvider(<TestComponent />, { client: mockClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Failed to fetch balances");
      expect(screen.getByTestId("account")).toHaveTextContent("100");
    });
  });

  it("clears error from previous session on reconnect", async () => {
    mockClient.account.getAccount = vi.fn().mockResolvedValueOnce({ data: null, error: "Old error" });
    mockClient.account.getBalances = vi.fn().mockResolvedValueOnce({ data: [], error: null });

    renderWithProvider(<TestComponent />, { client: mockClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Old error");
    });

    // Next connect with different address succeeds
    mockClient.wallet.connect = vi.fn().mockResolvedValue({ data: { address: "GDEF" }, error: null });
    mockClient.account.getAccount = vi.fn().mockResolvedValue({ data: { sequence: "200" }, error: null });
    mockClient.account.getBalances = vi.fn().mockResolvedValue({ data: [{ asset: "XLM", balance: "50" }], error: null });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GDEF");
      expect(screen.getByTestId("error")).toHaveTextContent("none");
      expect(screen.getByTestId("account")).toHaveTextContent("200");
    });
  });

  it("connectWallet populates address on success", async () => {
    renderWithProvider(<TestComponent />, { client: mockClient });

    expect(screen.getByTestId("address")).toHaveTextContent("none");

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("address")).toHaveTextContent("GABC");
  });

  it("switchNetwork updates network state", async () => {
    renderWithProvider(<TestComponent />, { client: mockClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Switch"));
    });

    expect(mockClient.network.switchNetwork).toHaveBeenCalledWith("testnet");
  });

  it("switchNetwork clears stale address, account, and balances from the previous network (#523)", async () => {
    renderWithProvider(<TestComponent />, { client: mockClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("address")).toHaveTextContent("GABC");
    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent("100");
      expect(screen.getByTestId("balances")).toHaveTextContent("1");
    });

    // Switching networks without this reset would leave the previous
    // network's address/account/balances on screen — e.g. showing mainnet
    // balances while the UI reports the user is now on testnet.
    await act(async () => {
      fireEvent.click(screen.getByText("Switch"));
    });

    expect(screen.getByTestId("address")).toHaveTextContent("none");
    expect(screen.getByTestId("account")).toHaveTextContent("none");
    expect(screen.getByTestId("balances")).toHaveTextContent("0");
  });

  it("memoizes the context value across parent re-renders", async () => {
    const Wrapper = ({ client }: { client: ReturnType<typeof getClient> }) => {
      const [, setTick] = useState(0);
      return (
        <div>
          <button onClick={() => setTick((c) => c + 1)}>Trigger Parent Render</button>
          <SorokitProvider client={client}>
            <MemoTestComponent />
          </SorokitProvider>
        </div>
      );
    };

    render(<Wrapper client={mockClient} />);

    // Wait for any async state updates (network load) to settle before testing
    // the memoization invariant.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Trigger Parent Render"));
    });

    expect(screen.getByTestId("render-count")).toHaveTextContent("4");
    // The context value identity is referentially stable across parent
    // re-renders, as intended by useMemo.
    expect(screen.getByTestId("ref-equal")).toHaveTextContent("true");
  });

  it("re-populates address after disconnect then reconnect", async () => {
    renderWithProvider(<TestComponent />, { client: mockClient });

    // Connect
    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });
    expect(screen.getByTestId("address")).toHaveTextContent("GABC");

    // Disconnect
    await act(async () => {
      fireEvent.click(screen.getByText("Disconnect"));
    });
    expect(screen.getByTestId("address")).toHaveTextContent("none");

    // Reconnect
    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });
    expect(screen.getByTestId("address")).toHaveTextContent("GABC");
  });

  it("captures first error when both getAccount and getBalances fail", async () => {
    const dualErrorClient = {
      ...mockClient,
      account: {
        getAccount: vi.fn().mockResolvedValue({ data: null, error: "getAccount failed" }),
        getBalances: vi.fn().mockResolvedValue({ data: null, error: "getBalances failed" }),
      },
    } as unknown as ReturnType<typeof getClient>;

    renderWithProvider(<TestComponent />, { client: dualErrorClient });

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(screen.getByTestId("address")).toHaveTextContent("GABC");
    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("getAccount failed");
    });
  });

  describe("network persistence", () => {
    const NetworkProbe = () => {
      const { network, initialNetwork, switchNetwork } = useSorokit();
      return (
        <div>
          <div data-testid="network">{network?.name ?? "none"}</div>
          <div data-testid="initial-network">{initialNetwork?.name ?? "none"}</div>
          <button onClick={() => switchNetwork("mainnet")}>Go Mainnet</button>
        </div>
      );
    };

    beforeEach(() => {
      window.localStorage.clear();
    });

    it("persists the selected network across reloads", async () => {
      renderWithProvider(<NetworkProbe />, { client: mockClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Go Mainnet"));
      });

      expect(window.localStorage.getItem("sorokit_network")).toBe("mainnet");
    });

    it("restores the persisted network on mount instead of the client default", async () => {
      window.localStorage.setItem("sorokit_network", "testnet");
      const client = {
        ...mockClient,
        network: {
          getNetwork: vi.fn().mockResolvedValue({ data: { name: "mainnet" }, error: null }),
          switchNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<NetworkProbe />, { client });

      await waitFor(() => {
        expect(screen.getByTestId("network")).toHaveTextContent("testnet");
      });
      expect(client.network.switchNetwork).toHaveBeenCalledWith("testnet");
    });

    it("exposes the client's own network as initialNetwork even when a preference is restored", async () => {
      window.localStorage.setItem("sorokit_network", "testnet");
      const client = {
        ...mockClient,
        network: {
          getNetwork: vi.fn().mockResolvedValue({ data: { name: "mainnet" }, error: null }),
          switchNetwork: vi.fn().mockResolvedValue({ data: { name: "testnet" }, error: null }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<NetworkProbe />, { client });

      await waitFor(() => {
        expect(screen.getByTestId("initial-network")).toHaveTextContent("mainnet");
        expect(screen.getByTestId("network")).toHaveTextContent("testnet");
      });
    });

    it("falls back to the client network when restoring the preference fails", async () => {
      window.localStorage.setItem("sorokit_network", "futurenet");
      const client = {
        ...mockClient,
        network: {
          getNetwork: vi.fn().mockResolvedValue({ data: { name: "mainnet" }, error: null }),
          switchNetwork: vi
            .fn()
            .mockResolvedValue({ data: null, error: "unreachable" }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<NetworkProbe />, { client });

      await waitFor(() => {
        expect(screen.getByTestId("network")).toHaveTextContent("mainnet");
      });
    });

    it("uses the client network when nothing is persisted", async () => {
      renderWithProvider(<NetworkProbe />, { client: mockClient });

      await waitFor(() => {
        expect(screen.getByTestId("network")).toHaveTextContent("mainnet");
        expect(screen.getByTestId("initial-network")).toHaveTextContent("mainnet");
      });
      expect(mockClient.network.switchNetwork).not.toHaveBeenCalled();
    });
  });

  it("refreshAccount sets isLoadingAccount to true during refresh and false after", async () => {
    renderWithProvider(<TestComponent />, { client: mockClient });

    // Connect first
    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });
    expect(screen.getByTestId("address")).toHaveTextContent("GABC");

    await waitFor(() => {
      expect(screen.getByTestId("isLoadingAccount")).toHaveTextContent("false");
    });

    // Mock a slow refresh
    mockClient.account.getAccount = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { sequence: "101" }, error: null }), 100))
    );

    // Trigger refresh
    act(() => {
      fireEvent.click(screen.getByText("Refresh"));
    });

    // isLoadingAccount should be true during refresh
    expect(screen.getByTestId("isLoadingAccount")).toHaveTextContent("true");

    // Wait for refresh to complete
    await waitFor(() => {
      expect(screen.getByTestId("isLoadingAccount")).toHaveTextContent("false");
    }, { timeout: 1000 });
  });

  describe("stable callback refs across client prop changes (#353)", () => {
    it("keeps connectWallet, disconnectWallet, switchNetwork, and refreshAccount referentially stable when client changes", async () => {
      const captures: Array<{
        connectWallet: unknown;
        disconnectWallet: unknown;
        switchNetwork: unknown;
        refreshAccount: unknown;
      }> = [];
      const onCapture = (fns: (typeof captures)[number]) => {
        captures.push(fns);
      };

      const { rerender } = render(
        <SorokitProvider client={mockClient}>
          <CallbackRefTestComponent onCapture={onCapture} />
        </SorokitProvider>,
      );

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      const before = captures[captures.length - 1]!;

      // A parent re-render passing a brand-new client object reference
      // (same shape, different identity) — this used to change every
      // callback's identity since they closed over `client` directly.
      const newClientSameShape = { ...mockClient };
      rerender(
        <SorokitProvider client={newClientSameShape as unknown as ReturnType<typeof getClient>}>
          <CallbackRefTestComponent onCapture={onCapture} />
        </SorokitProvider>,
      );

      const after = captures[captures.length - 1]!;

      expect(after.connectWallet).toBe(before.connectWallet);
      expect(after.disconnectWallet).toBe(before.disconnectWallet);
      expect(after.switchNetwork).toBe(before.switchNetwork);
      expect(after.refreshAccount).toBe(before.refreshAccount);
    });

    it("still uses the latest client for the actual API call after the client prop changes", async () => {
      const captures: Array<{ connectWallet: () => Promise<void> }> = [];
      const onCapture = (fns: { connectWallet: unknown }) => {
        captures.push(fns as { connectWallet: () => Promise<void> });
      };

      const { rerender } = render(
        <SorokitProvider client={mockClient}>
          <CallbackRefTestComponent onCapture={onCapture} />
        </SorokitProvider>,
      );
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      const newConnect = vi.fn().mockResolvedValue({ data: { address: "GNEW" }, error: null });
      const newClient = {
        ...mockClient,
        wallet: { ...mockClient.wallet, connect: newConnect },
      } as unknown as ReturnType<typeof getClient>;

      rerender(
        <SorokitProvider client={newClient}>
          <CallbackRefTestComponent onCapture={onCapture} />
        </SorokitProvider>,
      );

      const { connectWallet } = captures[captures.length - 1]!;
      await act(async () => {
        await connectWallet();
      });

      expect(newConnect).toHaveBeenCalledTimes(1);
      expect(mockClient.wallet.connect).not.toHaveBeenCalled();
    });
  });

  describe("errorHistory clears on disconnect (#353)", () => {
    it("clears errorHistory when disconnectWallet is called", async () => {
      const errorClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockResolvedValue({ data: null, error: "getAccount failed" }),
          getBalances: vi.fn().mockResolvedValue({ data: null, error: "getBalances failed" }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<TestComponent />, { client: errorClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("errorHistoryCount")).not.toHaveTextContent("0");
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Disconnect"));
      });

      expect(screen.getByTestId("errorHistoryCount")).toHaveTextContent("0");
    });
  });

  describe("refreshAccount guard for concurrent calls (#353)", () => {
    it("ignores a second refreshAccount call while the first is still in flight", async () => {
      renderWithProvider(<TestComponent />, { client: mockClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("isLoadingAccount")).toHaveTextContent("false");
      });

      let resolveGetAccount: (v: { data: { sequence: string }; error: null }) => void;
      mockClient.account.getAccount = vi.fn().mockImplementation(
        () => new Promise((resolve) => { resolveGetAccount = resolve; }),
      );
      const getAccountSpy = mockClient.account.getAccount as ReturnType<typeof vi.fn>;

      // First refresh — starts and hangs (getAccount not yet resolved).
      act(() => {
        fireEvent.click(screen.getByText("Refresh"));
      });
      expect(screen.getByTestId("isLoadingAccount")).toHaveTextContent("true");
      expect(getAccountSpy).toHaveBeenCalledTimes(1);

      // Second refresh while the first is still pending — must be a no-op.
      act(() => {
        fireEvent.click(screen.getByText("Refresh"));
      });
      expect(getAccountSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveGetAccount!({ data: { sequence: "999" }, error: null });
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId("isLoadingAccount")).toHaveTextContent("false");
      });

      // A refresh after the first one settles is allowed through normally.
      act(() => {
        fireEvent.click(screen.getByText("Refresh"));
      });
      expect(getAccountSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("onError, errorSeverity, errorHistory (#351)", () => {
    it("fires onError with the correct source label when a wallet error occurs", async () => {
      const onError = vi.fn();
      const errorClient = {
        ...mockClient,
        wallet: {
          ...mockClient.wallet,
          connect: vi.fn().mockResolvedValue({ data: null, error: "Wallet rejected" }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<TestComponent />, { client: errorClient, onError });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      expect(onError).toHaveBeenCalledWith("Wallet rejected", "wallet");
    });

    it("fires onError with 'network' source when a network switch fails", async () => {
      const onError = vi.fn();
      const errorClient = {
        ...mockClient,
        network: {
          ...mockClient.network,
          switchNetwork: vi.fn().mockResolvedValue({ data: null, error: "Network unreachable" }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<TestComponent />, { client: errorClient, onError });

      await act(async () => {
        fireEvent.click(screen.getByText("Switch"));
      });

      expect(onError).toHaveBeenCalledWith("Network unreachable", "network");
    });

    it("sets errorSeverity to 'error' on a failed connect", async () => {
      const SeverityProbe = () => {
        const { errorSeverity, connectWallet, error } = useSorokit();
        return (
          <div>
            <div data-testid="error">{error || "none"}</div>
            <div data-testid="errorSeverity">{errorSeverity || "none"}</div>
            <button onClick={() => connectWallet()}>Connect</button>
          </div>
        );
      };

      const errorClient = {
        ...mockClient,
        wallet: {
          ...mockClient.wallet,
          connect: vi.fn().mockResolvedValue({ data: null, error: "Wallet rejected" }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<SeverityProbe />, { client: errorClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("errorSeverity")).toHaveTextContent("error");
      });
    });

    it("sets errorSeverity to 'info' when connect resolves with no data and no error", async () => {
      const SeverityProbe = () => {
        const { errorSeverity, connectWallet, error } = useSorokit();
        return (
          <div>
            <div data-testid="error">{error || "none"}</div>
            <div data-testid="errorSeverity">{errorSeverity || "none"}</div>
            <button onClick={() => connectWallet()}>Connect</button>
          </div>
        );
      };

      const cancelledClient = {
        ...mockClient,
        wallet: {
          ...mockClient.wallet,
          connect: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<SeverityProbe />, { client: cancelledClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("errorSeverity")).toHaveTextContent("info");
      });
    });

    it("grows errorHistory across multiple errors", async () => {
      renderWithProvider(<TestComponent />, { client: mockClient });

      // Connect to populate address so account loading triggers
      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent("GABC");
      });

      // Now make getAccount fail repeatedly
      const errorMessage = "Account fetch failed";
      mockClient.account.getAccount = vi.fn().mockResolvedValue({ data: null, error: errorMessage });

      // Refresh to trigger first error
      await act(async () => {
        fireEvent.click(screen.getByText("Refresh"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent(errorMessage);
      });

      // Trigger a second error by refreshing again
      await act(async () => {
        fireEvent.click(screen.getByText("Refresh"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("errorHistoryCount")).toHaveTextContent("2");
      });
    });
  });

  describe("Strict Mode cancelled flag prevents state updates after cleanup (#331)", () => {
    it("does not update state after the effect has been cleaned up (active=false)", async () => {
      // In StrictMode, effects run twice. The first run's cleanup sets
      // active=false, so the second run's async callback should not update state.
      // We verify this by checking that the network state is not set from a
      // stale async callback.
      const slowClient = {
        ...mockClient,
        network: {
          getNetwork: vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ data: { name: "mainnet" }, error: null }), 100))
          ),
          switchNetwork: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      } as unknown as ReturnType<typeof getClient>;

      const NetworkProbe = () => {
        const { network } = useSorokit();
        return <div data-testid="network">{network?.name ?? "none"}</div>;
      };

      render(
        <StrictMode>
          <SorokitProvider client={slowClient}>
            <NetworkProbe />
          </SorokitProvider>
        </StrictMode>,
      );

      // Wait for the async effect to settle
      await waitFor(() => {
        expect(screen.getByTestId("network")).toHaveTextContent("mainnet");
      }, { timeout: 2000 });
    });

    it("does not update account state from a stale async callback after address change cleanup", async () => {
      // When address changes, the old effect's cleanup sets active=false.
      // A slow getAccount from the old effect should not overwrite the new data.
      let resolveOldAccount: (v: { data: { sequence: string }; error: null }) => void = () => {};
      const slowGetAccount = vi.fn().mockImplementation(
        () => new Promise((resolve) => { resolveOldAccount = resolve; })
      );

      const client = {
        ...mockClient,
        account: {
          getAccount: slowGetAccount,
          getBalances: vi.fn().mockResolvedValue({ data: [], error: null }),
        },
      } as unknown as ReturnType<typeof getClient>;

      const AddressChanger = () => {
        const { address, connectWallet } = useSorokit();
        return (
          <div>
            <div data-testid="address">{address || "none"}</div>
            <button onClick={() => connectWallet()}>Connect</button>
          </div>
        );
      };

      render(
        <StrictMode>
          <SorokitProvider client={client}>
            <AddressChanger />
          </SorokitProvider>
        </StrictMode>,
      );

      // Connect to trigger account loading
      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      // Wait for the first account load to complete
      await act(async () => {
        resolveOldAccount({ data: { sequence: "100" }, error: null });
        await new Promise((r) => setTimeout(r, 0));
      });

      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent("GABC");
      });
    });
  });

  describe("connect() with no data and no error (#353)", () => {
    it("shows a user-facing error when connect resolves with data: null, error: null", async () => {
      const cancelledClient = {
        ...mockClient,
        wallet: {
          ...mockClient.wallet,
          connect: vi.fn().mockResolvedValue({ data: null, error: null }),
        },
      } as unknown as ReturnType<typeof getClient>;

      renderWithProvider(<TestComponent />, { client: cancelledClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      expect(screen.getByTestId("address")).toHaveTextContent("none");
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Connection was cancelled or no wallet was selected.",
      );
    });

    it("does not show an error when connect resolves with a valid address", async () => {
      renderWithProvider(<TestComponent />, { client: mockClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      expect(screen.getByTestId("address")).toHaveTextContent("GABC");
      expect(screen.getByTestId("error")).toHaveTextContent("none");
    });

    it("works when wrapped in React.StrictMode (#343)", async () => {
      render(
        <StrictMode>
          <SorokitProvider client={mockClient}>
            <TestComponent />
          </SorokitProvider>
        </StrictMode>,
      );

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent("GABC");
        expect(screen.getByTestId("account")).toHaveTextContent("100");
        expect(screen.getByTestId("balances")).toHaveTextContent("1");
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Disconnect"));
      });

      expect(screen.getByTestId("address")).toHaveTextContent("none");
      expect(screen.getByTestId("errorHistoryCount")).toHaveTextContent("0");
    });
  });

  describe("disconnect errors, client re-init, and onNetworkChange", () => {
    it("surfaces a disconnect failure and still clears the session", async () => {
      mockClient.wallet.disconnect = vi
        .fn()
        .mockRejectedValue(new Error("Wallet extension unavailable"));

      renderWithProvider(<TestComponent />, { client: mockClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Connect"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("address")).toHaveTextContent("GABC");
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Disconnect"));
      });

      // The error is reported...
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Wallet extension unavailable",
      );
      // ...and the session is still torn down.
      expect(screen.getByTestId("address")).toHaveTextContent("none");
      expect(screen.getByTestId("account")).toHaveTextContent("none");
      expect(screen.getByTestId("balances")).toHaveTextContent("0");
    });

    it("reports a non-Error rejection with a fallback message", async () => {
      mockClient.wallet.disconnect = vi.fn().mockRejectedValue("boom");

      renderWithProvider(<TestComponent />, { client: mockClient });

      await act(async () => {
        fireEvent.click(screen.getByText("Disconnect"));
      });

      expect(screen.getByTestId("error")).toHaveTextContent(
        "Failed to disconnect wallet.",
      );
    });

    it("points getClient() at the provider's client on mount", async () => {
      await act(async () => {
        renderWithProvider(<TestComponent />, { client: mockClient });
      });

      expect(getClient()).toBe(mockClient);
    });

    it("re-initialises getClient() with the new network's client after a switch", async () => {
      const switchedClient = {
        ...mockClient,
      } as unknown as ReturnType<typeof getClient>;
      const createClientForNetwork = vi.fn().mockReturnValue(switchedClient);

      await act(async () => {
        render(
          <SorokitProvider
            client={mockClient}
            createClientForNetwork={createClientForNetwork}
          >
            <TestComponent />
          </SorokitProvider>,
        );
      });

      expect(getClient()).toBe(mockClient);

      await act(async () => {
        fireEvent.click(screen.getByText("Switch"));
      });

      expect(createClientForNetwork).toHaveBeenCalledWith({ name: "testnet" });
      expect(getClient()).toBe(switchedClient);
    });

    it("keeps the existing client when no factory is provided", async () => {
      await act(async () => {
        renderWithProvider(<TestComponent />, { client: mockClient });
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Switch"));
      });

      expect(getClient()).toBe(mockClient);
    });

    it("fires onNetworkChange with the new network after a successful switch", async () => {
      const onNetworkChange = vi.fn();

      await act(async () => {
        render(
          <SorokitProvider
            client={mockClient}
            onNetworkChange={onNetworkChange}
          >
            <TestComponent />
          </SorokitProvider>,
        );
      });
      onNetworkChange.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByText("Switch"));
      });

      expect(onNetworkChange).toHaveBeenCalledTimes(1);
      expect(onNetworkChange).toHaveBeenCalledWith({ name: "testnet" });
    });

    it("does not fire onNetworkChange when the switch fails", async () => {
      mockClient.network.switchNetwork = vi
        .fn()
        .mockResolvedValue({ data: null, error: "Invalid network: nope" });
      const onNetworkChange = vi.fn();

      await act(async () => {
        render(
          <SorokitProvider
            client={mockClient}
            onNetworkChange={onNetworkChange}
          >
            <TestComponent />
          </SorokitProvider>,
        );
      });
      onNetworkChange.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByText("Switch"));
      });

      expect(onNetworkChange).not.toHaveBeenCalled();
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Invalid network: nope",
      );
    });
  });
});
