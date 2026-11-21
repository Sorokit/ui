import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Separator } from "./Separator";

describe("Separator", () => {
  it("renders with role=separator by default", () => {
    const { container } = render(<Separator />);
    expect(container.firstElementChild).toHaveAttribute("role", "separator");
  });

  it("renders a vertical orientation as a 1px full-height column and exposes aria-orientation=vertical", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("role", "separator");
    expect(root).toHaveAttribute("aria-orientation", "vertical");
    expect(root).toHaveClass("w-px");
    expect(root).toHaveClass("h-full");
  });

  it("renders the supplied label between the two horizontal lines", () => {
    render(<Separator label="OR" />);
    expect(screen.getByText("OR")).toBeInTheDocument();
  });

  it("does not render the label container when label is omitted", () => {
    const { container } = render(<Separator />);
    // The unlabeled horizontal path renders only the line itself.
    const root = container.firstElementChild as HTMLElement;
    expect(root.querySelector("span")).toBeNull();
    expect(root).toHaveClass("h-px");
    expect(root).toHaveClass("bg-line");
  });

  it("applies the matching my-* spacing class for each spacing level", () => {
    const { container: sm } = render(<Separator spacing="sm" />);
    expect((sm.firstElementChild as HTMLElement).className).toContain("my-2");

    const { container: md } = render(<Separator spacing="md" />);
    expect((md.firstElementChild as HTMLElement).className).toContain("my-4");

    const { container: lg } = render(<Separator spacing="lg" />);
    expect((lg.firstElementChild as HTMLElement).className).toContain("my-6");
  });

  it("forwarded className lands on the rendered element", () => {
    const { container } = render(<Separator className="extra-class" />);
    expect(container.firstElementChild).toHaveClass("extra-class");
  });

  it("exposes aria-orientation=horizontal on the unlabeled divider (#549)", () => {
    const { container } = render(<Separator />);
    expect(container.firstElementChild).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });

  it("exposes aria-orientation=horizontal on the labelled divider (#549)", () => {
    const { container } = render(<Separator label="OR" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("role", "separator");
    expect(root).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("draws its lines with the semantic line token, never a hex value (#549)", () => {
    const { container } = render(<Separator label="OR" />);
    const markup = container.innerHTML;

    expect(markup).toContain("bg-line");
    expect(markup).not.toMatch(/bg-\[#/);
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  // ── Flex-container height collapse (issue #963) ──────────────────────────

  it("applies self-stretch and min-h-full so a vertical separator keeps its height in a stretch flex container", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("self-stretch");
    expect(root).toHaveClass("min-h-full");
  });

  // ── Decorative / semantic role (issue #963) ──────────────────────────────

  it("exposes role=separator and aria-orientation by default (non-decorative)", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("role", "separator");
    expect(root).toHaveAttribute("aria-orientation", "vertical");
    expect(root).not.toHaveAttribute("aria-hidden");
  });

  it("hides a decorative horizontal separator from the accessibility tree", () => {
    const { container } = render(<Separator decorative />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("role", "none");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).not.toHaveAttribute("aria-orientation");
  });

  it("hides a decorative vertical separator from the accessibility tree while keeping its layout classes", () => {
    const { container } = render(<Separator decorative orientation="vertical" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("role", "none");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveClass("self-stretch");
  });

  it("hides a decorative labelled separator from the accessibility tree", () => {
    const { container } = render(<Separator decorative label="OR" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("role", "none");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("OR")).toBeInTheDocument();
  });
});
