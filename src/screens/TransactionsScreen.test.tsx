import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/context/ToastContext";
import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient, Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";

import { TransactionsScreen } from "./TransactionsScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

const getHistoryMock = vi.fn();

function mockClient() {
  getHistoryMock.mockReset();
  getHistoryMock.mockResolvedValue({ data: [], error: null, total: 0 });
  vi.mocked(getClient).mockReturnValue({
    network: {
      getNetwork: vi.fn(),
      switchNetwork: vi.fn(),
      getGasPrice: vi.fn().mockReturnValue(new Promise(() => {})),
    },
    transaction: {
      estimateFee: vi.fn().mockReturnValue(new Promise(() => {})),
      estimateDetailedFee: vi.fn().mockReturnValue(new Promise(() => {})),
      getFeeScenarios: vi.fn(),
      submit: vi.fn().mockReturnValue(new Promise(() => {})),
      getStatus: vi.fn(),
      getHistory: getHistoryMock,
    },
    wallet: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getAddress: vi.fn(),
    },
    account: {
      getAccount: vi.fn(),
      getBalances: vi.fn(),
      getClaimableBalances: vi.fn(),
      claimBalance: vi.fn(),
    },
    soroban: {
      invokeContract: vi.fn(),
      getEvents: vi.fn(),
    },
    nft: {
      getNfts: vi.fn(),
      sendNft: vi.fn(),
      listNftForSale: vi.fn(),
    },
  } as unknown as SorokitClient);
}

