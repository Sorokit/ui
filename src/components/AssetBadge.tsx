import { Cancel01Icon, Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type MouseEvent, useEffect, useRef, useState } from "react";

import { Tooltip } from "@/components/ui/Tooltip";
import type { Balance } from "@/lib/client";
import { cn, truncateAddress } from "@/lib/utils";

export const ASSET_COLORS: Record<string, { bg: string; text: string }> = {
  XLM: { bg: "bg-[rgba(20,184,166,0.12)]", text: "text-teal" },
  yXLM: { bg: "bg-[rgba(34,197,94,0.12)]", text: "text-green" },
  USDC: { bg: "bg-[rgba(86,69,212,0.12)]", text: "text-brand" },
  USDT: { bg: "bg-success-dim-strong", text: "text-green" },
  BTC: { bg: "bg-[rgba(249,115,22,0.12)]", text: "text-orange" },
  ETH: { bg: "bg-[rgba(168,85,247,0.12)]", text: "text-purple" },
  AQUA: { bg: "bg-[rgba(59,130,246,0.12)]", text: "text-blue" },
  SHX: { bg: "bg-[rgba(236,72,153,0.12)]", text: "text-pink" },
  BLND: { bg: "bg-[rgba(236,204,41,0.12)]", text: "text-yellow" },
};

