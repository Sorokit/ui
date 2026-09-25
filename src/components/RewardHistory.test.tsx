import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  aggregateDailyRewards,
  generateMockRewardHistory,
  MOCK_VALIDATORS,
  REWARD_HISTORY_DAYS,
} from "@/lib/staking";

import { RewardHistory } from "./RewardHistory";

const ALL_EVENTS = generateMockRewardHistory();
const DAILY = aggregateDailyRewards(ALL_EVENTS);

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
    expect(screen.getByText(`Last ${REWARD_HISTORY_DAYS} Days`)).toBeInTheDocument();
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

  it("renders the event table header columns", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /date/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /validator/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /amount/i })).toBeInTheDocument();
  });

  it("renders reward event rows (capped at 50)", () => {
    render(
      <RewardHistory
        dailyRewards={DAILY}
        events={ALL_EVENTS}
        validators={MOCK_VALIDATORS}
      />,
    );
    // Each row has a + amount cell
    const amountCells = screen
      .getAllByText(/^\+/)
      .filter((el) => el.textContent?.includes("XLM"));
    expect(amountCells.length).toBeGreaterThan(0);
    expect(amountCells.length).toBeLessThanOrEqual(50);
  });

  it("shows 'no reward data' message in chart when daily rewards is empty", () => {
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
      screen.getByText(/no reward history in the last/i),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText(DAILY[DAILY.length - 1].date),
    ).toBeInTheDocument();
  });
});
