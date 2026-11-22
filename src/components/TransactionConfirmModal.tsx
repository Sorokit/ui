/**
 * TransactionConfirmModal
 *
 * A confirmation dialog shown before signing a transaction: transaction
 * type, operation summaries, a full fee breakdown (stroops and XLM), the
 * source account, sequence number, and timeout ledger. Requires an explicit
 * "Confirm & Sign" click before the caller's `onConfirm` runs.
 *
 * This component is presentation-only — it does not build or sign
 * transactions itself (see package.json's "Strictly presentation layer"
 * description). Callers construct a `TransactionPreviewData` from whatever
 * their sorokit-core client / transaction builder exposes and pass it in.
 *
 * @component
 * @example
 * ```tsx
 * import { TransactionConfirmModal } from 'sorokit-ui';
 *
 * function SendPayment() {
 *   const [preview, setPreview] = useState<TransactionPreviewData | null>(null);
 *   return (
 *     <TransactionConfirmModal
 *       open={preview !== null}
 *       transaction={preview}
 *       onCancel={() => setPreview(null)}
 *       onConfirm={async () => {
 *         await submit();
 *         setPreview(null);
 *       }}
 *     />
 *   );
 * }
 * ```
 */
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Separator } from "@/components/ui/Separator";
import { useI18n } from "@/i18n";
import { STROOPS_PER_XLM } from "@/lib/staking";
import { cn, friendlyError, truncateAddress } from "@/lib/utils";

import { HardwareWalletBadge } from "./HardwareWalletBadge";

export interface TransactionOperationSummary {
  /** Short operation type label, e.g. "Payment", "Change Trust" */
  type: string;
  /** Human-readable description, e.g. "Send 100 XLM to GABC…WXYZ" */
  description: string;
}

export interface TransactionFeeBreakdown {
  /** Stellar network base fee, in stroops */
  baseFeeStroops: string;
  /** Additional Soroban resource fee, in stroops, if applicable */
  networkFeeStroops?: string;
  /** Total fee that will be charged, in stroops */
  totalStroops: string;
}

export interface TransactionPreviewData {
  /** e.g. "Payment", "Path Payment", "Contract Invocation" */
  transactionType: string;
  operations: TransactionOperationSummary[];
  fee: TransactionFeeBreakdown;
  sourceAccount: string;
  /** Omitted when unavailable — shown as "Determined by wallet" */
  sequenceNumber?: string;
  /** Omitted when unavailable — shown as "Determined by wallet" */
  timeoutLedger?: number;
  /**
   * Total outbound amount in stroops. Used with `isHardwareWallet` to decide
   * whether the extra on-device confirmation step is required (#1153).
   */
  totalAmountStroops?: string;
}

export interface TransactionConfirmModalProps {
  open: boolean;
  transaction: TransactionPreviewData | null;
  /** Called when the user clicks "Confirm & Sign" */
  onConfirm: () => void | Promise<void>;
  /** Called on Cancel, backdrop click, close button, or Escape */
  onCancel: () => void;
  /** Shows a loading state on the confirm button and disables both actions */
  isSigning?: boolean;
  /** Signing happens on a hardware device, so show its badge and extra guard (#1153). */
  isHardwareWallet?: boolean;
  /** Override the high-value boundary; accepts a positive integer stroop string. */
  highValueThresholdStroops?: string;
}

/**
 * Payments at or above this value (100 XLM in stroops) require an explicit
 * on-device review step when a hardware wallet is connected (#1153).
 */
export const HARDWARE_HIGH_VALUE_THRESHOLD_STROOPS = "1000000000";

function groupIntegerDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Convert stroops to an XLM label with integer division so values past
 * Number.MAX_SAFE_INTEGER keep every digit.
 */
function stroopsToXlmLabel(stroops: string): string {
  const trimmed = stroops.trim();
  if (!/^\d+$/.test(trimmed)) return "—";

  const value = BigInt(trimmed);
  const scale = BigInt(STROOPS_PER_XLM);
  const whole = value / scale;
  const fraction = value % scale;
  const wholeLabel = groupIntegerDigits(whole.toString());
  if (fraction === 0n) return `${wholeLabel} XLM`;

  const fractionLabel = fraction.toString().padStart(7, "0").replace(/0+$/, "");
  return `${wholeLabel}.${fractionLabel} XLM`;
}

/** Integer stroop comparison so large amounts never lose precision. */
function isHighValueAmount(
  amount: string | undefined,
  threshold: string,
): boolean {
  if (!amount) return false;
  const value = amount.trim();
  const boundary = threshold.trim();
  if (!/^\d+$/.test(value) || !/^\d+$/.test(boundary)) return false;
  return BigInt(value) >= BigInt(boundary);
}

function signingFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return friendlyError(error.message);
  if (typeof error === "string" && error.trim()) return friendlyError(error);
  return "Signing was rejected. Review the transaction and try again.";
}

