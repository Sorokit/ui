import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepBreadcrumb } from "./StepBreadcrumb";

const steps = [
  { id: "signers", label: "Signers" },
  { id: "threshold", label: "Threshold" },
  { id: "xdr", label: "XDR" },
];

describe("StepBreadcrumb", () => {
  it("shows every step and marks the current one", () => {
    render(<StepBreadcrumb steps={steps} currentIndex={1} />);
    expect(screen.getByText("Step 1: Signers")).toBeInTheDocument();
    expect(screen.getByText("Step 2: Threshold")).toBeInTheDocument();
    expect(screen.getByText("Step 3: XDR")).toBeInTheDocument();
    expect(screen.getByText("Step 2: Threshold").closest("[aria-current]")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("Step 2 of 3: Threshold")).toBeInTheDocument();
  });

  it("lets users go back to completed steps only", () => {
    const onStepClick = vi.fn();
    render(<StepBreadcrumb steps={steps} currentIndex={2} onStepClick={onStepClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Step 1: Signers/ }));
    expect(onStepClick).toHaveBeenCalledWith(0);
    expect(screen.getAllByRole("button")).toHaveLength(2); // steps 1 and 2 only
  });

  it("is display-only without onStepClick", () => {
    render(<StepBreadcrumb steps={steps} currentIndex={2} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
