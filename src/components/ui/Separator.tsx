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
  const a11yProps = decorative
    ? { role: "none" as const, "aria-hidden": true as const }
    : { role: "separator" as const, "aria-orientation": orientation };

  if (orientation === "vertical") {
    return (
      <div
        {...a11yProps}
        // self-stretch + min-h-full keep the divider's height tied to its
        // flex container even when that container uses align-items:
        // stretch, where an unconstrained h-full alone collapses to 0px
        // (issue #963).
        className={`w-px h-full self-stretch min-h-full bg-line ${className ?? ""}`}
      />
    );
  }

  if (label) {
    return (
      <div
        {...a11yProps}
        className={`flex items-center gap-3 ${spacingMap[spacing]} ${className ?? ""}`}
      >
        <div className="flex-1 h-px bg-line" />
        <span className="text-ink-4 text-[11px] shrink-0">{label}</span>
        <div className="flex-1 h-px bg-line" />
      </div>
    );
  }

  return (
    <div
      {...a11yProps}
      className={`h-px bg-line w-full ${spacingMap[spacing]} ${className ?? ""}`}
    />
  );
}
