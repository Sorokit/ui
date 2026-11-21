import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId, useMemo, useState } from "react";

import { AddressDisplay } from "@/components/AddressDisplay";
import { Badge } from "@/components/ui/Badge";
import { LabelledValue } from "@/components/ui/LabelledValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import { useSorokit } from "@/context/useSorokit";
import { cn, truncateAddress } from "@/lib/utils";

export function getStellarExpertUrl(address: string, networkName?: string) {
  if (networkName === "futurenet" || networkName === "localnet") {
    return null;
  }
  const segment = networkName === "testnet" ? "testnet" : "public";
  return `https://stellar.expert/explorer/${segment}/account/${address}`;
}

/** Stellar base reserve: each subentry (trustline, offer, signer, data entry…) locks up 0.5 XLM. */
const BASE_RESERVE_XLM = 0.5;

/**
 * 32-bit FNV-1a hash of a full string (RFC 8999 compliant).
 * Evaluates every character in the string to ensure that accounts
 * with identical prefixes produce distinct hashes.
 */
export function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * DJB2 hash function as alternative/complementary hash.
 */
export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return hash >>> 0;
}

export const AVATAR_GRADIENT_PALETTES: [string, string][] = [
  ["#ec4899", "#8b5cf6"], // pink to purple
  ["#3b82f6", "#2dd4bf"], // blue to teal
  ["#f59e0b", "#ef4444"], // amber to red
  ["#10b981", "#3b82f6"], // emerald to blue
  ["#8b5cf6", "#ec4899"], // violet to pink
  ["#06b6d4", "#3b82f6"], // cyan to blue
  ["#f97316", "#e11d48"], // orange to rose
  ["#6366f1", "#a855f7"], // indigo to purple
  ["#14b8a6", "#10b981"], // teal to emerald
  ["#a855f7", "#ec4899"], // purple to pink
  ["#f43f5e", "#fb923c"], // rose to orange
  ["#0284c7", "#6366f1"], // sky to indigo
];

export interface AvatarGradient {
  background: string;
  colors: [string, string];
  angle: number;
}

