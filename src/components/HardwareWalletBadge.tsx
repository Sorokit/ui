/**
 * Shared indicator for a connected hardware wallet (#1153).
 *
 * The provider owns detection (`isHardware`); this component only renders the
 * answer so the connect button, transaction modal, and account surfaces all
 * use the same wording and styling.
 */
import { useI18n } from "@/i18n";

export interface HardwareWalletBadgeProps {
  /** Wallet name from the provider, used only to prefer the Ledger label. */
  walletName?: string | null;
  /** Compact variant for dense menu headers. */
  compact?: boolean;
  /** Override the test id when more than one badge can be on screen. */
  testId?: string;
}

export function HardwareWalletBadge({
  walletName,
  compact = false,
  testId = "hardware-badge",
}: HardwareWalletBadgeProps) {
  const { t } = useI18n();
  const label =
    walletName && walletName.toLowerCase().includes("ledger")
      ? "Ledger"
      : t("hardware.badge");

  return (
    <span
      data-testid={testId}
      role="status"
      className={
        compact
          ? "text-[9px] font-medium px-1 py-0.2 rounded bg-purple-500/15 text-purple-400"
          : "text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0"
      }
    >
      {label}
    </span>
  );
}
