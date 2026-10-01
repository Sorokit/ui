import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId, useState } from "react";

import { AddressDisplay } from "@/components/AddressDisplay";
import { Badge } from "@/components/ui/Badge";
import { LabelledValue } from "@/components/ui/LabelledValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import { useToast } from "@/context/ToastContext";
import { truncateAddress } from "@/lib/utils";

function getStellarExpertUrl(address: string, networkName?: string) {
  if (networkName === "futurenet" || networkName === "localnet") {
    return null;
  }
  const segment = networkName === "testnet" ? "testnet" : "public";
  const base =
    networkName === "testnet"
      ? "https://testnet.stellar.expert"
      : "https://stellar.expert";
  return `${base}/explorer/${segment}/account/${address}`;
}

/** Stellar base reserve: each subentry (trustline, offer, signer, data entry…) locks up 0.5 XLM. */
const BASE_RESERVE_XLM = 0.5;

export function AccountCard() {
  const { address, account, isLoadingAccount, network } = useSorokit();
  const { success } = useToast();
  const sequenceLabelId = useId();
  const [showSequenceTooltip, setShowSequenceTooltip] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);

  if (!address) return null;

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Account</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            Stellar account details
          </p>
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
      <div className="px-5 py-5">
        {isLoadingAccount ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <AddressDisplay
              address={address}
              showFull
              label="Address"
              onCopy={() =>
                success("Address Copied", {
                  message: "The address has been copied to your clipboard.",
                })
              }
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
  if (!address) return null;

  // Derive 2-char abbreviation from last 4 chars of address
  const lastFourChars = address.slice(-4);
  const charCode1 = lastFourChars.charCodeAt(0);
  const charCode2 = lastFourChars.charCodeAt(1);
  const charCode3 = lastFourChars.charCodeAt(2);
  const charCode4 = lastFourChars.charCodeAt(3);
  const total = charCode1 + charCode2 + charCode3 + charCode4;

  // Use total to pick 2 chars deterministically
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const char1 = alphabet[total % 26];
  const char2 = alphabet[(total + charCode1) % 26];
  const initials = `${char1}${char2}`;

  return (
    <button
      onClick={() => onNavigate?.("account")}
      title={address}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-line hover:bg-surface-3 hover:border-line-2 transition-colors cursor-pointer"
    >
      <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center text-[11px] font-bold text-white shrink-0">
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