// The screen mounts MultiSigTransactionBuilder, which reads the toast context,
// so these renders need the provider the real app supplies.
function renderScreen() {
  return render(
    <ToastProvider>
      <TransactionsScreen />
    </ToastProvider>,
  );
}
describe("TransactionsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
    } as unknown as ReturnType<typeof useSorokit>);
    mockClient();
  });

  it("renders the screen heading", () => {
    renderScreen();
    expect(screen.getByText("Transactions")).toBeInTheDocument();
  });

  it("renders FeeEstimator with its section title", () => {
    renderScreen();
    expect(screen.getByText("Network Fee")).toBeInTheDocument();
  });

  it("renders TransactionPanel with its section title", () => {
    renderScreen();
    expect(screen.getAllByText(/Send (Payment|XLM)/i)[0]).toBeInTheDocument();
  });

  it("renders FeeEstimator above TransactionPanel in the DOM", () => {
    const { container } = renderScreen();

    const allHeadings = Array.from(container.querySelectorAll("h3"));
    const feeHeading = screen.getByText("Network Fee");
    const txHeading = screen.getAllByText(/Send (Payment|XLM)/i).find(
      (el) => el.tagName === "H3",
    );

    const feeIndex = allHeadings.indexOf(feeHeading as HTMLHeadingElement);
    const txIndex = txHeading ? allHeadings.indexOf(txHeading as HTMLHeadingElement) : -1;

    expect(feeIndex).toBeLessThan(txIndex);
  });

  it("renders ActivityTimeline with its section title", () => {
    renderScreen();
    expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
  });

  it("renders ActivityTimeline below TransactionPanel in the DOM", () => {
    const { container } = renderScreen();

    const allHeadings = Array.from(container.querySelectorAll("h3"));
    const feeHeading = screen.getByText("Network Fee");
    const panelHeading = screen.getAllByText(/Send (Payment|XLM)/i).find(
      (el) => el.tagName === "H3",
    );
    const timelineHeading = screen.getByText("Activity Timeline");

    const feeIndex = allHeadings.indexOf(feeHeading as HTMLHeadingElement);
    const panelIndex = panelHeading ? allHeadings.indexOf(panelHeading as HTMLHeadingElement) : -1;
    const timelineIndex = allHeadings.indexOf(timelineHeading as HTMLHeadingElement);

    expect(feeIndex).toBeLessThan(panelIndex);
    expect(panelIndex).toBeLessThan(timelineIndex);
  });

  describe("date range validation", () => {
    it("clamps the end date to the start date when it would precede it", () => {
      renderScreen();

      const startInput = screen.getByLabelText(
        "Export start date",
      ) as HTMLInputElement;
      const endInput = screen.getByLabelText(
        "Export end date",
      ) as HTMLInputElement;

      fireEvent.change(endInput, { target: { value: "2026-01-20" } });
      expect(endInput.value).toBe("2026-01-20");

      // Setting a later start date should pull the end date forward with it.
      fireEvent.change(startInput, { target: { value: "2026-01-25" } });
      expect(startInput.value).toBe("2026-01-25");
      expect(endInput.value).toBe("2026-01-25");
    });

    it("clamps an end date chosen before the current start date", () => {
      renderScreen();

      const startInput = screen.getByLabelText(
        "Export start date",
      ) as HTMLInputElement;
      const endInput = screen.getByLabelText(
        "Export end date",
      ) as HTMLInputElement;

      fireEvent.change(startInput, { target: { value: "2026-02-10" } });
      fireEvent.change(endInput, { target: { value: "2026-01-01" } });

      expect(endInput.value).toBe("2026-02-10");
    });

    it("clamps a future end date to today", () => {
      renderScreen();

      const endInput = screen.getByLabelText(
        "Export end date",
      ) as HTMLInputElement;
      const future = new Date();
      future.setFullYear(future.getFullYear() + 5);
      const futureIso = future.toISOString().slice(0, 10);

      fireEvent.change(endInput, { target: { value: futureIso } });

      expect(endInput.value).not.toBe(futureIso);
      expect(new Date(endInput.value).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("export progress and cancellation", () => {
    function makeTransactions(count: number): Transaction[] {
      return Array.from({ length: count }, (_, i) => ({
        hash: `h${i.toString().padStart(10, "0")}`,
        ledger: 1000 + i,
        createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      })) as Transaction[];
    }

    it("shows a progress modal with percentage and record count for large exports", async () => {
      const total = 600;
      getHistoryMock.mockImplementation(
        (_address: string, page = 1, limit = 200) =>
          new Promise((resolve) => {
            setTimeout(() => {
              const start = (page - 1) * limit;
              const slice = makeTransactions(total).slice(start, start + limit);
              resolve({ data: slice, error: null, total });
            }, 10);
          }),
      );

      renderScreen();
      fireEvent.click(screen.getByText("Export CSV"));

      await waitFor(() => {
        expect(screen.getByText("Exporting transactions…")).toBeInTheDocument();
      });
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText(/of 600 records/)).toBeInTheDocument();
      });
    });

    it("does not show a progress modal for small exports", async () => {
      getHistoryMock.mockResolvedValue({
        data: makeTransactions(5),
        error: null,
        total: 5,
      });

      renderScreen();
      fireEvent.click(screen.getByText("Export CSV"));

      await waitFor(() => {
        expect(getHistoryMock).toHaveBeenCalled();
      });
      expect(screen.queryByText("Exporting transactions…")).not.toBeInTheDocument();
    });

    it("cancels an in-progress export when Cancel is clicked", async () => {
      const total = 1000;
      let resolvePage2: (() => void) | null = null;
      getHistoryMock.mockImplementation(
        (_address: string, page = 1, limit = 200) => {
          if (page === 1) {
            const slice = makeTransactions(total).slice(0, limit);
            return Promise.resolve({ data: slice, error: null, total });
          }
          return new Promise((resolve) => {
            resolvePage2 = () => {
              const start = (page - 1) * limit;
              const slice = makeTransactions(total).slice(start, start + limit);
              resolve({ data: slice, error: null, total });
            };
          });
        },
      );

      renderScreen();
      fireEvent.click(screen.getByText("Export CSV"));

      await waitFor(() => {
        expect(screen.getByText("Exporting transactions…")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Cancel"));
      resolvePage2?.();

      await waitFor(() => {
        expect(screen.getByText("Export cancelled.")).toBeInTheDocument();
      });
      expect(
        screen.queryByText("Exporting transactions…"),
      ).not.toBeInTheDocument();
    });
  });
});