export function TransactionConfirmModal({
  open,
  transaction,
  onConfirm,
  onCancel,
  isSigning = false,
  isHardwareWallet = false,
  highValueThresholdStroops = HARDWARE_HIGH_VALUE_THRESHOLD_STROOPS,
}: TransactionConfirmModalProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [deviceConfirmed, setDeviceConfirmed] = useState(false);
  const [trackedOpen, setTrackedOpen] = useState(open);

  if (trackedOpen !== open) {
    setTrackedOpen(open);
    if (!open) {
      setSigningError(null);
      setDeviceConfirmed(false);
    }
  }

  const showSigning = submitting || (isSigning && signingError === null);
  const requiresDeviceConfirmation =
    isHardwareWallet &&
    isHighValueAmount(transaction?.totalAmountStroops, highValueThresholdStroops);

  const handleConfirm = async () => {
    if (showSigning || !transaction) return;
    if (requiresDeviceConfirmation && !deviceConfirmed) return;
    setSigningError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (error) {
      setSigningError(signingFailureMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open && transaction !== null}
      onOpenChange={(next) => {
        if (!next && !showSigning) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[85vh] flex flex-col rounded-xl border border-line bg-surface shadow-2xl focus:outline-none animate-in fade-in zoom-in-95"
          aria-describedby="tx-confirm-desc"
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-1 shrink-0">
            <Dialog.Title className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              {t("tx.confirmTitle")}
              {isHardwareWallet && (
                <HardwareWalletBadge compact testId="tx-hardware-badge" />
              )}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="text-ink-4 hover:text-ink-2 transition-colors"
                aria-label="Close"
                disabled={showSigning}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={16}
                  color="currentColor"
                  strokeWidth={1.5}
                />
              </button>
            </Dialog.Close>
          </div>

          {transaction && (
            <>
              <p id="tx-confirm-desc" className="px-6 pb-4 text-[12px] text-ink-3">
                {transaction.transactionType} — {transaction.operations.length}{" "}
                operation{transaction.operations.length === 1 ? "" : "s"}
              </p>

              <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-5 pb-1">
                <Section title={t("tx.operations")}>
                  <div className="flex flex-col gap-2">
                    {transaction.operations.map((op, i) => (
                      <div
                        key={`${op.type}-${i}`}
                        className="rounded-lg border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <p className="text-[11px] font-semibold text-ink-2">
                          {i + 1}. {op.type}
                        </p>
                        <p
                          className="text-[12px] text-ink mt-0.5 max-w-full break-words"
                          style={{ overflowWrap: "anywhere" }}
                        >
                          {op.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title={t("tx.feeBreakdown")}>
                  <div className="flex flex-col gap-2 text-[12px]">
                    <FeeRow
                      label={t("tx.baseFee")}
                      stroops={transaction.fee.baseFeeStroops}
                    />
                    {transaction.fee.networkFeeStroops !== undefined && (
                      <>
                        <Separator spacing="sm" className="border-b border-line" />
                        <FeeRow
                          label={t("tx.networkFee")}
                          stroops={transaction.fee.networkFeeStroops}
                        />
                      </>
                    )}
                    <Separator spacing="sm" className="border-b border-line" />
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-ink-2">{t("tx.total")}</span>
                      <span className="text-ink tabular-nums">
                        {transaction.fee.totalStroops} stroops (
                        {stroopsToXlmLabel(transaction.fee.totalStroops)})
                      </span>
                    </div>
                  </div>
                </Section>

                <Section title={t("tx.details")}>
                  <div className="flex flex-col gap-2 text-[12px]">
                    <DetailRow label={t("tx.sourceAccount")}>
                      <span
                        data-address
                        className="font-mono text-ink"
                        title={transaction.sourceAccount}
                      >
                        {truncateAddress(transaction.sourceAccount, 8, 6)}
                      </span>
                    </DetailRow>
                    <DetailRow label={t("tx.sequenceNumber")}>
                      <span className="font-mono text-ink">
                        {transaction.sequenceNumber ?? t("tx.determinedByWallet")}
                      </span>
                    </DetailRow>
                    <DetailRow label={t("tx.timeoutLedger")}>
                      <span className="font-mono text-ink">
                        {transaction.timeoutLedger ?? t("tx.determinedByWallet")}
                      </span>
                    </DetailRow>
                  </div>
                </Section>

                {requiresDeviceConfirmation && (
                  <div
                    data-testid="hardware-confirmation"
                    className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-3"
                  >
                    <p className="text-[12px] text-ink">
                      {t("tx.hardwareNotice")}
                    </p>
                    <label className="mt-2 flex items-start gap-2 text-[12px] text-ink-2 cursor-pointer">
                      <input
                        type="checkbox"
                        data-testid="hardware-confirm-checkbox"
                        checked={deviceConfirmed}
                        onChange={(event) => setDeviceConfirmed(event.target.checked)}
                        className="mt-0.5 accent-purple-500"
                      />
                      <span>{t("tx.confirmOnDevice")}</span>
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {signingError && (
            <p
              role="alert"
              className="mx-6 mt-3 rounded-lg border border-error-dim-strong bg-error-dim px-3 py-2 text-[12px] text-red"
            >
              {signingError}
            </p>
          )}

          <div className="flex gap-2 px-6 py-4 border-t border-line shrink-0">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={onCancel}
              disabled={showSigning}
            >
              {t("tx.cancel")}
            </Button>
            <Button
              size="md"
              className="flex-1"
              loading={showSigning}
              disabled={
                !transaction ||
                showSigning ||
                (requiresDeviceConfirmation && !deviceConfirmed)
              }
              onClick={() => void handleConfirm()}
            >
              {showSigning ? t("tx.signing") : t("tx.confirmSign")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-3">{label}</span>
      {children}
    </div>
  );
}

function FeeRow({
  label,
  stroops,
  className,
}: {
  label: string;
  stroops: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-ink-3">{label}</span>
      <span className="text-ink tabular-nums">
        {stroops} stroops ({stroopsToXlmLabel(stroops)})
      </span>
    </div>
  );
}
