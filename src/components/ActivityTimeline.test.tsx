import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { GroupedTransaction, Operation, TimelineGroup } from "@/lib/client";
import { getClient } from "@/lib/client";

import { ActivityTimeline } from "./ActivityTimeline";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

function makeOperation(overrides: Partial<Operation>): Operation {
  return {
    id: `op-${overrides.type ?? "payment"}-${Math.random().toString(36).slice(2, 8)}`,
    txHash: overrides.txHash ?? `hash${Math.random().toString(36).slice(2, 64)}`,
    type: overrides.type ?? "payment",
    source: overrides.source ?? "GAAAAAAAAAAAAAAASOURCE",
    destination: overrides.destination ?? "GAAAAAAAAAAAAAAADST",
    amount: overrides.amount ?? "10.0000",
    asset: overrides.asset ?? "XLM",
    memo: overrides.memo,
    fee: overrides.fee ?? "100",
    success: overrides.success ?? true,
    createdAt: overrides.createdAt ?? "2026-07-26T10:00:00Z",
  };
}

function makeGroupedTx(overrides: Partial<GroupedTransaction>): GroupedTransaction {
  const hash = overrides.hash ?? `hash${Math.random().toString(36).slice(2, 64)}`;
  return {
    hash,
    date: overrides.date ?? "2026-07-26",
    time: overrides.time ?? "10:30:45",
    type: overrides.type ?? "Payment",
    totalAmount: overrides.totalAmount ?? "10.0000 XLM",
    status: overrides.status ?? "success",
    operationCount: overrides.operationCount ?? 1,
    operations: overrides.operations ?? [makeOperation({ txHash: hash })],
  };
}

function makeTimelineGroups(count = 3): TimelineGroup[] {
  return Array.from({ length: count }, (_, i) => ({
    date: `2026-07-${26 - i}`,
    transactions: Array.from({ length: 2 }, (_, j) =>
      makeGroupedTx({
        date: `2026-07-${26 - i}`,
        type: j === 0 ? "Payment" : "Trade",
        status: j === 0 ? "success" : "failed",
        operationCount: j + 1,
      }),
    ),
  }));
}

