import { Cancel01Icon, Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";

import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { truncateAddress } from "@/lib/utils";

export interface AddressDisplayProps {
  address: string;
  start?: number;
  end?: number;
  showFull?: boolean;
  className?: string;
  label?: string;
  onCopy?: () => void;
  size?: "sm" | "md" | "lg";
  masked?: boolean;
  mono?: boolean;
}

const sizeConfig = {
  sm: { text: "text-[10px]", icon: 10 },
  md: { text: "text-[11px]", icon: 12 },
  lg: { text: "text-[13px]", icon: 14 },
} as const;

const COPIED_RESET_MS = 2000;
const FAILED_RESET_MS = 1500;

/**
 * `document.execCommand("copy")` fallback for non-secure contexts (plain
 * HTTP), where `navigator.clipboard` is undefined. Deprecated but still the
 * only synchronous copy mechanism outside a secure context.
 */
function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  // `readOnly` keeps mobile browsers from raising the on-screen keyboard for
  // the throwaway textarea while it is focused for the copy.
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  // `textarea.select()` replaces whatever the user currently has highlighted
  // on the page, so capture the existing range and put it back afterwards.
  const selection = document.getSelection();
  const previousRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  let succeeded: boolean;
  try {
    succeeded = document.execCommand("copy");
  } catch {
    succeeded = false;
  } finally {
    document.body.removeChild(textarea);
    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }
  }
  return succeeded;
}

export function AddressDisplay({
  address,
  start = 8,
  end = 6,
  showFull = false,
  className,
  label,
  onCopy,
  size = "md",
  masked = false,
  mono = false,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearResetTimer() {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }

  // Without this, unmounting inside the copied/failed reset window leaves a
  // pending timeout that fires setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  async function copy() {
    clearResetTimer();
    let succeeded = false;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(address);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }
    if (!succeeded) {
      succeeded = copyViaExecCommand(address);
    }

    if (succeeded) {
      setCopyFailed(false);
      setCopied(true);
      onCopy?.();
      resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } else {
      setCopied(false);
      setCopyFailed(true);
      resetTimerRef.current = setTimeout(() => setCopyFailed(false), FAILED_RESET_MS);
    }
  }

  const display = masked
    ? `${address.slice(0, 4)}···${address.slice(-4)}`
    : showFull
      ? address
      : truncateAddress(address, start, end);
  const { text, icon: iconSize } = sizeConfig[size];

  const addressSpan = (
    <div className="flex items-center gap-2 group">
      <Tooltip content={address}>
        <span
          data-address
          className={cn(
            "break-all leading-relaxed",
            text,
            mono && "font-mono",
            showFull && "select-all",
          )}
        >
          {display}
        </span>
      </Tooltip>
      <Tooltip
        content={copyFailed ? "Copy failed" : copied ? "Copied!" : "Copy address to clipboard"}
      >
        <button
          onClick={copy}
          aria-label={
            copyFailed
              ? "Failed to copy address"
              : copied
                ? "Address copied"
                : "Copy address to clipboard"
          }
          className={cn(
            "shrink-0 p-1 rounded-md transition-all",
            copyFailed
              ? "text-red bg-error-dim"
              : copied
                ? "text-green bg-success-dim"
                : "text-ink-3 hover:text-ink-2 hover:bg-surface-2 opacity-50 hover:opacity-100",
          )}
        >
          <HugeiconsIcon
            icon={copyFailed ? Cancel01Icon : copied ? Tick01Icon : Copy01Icon}
            size={iconSize}
            color="currentColor"
            strokeWidth={2}
          />
        </button>
      </Tooltip>
      {/*
        The icon swap and the button's aria-label are not reliably announced by
        screen readers, so the copy result - especially a failure in a
        non-secure context - was silent for assistive technology. This live
        region announces both outcomes.
      */}
      <span role="status" aria-live="polite" className="sr-only">
        {copyFailed
          ? "Failed to copy address"
          : copied
            ? "Address copied to clipboard"
            : ""}
      </span>
    </div>
  );

  if (label) {
    return (
      <dl className={cn("flex flex-col gap-1", className)}>
        <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          {label}
        </dt>
        <dd className="m-0">{addressSpan}</dd>
      </dl>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {addressSpan}
    </div>
  );
}
