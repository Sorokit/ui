import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode,useState } from "react";

import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

interface LabelledValueProps {
  label: string;
  value?: string;
  mono?: boolean;
  copyable?: boolean;
  children?: ReactNode;
  className?: string;
  labelId?: string;
}

export function LabelledValue({
  label,
  value,
  mono,
  copyable,
  children,
  className,
  labelId,
}: LabelledValueProps) {
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      success(`${label} Copied`, {
        message: "The value has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  }

  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span
        id={labelId}
        className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 break-words"
      >
        {label}
      </span>
      {children ? (
        children
      ) : (
        <div className="flex items-start gap-2 group min-w-0">
          <span
            className={cn(
              "text-[13px] text-ink-2 break-all flex-1 min-w-0",
              mono && "font-mono text-[12px]",
            )}
          >
            {value}
          </span>
          {copyable && (
            <button
              onClick={copy}
              aria-label={copied ? `${label} copied` : `Copy ${label}`}
              className={cn(
                "shrink-0 p-1 rounded-md transition-all mt-0.5",
                copied
                  ? "text-green bg-success-dim"
                  : "text-ink-3 hover:text-ink-2 hover:bg-surface-2 opacity-50 hover:opacity-100",
              )}
              title={copied ? "Copied!" : `Copy ${label}`}
            >
              <HugeiconsIcon
                icon={copied ? Tick01Icon : Copy01Icon}
                size={12}
                color="currentColor"
                strokeWidth={2}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
