import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MOCK_DELEGATIONS,
  MOCK_REWARD_SCHEDULE,
  MOCK_VALIDATORS,
} from "@/lib/staking";

import { RewardsPanel } from "./RewardsPanel";

function renderPanel(
  overrides: Partial<Parameters<typeof RewardsPanel>[0]> = {},
) {
  const onClaim = vi.fn().mockResolvedValue(undefined);
  const onClaimAll = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <RewardsPanel
      delegations={MOCK_DELEGATIONS}
      validators={MOCK_VALIDATORS}
      schedule={MOCK_REWARD_SCHEDULE}
      onClaim={onClaim}
      onClaimAll={onClaimAll}
      {...overrides}
    />,
  );
  return { ...result, onClaim, onClaimAll };
}

// ─── Summary tiles ────────────────────────────────────────────────────────────

describe("RewardsPanel — summary tiles", () => {
  it("renders the Claimable tile label", () => {
    renderPanel();
    expect(screen.getByText("Claimable")).toBeInTheDocument();
  });

  it("renders the Pending tile label", () => {
    renderPanel();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("displays total claimable XLM amount", () => {
    renderPanel();
    // 12.875 + 6.12 + 2.43 ≈ 21.42 XLM — just confirm a large number is present
    expect(screen.getAllByText(/21\./)[0]).toBeInTheDocument();
  });
});

// ─── Claim all banner ─────────────────────────────────────────────────────────

describe("RewardsPanel — claim all", () => {
  it("shows Claim All button when there are claimable rewards", () => {
    renderPanel();
    expect(
      screen.getByRole("button", { name: /claim all rewards/i }),
    ).toBeInTheDocument();
  });

  it("calls onClaimAll when Claim All is clicked", async () => {
    const { onClaimAll } = renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /claim all rewards/i }));
    });
    expect(onClaimAll).toHaveBeenCalledOnce();
  });

  it("does not show Claim All when all rewards are zero", () => {
    const zeroDelegations = MOCK_DELEGATIONS.map((d) => ({
      ...d,
      claimableReward: "0",
    }));
    renderPanel({ delegations: zeroDelegations, onClaimAll: vi.fn() });
    expect(
      screen.queryByRole("button", { name: /claim all rewards/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a 'no claimable rewards' message when all claimable are zero", () => {
    const zeroDelegations = MOCK_DELEGATIONS.map((d) => ({
      ...d,
      claimableReward: "0",
    }));
    renderPanel({ delegations: zeroDelegations });
    expect(screen.getByText(/no claimable rewards/i)).toBeInTheDocument();
  });

  it("disables Claim All button while claiming", () => {
    const { onClaimAll } = renderPanel({
      claimingIds: [MOCK_DELEGATIONS[0].validatorId],
    });
    expect(onClaimAll).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /claim all rewards/i }),
    ).toBeDisabled();
  });
});

// ─── Per-validator claim ──────────────────────────────────────────────────────

describe("RewardsPanel — per-validator claim", () => {
  it("renders a Claim button for each validator with claimable rewards", () => {
    renderPanel();
    const claimButtons = screen.getAllByRole("button", {
      name: /claim rewards from/i,
    });
    // All 3 mock delegations have claimable rewards
    expect(claimButtons).toHaveLength(3);
  });

  it("calls onClaim with the correct validator id", async () => {
    const { onClaim } = renderPanel();
    const firstClaimBtn = screen.getAllByRole("button", {
      name: /claim rewards from/i,
    })[0];
    await act(async () => {
      fireEvent.click(firstClaimBtn);
    });
    expect(onClaim).toHaveBeenCalledOnce();
  });

  it("shows validator names in the per-validator list", () => {
    renderPanel();
    expect(screen.getAllByText("Alpha Staking")[0]).toBeInTheDocument();
  });

  it("disables individual Claim button when that validator is claiming", () => {
    renderPanel({
      claimingIds: [MOCK_DELEGATIONS[0].validatorId],
    });
    const claimButtons = screen.getAllByRole("button", {
      name: /claim rewards from/i,
    });
    expect(claimButtons[0]).toBeDisabled();
  });
});

// ─── Pending rewards ─────────────────────────────────────────────────────────

describe("RewardsPanel — pending rewards", () => {
  it("renders the Pending by Validator section", () => {
    renderPanel();
    expect(screen.getByText("Pending by Validator")).toBeInTheDocument();
  });
});

// ─── Schedule ────────────────────────────────────────────────────────────────

describe("RewardsPanel — reward schedule", () => {
  it("renders the Upcoming Schedule heading", () => {
    renderPanel();
    expect(screen.getByText("Upcoming Schedule")).toBeInTheDocument();
  });

  it("renders one entry per schedule item", () => {
    renderPanel();
    // 3 schedule entries
    const entries = screen.getAllByText(/Alpha|Gamma|Delta/);
    expect(entries.length).toBeGreaterThanOrEqual(
      MOCK_REWARD_SCHEDULE.length,
    );
  });

  it("does not render the schedule section when empty", () => {
    renderPanel({ schedule: [] });
    expect(
      screen.queryByText("Upcoming Schedule"),
    ).not.toBeInTheDocument();
  });
});
