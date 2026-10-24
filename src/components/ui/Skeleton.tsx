import React from "react";

import { cn } from "@/lib/utils";

export type SkeletonShape = "rounded" | "circle" | "square";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render as a circle (for avatars/icons) - shorthand for shape="circle" */
  circle?: boolean;
  /** Shape variant: rounded (default), circle, or square */
  shape?: SkeletonShape;
  /**
   * Animation variant.
   * - "pulse"   — opacity pulsing via Tailwind's animate-pulse (default)
   * - "shimmer" — a light sweep across the skeleton
   */
  variant?: "pulse" | "shimmer";
}

export function Skeleton({
  circle,
  shape = "rounded",
  variant = "pulse",
  className,
  ...props
}: SkeletonProps) {
  const resolvedShape = circle ? "circle" : shape;
  return (
    <div
      role="presentation"
      className={cn(
        "bg-surface-2 shrink-0",
        resolvedShape === "circle"
          ? "rounded-full"
          : resolvedShape === "square"
            ? "rounded-none"
            : "rounded-lg",
        // Gate the animation on motion-safe and provide the matching
        // motion-reduce fallback, rather than an unconditional
        // animate-pulse/skeleton-shimmer (issue #962): the bare utility
        // would keep animating even with prefers-reduced-motion set.
        variant === "pulse"
          ? "motion-safe:animate-pulse motion-reduce:opacity-60"
          : "motion-safe:skeleton-shimmer motion-reduce:skeleton-shimmer-static",
        className,
      )}
      {...props}
    />
  );
}

export interface SkeletonRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of skeleton rows to render */
  count?: number;
}

/** Pre-composed row skeleton: icon + two lines of text */
export function SkeletonRow({ count, className, ...props }: SkeletonRowProps) {
  if (count !== undefined && count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            role="presentation"
            className={cn("flex items-center gap-3", className)}
            {...props}
          >
            <Skeleton circle className="w-9 h-9" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div role="presentation" className={cn("flex items-center gap-3", className)} {...props}>
      <Skeleton circle className="w-9 h-9" />
      <div className="flex-1 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * Pre-composed asset-row skeleton mirroring AssetRow's layout: an icon + two
 * text lines on the left, and a right-aligned balance/amount placeholder.
 */
export function AssetRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={cn(
        "flex items-center justify-between px-5 py-4 border-b border-line last:border-0",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton circle className="w-9 h-9" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-20" data-testid="asset-amount-skeleton" />
    </div>
  );
}

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of body rows to render (ignored if children/structure are provided) */
  rows?: number;
  /** Custom header slot; defaults to standard 2-line header skeleton */
  header?: React.ReactNode;
  /** Replaces the entire default header + rows layout wholesale */
  structure?: React.ReactNode;
  children?: React.ReactNode;
}

/** Pre-composed card skeleton: header + body lines */
export function SkeletonCard({
  rows = 3,
  structure,
  children,
  header,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
      {...props}
    >
      {structure || children ? (
        structure || children
      ) : (
        <>
          <div className="px-5 py-4 border-b border-line flex flex-col gap-2">
            {header ?? (
              <>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </>
            )}
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={`skeleton-row-${rows}-${i}`} className="h-4 w-full" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder rows to render. */
  rows?: number;
  /** Number of placeholder columns per row. */
  columns?: number;
}

/**
 * Pre-composed table loading state: a header row of column-label
 * placeholders above `rows` body rows of `columns` cell placeholders each
 * (issue #962). Columns are laid out with `grid` so every row's cells line
 * up under the header regardless of `columns`.
 */
export function SkeletonTable({
  rows = 4,
  columns = 4,
  className,
  ...props
}: SkeletonTableProps) {
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
      {...props}
    >
      <div
        className="grid gap-4 px-5 py-4 border-b border-line"
        style={gridStyle}
        data-testid="skeleton-table-header"
      >
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`skeleton-table-header-${i}`} className="h-3.5 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`skeleton-table-row-${rowIndex}`}
          className="grid gap-4 px-5 py-4 border-b border-line last:border-0"
          style={gridStyle}
          data-testid="skeleton-table-row"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`skeleton-table-cell-${rowIndex}-${colIndex}`}
              className="h-4 w-full"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
