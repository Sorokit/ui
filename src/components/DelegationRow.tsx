/**
 * DelegationRow — shows a user's delegation to one validator and provides
 * inline amount adjustment (delegate more / undelegate) with fee preview
 * and a two-step confirmation flow.
 */

import {
  Cancel01Icon,
  CheckmarkCircle01Icon,
  MinusSignIcon,
  PlusSignIcon,
  TimeQuarterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Delegation, Validator } from "@/lib/staking";
import {
  estimateDelegationFeeXlm,
  formatXlm,
  validateDelegationAmount,
} from "@/lib/staking";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegationRowProps {
  delegation: Delegation;
  validator: Validator;
  /** Available XLM balance in the wallet */
  availableXlm: number;
  /** Called when the user confirms a delegation change */
  onAdjust?: (
    validatorId: string,
    type: "delegate" | "undelegate",
    amount: string,
  ) => Promise<void>;
  /** Whether a change is currently being submitted */
  isSubmitting?: boolean;
  className?: string;
}

type AdjustMode = "delegate" | "undelegate" | null;

// ─── Sub-components ───────────────────────────────────────────────────────────

function UnbondingChip({
  amount,
  endsAt,
}: {
  amount: string;
  endsAt: string;
}) {
  const label = new Date(endsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-orange">
      <HugeiconsIcon icon={TimeQuarterIcon} size={11} color="currentColor" strokeWidth={1.5} />
      {formatXlm(amount)} unbonding · ready {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DelegationRow({
  delegation,
  validator,
  availableXlm,
  onAdjust,
  isSubmitting = false,
  className,
}: DelegationRowProps) {
  const [mode, setMode] = useState<AdjustMode>(null);
  const [amountRaw, setAmountRaw] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const delegatedAmount = parseFloat(delegation.amount);
  const feeXlm = estimateDelegationFeeXlm();

  const amountError =
    amountRaw !== ""
      ? validateDelegationAmount(amountRaw, availableXlm, mode ?? "delegate", delegatedAmount)
      : null;

  const canSubmit =
    mode !== null &&
    amountRaw !== "" &&
    amountError === null &&
    confirmed &&
    !isSubmitting;

  function openMode(m: AdjustMode) {
    setMode(m);
    setAmountRaw("");
    setConfirmed(false);
  }

  function close() {
    setMode(null);
    setAmountRaw("");
    setConfirmed(false);
  }

  async function handleSubmit() {
    if (!canSubmit || !onAdjust) return;
    await onAdjust(delegation.validatorId, mode!, amountRaw);
    close();
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        {/* Left: validator identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          {validator.logoUrl ? (
            <img
              src={validator.logoUrl}
              alt=""
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-surface-2 object-cover shrink-0"
            />
          ) : (
            <span
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-brand-dim text-brand flex items-center justify-center text-[10px] font-bold shrink-0 select-none"
            >
              {validator.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{validator.name}</p>
            {delegation.unbondingAmount && delegation.unbondingEndsAt && (
              <UnbondingChip
                amount={delegation.unbondingAmount}
                endsAt={delegation.unbondingEndsAt}
              />
            )}
          </div>
        </div>

        {/* Right: amounts */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
              Delegated
            </p>
            <p className="text-[14px] font-semibold text-ink">
              {formatXlm(delegation.amount)}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
              Claimable
            </p>
            <p className="text-[13px] font-semibold text-green">
              {formatXlm(delegation.claimableReward)}
            </p>
          </div>

          {/* Adjust controls */}
          {onAdjust && mode === null && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openMode("delegate")}
                disabled={isSubmitting}
                aria-label={`Delegate more to ${validator.name}`}
                className="p-1.5 rounded-lg border border-line text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                <HugeiconsIcon icon={PlusSignIcon} size={13} color="currentColor" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => openMode("undelegate")}
                disabled={isSubmitting || delegatedAmount <= 0}
                aria-label={`Undelegate from ${validator.name}`}
                className="p-1.5 rounded-lg border border-line text-ink-3 hover:text-red hover:bg-error-dim hover:border-error-dim-strong transition-colors disabled:opacity-40"
              >
                <HugeiconsIcon icon={MinusSignIcon} size={13} color="currentColor" strokeWidth={2} />
              </button>
            </div>
          )}

          {onAdjust && mode !== null && (
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              aria-label="Cancel adjustment"
              className="p-1.5 rounded-lg border border-line text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-40"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} color="currentColor" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── Adjustment panel ──────────────────────────────────────────────── */}
      {mode !== null && (
        <div
          className="border-t border-line bg-surface-2 px-4 py-4 flex flex-col gap-3"
          aria-label={`Adjust delegation — ${mode === "delegate" ? "add more" : "remove"}`}
        >
          <p className="text-[12px] font-semibold text-ink">
            {mode === "delegate" ? "Delegate more XLM" : "Undelegate XLM"}
          </p>

          <div className="flex flex-wrap gap-3 items-start">
            {/* Amount input */}
            <div className="flex-1 min-w-[140px]">
              <Input
                label={mode === "delegate" ? "Amount to add (XLM)" : "Amount to remove (XLM)"}
                type="number"
                min="0"
                step="1"
                value={amountRaw}
                onChange={(e) => {
                  setAmountRaw(e.target.value);
                  setConfirmed(false);
                }}
                error={amountError ?? undefined}
                hint={
                  mode === "delegate"
                    ? `Available: ${formatXlm(availableXlm)}`
                    : `Delegated: ${formatXlm(delegation.amount)}`
                }
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            {/* Fee preview */}
            <div className="flex flex-col gap-0.5 pt-5 shrink-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                Est. Fee
              </span>
              <span className="text-[13px] font-semibold text-ink">
                {formatXlm(feeXlm, 6)}
              </span>
            </div>
          </div>

          {/* Confirmation checkbox */}
          {amountRaw !== "" && amountError === null && (
            <label className="flex items-center gap-2 text-[12px] text-ink-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={isSubmitting}
                className="w-3.5 h-3.5 accent-brand"
                aria-label="Confirm delegation change"
              />
              I confirm:{" "}
              {mode === "delegate"
                ? `delegate ${formatXlm(amountRaw)} to ${validator.name}`
                : `undelegate ${formatXlm(amountRaw)} from ${validator.name}`}
              {" "}(fee ≈ {formatXlm(feeXlm, 6)})
            </label>
          )}

          {/* Submit */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "undelegate" ? "destructive" : "primary"}
              disabled={!canSubmit}
              loading={isSubmitting}
              onClick={() => void handleSubmit()}
            >
              {mode === "delegate" ? (
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} color="currentColor" strokeWidth={2} />
              ) : null}
              {mode === "delegate" ? "Confirm Delegation" : "Confirm Undelegation"}
            </Button>
            <Button size="sm" variant="ghost" disabled={isSubmitting} onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
