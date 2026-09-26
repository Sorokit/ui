import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { MOCK_DELEGATIONS, MOCK_VALIDATORS } from "@/lib/staking";

import { StakingDashboard } from "./StakingDashboard";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function mockConnection(isConnected: boolean) {
  vi.mocked(useSorokit).mockReturnValue({
    isConnected,
    isLoadingAccount: false,
    refreshAccount: vi.fn(),
  } as unknown as ReturnType<typeof useSorokit>);
}

describe("StakingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dashboard heading and tabs when connected", () => {
    mockConnection(true);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    expect(screen.getByText("Staking Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Validators/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Delegations/ })).toBeInTheDocument();
  });

  it("switches to the Delegations tab", () => {
    mockConnection(true);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Delegations/ }));
    expect(screen.getByRole("tab", { name: /Delegations/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("clears delegations and shows the connect prompt when disconnected", () => {
    mockConnection(false);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    expect(
      screen.getByText(/Connect your wallet to view validators/i),
    ).toBeInTheDocument();
  });

  it("renders a validator card for every validator in MOCK_VALIDATORS", () => {
    mockConnection(true);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    for (const validator of MOCK_VALIDATORS) {
      expect(screen.getAllByText(validator.name).length).toBeGreaterThan(0);
    }
  });

  it("opens the delegation adjustment form when Delegate is clicked on a validator", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockConnection(true);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    // Alpha Staking already has a delegation, so its CTA reads "Manage".
    fireEvent.click(
      screen.getByRole("button", { name: /manage delegation to alpha staking/i }),
    );

    expect(screen.getByRole("tab", { name: /Delegations/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // handleDelegate keeps the row disabled for 1.5s while it "acts" on it.
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );

    expect(screen.getByLabelText(/amount to add \(xlm\)/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the correct total claimable reward in the Rewards tab", () => {
    mockConnection(true);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Rewards/ }));

    // 12.8750 + 6.1200 + 2.4300 (MOCK_DELEGATIONS claimableReward) = 21.425
    expect(screen.getAllByText("21.425 XLM").length).toBeGreaterThan(0);
  });

  it("clears all claimable rewards after Claim All completes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockConnection(true);
    render(
      <StakingDashboard
        validators={MOCK_VALIDATORS}
        delegations={MOCK_DELEGATIONS}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Rewards/ }));
    fireEvent.click(screen.getByRole("button", { name: /claim all rewards/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(
      screen.getByText(/no claimable rewards at this time/i),
    ).toBeInTheDocument();
    vi.useRealTimers();
  });
});
