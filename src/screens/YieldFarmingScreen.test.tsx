import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { YieldFarmingScreen } from "./YieldFarmingScreen";

describe("YieldFarmingScreen", () => {
  it("renders Yield Farming Screen with positions", () => {
    render(<YieldFarmingScreen />);
    expect(screen.getByText("Yield Farming Positions")).toBeInTheDocument();
    expect(screen.getByTestId("total-rewards")).toBeInTheDocument();
    expect(screen.getAllByTestId("farming-card").length).toBeGreaterThan(0);
  });

  it("handles claiming rewards modal flow", () => {
    render(<YieldFarmingScreen />);

    // Open claim modal
    const claimBtns = screen.getAllByRole("button", { name: "Claim Rewards" });
    fireEvent.click(claimBtns[0]);

    expect(screen.getByTestId("claim-modal")).toBeInTheDocument();
    expect(screen.getByText("Confirm Claim")).toBeInTheDocument();

    // Confirm claim
    const confirmBtn = screen.getByRole("button", { name: "Confirm Claim" });
    fireEvent.click(confirmBtn);

    expect(screen.queryByTestId("claim-modal")).not.toBeInTheDocument();
  });

  it("handles remove liquidity modal flow", () => {
    render(<YieldFarmingScreen />);

    // Open remove modal
    const removeBtns = screen.getAllByRole("button", { name: "Remove Liquidity" });
    fireEvent.click(removeBtns[0]);

    expect(screen.getByTestId("remove-modal")).toBeInTheDocument();

    // Adjust slippage
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "1.5" } });
    expect(screen.getByText("1.5%")).toBeInTheDocument();

    // Confirm withdrawal
    const confirmBtn = screen.getByRole("button", { name: "Confirm Withdrawal" });
    fireEvent.click(confirmBtn);

    expect(screen.queryByTestId("remove-modal")).not.toBeInTheDocument();
  });
});

describe("YieldFarmingScreen staking and unstaking flows (#1067)", () => {
  it("stakes more capital from the form and shows the updated position value", () => {
    render(<YieldFarmingScreen />);

    // First card starts at $1040
    expect(screen.getByText("Value: $1040")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Stake More" })[0]);
    expect(screen.getByTestId("stake-modal")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("stake-input"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Stake" }));

    expect(screen.queryByTestId("stake-modal")).not.toBeInTheDocument();
    expect(screen.getByText("Value: $1540")).toBeInTheDocument();
  });

  it("keeps the stake modal open with an error when the amount is invalid", () => {
    render(<YieldFarmingScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Stake More" })[0]);

    fireEvent.change(screen.getByTestId("stake-input"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Stake" }));

    expect(screen.getByTestId("stake-modal")).toBeInTheDocument();
    expect(screen.getByTestId("stake-error")).toHaveTextContent(
      "Enter a deposit amount greater than zero.",
    );
    // The position is untouched while the error is showing.
    expect(screen.getByText("Value: $1040")).toBeInTheDocument();

    // An empty amount is rejected the same way.
    fireEvent.change(screen.getByTestId("stake-input"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Stake" }));
    expect(screen.getByTestId("stake-error")).toBeInTheDocument();
  });

  it("cancels staking without changing the position", () => {
    render(<YieldFarmingScreen />);

    fireEvent.click(screen.getAllByRole("button", { name: "Stake More" })[0]);
    fireEvent.change(screen.getByTestId("stake-input"), {
      target: { value: "250" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("stake-modal")).not.toBeInTheDocument();
    expect(screen.getByText("Value: $1040")).toBeInTheDocument();
  });

  it("unstaking removes the position and its rewards card", () => {
    render(<YieldFarmingScreen />);

    const before = screen.getAllByTestId("farming-card").length;
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Liquidity" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Withdrawal" }));

    expect(screen.getAllByTestId("farming-card")).toHaveLength(before - 1);
    expect(screen.queryByText("XLM / USDC")).not.toBeInTheDocument();
  });

  it("cancels unstaking without removing the position", () => {
    render(<YieldFarmingScreen />);

    const before = screen.getAllByTestId("farming-card").length;
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Liquidity" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("remove-modal")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("farming-card")).toHaveLength(before);
  });

  it("cancels a claim without clearing the rewards", () => {
    render(<YieldFarmingScreen />);

    const before = screen.getByTestId("total-rewards").textContent;
    fireEvent.click(screen.getAllByRole("button", { name: "Claim Rewards" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByTestId("claim-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("total-rewards").textContent).toBe(before);
  });
});
