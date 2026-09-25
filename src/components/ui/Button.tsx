import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  loading?: boolean;
  /** Square button with no horizontal padding, sized for a single icon. */
  iconOnly?: boolean;
  /**
   * Require a two-click confirmation before `onClick` fires. The first click
   * swaps the label to `confirmLabel`; the second click (within the same
   * armed state) invokes `onClick`.
   */
  requireConfirm?: boolean;
  /** Label shown while the button is armed for confirmation. */
  confirmLabel?: string;
  /** Icon rendered before the label, sized to match the button. */
  leftIcon?: ReactNode;
  /** Icon rendered after the label, sized to match the button. */
  rightIcon?: ReactNode;
  /**
   * Render an anchor instead of a button. The link always opens in a new tab
   * (`target="_blank" rel="noopener noreferrer"`) and navigation is suppressed
   * while `disabled` or `loading`.
   */
  href?: string;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "bg-transparent text-ink border border-line-2 hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  destructive:
    "bg-error-dim text-red border border-error-dim-strong hover:bg-error-dim-hover",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[12px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
  lg: "h-10 px-5 text-[14px] gap-2",
};

const iconOnlySizes: Record<Size, string> = {
  sm: "h-8 w-8 text-[12px]",
  md: "h-9 w-9 text-[13px]",
  lg: "h-10 w-10 text-[14px]",
};

/** Box the leading/trailing icon slots so consumers don't size icons by hand. */
const iconSlotSizes: Record<Size, string> = {
  sm: "w-3.5 h-3.5 [&>svg]:w-3.5 [&>svg]:h-3.5",
  md: "w-4 h-4 [&>svg]:w-4 [&>svg]:h-4",
  lg: "w-[18px] h-[18px] [&>svg]:w-[18px] [&>svg]:h-[18px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      asChild,
      loading,
      iconOnly,
      requireConfirm,
      confirmLabel = "Are you sure?",
      leftIcon,
      rightIcon,
      href,
      className,
      disabled,
      children,
      onClick,
      onClickCapture,
      onBlur,
      ...props
    },
    ref,
  ) => {
    // The href branch returns its own anchor below, so Comp never needs "a".
    const isLink = !!href && !asChild;
    const Comp = asChild ? Slot : "button";
    const [armed, setArmed] = useState(false);
    const isInert = !!disabled || !!loading;
    const ariaDisabled = props["aria-disabled"];
    const isAriaDisabled = ariaDisabled === true || ariaDisabled === "true";

    // Runs in the capture phase, before any onClick — including one that a
    // slotted `asChild` child carries itself, which Slot would otherwise invoke
    // ahead of ours. Stopping the event here means a disabled or
    // aria-disabled button never reaches a click handler, whatever element is
    // rendered. The DOM check also catches aria-disabled/disabled set directly
    // on a slotted child rather than on <Button>.
    const handleClickCapture = (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = e.currentTarget;
      if (
        isInert ||
        isAriaDisabled ||
        el.getAttribute("aria-disabled") === "true" ||
        el.hasAttribute("disabled")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      onClickCapture?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isInert) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Two-step confirmation: first click arms, second click confirms.
      if (requireConfirm && !asChild && !armed) {
        e.preventDefault();
        setArmed(true);
        return;
      }
      setArmed(false);
      onClick?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
      // Reset the confirmation prompt when focus leaves the button.
      if (armed) setArmed(false);
      onBlur?.(e);
    };

    const spinner = (
      <>
        <span
          aria-hidden="true"
          className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin shrink-0"
        />
        <span className="sr-only">Loading</span>
      </>
    );

    const label = requireConfirm && armed ? confirmLabel : children;

    const iconSlot = (icon: ReactNode) => (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center shrink-0",
          iconSlotSizes[size],
        )}
      >
        {icon}
      </span>
    );

    const classes = cn(
      "inline-flex items-center justify-center font-medium rounded-lg transition-colors cursor-pointer select-none",
      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      variants[variant],
      iconOnly ? iconOnlySizes[size] : sizes[size],
      // Anchors, slotted elements and aria-disabled buttons ignore :disabled,
      // so mirror the styling off aria-disabled.
      "aria-disabled:opacity-40 aria-disabled:cursor-not-allowed",
      className,
    );

    const content = asChild ? (
      children
    ) : iconOnly ? (
      // Icon-only: the spinner replaces the icon entirely.
      loading ? (
        spinner
      ) : (
        children
      )
    ) : (
      <>
        {/* Spinner occupies the leading icon slot so the label stays put. */}
        {loading ? spinner : leftIcon ? iconSlot(leftIcon) : null}
        {label}
        {rightIcon ? iconSlot(rightIcon) : null}
      </>
    );

    if (isLink) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          // Dropping href while inert keeps the link out of the tab order and
          // makes the disabled state real rather than cosmetic.
          href={isInert ? undefined : href}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={isInert || undefined}
          aria-busy={loading || undefined}
          className={classes}
          onClickCapture={handleClickCapture as unknown as React.MouseEventHandler<HTMLAnchorElement>}
          onClick={handleClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
          onBlur={handleBlur as unknown as React.FocusEventHandler<HTMLAnchorElement>}
          {...(props as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }

    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        // A slotted <a>/<div> has no native disabled state, so announce it.
        aria-disabled={asChild && isInert ? true : undefined}
        aria-busy={loading || undefined}
        className={classes}
        onClickCapture={handleClickCapture}
        onClick={handleClick}
        onBlur={handleBlur}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stack the buttons vertically instead of side by side. */
  orientation?: "horizontal" | "vertical";
}

/**
 * Visually connects sibling buttons by collapsing the shared border radius and
 * the gap between them — e.g. Prev/Next pagination or Cancel/Confirm pairs.
 *
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button variant="secondary">Prev</Button>
 *   <Button variant="secondary">Next</Button>
 * </ButtonGroup>
 * ```
 */
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ orientation = "horizontal", className, children, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      data-orientation={orientation}
      className={cn(
        "inline-flex isolate",
        orientation === "vertical"
          ? [
              "flex-col",
              "[&>*:not(:first-child)]:rounded-t-none",
              "[&>*:not(:last-child)]:rounded-b-none",
              "[&>*:not(:first-child)]:-mt-px",
            ]
          : [
              "flex-row",
              "[&>*:not(:first-child)]:rounded-l-none",
              "[&>*:not(:last-child)]:rounded-r-none",
              "[&>*:not(:first-child)]:-ml-px",
            ],
        // Keep the focused button's ring above its neighbour's border.
        "[&>*:focus-visible]:z-10 [&>*:hover]:z-10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
ButtonGroup.displayName = "ButtonGroup";
