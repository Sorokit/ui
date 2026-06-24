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
  dot?: boolean;
  live?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-2 text-ink-2 border border-line-2",
  success:
    "bg-success-dim text-green border border-success-dim-strong",
  warning:
    "bg-[rgba(249,115,22,0.1)] text-orange border border-[rgba(249,115,22,0.2)]",
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

export function Badge({
  variant = "default",
  dot,
  live,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold tracking-wide",
        variants[variant],
        className,
      )}
      {...(live ? { role: "status", "aria-live": "polite" } : {})}
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
