import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  computeTooltipPosition,
  PieChart,
  type PieSlice,
  SLICE_COLORS,
} from "./PieChart";

describe("PieChart", () => {
  const sampleSlices: PieSlice[] = [
    { key: "xlm", label: "Stellar Lumens", value: 60, color: "#5645D4" },
    { key: "usdc", label: "USD Coin", value: 30, color: "#14B8A6" },
    { key: "aqua", label: "Aqua", value: 10, color: "#22C55E" },
  ];

  describe("empty or zero-value datasets", () => {
    it("renders empty circle placeholder and no NaN path when slices array is empty", () => {
      const { container } = render(<PieChart slices={[]} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
      const circle = container.querySelector("circle");
      expect(circle).toBeInTheDocument();
      expect(container.querySelectorAll("path")).toHaveLength(0);

      // Verify no NaN in the SVG markup
      expect(container.innerHTML).not.toContain("NaN");
    });

    it("renders empty state without NaN when all slice values are 0", () => {
      const zeroSlices: PieSlice[] = [
        { key: "a", label: "Asset A", value: 0 },
        { key: "b", label: "Asset B", value: 0 },
      ];

      const { container } = render(<PieChart slices={zeroSlices} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
      const circle = container.querySelector("circle");
      expect(circle).toBeInTheDocument();
      expect(container.querySelectorAll("path")).toHaveLength(0);

      // Verify no NaN path generated
      expect(container.innerHTML).not.toContain("NaN");
    });

    it("renders centerLabel in empty state when provided", () => {
      render(
        <PieChart
          slices={[]}
          centerLabel={<span data-testid="empty-center">0 Assets</span>}
        />,
      );

      expect(screen.getByTestId("empty-center")).toHaveTextContent("0 Assets");
    });

    it("uses default empty aria-label or custom ariaLabel in empty state", () => {
      const { rerender } = render(<PieChart slices={[]} />);
      expect(
        screen.getByRole("img", { name: "Empty portfolio chart" }),
      ).toBeInTheDocument();

      rerender(<PieChart slices={[]} ariaLabel="Custom empty label" />);
      expect(
        screen.getByRole("img", { name: "Custom empty label" }),
      ).toBeInTheDocument();
    });
  });

  describe("rendering slices and legend", () => {
    it("renders slice paths with corresponding percentages and colors", () => {
      const { container } = render(<PieChart slices={sampleSlices} />);

      const paths = container.querySelectorAll("path");
      expect(paths).toHaveLength(3);

      // Verify fill colors
      expect(paths[0]).toHaveAttribute("fill", "#5645D4");
      expect(paths[1]).toHaveAttribute("fill", "#14B8A6");
      expect(paths[2]).toHaveAttribute("fill", "#22C55E");

      // Verify path strings are valid non-empty and have no NaN
      paths.forEach((path) => {
        const d = path.getAttribute("d");
        expect(d).toBeTruthy();
        expect(d).not.toContain("NaN");
      });

      // Verify legend contains labels and computed percentages
      expect(screen.getByText("Stellar Lumens")).toBeInTheDocument();
      expect(screen.getByText("60.0%")).toBeInTheDocument();
      expect(screen.getByText("USD Coin")).toBeInTheDocument();
      expect(screen.getByText("30.0%")).toBeInTheDocument();
      expect(screen.getByText("Aqua")).toBeInTheDocument();
      expect(screen.getByText("10.0%")).toBeInTheDocument();
    });

    it("falls back to SLICE_COLORS palette when slice color is omitted", () => {
      const slicesWithoutColors: PieSlice[] = [
        { key: "1", label: "One", value: 50 },
        { key: "2", label: "Two", value: 50 },
      ];

      const { container } = render(<PieChart slices={slicesWithoutColors} />);
      const paths = container.querySelectorAll("path");

      expect(paths[0]).toHaveAttribute("fill", SLICE_COLORS[0]);
      expect(paths[1]).toHaveAttribute("fill", SLICE_COLORS[1]);
    });

    it("hides legend when showLegend is false", () => {
      render(<PieChart slices={sampleSlices} showLegend={false} />);

      expect(screen.queryByRole("list", { name: "Chart legend" })).not.toBeInTheDocument();
    });

    it("renders centerLabel in donut center when provided", () => {
      render(
        <PieChart
          slices={sampleSlices}
          centerLabel={<span data-testid="center-total">Total: 100</span>}
        />,
      );

      expect(screen.getByTestId("center-total")).toHaveTextContent("Total: 100");
    });

    it("handles single 100% slice donut correctly without degenerate SVG arc", () => {
      const singleSlice: PieSlice[] = [
        { key: "solo", label: "Solo Asset", value: 100 },
      ];

      const { container } = render(<PieChart slices={singleSlice} />);
      const path = container.querySelector("path");

      expect(path).toBeInTheDocument();
      const d = path?.getAttribute("d");
      expect(d).toBeTruthy();
      expect(d).not.toContain("NaN");
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });

    it("handles solid pie (innerRadius = 0) without error", () => {
      const { container } = render(
        <PieChart slices={sampleSlices} innerRadius={0} />,
      );

      const paths = container.querySelectorAll("path");
      expect(paths).toHaveLength(3);
      paths.forEach((path) => {
        expect(path.getAttribute("d")).not.toContain("NaN");
      });
    });

    it("forwards custom className and custom ariaLabel", () => {
      const { container } = render(
        <PieChart
          slices={sampleSlices}
          className="custom-pie-chart"
          ariaLabel="My Portfolio"
        />,
      );

      expect(container.firstChild).toHaveClass("custom-pie-chart");
      expect(
        screen.getByRole("img", { name: "My Portfolio" }),
      ).toBeInTheDocument();
    });
  });

  describe("slice tooltips and dynamic repositioning", () => {
    it("renders title tag inside each path for native fallback", () => {
      const { container } = render(<PieChart slices={sampleSlices} />);
      const titles = container.querySelectorAll("path > title");

      expect(titles).toHaveLength(3);
      expect(titles[0]).toHaveTextContent("Stellar Lumens: 60.0%");
      expect(titles[1]).toHaveTextContent("USD Coin: 30.0%");
      expect(titles[2]).toHaveTextContent("Aqua: 10.0%");
    });

    it("shows floating tooltip on slice hover and hides on mouse leave", () => {
      const { container } = render(<PieChart slices={sampleSlices} size={160} />);
      const paths = container.querySelectorAll("path");

      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

      // Trigger mouse enter
      fireEvent.mouseEnter(paths[0], { clientX: 80, clientY: 40 });
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent("Stellar Lumens: 60.0%");

      // Trigger mouse leave on container
      const chartContainer = paths[0].closest(".relative");
      if (chartContainer) {
        fireEvent.mouseLeave(chartContainer);
      }
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("shows tooltip on keyboard focus and dismisses on blur", () => {
      const { container } = render(<PieChart slices={sampleSlices} size={160} />);
      const paths = container.querySelectorAll("path");

      fireEvent.focus(paths[1]);
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent("USD Coin: 30.0%");

      fireEvent.blur(paths[1]);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("dynamically adjusts tooltip position when near boundary edges via computeTooltipPosition", () => {
      const size = 160;

      // Near left boundary (x = 10, y = 80) -> aligns start (transformX: 0%)
      const leftPos = computeTooltipPosition(10, 80, size);
      expect(leftPos.left).toBe(10);
      expect(leftPos.transform).toContain("0%");

      // Near right boundary (x = 155, y = 80) -> aligns end (transformX: -100%) and clamps to size - padding
      const rightPos = computeTooltipPosition(155, 80, size);
      expect(rightPos.left).toBe(152); // 160 - 8
      expect(rightPos.transform).toContain("-100%");

      // Near top boundary (x = 80, y = 10) -> positions below (transformY: 8px)
      const topPos = computeTooltipPosition(80, 10, size);
      expect(topPos.top).toBe(10);
      expect(topPos.transform).toContain("8px");

      // Near bottom boundary (x = 80, y = 155) -> positions above (transformY: calc(-100% - 8px)) and clamps to size - padding
      const bottomPos = computeTooltipPosition(80, 155, size);
      expect(bottomPos.top).toBe(152); // 160 - 8
      expect(bottomPos.transform).toContain("calc(-100% - 8px)");

      // Center position (x = 80, y = 80) -> centered horizontally and above anchor
      const centerPos = computeTooltipPosition(80, 80, size);
      expect(centerPos.left).toBe(80);
      expect(centerPos.top).toBe(80);
      expect(centerPos.transform).toBe("translate(-50%, calc(-100% - 8px))");
    });
  });
});
