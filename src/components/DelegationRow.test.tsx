import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_DELEGATIONS, MOCK_VALIDATORS } from "@/lib/staking";

import { DelegationRow } from "./DelegationRow";

const VALIDATOR = MOCK_VALIDATORS[0]; // Alpha Staking
const DELEGATION = MOCK_DELEGATIONS[0]; // 5000 XLM delegated to ALPHA

const DELEGATION_WITH_UNBONDING = MOCK_DELEGATIONS[2]; // has unbondingAmount
const VALIDATOR_DELTA = MOCK_VALIDATORS[3];

function renderRow(overrides: Partial<Parameters<typeof DelegationRow>[0]> = {}) {
  const onAdjust = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <DelegationRow
      delegation={DELEGATION}
      validator={VALIDATOR}
      availableXlm={10000}
      onAdjust={onAdjust}
      {...overrides}
    />,
  );
  return { ...result, onAdjust };
}

// ─── Display ──────────────────────────────────────────────────────────────────

describe("DelegationRow — display", () => {
  it("renders validator name", () => {
    renderRow();
    expect(screen.getByText("Alpha Staking")).toBeInTheDocument();
  });

  it("renders delegated amount", () => {
    renderRow();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("renders claimable reward", () => {
    renderRow();
    // claimableReward = 12.875
    expect(screen.getByText(/12\./)).toBeInTheDocument();
  });

  it("renders + button for delegating more", () => {
    renderRow();
    expect(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    ).toBeInTheDocument();
  });

  it("renders − button for undelegating", () => {
    renderRow();
    expect(
      screen.getByRole("button", { name: /undelegate from alpha staking/i }),
    ).toBeInTheDocument();
  });

  it("shows unbonding chip when unbondingAmount is set", () => {
    render(
      <DelegationRow
        delegation={DELEGATION_WITH_UNBONDING}
        validator={VALIDATOR_DELTA}
        availableXlm={10000}
      />,
    );
    expect(screen.getByText(/unbonding/i)).toBeInTheDocument();
  });

  it("does not show adjust buttons when onAdjust is not provided", () => {
    render(
      <DelegationRow
        delegation={DELEGATION}
        validator={VALIDATOR}
        availableXlm={10000}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /delegate more/i }),
    ).not.toBeInTheDocument();
  });
});

// ─── Delegate more flow ───────────────────────────────────────────────────────

describe("DelegationRow — delegate more", () => {
  it("opens the adjustment panel when + is clicked", () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    expect(screen.getByText("Delegate more XLM")).toBeInTheDocument();
  });

  it("shows fee estimate in the panel", () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    expect(screen.getByText(/est\. fee/i)).toBeInTheDocument();
  });

  it("shows a hint with available balance", () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    expect(screen.getByText(/available/i)).toBeInTheDocument();
  });

  it("shows confirmation checkbox after entering a valid amount", async () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
  });

  it("submit button is disabled until confirmation is checked", async () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    await waitFor(() => {
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /confirm delegation/i }),
    ).toBeDisabled();
  });

  it("enables submit after checking confirmation", async () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.getByRole("button", { name: /confirm delegation/i }),
    ).not.toBeDisabled();
  });

  it("calls onAdjust with correct args when confirmed", async () => {
    const { onAdjust } = renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "200" } });
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirm delegation/i }));
    });
    expect(onAdjust).toHaveBeenCalledWith(VALIDATOR.id, "delegate", "200");
  });

  it("shows a validation error when amount exceeds balance", async () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "99999" } });
    await waitFor(() => {
      expect(screen.getByText(/insufficient balance/i)).toBeInTheDocument();
    });
  });

  it("closes the panel when cancel is clicked", () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /delegate more to alpha staking/i }),
    );
    expect(screen.getByText("Delegate more XLM")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel adjustment/i }));
    expect(screen.queryByText("Delegate more XLM")).not.toBeInTheDocument();
  });
});

// ─── Undelegate flow ──────────────────────────────────────────────────────────

describe("DelegationRow — undelegate", () => {
  it("opens undelegate panel when − is clicked", () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /undelegate from alpha staking/i }),
    );
    expect(screen.getByText("Undelegate XLM")).toBeInTheDocument();
  });

  it("opens confirmation modal before undelegating and submits on confirm", async () => {
    const { onAdjust } = renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /undelegate from alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));

    // Click confirm in the panel - opens the confirmation modal
    fireEvent.click(
      screen.getByRole("button", { name: /confirm undelegation/i }),
    );

    // Modal is now open
    expect(screen.getByRole("heading", { name: "Confirm Undelegation" })).toBeInTheDocument();
    expect(screen.getByText(/21 days/i)).toBeInTheDocument();
    expect(screen.getByText(/Estimated Network Fee/i)).toBeInTheDocument();
    expect(onAdjust).not.toHaveBeenCalled();

    // Confirm in the modal
    await act(async () => {
      fireEvent.click(screen.getByTestId("modal-confirm-undelegate"));
    });

    expect(onAdjust).toHaveBeenCalledWith(VALIDATOR.id, "undelegate", "100");
  });

  it("does not call onAdjust when undelegation modal is cancelled", async () => {
    const { onAdjust } = renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /undelegate from alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));

    // Open modal
    fireEvent.click(
      screen.getByRole("button", { name: /confirm undelegation/i }),
    );
    expect(screen.getByRole("heading", { name: "Confirm Undelegation" })).toBeInTheDocument();

    // Click Cancel in modal
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onAdjust).not.toHaveBeenCalled();
  });

  it("shows error when undelegating more than delegated", async () => {
    renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /undelegate from alpha staking/i }),
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "99999" } });
    await waitFor(() => {
      expect(screen.getByText(/exceeds delegated amount/i)).toBeInTheDocument();
    });
  });

  it("cleanly removes entries with zero balance", () => {
    const { container } = render(
      <DelegationRow
        delegation={{ ...DELEGATION, amount: "0" }}
        validator={VALIDATOR}
        availableXlm={10000}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ─── Redelegate & keyboard navigation flow ───────────────────────────────────

describe("DelegationRow — redelegate & keyboard navigation", () => {
  it("opens redelegate panel and supports keyboard navigation in validator dropdown", async () => {
    const { onAdjust } = renderRow();
    fireEvent.click(
      screen.getByRole("button", { name: /redelegate from alpha staking/i }),
    );
    expect(screen.getByText("Redelegate XLM to another validator")).toBeInTheDocument();

    const combobox = screen.getByRole("combobox", { name: /select target validator/i });
    expect(combobox).toBeInTheDocument();

    // Open dropdown via ArrowDown key
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(combobox).toHaveAttribute("aria-expanded", "true");

    const listbox = screen.getByRole("listbox", { name: /target validators/i });
    expect(listbox).toBeInTheDocument();

    // Navigate with ArrowDown
    fireEvent.keyDown(combobox, { key: "ArrowDown" });

    // Select using Enter key
    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(combobox).toHaveAttribute("aria-expanded", "false");

    // Enter amount and confirm redelegation
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "50" } });
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("checkbox"));

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /confirm redelegation/i }),
      );
    });

    expect(onAdjust).toHaveBeenCalledWith(
      VALIDATOR.id,
      "redelegate",
      "50",
      expect.any(String),
    );
  });
});

// ─── Submitting state ─────────────────────────────────────────────────────────

describe("DelegationRow — submitting state", () => {
  it("disables adjust buttons when isSubmitting=true", () => {
    renderRow({ isSubmitting: true });
    expect(
      screen.getByRole("button", { name: /delegate more/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /undelegate/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /redelegate/i }),
    ).toBeDisabled();
  });
});