export function generateAvatarGradient(address: string): AvatarGradient {
  // Uses the full public key string to avoid collisions for shared prefixes
  const hash = fnv1aHash(address);
  const paletteIndex = hash % AVATAR_GRADIENT_PALETTES.length;
  const colors = AVATAR_GRADIENT_PALETTES[paletteIndex];
  const angle = (hash >> 8) % 360;
  return {
    background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`,
    colors,
    angle,
  };
}

export function computeInitials(address: string): string {
  const lastFourChars = address.slice(-4);
  const charCode1 = lastFourChars.charCodeAt(0) || 0;
  const charCode2 = lastFourChars.charCodeAt(1) || 0;
  const charCode3 = lastFourChars.charCodeAt(2) || 0;
  const charCode4 = lastFourChars.charCodeAt(3) || 0;
  const total = charCode1 + charCode2 + charCode3 + charCode4;

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const char1 = alphabet[total % 26];
  const char2 = alphabet[(total + charCode1) % 26];
  return `${char1}${char2}`;
}

/**
 * Copies text using the Clipboard API with fallback to document.execCommand('copy').
 * Returns true if the text was successfully written, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    try {
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

      let succeeded = false;
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
    } catch {
      return false;
    }
  }

  return false;
}

export function AccountCard() {
  const { address, account, isLoadingAccount, network } = useSorokit();
  const { success, error } = useToast();
  const sequenceLabelId = useId();
  const [showSequenceTooltip, setShowSequenceTooltip] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);

  const initials = useMemo(
    () => (address ? computeInitials(address) : ""),
    [address],
  );
  const avatarGradient = useMemo(
    () => (address ? generateAvatarGradient(address) : null),
    [address],
  );

  if (!address) return null;

  const handleCopySuccess = () => {
    success("Address Copied", {
      message: "The address has been copied to your clipboard.",
    });
  };

  const handleCopyError = () => {
    error("Copy Failed", {
      message: "Failed to copy address to clipboard.",
    });
  };

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div
            data-testid="account-card-avatar"
            style={{ background: avatarGradient?.background }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
          >
            {initials}
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Account</h3>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Stellar account details
            </p>
          </div>
        </div>
        {isLoadingAccount ? (
          <Badge variant="default">Loading</Badge>
        ) : (
          account && (
            <Badge variant="success" dot>
              Active
            </Badge>
          )
        )}
      </div>
      <div className="px-5 py-5" aria-busy={isLoadingAccount || undefined}>
        {!account ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          // Issue: keep the last-known account in view (instead of unmounting
          // it behind a 3-bar skeleton) while a refresh is in flight, so the
          // card's height stays steady — only the initial, data-less load
          // above falls back to the skeleton.
          <div
            className={cn(
              "flex flex-col gap-5 transition-opacity",
              isLoadingAccount && "opacity-60",
            )}
          >
            <AddressDisplay
              address={address}
              showFull
              label="Address"
              onCopy={handleCopySuccess}
              onCopyError={handleCopyError}
            />
            <a
              href={getStellarExpertUrl(address, network?.name) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={getStellarExpertUrl(address, network?.name) === null}
              title={
                getStellarExpertUrl(address, network?.name) === null
                  ? "Stellar Expert is not available for this network"
                  : undefined
              }
              className={`text-[11px] hover:underline ${
                getStellarExpertUrl(address, network?.name) === null
                  ? "text-ink-4 cursor-not-allowed pointer-events-none"
                  : "text-brand"
              }`}
            >
              View on Stellar Expert →
            </a>
            {account && (
              <div className="grid grid-cols-2 gap-5">
                <LabelledValue label="Sequence" labelId={sequenceLabelId}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] text-ink-2">
                      {account.sequence}
                    </span>
                    <span className="relative inline-flex">
                      <button
                        type="button"
                        aria-label="What is the sequence number?"
                        className="text-ink-4 hover:text-ink-2 transition-colors"
                        onMouseEnter={() => setShowSequenceTooltip(true)}
                        onMouseLeave={() => setShowSequenceTooltip(false)}
                        onFocus={() => setShowSequenceTooltip(true)}
                        onBlur={() => setShowSequenceTooltip(false)}
                      >
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          size={13}
                          color="currentColor"
                          strokeWidth={1.5}
                        />
                      </button>
                      {showSequenceTooltip && (
                        <span
                          role="tooltip"
                          aria-labelledby={sequenceLabelId}
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-2 shadow-lg z-10"
                        >
                          Increments with every transaction from this account to
                          prevent replay attacks.
                        </span>
                      )}
                    </span>
                  </div>
                </LabelledValue>
                <LabelledValue label="Subentries">
                  <span className="text-[13px] text-ink">
                    {account.subentryCount}
                  </span>
                </LabelledValue>
                <div className="col-span-2">
                  <LabelledValue label="Reserve Impact">
                    <span className="text-[13px] text-ink">
                      {(account.subentryCount * BASE_RESERVE_XLM).toFixed(2)}{" "}
                      XLM
                    </span>
                  </LabelledValue>
                </div>
              </div>
            )}
            {account?.thresholds && (
              <div>
                <button
                  onClick={() => setShowThresholds((v) => !v)}
                  className="text-[11px] text-ink-3 hover:text-ink-2 transition-colors"
                >
                  {showThresholds ? "▾ Hide thresholds" : "▸ Show thresholds"}
                </button>
                {showThresholds && (
                  <div className="mt-2 grid grid-cols-4 gap-3">
                    {(["low", "med", "high", "master"] as const).map((key) => (
                      <div key={key} className="flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-ink-4">
                          {key}
                        </span>
                        <span className="text-[12px] font-mono text-ink">
                          {account.thresholds![key]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountCardCompact({
  onNavigate,
}: {
  onNavigate?: (screen: "account") => void;
}) {
  const { address } = useSorokit();

  const initials = useMemo(
    () => (address ? computeInitials(address) : ""),
    [address],
  );
  const avatarGradient = useMemo(
    () => (address ? generateAvatarGradient(address) : null),
    [address],
  );

  if (!address || !avatarGradient) return null;

  return (
    <button
      onClick={() => onNavigate?.("account")}
      title={address}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-line hover:bg-surface-3 hover:border-line-2 transition-colors cursor-pointer"
    >
      <div
        data-testid="account-avatar"
        style={{ background: avatarGradient.background }}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
      >
        {initials}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[9px] text-ink-4 uppercase tracking-widest">
          Connected
        </span>
        <span data-address className="truncate text-[12px] text-ink-2">
          {truncateAddress(address)}
        </span>
      </div>
    </button>
  );
}
