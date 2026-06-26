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
import {
  Skeleton,
  SkeletonRow,
  SkeletonCard,
  AssetRowSkeleton,
} from "./Skeleton";

describe("Skeleton", () => {
  it("marks the placeholder as presentational for assistive tech", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("role", "presentation");
  });

  it("applies a circle radius when the circle prop is set", () => {
    const { container } = render(<Skeleton circle />);
    expect(container.firstElementChild).toHaveClass("rounded-full");
  });
});

describe("SkeletonRow", () => {
  it("is presentational", () => {
    const { container } = render(<SkeletonRow />);
    expect(container.firstElementChild).toHaveAttribute("role", "presentation");
  });
});

describe("SkeletonCard", () => {
  it("announces a busy/loading state via aria-busy", () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("renders the requested number of body rows", () => {
    const { container } = render(<SkeletonCard rows={5} />);
    // header has 2 skeletons; body has `rows`; all carry role=presentation
    const placeholders = container.querySelectorAll('[role="presentation"]');
    expect(placeholders.length).toBe(2 + 5);
  });
});

describe("AssetRowSkeleton", () => {
  it("is presentational", () => {
    const { container } = render(<AssetRowSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("role", "presentation");
  });

  it("renders a right-side amount placeholder", () => {
    render(<AssetRowSkeleton />);
    expect(screen.getByTestId("asset-amount-skeleton")).toBeInTheDocument();
  });

  it("lays out left content and right amount with space-between", () => {
    const { container } = render(<AssetRowSkeleton />);
    expect(container.firstElementChild).toHaveClass("justify-between");
  });
});
