export interface SeparatorProps {
  className?: string;
  label?: string;
  orientation?: "horizontal" | "vertical";
  spacing?: "sm" | "md" | "lg";
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
}: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={`w-px h-full bg-line ${className ?? ""}`}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
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
      role="separator"
      aria-orientation="horizontal"
      className={`h-px bg-line w-full ${spacingMap[spacing]} ${className ?? ""}`}
    />
  );
}