const FALLBACK_COLOR_PALETTE = [
  { bg: "bg-[rgba(168,85,247,0.12)]", text: "text-purple" },
  { bg: "bg-[rgba(59,130,246,0.12)]", text: "text-blue" },
  { bg: "bg-[rgba(236,72,153,0.12)]", text: "text-pink" },
  { bg: "bg-[rgba(236,204,41,0.12)]", text: "text-yellow" },
  { bg: "bg-[rgba(34,197,94,0.12)]", text: "text-green" },
  { bg: "bg-[rgba(249,115,22,0.12)]", text: "text-orange" },
  { bg: "bg-[rgba(14,165,233,0.12)]", text: "text-cyan" },
  { bg: "bg-[rgba(229,57,53,0.12)]", text: "text-red" },
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function getAssetColor(
  code: string,
  colorMap?: Record<string, { bg: string; text: string }>,
) {
  if (colorMap) {
    if (colorMap[code]) return colorMap[code];
    const lower = code.toLowerCase();
    const matchedKey = Object.keys(colorMap).find(
      (k) => k.toLowerCase() === lower,
    );
    if (matchedKey && colorMap[matchedKey]) return colorMap[matchedKey];
  }
  if (ASSET_COLORS[code]) return ASSET_COLORS[code];
  const upper = code.toUpperCase();
  if (ASSET_COLORS[upper]) return ASSET_COLORS[upper];
  const hash = hashCode(code);
  return FALLBACK_COLOR_PALETTE[hash % FALLBACK_COLOR_PALETTE.length];
}

/**
 * Assets whose issuer is well known enough that printing the issuer address
 * next to the code is noise rather than information.
 */
const KNOWN_ASSETS = new Set(["XLM", "yXLM", "USDC", "USDT", "BTC", "ETH", "AQUA", "SHX", "BLND"]);

/** Whether `code` is in the built-in known-asset registry. */
export function isKnownAsset(code: string): boolean {
  return KNOWN_ASSETS.has(code.toUpperCase());
}

const COPIED_RESET_MS = 2000;

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

export interface AssetBadgeProps {
  balance: Balance;
  showIssuer?: boolean;
  /**
   * Show the issuer only for assets outside the known-asset registry
   * (XLM, USDC, USDT, BTC, ETH). Takes precedence over `showIssuer`.
   */
  showIssuerForUnknown?: boolean;
  /**
   * Appends a short issuer suffix (first 4 + last 4 chars, e.g. "GA5Z...KZVN")
   * to the asset code label to distinguish multi-issuer tokens sharing the same code.
   */
  showIssuerSuffix?: boolean;
  size?: "sm" | "md" | "lg";
  /** Network variant styling (e.g. "mainnet" | "testnet"). */
  network?: "mainnet" | "testnet" | (string & {});
  /** Makes the badge an interactive button — e.g. for asset selection. */
  onClick?: () => void;
  /** Custom color map merged with default ASSET_COLORS */
  colorMap?: Record<string, { bg: string; text: string }>;
  className?: string;
}

export function AssetBadge({
  balance,
  showIssuer = true,
  showIssuerForUnknown,
  showIssuerSuffix = false,
  size = "md",
  network,
  onClick,
  colorMap,
  className,
}: AssetBadgeProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const isLpShares = balance.assetType === "liquidity_pool_shares";
  const isNative = balance.assetType === "native";
  const code = isLpShares
    ? "LP"
    : isNative
      ? "XLM"
      : (balance.assetCode ?? balance.asset);
  const { bg, text } = isLpShares
    ? (colorMap?.[code] ?? colorMap?.LP ?? { bg: "bg-surface-2", text: "text-ink-2" })
    : network === "testnet" && !colorMap?.[code]
      ? { bg: "bg-warning-dim", text: "text-warning" }
      : getAssetColor(code, colorMap);

  const iconSize =
    size === "sm"
      ? "w-6 h-6 text-[9px]"
      : size === "lg"
        ? "w-10 h-10 text-[13px]"
        : "w-8 h-8 text-[11px]";
  const labelSize =
    size === "sm"
      ? "text-[11px]"
      : size === "lg"
        ? "text-[14px]"
        : "text-[13px]";
  const subSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  // Show full code for 1-3 char codes (e.g. XLM, ETH, BTC), 4 chars at lg for longer codes, and 2 chars otherwise.
  const iconLabel =
    code.length <= 3
      ? code
      : size === "lg"
        ? code.slice(0, 4)
        : code.slice(0, 2);

  // showIssuerForUnknown narrows showIssuer: known assets never show it.
  const issuerVisible = showIssuerForUnknown
    ? !isKnownAsset(code)
    : showIssuer;

  const issuerSuffix =
    showIssuerSuffix && balance.assetIssuer
      ? truncateAddress(balance.assetIssuer, 4, 4)
      : null;

  const hasIssuerTooltip = !isNative && !isLpShares && Boolean(balance.assetIssuer);

  async function handleCopyIssuer(e: MouseEvent) {
    e.stopPropagation();
    if (!balance.assetIssuer) return;
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    let succeeded = false;
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(balance.assetIssuer);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }
    if (!succeeded) {
      succeeded = copyViaExecCommand(balance.assetIssuer);
    }

    if (succeeded) {
      setCopyFailed(false);
      setCopied(true);
      resetTimerRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } else {
      setCopied(false);
      setCopyFailed(true);
      resetTimerRef.current = setTimeout(() => setCopyFailed(false), COPIED_RESET_MS);
    }
  }

  const content = (
    <>
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-bold shrink-0",
          iconSize,
          // Four characters need to shrink to stay inside the circle.
          size === "lg" && iconLabel.length > 2 && "text-[11px] tracking-tight",
          bg,
          text,
        )}
      >
        {iconLabel}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          title={code}
          className={cn(
            "font-medium text-ink leading-none truncate max-w-[12ch]",
            labelSize,
          )}
        >
          {code}
          {issuerSuffix && (
            <span className="text-ink-3 font-normal ml-1 text-[11px]">
              ({issuerSuffix})
            </span>
          )}
        </span>
        {issuerVisible &&
          (isNative ? (
            <span className={cn("text-ink-3", subSize)}>Stellar Lumens</span>
          ) : isLpShares ? (
            <span className={cn("text-ink-3", subSize)}>
              Liquidity Pool Shares
            </span>
          ) : balance.assetIssuer ? (
            <span data-address className={cn("truncate", subSize)}>
              {truncateAddress(balance.assetIssuer, 6, 4)}
            </span>
          ) : null)}
      </div>
    </>
  );

  const badgeElement = onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Select ${code}`}
      className={cn(
        "flex items-center gap-2.5 min-w-0 text-left rounded-lg -mx-1.5 px-1.5 py-1 cursor-pointer transition-colors",
        "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        className,
      )}
    >
      {content}
    </button>
  ) : (
    <div
      tabIndex={hasIssuerTooltip ? 0 : undefined}
      className={cn(
        "flex items-center gap-2.5 min-w-0",
        hasIssuerTooltip &&
          "rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        className,
      )}
    >
      {content}
    </div>
  );

  if (!hasIssuerTooltip || !balance.assetIssuer) {
    return badgeElement;
  }

  const truncatedIssuer = truncateAddress(balance.assetIssuer, 6, 4);

  const tooltipContent = (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          Issuer
        </span>
        <span
          data-testid="issuer-tooltip-address"
          title={balance.assetIssuer}
          className="font-mono text-[11px] text-ink"
        >
          {truncatedIssuer}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => void handleCopyIssuer(e)}
        aria-label={
          copyFailed
            ? "Failed to copy issuer address"
            : copied
              ? "Issuer address copied"
              : "Copy issuer address"
        }
        className={cn(
          "shrink-0 p-1 rounded-md transition-all cursor-pointer",
          copyFailed
            ? "text-red bg-error-dim"
            : copied
              ? "text-green bg-success-dim"
              : "text-ink-3 hover:text-ink-2 hover:bg-surface-3",
        )}
      >
        <HugeiconsIcon
          icon={copyFailed ? Cancel01Icon : copied ? Tick01Icon : Copy01Icon}
          size={12}
          color="currentColor"
          strokeWidth={2}
        />
      </button>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} delayDuration={0}>
      {badgeElement}
    </Tooltip>
  );
}

export interface AssetPillProps {
  assetCode: string;
  network?: "mainnet" | "testnet" | (string & {});
  colorMap?: Record<string, { bg: string; text: string }>;
  className?: string;
}

/** Inline pill version — just the code with colored dot */
export function AssetPill({
  assetCode,
  network,
  colorMap,
  className,
}: AssetPillProps) {
  const { bg, text } =
    network === "testnet" && !colorMap?.[assetCode]
      ? { bg: "bg-warning-dim", text: "text-warning" }
      : getAssetColor(assetCode, colorMap);
  return (
    <span
      title={assetCode}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border border-line-2 truncate max-w-[12ch]",
        bg,
        text,
        className,
      )}
    >
      {assetCode}
    </span>
  );
}
