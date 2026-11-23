import * as SeparatorPrimitive from "@radix-ui/react-separator";
import React from "react";

export interface SeparatorProps {
  className?: string;
  label?: string;
  orientation?: "horizontal" | "vertical";
  spacing?: "sm" | "md" | "lg";
  /**
   * Purely visual separators (no semantic meaning in the layout) should be
   * hidden from the accessibility tree rather than announced as a
   * `separator` landmark on every render (issue #963). When true, the root
   * gets `role="none"` and `aria-hidden="true"` instead of
   * `role="separator"`/`aria-orientation`.
   */
  decorative?: boolean;
}

const spacingMap = {
  sm: "my-2",
  md: "my-4",
  lg: "my-6",
} as const;

export function Separator({
  className,
  label,
  orientation = "horizontal",
  spacing = "md",
  decorative = false,
}: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <SeparatorPrimitive.Root
        orientation="vertical"
        decorative={decorative}
        role={decorative ? "none" : "separator"}
        aria-hidden={decorative ? true : undefined}
        aria-orientation={decorative ? undefined : "vertical"}
        className={`w-px h-full self-stretch min-h-full bg-line ${className ?? ""}`}
      />
    );
  }

  if (label) {
    return (
      <div
        role={decorative ? "none" : "separator"}
        aria-hidden={decorative ? true : undefined}
        aria-orientation={decorative ? undefined : orientation}
        data-orientation={orientation}
        className={`flex items-center gap-3 ${spacingMap[spacing]} ${className ?? ""}`}
      >
        <div className="flex-1 h-px bg-line" />
        <span className="text-ink-4 text-[11px] shrink-0">{label}</span>
        <div className="flex-1 h-px bg-line" />
      </div>
    );
  }

  return (
    <SeparatorPrimitive.Root
      orientation="horizontal"
      decorative={decorative}
      role={decorative ? "none" : "separator"}
      aria-hidden={decorative ? true : undefined}
      aria-orientation={decorative ? undefined : "horizontal"}
      className={`h-px bg-line w-full ${spacingMap[spacing]} ${className ?? ""}`}
    />
  );
}
