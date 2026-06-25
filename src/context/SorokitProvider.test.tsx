import { screen, act, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSorokit } from "./useSorokit";
import { getClient } from "@/lib/client";
import { renderWithProvider } from "@/__tests__/utils";

const TestComponent = () => {
  const { address, account, balances, connectWallet, disconnectWallet, switchNetwork } = useSorokit();
  
  return (
    <div>
      <div data-testid="address">{address || "none"}</div>
      <div data-testid="account">{account ? account.sequence : "none"}</div>
      <div data-testid="balances">{balances.length}</div>
      <button onClick={() => connectWallet()}>Connect</button>
      <button onClick={() => disconnectWallet()}>Disconnect</button>
      <button onClick={() => switchNetwork("testnet")}>Switch</button>
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

  it("disconnectWallet clears address, account, and balances", async () => {
    renderWithProvider(<TestComponent />, { client: mockClient });

    // Initial load will hit getNetwork
    const connectBtn = screen.getByText("Connect");
    const disconnectBtn = screen.getByText("Disconnect");

    await act(async () => {
      fireEvent.click(connectBtn);
    });

    expect(screen.getByTestId("address")).toHaveTextContent("GABC");
    
    await waitFor(() => {
      expect(screen.getByTestId("account")).toHaveTextContent("100");
      expect(screen.getByTestId("balances")).toHaveTextContent("1");
    });

    await act(async () => {
      fireEvent.click(disconnectBtn);
    });

    expect(screen.getByTestId("address")).toHaveTextContent("none");
    expect(screen.getByTestId("account")).toHaveTextContent("none");
    expect(screen.getByTestId("balances")).toHaveTextContent("0");
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
});
