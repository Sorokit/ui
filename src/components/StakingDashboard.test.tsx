import { fireEvent, render, screen } from "@testing-library/react";
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
});
