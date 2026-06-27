import { render, screen } from "@testing-library/react";
import { describe, expect,it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("does not set live-region attributes by default", () => {
    render(<Badge>Static</Badge>);
    const badge = screen.getByText("Static");
    expect(badge).not.toHaveAttribute("role", "status");
    expect(badge).not.toHaveAttribute("aria-live");
  });

  it("exposes a polite live region when live is set", () => {
    render(<Badge live>Updating</Badge>);
    const badge = screen.getByText("Updating");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAttribute("aria-live", "polite");
  });

  it("hides the status dot from assistive tech", () => {
    const { container } = render(
      <Badge dot live>
        Live
      </Badge>,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).toBeInTheDocument();
  });
});
