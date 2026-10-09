/**
 * PieChart — a pure-SVG donut/pie chart with no external charting library.
 *
 * Renders accessible SVG with ARIA labels and a colour-keyed legend.
 * Each slice supports an optional tooltip with dynamic boundary repositioning and `title` element.
 */

import React, { useCallback, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PieSlice {
  /** Unique key for the slice */
  key: string;
  /** Display label */
  label: string;
  /** Numeric value (raw; percentages are computed from the sum of all values) */
  value: number;
  /** Tailwind or CSS colour class / hex string.  Falls back to SLICE_COLORS. */
  color?: string;
}

export interface PieChartProps {
  slices: PieSlice[];
  /** Total diameter in pixels (default 160) */
  size?: number;
  /** Donut hole radius as a fraction 0–1 (default 0.55, set to 0 for a solid pie) */
  innerRadius?: number;
  /** Show the percentage legend below the chart (default true) */
  showLegend?: boolean;
  /** Optional label rendered in the centre of the donut hole */
  centerLabel?: React.ReactNode;
  className?: string;
  /** Aria-label for the SVG element */
  ariaLabel?: string;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

/**
 * Ordered palette of fill colours.  Colours cycle when there are more slices
 * than entries.
 */
export const SLICE_COLORS = [
  "#5645D4", // brand (violet)
  "#14B8A6", // teal
  "#22C55E", // green
  "#F97316", // orange
  "#A855F7", // purple
  "#EAB308", // yellow
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F43F5E", // rose
];

function resolveColor(slice: PieSlice, index: number): string {
  return slice.color ?? SLICE_COLORS[index % SLICE_COLORS.length];
}

// ─── Arc math ─────────────────────────────────────────────────────────────────

interface ArcParams {
  cx: number;
  cy: number;
  r: number;
  startAngle: number; // radians
  endAngle: number; // radians
}

/**
 * Build an SVG arc path string for a pie/donut slice.
 *
 * When `innerR` is 0 a solid wedge from the centre is drawn instead of a ring.
 */
function arcPath(
  { cx, cy, r, startAngle, endAngle }: ArcParams,
  innerR: number,
): string {
  const sweep = endAngle - startAngle;
  if (!Number.isFinite(sweep) || sweep <= 0) {
    return "";
  }

  // Handle full circle (360 deg) where start and end points coincide
  if (sweep >= 2 * Math.PI - 0.0001) {
    if (innerR <= 0) {
      return [
        `M ${cx - r} ${cy}`,
        `A ${r} ${r} 0 1 0 ${cx + r} ${cy}`,
        `A ${r} ${r} 0 1 0 ${cx - r} ${cy}`,
        "Z",
      ].join(" ");
    }
    return [
      `M ${cx - r} ${cy}`,
      `A ${r} ${r} 0 1 0 ${cx + r} ${cy}`,
      `A ${r} ${r} 0 1 0 ${cx - r} ${cy}`,
      `M ${cx - innerR} ${cy}`,
      `A ${innerR} ${innerR} 0 1 1 ${cx + innerR} ${cy}`,
      `A ${innerR} ${innerR} 0 1 1 ${cx - innerR} ${cy}`,
      "Z",
    ].join(" ");
  }

  const cos = Math.cos;
  const sin = Math.sin;

  const x1o = cx + r * cos(startAngle);
  const y1o = cy + r * sin(startAngle);
  const x2o = cx + r * cos(endAngle);
  const y2o = cy + r * sin(endAngle);

  const largeArc = sweep > Math.PI ? 1 : 0;

  if (innerR <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${x1o} ${y1o}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      "Z",
    ].join(" ");
  }

  const x1i = cx + innerR * cos(endAngle);
  const y1i = cy + innerR * sin(endAngle);
  const x2i = cx + innerR * cos(startAngle);
  const y2i = cy + innerR * sin(startAngle);

  return [
    `M ${x1o} ${y1o}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    "Z",
  ].join(" ");
}

export interface TooltipPos {
  left: number;
  top: number;
  transform: string;
}

/**
 * Dynamically compute tooltip position and alignment near container boundaries
 * to prevent clipping at edges.
 */
export function computeTooltipPosition(
  x: number,
  y: number,
  size: number,
): TooltipPos {
  const padding = 8;
  const clampedX = Math.max(padding, Math.min(size - padding, x));
  const clampedY = Math.max(padding, Math.min(size - padding, y));

  // Determine horizontal alignment based on boundary proximity
  let transformX = "-50%";
  if (clampedX < size * 0.3) {
    transformX = "0%";
  } else if (clampedX > size * 0.7) {
    transformX = "-100%";
  }

  // Determine vertical placement based on top/bottom boundary proximity
  let transformY = "calc(-100% - 8px)";
  if (clampedY < size * 0.3) {
    transformY = "8px";
  } else if (clampedY > size * 0.85) {
    transformY = "calc(-100% - 8px)";
  }

  return {
    left: clampedX,
    top: clampedY,
    transform: `translate(${transformX}, ${transformY})`,
  };
}

interface HoverState {
  slice: PieSlice;
  pct: number;
  x: number;
  y: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PieChart({
  slices,
  size = 160,
  innerRadius = 0.55,
  showLegend = true,
  centerLabel,
  className,
  ariaLabel,
}: PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);

  const rawTotal = (slices ?? []).reduce((s, sl) => s + (sl.value > 0 ? sl.value : 0), 0);
  const total = Number.isFinite(rawTotal) ? rawTotal : 0;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2; // 2px padding so stroke doesn't clip
  const innerR = r * innerRadius;

  const rawId = useId();
  const legendId = `pie-legend-${rawId.replace(/:/g, "")}`;

  // Build arc segments. Start at -90° (top) and go clockwise.
  const segments = useMemo(() => {
    if (!slices || slices.length === 0 || total <= 0) {
      return [];
    }
    const result: Array<{
      slice: PieSlice;
      color: string;
      path: string;
      pct: number;
      midAngle: number;
    }> = [];
    let angle = -Math.PI / 2;
    for (const [i, slice] of slices.entries()) {
      const val = Math.max(0, slice.value || 0);
      const sweep = total > 0 ? (val / total) * (2 * Math.PI) : 0;
      const start = angle;
      const end = angle + sweep;
      const pct = total > 0 ? (val / total) * 100 : 0;
      const color = resolveColor(slice, i);
      const path =
        sweep > 0
          ? arcPath({ cx, cy, r, startAngle: start, endAngle: end }, innerR)
          : "";
      const midAngle = start + sweep / 2;
      result.push({ slice, color, path, pct, midAngle });
      angle = end;
    }
    return result;
  }, [slices, total, cx, cy, r, innerR]);

  const handlePointerMove = useCallback(
    (
      e: React.PointerEvent<SVGPathElement> | React.MouseEvent<SVGPathElement>,
      slice: PieSlice,
      pct: number,
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const clientX = typeof e.clientX === "number" ? e.clientX : 0;
      const clientY = typeof e.clientY === "number" ? e.clientY : 0;
      const x = rect ? clientX - rect.left : clientX;
      const y = rect ? clientY - rect.top : clientY;
      setHoverState({ slice, pct, x, y });
    },
    [],
  );

  const handleFocus = useCallback(
    (slice: PieSlice, pct: number, midAngle: number) => {
      const midR = innerR > 0 ? (r + innerR) / 2 : r * 0.65;
      const x = cx + midR * Math.cos(midAngle);
      const y = cy + midR * Math.sin(midAngle);
      setHoverState({ slice, pct, x, y });
    },
    [cx, cy, r, innerR],
  );

  const handlePointerLeave = useCallback(() => {
    setHoverState(null);
  }, []);

  // Empty state — render a grey placeholder ring
  if (total <= 0 || !slices || slices.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-4", className)}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel ?? "Empty portfolio chart"}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={innerR > 0 ? r - innerR : 2}
            className="text-surface-2"
          />
          {centerLabel && (
            <foreignObject
              x={innerR}
              y={innerR}
              width={innerR * 2}
              height={innerR * 2}
            >
              <div className="w-full h-full flex items-center justify-center text-center">
                {centerLabel}
              </div>
            </foreignObject>
          )}
        </svg>
        {showLegend && <p className="text-[11px] text-ink-3">No data</p>}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        ref={containerRef}
        className="relative"
        style={{ width: size, height: size }}
        onMouseLeave={handlePointerLeave}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel ?? "Portfolio allocation chart"}
          aria-describedby={showLegend ? legendId : undefined}
        >
          {segments.map(({ slice, color, path, pct, midAngle }) =>
            path ? (
              <path
                key={slice.key}
                d={path}
                fill={color}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${slice.label}: ${pct.toFixed(1)}%`}
                className="transition-opacity duration-150 hover:opacity-80 focus:opacity-80 focus:outline-none cursor-pointer"
                onMouseEnter={(e) => handlePointerMove(e, slice, pct)}
                onMouseMove={(e) => handlePointerMove(e, slice, pct)}
                onFocus={() => handleFocus(slice, pct, midAngle)}
                onBlur={handlePointerLeave}
              >
                <title>
                  {slice.label}: {pct.toFixed(1)}%
                </title>
              </path>
            ) : null,
          )}
        </svg>

        {/* Centre label (renders on top of the SVG via absolute positioning) */}
        {centerLabel && (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ padding: r - innerR + 4 }}
          >
            <div className="text-center">{centerLabel}</div>
          </div>
        )}

        {/* Floating tooltip with dynamic repositioning */}
        {hoverState && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink shadow-lg"
            style={computeTooltipPosition(hoverState.x, hoverState.y, size)}
          >
            {hoverState.slice.label}: {hoverState.pct.toFixed(1)}%
          </div>
        )}
      </div>

      {showLegend && (
        <ul
          id={legendId}
          className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 max-w-[240px]"
          aria-label="Chart legend"
        >
          {segments.map(({ slice, color, pct }) => (
            <li key={slice.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-ink-2">
                {slice.label}{" "}
                <span className="text-ink-3 tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

