import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardOverview } from "./DashboardOverview";
import { SorokitProvider } from "@/context/SorokitProvider";
import { getClient, initClient } from "@/lib/client";

describe("DashboardOverview", () => {
  let mockClient: ReturnType<typeof getClient>;

  beforeEach(() => {
    mockClient = {
      wallet: {
        connect: vi
          .fn()
          .mockResolvedValue({ data: { address: "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA" }, error: null }),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      account: {
        getAccount: vi.fn().mockResolvedValue({
          data: { sequence: "123456789" },
          error: null,
        }),
        getBalances: vi.fn().mockResolvedValue({
          data: [
            { asset: "XLM", balance: "1500.5000000", assetType: "native" },
            { asset: "USDC", balance: "500.0000000", assetType: "credit_alphanum4", assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
          ],
          error: null,
        }),
      },
      network: {
        getNetwork: vi.fn().mockResolvedValue({
          data: { name: "testnet" },
          error: null,
        }),
        switchNetwork: vi.fn().mockResolvedValue({
          data: { name: "testnet" },
          error: null,
        }),
      },
    } as unknown as ReturnType<typeof getClient>;

    initClient(mockClient);
  });

  const renderWithProvider = (element: React.ReactElement) => {
    return render(
      <SorokitProvider client={mockClient}>
        {element}
      </SorokitProvider>,
    );
  };

  describe("rendering without connection", () => {
    it("renders quick actions when not connected", () => {
      const mockDisconnectedClient = {
        ...mockClient,
        wallet: {
          connect: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockDisconnectedClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      expect(screen.getByTestId("dashboard-overview")).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Quick actions" })).toBeInTheDocument();
    });

    it("renders all four quick action buttons", () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      expect(screen.getByTestId("quick-action-send")).toBeInTheDocument();
      expect(screen.getByTestId("quick-action-receive")).toBeInTheDocument();
      expect(screen.getByTestId("quick-action-swap")).toBeInTheDocument();
      expect(screen.getByTestId("quick-action-stake")).toBeInTheDocument();
    });

    it("does not display balance summary when not connected", () => {
      const mockDisconnectedClient = {
        ...mockClient,
        wallet: {
          connect: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockDisconnectedClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      expect(screen.queryByTestId("balance-summary")).not.toBeInTheDocument();
    });
  });

  describe("rendering with connection", () => {
    it("displays balance summary after wallet connects", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByTestId("balance-summary")).toBeInTheDocument();
      });
    });

    it("displays XLM balance correctly", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText("XLM Balance")).toBeInTheDocument();
        expect(screen.getByText("1500.5")).toBeInTheDocument();
      });
    });

    it("displays asset count correctly", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText("Assets")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
      });
    });

    it("shows loading skeletons while fetching account data", async () => {
      const mockLoadingClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      data: { sequence: "123456789" },
                      error: null,
                    }),
                  100,
                ),
              ),
          ),
          getBalances: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      data: [
                        { asset: "XLM", balance: "1500.5000000", assetType: "native" },
                      ],
                      error: null,
                    }),
                  100,
                ),
              ),
          ),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockLoadingClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      // Check for skeleton while loading
      expect(screen.getByTestId("balance-summary-skeleton")).toBeInTheDocument();

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByTestId("balance-summary-skeleton")).not.toBeInTheDocument();
        expect(screen.getByText("1500.5")).toBeInTheDocument();
      });
    });

    it("displays recent transactions widget when connected", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        // RecentTransactionsWidget should be rendered within DashboardOverview
        const dashboard = screen.getByTestId("dashboard-overview");
        expect(dashboard).toBeInTheDocument();
      });
    });
  });

  describe("quick action navigation", () => {
    it("calls onNavigate with 'transactions' when Send is clicked", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      const sendBtn = screen.getByTestId("quick-action-send");
      sendBtn.click();

      expect(onNavigate).toHaveBeenCalledWith("transactions");
    });

    it("calls onNavigate with 'wallet' when Receive is clicked", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      const receiveBtn = screen.getByTestId("quick-action-receive");
      receiveBtn.click();

      expect(onNavigate).toHaveBeenCalledWith("wallet");
    });

    it("calls onNavigate with 'soroban' when Swap is clicked", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      const swapBtn = screen.getByTestId("quick-action-swap");
      swapBtn.click();

      expect(onNavigate).toHaveBeenCalledWith("soroban");
    });

    it("calls onNavigate with 'farming' when Stake is clicked", async () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      const stakeBtn = screen.getByTestId("quick-action-stake");
      stakeBtn.click();

      expect(onNavigate).toHaveBeenCalledWith("farming");
    });
  });

  describe("edge cases", () => {
    it("handles zero XLM balance", async () => {
      const mockZeroBalanceClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockResolvedValue({
            data: { sequence: "123456789" },
            error: null,
          }),
          getBalances: vi.fn().mockResolvedValue({
            data: [{ asset: "XLM", balance: "0.0000000", assetType: "native" }],
            error: null,
          }),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockZeroBalanceClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText("XLM Balance")).toBeInTheDocument();
        expect(screen.getByText("0")).toBeInTheDocument();
      });
    });

    it("handles no balances (only native XLM available)", async () => {
      const mockSingleAssetClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockResolvedValue({
            data: { sequence: "123456789" },
            error: null,
          }),
          getBalances: vi.fn().mockResolvedValue({
            data: [{ asset: "XLM", balance: "1000.0000000", assetType: "native" }],
            error: null,
          }),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockSingleAssetClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText("Assets")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
      });
    });

    it("handles account fetch error gracefully", async () => {
      const mockErrorClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockResolvedValue({
            data: null,
            error: "Failed to fetch account",
          }),
          getBalances: vi.fn().mockResolvedValue({
            data: null,
            error: "Failed to fetch balances",
          }),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockErrorClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      // Dashboard should still render quick actions
      await waitFor(() => {
        expect(screen.getByTestId("quick-action-send")).toBeInTheDocument();
      });
    });

    it("handles large balance values correctly", async () => {
      const mockLargeBalanceClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockResolvedValue({
            data: { sequence: "123456789" },
            error: null,
          }),
          getBalances: vi.fn().mockResolvedValue({
            data: [
              { asset: "XLM", balance: "999999999.9999999", assetType: "native" },
            ],
            error: null,
          }),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockLargeBalanceClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText(/999999999/)).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("renders quick actions as a proper group with aria-label", () => {
      const onNavigate = vi.fn();
      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      const group = screen.getByRole("group", { name: "Quick actions" });
      expect(group).toBeInTheDocument();
    });

    it("balance summary has aria-busy attribute while loading", async () => {
      const mockLoadingClient = {
        ...mockClient,
        account: {
          getAccount: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      data: { sequence: "123456789" },
                      error: null,
                    }),
                  50,
                ),
              ),
          ),
          getBalances: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) =>
                setTimeout(
                  () =>
                    resolve({
                      data: [
                        { asset: "XLM", balance: "1500.5000000", assetType: "native" },
                      ],
                      error: null,
                    }),
                  50,
                ),
              ),
          ),
        },
      } as unknown as ReturnType<typeof getClient>;

      initClient(mockLoadingClient);
      const onNavigate = vi.fn();

      renderWithProvider(<DashboardOverview onNavigate={onNavigate} />);

      await waitFor(() => {
        const summary = screen.getByTestId("balance-summary");
        expect(summary).toHaveAttribute("aria-busy", "true");
      });
    });
  });
});
