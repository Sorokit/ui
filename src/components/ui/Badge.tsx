import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "primary"
  | "teal"
  | "purple";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  dot?: boolean;
  live?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-2 text-ink-2 border border-line-2",
  success:
    "bg-success-dim text-green border border-success-dim-strong",
  // Theme-aware tokens (see styles.css) keep warning text at WCAG AA contrast
  // in both dark and light themes; raw text-orange fails on light surfaces.
  warning: "bg-warning-dim text-warning border border-warning-dim",
  error:
    "bg-error-dim text-red border border-error-dim-strong",
  primary: "bg-brand-dim text-brand border border-[rgba(86,69,212,0.25)]",
  teal: "bg-[rgba(20,184,166,0.1)] text-teal   border border-[rgba(20,184,166,0.2)]",
  purple:
    "bg-[rgba(168,85,247,0.1)] text-purple border border-[rgba(168,85,247,0.2)]",
};

const dots: Record<BadgeVariant, string> = {
  default: "bg-ink-3",
  success: "bg-green",
  warning: "bg-orange",
  error: "bg-red",
  primary: "bg-brand",
  teal: "bg-teal",
  purple: "bg-purple",
};

const sizes: Record<string, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-1 text-[11px]",
};

export function Badge({
  variant = "default",
  size = "md",
  dot,
  live,
  className,
  children,
  ...props
}: BadgeProps) {
  const liveProps = live
    ? ({ role: "status", "aria-live": "polite" } as const)
    : {};

  const hasChildren =
    children !== undefined &&
    children !== null &&
    children !== false &&
    children !== "";

  // A dot with no label has nothing to give the pill width, so the padded
  // container collapses to a sliver and reads as broken. Drop the pill chrome
  // and let the dot stand on its own.
  if (dot && !hasChildren) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        {...liveProps}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn("w-1 h-1 rounded-full shrink-0", dots[variant])}
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-wide",
        sizes[size],
        variants[variant],
        className,
      )}
      {...liveProps}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("w-1 h-1 rounded-full shrink-0", dots[variant])}
        />
      )}
      {children}
    </span>
  );
}
