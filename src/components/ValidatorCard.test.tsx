import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// ─── Uptime for new validators (#689) ─────────────────────────────────────────

describe("ValidatorCard — uptime edge cases", () => {
  it("shows 'New' instead of NaN% when a validator has 0 recorded pings", () => {
    const fresh = {
      ...ALPHA,
      pingCount: 0,
      successfulPings: 0,
      uptimePct: 0 / 0,
    };
    const { container } = render(<ValidatorCard validator={fresh} />);
    expect(container.textContent).not.toMatch(/NaN/);
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("New")).toHaveAttribute(
      "title",
      "No uptime data recorded yet",
    );
  });

  it("never renders NaN% when uptimePct itself is NaN", () => {
    const broken = { ...ALPHA, uptimePct: Number.NaN };
    const { container } = render(<ValidatorCard validator={broken} />);
    expect(container.textContent).not.toMatch(/NaN/);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("derives uptime from ping counts when they are available", () => {
    const counted = {
      ...ALPHA,
      uptimePct: 0,
      pingCount: 200,
      successfulPings: 190,
    };
    render(<ValidatorCard validator={counted} />);
    expect(screen.getByText("95.0%")).toBeInTheDocument();
  });

  it("falls back to uptimePct when ping counts are absent", () => {
    render(<ValidatorCard validator={ALPHA} />);
    expect(screen.getByText(/100\.0%/)).toBeInTheDocument();
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });
});

// ─── Truncation (#689) ────────────────────────────────────────────────────────

describe("ValidatorCard — long text truncation", () => {
  const LONG_NAME =
    "The Extremely Long Validator Name Operated By A Very Verbose Organisation Ltd";
  const LONG_DESCRIPTION =
    "A".repeat(40) +
    " Institutional-grade validator infrastructure spread across many regions, with a very long description that would otherwise push the card well beyond its boundaries.";

  it("truncates the validator name to a single line", () => {
    render(<ValidatorCard validator={{ ...ALPHA, name: LONG_NAME }} />);
    const heading = screen.getByRole("heading", { name: LONG_NAME });
    expect(heading).toHaveClass("truncate", "min-w-0");
    // The heading row must not wrap, or truncate never kicks in.
    expect(heading.parentElement).not.toHaveClass("flex-wrap");
  });

  it("clamps the description to two lines and breaks long words", () => {
    render(
      <ValidatorCard validator={{ ...ALPHA, description: LONG_DESCRIPTION }} />,
    );
    const desc = screen.getByTestId("validator-description");
    expect(desc).toHaveClass("line-clamp-2", "break-words");
  });

  it("keeps the full text in the DOM for assistive technology", () => {
    render(
      <ValidatorCard
        validator={{ ...ALPHA, name: LONG_NAME, description: LONG_DESCRIPTION }}
      />,
    );
    expect(screen.getByRole("heading", { name: LONG_NAME })).toHaveTextContent(
      LONG_NAME,
    );
    expect(screen.getByTestId("validator-description")).toHaveTextContent(
      LONG_DESCRIPTION,
    );
  });

  it("reveals the full description in a tooltip", async () => {
    const user = userEvent.setup();
    render(
      <ValidatorCard validator={{ ...ALPHA, description: LONG_DESCRIPTION }} />,
    );
    await user.hover(screen.getByTestId("validator-description"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(LONG_DESCRIPTION);
  });

  it("reveals the full name in a tooltip", async () => {
    const user = userEvent.setup();
    render(<ValidatorCard validator={{ ...ALPHA, name: LONG_NAME }} />);
    await user.hover(screen.getByRole("heading", { name: LONG_NAME }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(LONG_NAME);
  });

  it("omits the description block when there is no description", () => {
    render(<ValidatorCard validator={{ ...ALPHA, description: undefined }} />);
    expect(
      screen.queryByTestId("validator-description"),
    ).not.toBeInTheDocument();
  });
});

// ─── Inactive / jailed warnings (#689) ────────────────────────────────────────

describe("ValidatorCard — inactive warning", () => {
  const INACTIVE = { ...ALPHA, id: "v-inactive", status: "inactive" as const };

  it("shows no warning for an active validator", () => {
    render(<ValidatorCard validator={ALPHA} onDelegate={vi.fn()} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delegate to alpha staking/i }),
    ).toBeEnabled();
  });

  it("warns and disables delegation for an inactive validator", () => {
    const onDelegate = vi.fn();
    render(<ValidatorCard validator={INACTIVE} onDelegate={onDelegate} />);

    expect(screen.getByRole("note")).toHaveTextContent(/inactive/i);
    expect(screen.getByRole("note")).toHaveTextContent(
      /new delegations are disabled/i,
    );
    // Warning variant, not the muted default grey it used to be.
    expect(screen.getByText("Inactive").closest("span")).not.toHaveClass(
      "text-ink-2",
    );

    const button = screen.getByRole("button", { name: /delegate to/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onDelegate).not.toHaveBeenCalled();
  });

  it("warns and disables delegation for a jailed validator", () => {
    render(<ValidatorCard validator={ZETA} onDelegate={vi.fn()} />);
    expect(screen.getByRole("note")).toHaveTextContent(/jailed/i);
    expect(screen.getByRole("button", { name: /delegate to/i })).toBeDisabled();
  });

  it("links the warning to the delegate button via aria-describedby", () => {
    render(<ValidatorCard validator={INACTIVE} onDelegate={vi.fn()} />);
    const button = screen.getByRole("button", { name: /delegate to/i });
    const note = screen.getByRole("note");
    expect(note.id).toBeTruthy();
    expect(button).toHaveAttribute("aria-describedby", note.id);
    expect(button).toHaveAccessibleDescription(/not earning rewards/i);
  });

  it("still lets existing delegators manage (withdraw) their stake", () => {
    const onDelegate = vi.fn();
    render(
      <ValidatorCard
        validator={INACTIVE}
        delegation={{ ...DELEGATION_ALPHA, validatorId: INACTIVE.id }}
        onDelegate={onDelegate}
      />,
    );
    expect(screen.getByRole("note")).toBeInTheDocument();
    const manage = screen.getByRole("button", { name: /manage delegation/i });
    expect(manage).toBeEnabled();
    fireEvent.click(manage);
    expect(onDelegate).toHaveBeenCalledWith(INACTIVE.id);
  });

  it("shows the warning even without a delegate CTA", () => {
    render(<ValidatorCard validator={INACTIVE} />);
    expect(screen.getByRole("note")).toBeInTheDocument();
  });
});
