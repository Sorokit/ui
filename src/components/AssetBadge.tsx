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
  onClick,
  colorMap,
  className,
}: AssetBadgeProps) {
  const isLpShares = balance.assetType === "liquidity_pool_shares";
  const code = isLpShares
    ? "LP"
    : balance.assetType === "native"
      ? "XLM"
      : (balance.assetCode ?? balance.asset);
  const { bg, text } = isLpShares
    ? (colorMap?.[code] ?? colorMap?.LP ?? { bg: "bg-surface-2", text: "text-ink-2" })
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
        <span className={cn("font-medium text-ink leading-none", labelSize)}>
          {code}
          {issuerSuffix && (
            <span className="text-ink-3 font-normal ml-1 text-[11px]">
              ({issuerSuffix})
            </span>
          )}
        </span>
        {issuerVisible &&
          (balance.assetType === "native" ? (
            <span className={cn("text-ink-3", subSize)}>Stellar Lumens</span>
          ) : isLpShares ? (
            <span className={cn("text-ink-3", subSize)}>
              Liquidity Pool Shares
            </span>
          ) : balance.assetIssuer ? (
            <span data-address className={subSize}>
              {truncateAddress(balance.assetIssuer, 6, 4)}
            </span>
          ) : null)}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Select ${code}`}
        className={cn(
          "flex items-center gap-2.5 text-left rounded-lg -mx-1.5 px-1.5 py-1 cursor-pointer transition-colors",
          "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>{content}</div>
  );
}

export interface AssetPillProps {
  assetCode: string;
  colorMap?: Record<string, { bg: string; text: string }>;
  className?: string;
}

/** Inline pill version — just the code with colored dot */
export function AssetPill({
  assetCode,
  colorMap,
  className,
}: AssetPillProps) {
  const { bg, text } = getAssetColor(assetCode, colorMap);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border border-line-2",
        bg,
        text,
        className,
      )}
    >
      {assetCode}
    </span>
  );
}
