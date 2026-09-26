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
});
