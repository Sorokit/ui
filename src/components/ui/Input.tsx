import { Cancel01Icon, EyeIcon, EyeOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  /** Render a multi-line `<textarea>` instead of a single-line `<input>`. */
  multiline?: boolean;
  /** Number of visible rows when `multiline` is true. */
  rows?: number;
  /** Element rendered before the input value inside the container. */
  prefix?: React.ReactNode;
  /** Element rendered after the input value inside the container. */
  suffix?: React.ReactNode;
  /**
   * Show a clear (×) button while the input has a value. Clearing fires the
   * input's `onChange` with an empty value, so it works for both controlled
   * and uncontrolled inputs. Ignored for `multiline`.
   */
  clearable?: boolean;
  /** Called after the value has been cleared via the clear button. */
  onClear?: () => void;
  /** Accessible label for the clear button. Defaults to "Clear input". */
  clearLabel?: string;
}

function hasText(value: unknown): boolean {
  return value !== undefined && value !== null && String(value) !== "";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      multiline,
      prefix,
      suffix,
      clearable,
      onClear,
      clearLabel = "Clear input",
      className,
      id,
      onChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    // Issue #544: derive the id from React.useId() rather than the label text,
    // which collided when two inputs shared the same label on one page.
    const inputId = id ?? generatedId;

    const [lastError, setLastError] = useState<string | undefined>(error);
    const [lastHint, setLastHint] = useState<string | undefined>(hint);
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = props.type === "password";

    const inputRef = useRef<HTMLInputElement | null>(null);
    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    // Uncontrolled inputs don't re-render on typing, so track emptiness here
    // to know when to show the clear button.
    const [uncontrolledHasValue, setUncontrolledHasValue] = useState(() =>
      hasText(props.defaultValue),
    );
    const isControlled = props.value !== undefined;
    const hasValue = isControlled ? hasText(props.value) : uncontrolledHasValue;
    const showClear =
      !!clearable && hasValue && !props.disabled && !props.readOnly;
    const hasTrailingAdornment = !!suffix || isPassword;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setUncontrolledHasValue(e.target.value !== "");
      onChange?.(e);
    };

    const handleClear = () => {
      const input = inputRef.current;
      if (!input) return;
      // Assigning .value directly would bypass React's value tracking and
      // swallow the change. Going through the native setter and dispatching a
      // real input event makes React fire onChange with an empty value.
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setValue?.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      onClear?.();
      // The clear button unmounts once the value is empty; keep keyboard
      // users in the field rather than dropping focus to <body>.
      input.focus();
    };

    useEffect(() => {
      if (props.value !== undefined && !onChange && !props.readOnly) {
        console.warn(
          "Input received a controlled `value` prop without an `onChange` handler. " +
            "The input will be read-only. Provide an `onChange` handler to make it editable.",
        );
      }
    }, [onChange, props.readOnly, props.value]);

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
            onChange={
              onChange as unknown as React.ChangeEventHandler<HTMLTextAreaElement>
            }
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
              ref={setInputRef}
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
                // Reserve room for the clear button (plus any trailing
                // adornment) so text never runs underneath it.
                clearable && (hasTrailingAdornment ? "pr-14" : "pr-9"),
                className,
              )}
              {...props}
              onChange={handleChange}
              type={
                isPassword ? (showPassword ? "text" : "password") : props.type
              }
            />
            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={clearLabel}
                aria-controls={inputId}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded",
                  "text-ink-3 hover:text-ink-2 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
                  hasTrailingAdornment ? "right-8" : "right-2",
                )}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={14}
                  color="currentColor"
                  strokeWidth={1.5}
                />
              </button>
            )}
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
