import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Skeleton, SkeletonRow, SkeletonCard, AssetRowSkeleton } from "./Skeleton";

describe("Skeleton components accessibility and structure", () => {
  it("Skeleton has role='presentation'", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("role", "presentation");
  });

  it("SkeletonRow has role='presentation'", () => {
    const { container } = render(<SkeletonRow />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("role", "presentation");
  });

  it("AssetRowSkeleton has role='presentation'", () => {
    const { container } = render(<AssetRowSkeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute("role", "presentation");
  });

  it("SkeletonCard has role='status', aria-busy='true', and aria-label='Loading content'", () => {
    render(<SkeletonCard />);
    const el = screen.getByRole("status");
    expect(el).toHaveAttribute("aria-busy", "true");
    expect(el).toHaveAttribute("aria-label", "Loading content");
  });

  it("SkeletonCard accepts custom children override", () => {
    render(
      <SkeletonCard>
        <div data-testid="custom-child">Custom Content</div>
      </SkeletonCard>
    );
    expect(screen.getByTestId("custom-child")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading content");
    // Default header should not render
    expect(screen.queryByText("Stellar account details")).not.toBeInTheDocument();
  });

  it("SkeletonCard accepts custom structure override", () => {
    render(
      <SkeletonCard structure={<div data-testid="custom-structure">Custom Structure</div>} />
    );
    expect(screen.getByTestId("custom-structure")).toBeInTheDocument();
  });
});
