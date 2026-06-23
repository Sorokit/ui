import { forwardRef, useId, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? generatedId;

    const [lastError, setLastError] = useState<string | undefined>(error);
    const [lastHint, setLastHint] = useState<string | undefined>(hint);

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
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 w-full rounded-lg border bg-surface-2 px-3.5",
            "text-[13px] text-ink placeholder:text-ink-4",
            "outline-none transition-colors",
            error
              ? "border-[rgba(239,68,68,0.5)] focus:border-red focus:ring-1 focus:ring-[rgba(239,68,68,0.2)]"
              : "border-line focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
        <div className="min-h-[18px] relative">
          <p
            className={cn(
              "absolute inset-x-0 top-0 text-[11px] text-red transition-opacity duration-150",
              error ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            {error || lastError || ""}
          </p>
          <p
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
