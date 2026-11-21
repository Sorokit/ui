import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyReward, RewardEvent } from "@/lib/staking";
import {
  aggregateDailyRewards,
  generateMockRewardHistory,
  MOCK_VALIDATORS,
  REWARD_HISTORY_DAYS,
} from "@/lib/staking";

import { generateRewardHistoryCsv, RewardHistory } from "./RewardHistory";

const ALL_EVENTS = generateMockRewardHistory();
const DAILY = aggregateDailyRewards(ALL_EVENTS);

// Mock URL.createObjectURL and URL.revokeObjectURL for DOM CSV export tests
const mockCreateObjectURL = vi.fn(() => "blob:mock-reward-csv");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("RewardHistory — rendering", () => {
  it("renders the summary heading with correct day count", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(
      screen.getByText(`Last ${REWARD_HISTORY_DAYS} Days`),
    ).toBeInTheDocument();
  });

  it("renders the chart with accessible aria label", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(
      screen.getByRole("img", { name: /reward history bar chart/i }),
    ).toBeInTheDocument();
  });

  it("renders the total XLM earned", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    // Total should be a positive number with XLM suffix
    expect(screen.getAllByText(/XLM/)[0]).toBeInTheDocument();
  });

  it("renders the event table header columns including Est. USD", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: /date/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /validator/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /amount/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /est\. usd/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /tx/i }),
    ).toBeInTheDocument();
  });

  it("renders reward event rows capped by pageSize", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    // Default pageSize is 10
    const amountCells = screen
      .getAllByText(/^\+/)
      .filter((el) => el.textContent?.includes("XLM"));
    expect(amountCells.length).toBeGreaterThan(0);
    expect(amountCells.length).toBeLessThanOrEqual(10);
  });

  it("shows validator names in the event table", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    // At least one validator name should appear in the table
    expect(screen.getAllByText("Alpha Staking").length).toBeGreaterThan(0);
  });

  it("shows the date range labels under the chart", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    // First and last date labels exist
    expect(screen.getByText(DAILY[0].date)).toBeInTheDocument();
    expect(screen.getByText(DAILY[DAILY.length - 1].date)).toBeInTheDocument();
  });

  it("renders truncated transaction hashes when present", () => {
    const eventsWithHash: RewardEvent[] = [
      {
        id: "tx-1",
        date: "2026-10-15",
        amount: "1.2500",
        validatorId: "VALIDATOR_ALPHA",
        txHash: "abcdef1234567890fedcba0987654321",
      },
    ];
    render(
      <RewardHistory
        dailyRewards={[{ date: "2026-10-15", totalXlm: 1.25 }]}
        events={eventsWithHash}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(screen.getByText("abcdef…4321")).toBeInTheDocument();
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe("RewardHistory — empty state", () => {
  it("shows 'No reward data' message in chart when daily rewards is empty", () => {
    render(
      <RewardHistory
        dailyRewards={[]}
        events={[]}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(screen.getByText("No reward data")).toBeInTheDocument();
  });

  it("shows 'no reward history' message when events are empty", () => {
    render(
      <RewardHistory
        dailyRewards={[]}
        events={[]}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(
      screen.getByText(`No reward history in the last ${REWARD_HISTORY_DAYS} days.`),
    ).toBeInTheDocument();
  });

  it("displays 0 XLM total and hides reward days badge and CSV button when empty", () => {
    render(
      <RewardHistory
        dailyRewards={[]}
        events={[]}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(screen.getByText("0 XLM")).toBeInTheDocument();
    expect(screen.queryByText(/reward days/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /export csv/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows empty filtered state when date filter excludes all events", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );

    const startInput = screen.getByLabelText("Start date");
    fireEvent.change(startInput, { target: { value: "2099-01-01" } });

    expect(
      screen.getByText("No reward events match the selected date range."),
    ).toBeInTheDocument();
    expect(screen.getByText("No reward data")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeDisabled();
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe("RewardHistory — pagination", () => {
  it("paginates long reward histories without rendering all rows in DOM at once", () => {
    // Generate 250 events to simulate hundreds of daily payouts
    const largeEvents: RewardEvent[] = Array.from({ length: 250 }, (_, i) => ({
      id: `evt-${i}`,
      date: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
      amount: (1 + i * 0.01).toFixed(4),
      validatorId: "VALIDATOR_ALPHA",
    }));

    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={largeEvents}
        validators={MOCK_VALIDATORS}
        pageSize={10}
      />,
    );

    // Only 10 body rows should be rendered in the DOM
    const rows = screen.getAllByRole("row");
    // 1 header row + 10 body rows = 11 rows
    expect(rows).toHaveLength(11);
    expect(screen.getByText("Page 1 of 25")).toBeInTheDocument();
  });

  it("navigates between pages with Next and Prev buttons", () => {
    const customEvents: RewardEvent[] = Array.from({ length: 15 }, (_, i) => ({
      id: `evt-${i}`,
      date: `2026-10-${String(20 - i).padStart(2, "0")}`,
      amount: (10 + i).toFixed(4),
      validatorId: "VALIDATOR_ALPHA",
    }));

    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={customEvents}
        validators={MOCK_VALIDATORS}
        pageSize={10}
      />,
    );

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    const prevBtn = screen.getByRole("button", { name: /prev/i });
    const nextBtn = screen.getByRole("button", { name: /next/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // First page has 10 items (10.0000 to 19.0000)
    expect(screen.getByText("+10.0000 XLM")).toBeInTheDocument();
    expect(screen.queryByText("+20.0000 XLM")).not.toBeInTheDocument();

    // Go to page 2
    fireEvent.click(nextBtn);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // Second page has remaining 5 items (20.0000 to 24.0000)
    expect(screen.getByText("+20.0000 XLM")).toBeInTheDocument();
    expect(screen.queryByText("+10.0000 XLM")).not.toBeInTheDocument();

    // Go back to page 1
    fireEvent.click(prevBtn);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("+10.0000 XLM")).toBeInTheDocument();
  });

  it("hides pagination controls when all events fit on a single page", () => {
    const fewEvents: RewardEvent[] = [
      {
        id: "evt-1",
        date: "2026-10-15",
        amount: "2.5000",
        validatorId: "VALIDATOR_ALPHA",
      },
    ];

    render(
      <RewardHistory
        dailyRewards={[{ date: "2026-10-15", totalXlm: 2.5 }]}
        events={fewEvents}
        validators={MOCK_VALIDATORS}
        pageSize={10}
      />,
    );

    expect(screen.queryByText(/page 1 of/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });
});

// ─── Date filtering ───────────────────────────────────────────────────────────

describe("RewardHistory — date filtering", () => {
  const sampleDaily: DailyReward[] = [
    { date: "2026-10-01", totalXlm: 1.0 },
    { date: "2026-10-05", totalXlm: 2.0 },
    { date: "2026-10-10", totalXlm: 3.0 },
  ];

  const sampleEvents: RewardEvent[] = [
    {
      id: "e1",
      date: "2026-10-01",
      amount: "1.0000",
      validatorId: "VALIDATOR_ALPHA",
    },
    {
      id: "e2",
      date: "2026-10-05",
      amount: "2.0000",
      validatorId: "VALIDATOR_GAMMA",
    },
    {
      id: "e3",
      date: "2026-10-10",
      amount: "3.0000",
      validatorId: "VALIDATOR_DELTA",
    },
  ];

  it("filters events and daily rewards by start date", () => {
    render(
      <RewardHistory
        dailyRewards={sampleDaily}
        events={sampleEvents}
        validators={MOCK_VALIDATORS}
      />,
    );

    const startInput = screen.getByLabelText("Start date");
    fireEvent.change(startInput, { target: { value: "2026-10-05" } });

    expect(screen.queryByText("+1.0000 XLM")).not.toBeInTheDocument();
    expect(screen.getByText("+2.0000 XLM")).toBeInTheDocument();
    expect(screen.getByText("+3.0000 XLM")).toBeInTheDocument();
    expect(screen.getByText("5 XLM")).toBeInTheDocument();
    expect(screen.getByText("2 reward days")).toBeInTheDocument();
  });

  it("filters events and daily rewards by end date", () => {
    render(
      <RewardHistory
        dailyRewards={sampleDaily}
        events={sampleEvents}
        validators={MOCK_VALIDATORS}
      />,
    );

    const endInput = screen.getByLabelText("End date");
    fireEvent.change(endInput, { target: { value: "2026-10-05" } });

    expect(screen.getByText("+1.0000 XLM")).toBeInTheDocument();
    expect(screen.getByText("+2.0000 XLM")).toBeInTheDocument();
    expect(screen.queryByText("+3.0000 XLM")).not.toBeInTheDocument();
    expect(screen.getByText("3 XLM")).toBeInTheDocument();
  });

  it("filters by both start date and end date and clears filters", () => {
    render(
      <RewardHistory
        dailyRewards={sampleDaily}
        events={sampleEvents}
        validators={MOCK_VALIDATORS}
      />,
    );

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-10-04" },
    });
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-10-06" },
    });

    expect(screen.queryByText("+1.0000 XLM")).not.toBeInTheDocument();
    expect(screen.getByText("+2.0000 XLM")).toBeInTheDocument();
    expect(screen.queryByText("+3.0000 XLM")).not.toBeInTheDocument();

    const clearBtn = screen.getByRole("button", { name: /clear date filters/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText("+1.0000 XLM")).toBeInTheDocument();
    expect(screen.getByText("+2.0000 XLM")).toBeInTheDocument();
    expect(screen.getByText("+3.0000 XLM")).toBeInTheDocument();
  });

  it("resets pagination to page 1 when date filter changes", () => {
    const manyEvents: RewardEvent[] = [
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `oct-${i}`,
        date: "2026-10-10",
        amount: "1.0000",
        validatorId: "VALIDATOR_ALPHA",
      })),
      {
        id: "sep-1",
        date: "2026-09-01",
        amount: "5.0000",
        validatorId: "VALIDATOR_GAMMA",
      },
    ];

    render(
      <RewardHistory
        dailyRewards={sampleDaily}
        events={manyEvents}
        validators={MOCK_VALIDATORS}
        pageSize={10}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: "2026-10-01" },
    });

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });
});

// ─── CSV export with historical fiat values ───────────────────────────────────

describe("RewardHistory — CSV export", () => {
  const exportEvents: RewardEvent[] = [
    {
      id: "r1",
      date: "2026-10-15",
      amount: "100.000000",
      validatorId: "VALIDATOR_ALPHA",
      priceUsd: 0.125,
      usdValue: 12.5,
      txHash: "txhash123",
    },
    {
      id: "r2",
      date: "2026-10-14",
      amount: "50.000000",
      validatorId: "VALIDATOR_GAMMA",
      priceUsd: 0.11,
      usdValue: 5.5,
    },
  ];

  it("includes historical fiat value columns in generated CSV", () => {
    const csv = generateRewardHistoryCsv(exportEvents, MOCK_VALIDATORS);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(
      "Date,Validator,Amount (XLM),XLM Price (USD),Estimated Value (USD),Transaction Hash",
    );
    expect(lines[1]).toBe(
      "2026-10-15,Alpha Staking,100.000000,0.1250,12.5000,txhash123",
    );
    expect(lines[2]).toBe(
      "2026-10-14,Gamma Validator,50.000000,0.1100,5.5000,",
    );
  });

  it("calls onExport callback with CSV containing historical USD estimates", () => {
    const onExport = vi.fn();
    render(
      <RewardHistory
        dailyRewards={[{ date: "2026-10-15", totalXlm: 150 }]}
        events={exportEvents}
        validators={MOCK_VALIDATORS}
        onExport={onExport}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(onExport).toHaveBeenCalledTimes(1);

    const csv = onExport.mock.calls[0][0] as string;
    expect(csv).toContain("XLM Price (USD),Estimated Value (USD)");
    expect(csv).toContain("0.1250,12.5000");
    expect(csv).toContain("0.1100,5.5000");
  });

  it("triggers DOM file download when onExport is not provided", () => {
    render(
      <RewardHistory
        dailyRewards={[{ date: "2026-10-15", totalXlm: 150 }]}
        events={exportEvents}
        validators={MOCK_VALIDATORS}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
