import { Cancel01Icon, Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";

import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

/** Reusable copy-to-clipboard button matching AddressDisplay UX */
export interface CopyAddressButtonProps {
  address: string;
  /** Optional custom aria-label */
  ariaLabel?: string;
  /** Size variant – mirrors AddressDisplay size config */
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { icon: 10 },
  md: { icon: 12 },
  lg: { icon: 14 },
} as const;

const COPIED_RESET_MS = 2000;
const FAILED_RESET_MS = 1500;

function copyViaExecCommand(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

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

export function CopyAddressButton({
  address,
  ariaLabel = "Copy address to clipboard",
  size = "md",
}: CopyAddressButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearResetTimer() {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }

  function resetCopyStateOnLeave() {
    clearResetTimer();
    setCopied(false);
    setCopyFailed(false);
  }

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
      resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } else {
      setCopied(false);
      setCopyFailed(true);
      resetTimerRef.current = setTimeout(() => setCopyFailed(false), FAILED_RESET_MS);
    }
  }

  const { icon: iconSize } = sizeConfig[size];

  return (
    <>
      <Tooltip
        content={copyFailed ? "Copy failed" : copied ? "Copied!" : "Copy address to clipboard"}
      >
        <button
          onClick={copy}
          onMouseLeave={resetCopyStateOnLeave}
          aria-label={
            copyFailed ? "Failed to copy address" : copied ? "Address copied" : ariaLabel
          }
          className={cn(
            "shrink-0 p-1 rounded-md transition-all",
            copyFailed ? "text-red bg-error-dim" : copied ? "text-green bg-success-dim" : "text-ink-3 hover:text-ink-2 hover:bg-surface-2 opacity-50 hover:opacity-100",
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
      {/* Live region for screen‑readers */}
      <span role="status" aria-live="polite" className="sr-only">
        {copyFailed ? "Failed to copy address" : copied ? "Address copied to clipboard" : ""}
      </span>
    </>
  );
}
