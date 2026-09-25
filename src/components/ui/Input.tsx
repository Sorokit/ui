import { EyeIcon, EyeOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { forwardRef, useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  /** Render a multi-line `<textarea>` instead of a single-line `<input>`. */
  multiline?: boolean;
  /** Element rendered before the input value inside the container. */
  prefix?: React.ReactNode;
  /** Element rendered after the input value inside the container. */
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, multiline, prefix, suffix, className, id, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId =
      id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? generatedId;

    const [lastError, setLastError] = useState<string | undefined>(error);
    const [lastHint, setLastHint] = useState<string | undefined>(hint);
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = props.type === "password";

    useEffect(() => {
      if (props.value !== undefined && !props.onChange && !props.readOnly) {
        console.warn(
          "Input received a controlled `value` prop without an `onChange` handler. " +
            "The input will be read-only. Provide an `onChange` handler to make it editable.",
        );
      }
    }, [props.onChange, props.readOnly, props.value]);

    useEffect(() => {
      if (error) {
        setLastError(error);
      }
    }, [error]);

    useEffect(() => {
      if (hint) {
        setLastHint(hint);
      }
    }, [hint]);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[12px] font-medium text-ink-2"
          >
            {label}
          </label>
        )}
        {multiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
            }
            className={cn(
              "min-h-[72px] w-full rounded-lg border bg-surface-2 px-3.5 py-2",
              "text-[13px] text-ink placeholder:text-ink-4",
              "outline-none transition-colors resize-y",
              error
                ? "border-error-dim-input focus:border-red focus:ring-1 ring-error-dim"
                : "border-line focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              className,
            )}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <div className="relative flex items-center">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-[13px] pointer-events-none">
                {prefix}
              </span>
            )}
            <input
              ref={ref}
              id={inputId}
              aria-invalid={!!error}
              aria-describedby={
                error
                  ? `${inputId}-error`
                  : hint
                    ? `${inputId}-hint`
                    : undefined
              }
              className={cn(
                "h-9 w-full rounded-lg border bg-surface-2",
                "text-[13px] text-ink placeholder:text-ink-4",
                "outline-none transition-colors",
                error
                  ? "border-error-dim-input focus:border-red focus:ring-1 ring-error-dim"
                  : "border-line focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                prefix ? "pl-8" : "px-3.5",
                suffix || isPassword ? "pr-9" : "px-3.5",
                !prefix && !suffix && !isPassword && "px-3.5",
                className,
              )}
              {...props}
              type={
                isPassword ? (showPassword ? "text" : "password") : props.type
              }
            />
            {suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 text-[13px] pointer-events-none">
                {suffix}
              </span>
            )}
            {isPassword && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors"
              >
                <HugeiconsIcon
                  icon={showPassword ? EyeOffIcon : EyeIcon}
                  size={15}
                  color="currentColor"
                  strokeWidth={1.5}
                />
              </button>
            )}
          </div>
        )}
        <div className="min-h-[18px] relative">
          <p
            id={`${inputId}-error`}
            className={cn(
              "absolute inset-x-0 top-0 text-[11px] text-red transition-opacity duration-150",
              error ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            {error || lastError || ""}
          </p>
          <p
            id={`${inputId}-hint`}
            data-testid="input-hint"
            className={cn(
              "absolute inset-x-0 top-0 text-[11px] text-ink-3 transition-opacity duration-150",
              !error && hint ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            {!error && hint ? hint : lastHint || ""}
          </p>
        </div>
      </div>
    );
  },
);
Input.displayName = "Input";
