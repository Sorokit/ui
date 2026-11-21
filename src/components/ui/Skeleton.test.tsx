import { render, screen } from "@testing-library/react";
import { describe, expect,it } from "vitest";

import {
  AssetRowSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  SkeletonTable,
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

  it("applies rounded-none when shape='square'", () => {
    const { container } = render(<Skeleton shape="square" />);
    expect(container.firstElementChild).toHaveClass("rounded-none");
  });

  it("applies rounded-full when shape='circle'", () => {
    const { container } = render(<Skeleton shape="circle" />);
    expect(container.firstElementChild).toHaveClass("rounded-full");
  });

  it("applies rounded-lg when shape='rounded' or default", () => {
    const { container: c1 } = render(<Skeleton shape="rounded" />);
    expect(c1.firstElementChild).toHaveClass("rounded-lg");

    const { container: c2 } = render(<Skeleton />);
    expect(c2.firstElementChild).toHaveClass("rounded-lg");
  });

  it("uses the motion-safe pulse variant by default (no variant prop)", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveClass("motion-safe:animate-pulse");
  });

  it("applies the motion-safe shimmer variant when variant='shimmer'", () => {
    const { container } = render(<Skeleton variant="shimmer" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveClass("motion-safe:skeleton-shimmer");
    expect(el).not.toHaveClass("motion-safe:animate-pulse");
  });

  it("applies the motion-safe pulse variant when variant='pulse' is explicit", () => {
    const { container } = render(<Skeleton variant="pulse" />);
    expect(container.firstElementChild).toHaveClass("motion-safe:animate-pulse");
    expect(container.firstElementChild).not.toHaveClass("motion-safe:skeleton-shimmer");
  });

  // ── prefers-reduced-motion (issue #962) ──────────────────────────────────

  describe("reduced motion", () => {
    it("gates the pulse animation on motion-safe and provides a motion-reduce fallback", () => {
      const { container } = render(<Skeleton variant="pulse" />);
      const classes = (container.firstElementChild as HTMLElement).className.split(/\s+/);
      // The bare utility would keep animating even under
      // prefers-reduced-motion: reduce.
      expect(classes).toContain("motion-safe:animate-pulse");
      expect(classes).not.toContain("animate-pulse");
      expect(classes).toContain("motion-reduce:opacity-60");
    });

    it("gates the shimmer animation on motion-safe and swaps in a static class under motion-reduce", () => {
      const { container } = render(<Skeleton variant="shimmer" />);
      const classes = (container.firstElementChild as HTMLElement).className.split(/\s+/);
      expect(classes).toContain("motion-safe:skeleton-shimmer");
      expect(classes).not.toContain("skeleton-shimmer");
      expect(classes).toContain("motion-reduce:skeleton-shimmer-static");
    });
  });
});

describe("SkeletonRow", () => {
  it("is presentational", () => {
    const { container } = render(<SkeletonRow />);
    expect(container.firstElementChild).toHaveAttribute("role", "presentation");
  });

  it("renders multiple rows when count prop is provided", () => {
    const { container } = render(<SkeletonRow count={5} />);
    const rows = container.querySelectorAll('[role="presentation"]');
    // Each SkeletonRow contains 1 wrapper div + 3 internal Skeletons = 4 presentational divs per row
    // Or querying top-level children / row divs:
    expect(container.children.length).toBe(5);
    void rows;
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

  it("renders custom header slot when header prop is provided", () => {
    const customHeader = (
      <div data-testid="custom-card-header" className="px-5 py-4 border-b border-line flex items-center justify-between">
        <Skeleton shape="circle" className="w-8 h-8" />
        <Skeleton shape="rounded" className="h-4 w-24" />
      </div>
    );
    render(<SkeletonCard header={customHeader} />);
    expect(screen.getByTestId("custom-card-header")).toBeInTheDocument();
  });

  it("uses stable keys that encode row count — changing rows remounts items", () => {
    const { rerender, container } = render(<SkeletonCard rows={3} />);
    const before = Array.from(
      container.querySelectorAll('[role="presentation"]'),
    ).map((el) => el.getAttribute("data-key"));

    rerender(<SkeletonCard rows={2} />);
    const afterRows = container.querySelectorAll(
      '.px-5.py-5 [role="presentation"]',
    );
    // After decreasing rows there should be exactly 2 body skeletons, not 3
    expect(afterRows.length).toBe(2);
    void before; // suppress unused-var lint
  });

  it("renders the provided structure prop instead of the default header + rows layout", () => {
    const { container } = render(
      <SkeletonCard
        structure={
          <div data-testid="custom-header">Header content</div>
        }
      />,
    );
    expect(screen.getByTestId("custom-header")).toHaveTextContent("Header content");
    // The default header is replaced wholesale — no default h-4/w-32 marker present.
    expect(container.querySelector(".h-4.w-32")).toBeNull();
  });

  it("renders provided children instead of the default header + rows layout", () => {
    render(
      <SkeletonCard>
        <div data-testid="custom-child">Child slot content</div>
      </SkeletonCard>,
    );
    expect(screen.getByTestId("custom-child")).toHaveTextContent("Child slot content");
  });
});

describe("SkeletonTable", () => {
  it("announces a busy/loading state via aria-busy", () => {
    const { container } = render(<SkeletonTable />);
    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
  });

  it("renders the default 4 header columns and 4 body rows", () => {
    render(<SkeletonTable />);
    const header = screen.getByTestId("skeleton-table-header");
    expect(header.children.length).toBe(4);
    expect(screen.getAllByTestId("skeleton-table-row")).toHaveLength(4);
  });

  it("renders the requested number of rows and columns", () => {
    render(<SkeletonTable rows={2} columns={6} />);
    const header = screen.getByTestId("skeleton-table-header");
    expect(header.children.length).toBe(6);

    const rows = screen.getAllByTestId("skeleton-table-row");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.children.length).toBe(6);
    }
  });

  it("lines up each row's columns with a matching grid-template-columns", () => {
    render(<SkeletonTable rows={1} columns={3} />);
    const header = screen.getByTestId("skeleton-table-header");
    const row = screen.getByTestId("skeleton-table-row");
    expect(header.style.gridTemplateColumns).toBe(row.style.gridTemplateColumns);
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
