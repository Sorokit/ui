import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/utils";

interface AddressDisplayProps {
  address: string;
  start?: number;
  end?: number;
  showFull?: boolean;
  className?: string;
  label?: string;
}

export function AddressDisplay({
  address,
  start = 8,
  end = 6,
  showFull = false,
  className,
  label,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
    }
  }

  const display = showFull ? address : truncateAddress(address, start, end);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2 group">
        <span
          data-address
          className={cn(
            "break-all leading-relaxed",
            showFull ? "text-[11px]" : "",
          )}
          title={address}
        >
          {display}
        </span>
        <button
          onClick={copy}
          aria-label={copied ? "Address copied" : "Copy address"}
          className={cn(
            "shrink-0 p-1 rounded-md transition-all",
            copied
              ? "text-green bg-success-dim"
              : "text-ink-3 hover:text-ink-2 hover:bg-surface-2 opacity-50 hover:opacity-100",
          )}
          title={copied ? "Copied!" : "Copy address"}
        >
          <HugeiconsIcon
            icon={copied ? Tick01Icon : Copy01Icon}
            size={12}
            color="currentColor"
            strokeWidth={2}
          />
        </button>
      </div>
    </div>
  );
}
