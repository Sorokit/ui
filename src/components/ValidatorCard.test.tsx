import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MOCK_DELEGATIONS, MOCK_VALIDATORS } from "@/lib/staking";

import { ValidatorCard } from "./ValidatorCard";

const ALPHA = MOCK_VALIDATORS[0]; // active, rank 1
const ZETA = MOCK_VALIDATORS[5];  // jailed
const DELEGATION_ALPHA = MOCK_DELEGATIONS[0]; // delegating to ALPHA

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("ValidatorCard — rendering", () => {
  it("renders the validator name", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText("Alpha Staking")).toBeInTheDocument();
  });

  it("renders rank", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText(/rank #1/i)).toBeInTheDocument();
  });

  it("renders Active badge for an active validator", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders Jailed badge for a jailed validator", () => {
    render(<ValidatorCard validator={ZETA} />);
    expect(screen.getByText("Jailed")).toBeInTheDocument();
  });

  it("renders APY metric", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText("8.4%")).toBeInTheDocument();
  });

  it("renders commission metric", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText("5.0%")).toBeInTheDocument();
  });

  it("renders uptime metric", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText(/100\.0%/i)).toBeInTheDocument();
  });

  it("renders delegator count", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText("842")).toBeInTheDocument();
  });

  it("renders a Delegate button when onDelegate is provided", () => {
    render(<ValidatorCard validator={ALPHA} onDelegate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /delegate to alpha staking/i }),
    ).toBeInTheDocument();
  });

  it("does not render a button when onDelegate is not provided", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders Manage button when user has an active delegation", () => {
    render(
      <ValidatorCard
        validator={ALPHA}
        delegation={DELEGATION_ALPHA}
        onDelegate={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: /manage delegation to alpha staking/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows the delegation amount when user is delegating", () => {
    render(
      <ValidatorCard
        validator={ALPHA}
        delegation={DELEGATION_ALPHA}
        onDelegate={vi.fn()}
      />,
    );
    // 5000 XLM formatted
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });

  it("shows claimable reward when delegating", () => {
    render(
      <ValidatorCard
        validator={ALPHA}
        delegation={DELEGATION_ALPHA}
        onDelegate={vi.fn()}
      />,
    );
    expect(screen.getByText(/claimable/i)).toBeInTheDocument();
  });

  it("shows 'Delegating' badge when user has an active delegation", () => {
    render(
      <ValidatorCard
        validator={ALPHA}
        delegation={DELEGATION_ALPHA}
        onDelegate={vi.fn()}
      />,
    );
    expect(screen.getByText("Delegating")).toBeInTheDocument();
  });

  it("shows website link when provided", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(
      screen.getByRole("link", { name: /alpha staking website/i }),
    ).toBeInTheDocument();
  });

  it("renders the validator article with accessible label", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(
      screen.getByRole("article", { name: /validator alpha staking/i }),
    ).toBeInTheDocument();
  });
});

// ─── Interactions ─────────────────────────────────────────────────────────────

describe("ValidatorCard — interactions", () => {
  it("calls onDelegate with the validator id when Delegate is clicked", () => {
    const onDelegate = vi.fn();
    render(<ValidatorCard validator={ALPHA} onDelegate={onDelegate} />);
    fireEvent.click(
      screen.getByRole("button", { name: /delegate to alpha staking/i }),
    );
    expect(onDelegate).toHaveBeenCalledOnce();
    expect(onDelegate).toHaveBeenCalledWith(ALPHA.id);
  });

  it("disables the Delegate button for a jailed validator", () => {
    render(<ValidatorCard validator={ZETA} onDelegate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /delegate to/i })).toBeDisabled();
  });

  it("shows loading state when isActing=true", () => {
    const { container } = render(
      <ValidatorCard validator={ALPHA} onDelegate={vi.fn()} isActing />,
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

// ─── Logo / avatar ────────────────────────────────────────────────────────────

describe("ValidatorCard — avatar", () => {
  it("renders an img when logoUrl is provided", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByAltText("Alpha Staking logo")).toBeInTheDocument();
  });

  it("renders initials fallback when no logoUrl", () => {
    const noLogo = { ...ALPHA, logoUrl: undefined, name: "Gamma Validator" };
    render(<ValidatorCard validator={noLogo} />);
    // Initials: GV
    expect(screen.getByText("GV")).toBeInTheDocument();
  });
});