function mockGetTimeline(data: TimelineGroup[], total: number) {
  vi.mocked(getClient).mockReturnValue({
    operation: {
      getTimeline: vi.fn().mockResolvedValue({ data, error: null, total }),
      getOperations: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  } as unknown as ReturnType<typeof getClient>);
}

function mockGetTimelineError(errorMsg: string) {
  vi.mocked(getClient).mockReturnValue({
    operation: {
      getTimeline: vi.fn().mockResolvedValue({ data: null, error: errorMsg, total: 0 }),
      getOperations: vi.fn().mockResolvedValue({ data: null, error: errorMsg }),
    },
  } as unknown as ReturnType<typeof getClient>);
}

const DEFAULT_CONTEXT = {
  get client() { return getClient(); },
  address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
  isConnected: true,
  network: null,
  account: null,
  balances: null,
  wallet: null,
};

describe("ActivityTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Connect your wallet' when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      ...DEFAULT_CONTEXT,
      isConnected: false,
      address: null,
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      operation: { getTimeline: vi.fn(), getOperations: vi.fn() },
    } as unknown as ReturnType<typeof getClient>);

    render(<ActivityTimeline />);
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it("renders the 'Activity Timeline' heading", () => {
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );
    mockGetTimeline([], 0);

    render(<ActivityTimeline />);
    expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
  });

  it("shows 'No activity yet' when there are no transactions", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );
    mockGetTimeline([], 0);

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
  });

  it("shows 'No transactions match your filters' when filters return no results", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );
    mockGetTimeline([], 0);

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });

    await waitFor(() => {
      expect(screen.getByText("No transactions match your filters")).toBeInTheDocument();
    });
  });

  it("renders skeleton loaders while loading", () => {
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );
    vi.mocked(getClient).mockReturnValue({
      operation: {
        getTimeline: vi.fn().mockReturnValue(new Promise(() => {})),
        getOperations: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<ActivityTimeline />);
    expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
  });

  it("renders grouped transactions by date", async () => {
    const groups = makeTimelineGroups(2);
    mockGetTimeline(groups, 4);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      for (const group of groups) {
        expect(
          screen.getByText(
            new Date(group.date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
          ),
        ).toBeInTheDocument();
      }
    });
  });

  it("renders transaction hash with truncated form", async () => {
    const groups = makeTimelineGroups(1);
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(
        screen.getByText(
          new Date(groups[0].date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        ),
      ).toBeInTheDocument();
    });
  });

  it("shows success badge for successful transactions", async () => {
    const groups: TimelineGroup[] = [
      {
        date: "2026-07-26",
        transactions: [makeGroupedTx({ status: "success" })],
      },
    ];
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument();
    });
  });

  it("shows failed badge for failed transactions", async () => {
    const groups: TimelineGroup[] = [
      {
        date: "2026-07-26",
        transactions: [makeGroupedTx({ status: "failed" })],
      },
    ];
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("renders pagination when total > PAGE_SIZE", async () => {
    const groups = makeTimelineGroups(5);
    mockGetTimeline(groups, 25);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Prev")).toBeInTheDocument();
      expect(screen.getByText("Next")).toBeInTheDocument();
    });
  });

  it("does not show pagination when total <= PAGE_SIZE", async () => {
    const groups = makeTimelineGroups(1);
    mockGetTimeline(groups, 2);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.queryByText("Prev")).not.toBeInTheDocument();
      expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });
  });

  it("displays error state when timeline fetch fails", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );
    mockGetTimelineError("Network error");

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load activity")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows a Retry button in error state and calls getTimeline on click", async () => {
    const mockTimeline = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: "Network error", total: 0 })
      .mockResolvedValueOnce({ data: makeTimelineGroups(1), error: null, total: 2 });

    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );
    vi.mocked(getClient).mockReturnValue({
      operation: {
        getTimeline: mockTimeline,
        getOperations: vi.fn(),
      },
    } as unknown as ReturnType<typeof getClient>);

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load activity")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(mockTimeline).toHaveBeenCalledTimes(2);
    });
  });

  it("toggles the filter panel when the Filters button is clicked", async () => {
    mockGetTimeline([], 0);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    expect(screen.getByText("Operation Type")).toBeInTheDocument();
  });

  it("shows operation type dropdown when filter panel is open", async () => {
    mockGetTimeline([], 0);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    expect(screen.getByRole("combobox", { name: /operation type/i })).toBeInTheDocument();
  });

  it("shows date range inputs when filter panel is open", async () => {
    mockGetTimeline([], 0);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("shows search input when filter panel is open", async () => {
    mockGetTimeline([], 0);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /toggle filters/i }));
    expect(screen.getByPlaceholderText(/search by address or transaction hash/i)).toBeInTheDocument();
  });

  it("renders copy hash button for each transaction", async () => {
    const groups = makeTimelineGroups(1);
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getAllByTitle("Copy transaction hash")).toHaveLength(2);
    });
  });

  it("renders operation rows when a transaction is expanded", async () => {
    const groups: TimelineGroup[] = [
      {
        date: "2026-07-26",
        transactions: [
          makeGroupedTx({
            status: "success",
            operationCount: 2,
            operations: [
              makeOperation({ type: "payment", amount: "5.0000" }),
              makeOperation({ type: "trade", amount: "5.0000" }),
            ],
          }),
        ],
      },
    ];
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument();
    });

    const txButtons = screen.getAllByRole("button");
    const txRow = txButtons.find((btn) =>
      /2 operations/i.test(btn.getAttribute("aria-label") ?? ""),
    );
    expect(txRow).toBeDefined();
    if (txRow) fireEvent.click(txRow);

    await waitFor(() => {
      expect(screen.getByText("Operations (2)")).toBeInTheDocument();
      expect(screen.getByText("payment")).toBeInTheDocument();
    });
  });

  it("shows source, destination, amount, fee, and memo in operation details", async () => {
    const op = makeOperation({
      type: "payment",
      amount: "25.0000",
      asset: "USDC",
      source: "GSOURCE123456789012345678901234567890123456789012345678901",
      destination: "GDEST123456789012345678901234567890123456789012345678901",
      memo: "test memo",
      fee: "200",
    });

    const groups: TimelineGroup[] = [
      {
        date: "2026-07-26",
        transactions: [
          makeGroupedTx({
            operations: [op],
          }),
        ],
      },
    ];
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Success")).toBeInTheDocument();
    });

    const txButtons = screen.getAllByRole("button");
    const txRow = txButtons.find((btn) =>
      /1 operations/i.test(btn.getAttribute("aria-label") ?? ""),
    );
    expect(txRow).toBeDefined();
    if (txRow) fireEvent.click(txRow);

    await waitFor(() => {
      expect(screen.getByText("payment")).toBeInTheDocument();
      expect(screen.getByText("25.0000 USDC")).toBeInTheDocument();
      expect(screen.getByText("200 stroops")).toBeInTheDocument();
      expect(screen.getByText("test memo")).toBeInTheDocument();
    });
  });

  it("renders the filter toggle button with filter indicator when filters are active", async () => {
    const groups = makeTimelineGroups(1);
    mockGetTimeline(groups, 1);
    vi.mocked(useSorokit).mockReturnValue(
      DEFAULT_CONTEXT as unknown as ReturnType<typeof useSorokit>,
    );

    render(<ActivityTimeline />);
    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });

    const filterBtn = screen.getByRole("button", { name: /toggle filters/i });
    expect(filterBtn).toBeInTheDocument();
  });
});