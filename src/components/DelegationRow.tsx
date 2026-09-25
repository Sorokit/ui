/**
 * DelegationRow — shows a user's delegation to one validator and provides
 * inline amount adjustment (delegate more / undelegate / redelegate) with fee preview
 * and confirmation flows.
 */

import {
  Alert01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  MinusSignIcon,
  PlusSignIcon,
  TimeQuarterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Delegation, Validator } from "@/lib/staking";
import {
  estimateDelegationFeeXlm,
  formatXlm,
  MOCK_VALIDATORS,
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
    type: "delegate" | "undelegate" | "redelegate",
    amount: string,
    targetValidatorId?: string,
  ) => Promise<void>;
  /** Optional list of validators for redelegation */
  validators?: Validator[];
  /** Whether a change is currently being submitted */
  isSubmitting?: boolean;
  className?: string;
}

type AdjustMode = "delegate" | "undelegate" | "redelegate" | null;

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
  validators: validatorsProp,
  isSubmitting = false,
  className,
}: DelegationRowProps) {
  const [mode, setMode] = useState<AdjustMode>(null);
  const [amountRaw, setAmountRaw] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [showUndelegateModal, setShowUndelegateModal] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  // Redelegate validator dropdown state
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const delegatedAmount = parseFloat(delegation.amount);
  const hasUnbonding = Boolean(
    delegation.unbondingAmount && parseFloat(delegation.unbondingAmount) > 0,
  );

  const candidateValidators = useMemo(() => {
    const list = validatorsProp ?? MOCK_VALIDATORS;
    return list.filter((v) => v.id !== validator.id);
  }, [validatorsProp, validator.id]);

  // Cleanly remove 0-amount entries upon completion or if 0 amount with no unbonding
  if (isRemoved || (delegatedAmount <= 0 && !hasUnbonding)) {
    return null;
  }

  const feeXlm = estimateDelegationFeeXlm();

  const amountError =
    amountRaw !== ""
      ? validateDelegationAmount(
          amountRaw,
          availableXlm,
          mode === "redelegate" ? "undelegate" : (mode ?? "delegate"),
          delegatedAmount,
        )
      : null;

  const canSubmit =
    mode !== null &&
    amountRaw !== "" &&
    amountError === null &&
    (mode === "redelegate" ? Boolean(selectedTargetId) : true) &&
    confirmed &&
    !isSubmitting;

  function openMode(m: AdjustMode) {
    setMode(m);
    setAmountRaw("");
    setConfirmed(false);
    setShowUndelegateModal(false);
    if (m === "redelegate" && candidateValidators.length > 0) {
      setSelectedTargetId(candidateValidators[0].id);
      setHighlightedIndex(0);
    }
  }

  function close() {
    setMode(null);
    setAmountRaw("");
    setConfirmed(false);
    setShowUndelegateModal(false);
    setIsDropdownOpen(false);
  }

  async function handleSubmit() {
    if (!canSubmit || !onAdjust) return;
    if (mode === "undelegate") {
      setShowUndelegateModal(true);
      return;
    }
    if (mode === "redelegate") {
      await onAdjust(delegation.validatorId, mode, amountRaw, selectedTargetId);
    } else {
      await onAdjust(delegation.validatorId, mode!, amountRaw);
    }
    close();
  }

  async function handleConfirmUndelegate() {
    if (!onAdjust) return;
    await onAdjust(delegation.validatorId, "undelegate", amountRaw);
    setShowUndelegateModal(false);
    if (parseFloat(amountRaw) >= delegatedAmount) {
      setIsRemoved(true);
    }
    close();
  }

  function handleDropdownKeyDown(e: React.KeyboardEvent) {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, candidateValidators.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (candidateValidators[highlightedIndex]) {
        setSelectedTargetId(candidateValidators[highlightedIndex].id);
        setIsDropdownOpen(false);
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      setIsDropdownOpen(false);
    }
  }

  const selectedTargetValidator = candidateValidators.find((v) => v.id === selectedTargetId);

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
              <button
                type="button"
                onClick={() => openMode("redelegate")}
                disabled={isSubmitting || delegatedAmount <= 0}
                aria-label={`Redelegate from ${validator.name}`}
                className="p-1.5 rounded-lg border border-line text-ink-3 hover:text-brand hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={13} color="currentColor" strokeWidth={2} />
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
          aria-label={`Adjust delegation — ${
            mode === "delegate"
              ? "add more"
              : mode === "undelegate"
              ? "remove"
              : "redelegate"
          }`}
        >
          <p className="text-[12px] font-semibold text-ink">
            {mode === "delegate"
              ? "Delegate more XLM"
              : mode === "undelegate"
              ? "Undelegate XLM"
              : "Redelegate XLM to another validator"}
          </p>

          {/* Redelegate: Target validator dropdown with full keyboard navigation */}
          {mode === "redelegate" && (
            <div className="flex flex-col gap-1.5" ref={dropdownRef}>
              <label
                id="target-validator-label"
                className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em]"
              >
                Target Validator
              </label>
              <div className="relative">
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls={listboxId}
                  aria-label="Select target validator"
                  aria-activedescendant={
                    isDropdownOpen && candidateValidators[highlightedIndex]
                      ? `validator-option-${candidateValidators[highlightedIndex].id}`
                      : undefined
                  }
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  onKeyDown={handleDropdownKeyDown}
                  disabled={isSubmitting}
                  className="flex items-center justify-between w-full h-9 px-3 rounded-lg border border-line bg-surface text-[13px] text-ink hover:border-line-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span>
                    {selectedTargetValidator
                      ? selectedTargetValidator.name
                      : "Select a validator"}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={14}
                    color="currentColor"
                    className={cn("transition-transform text-ink-3", isDropdownOpen && "rotate-180")}
                  />
                </button>

                {isDropdownOpen && (
                  <ul
                    id={listboxId}
                    role="listbox"
                    aria-label="Target validators"
                    tabIndex={-1}
                    className="absolute z-30 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg focus:outline-none"
                  >
                    {candidateValidators.map((v, index) => {
                      const isSelected = v.id === selectedTargetId;
                      const isHighlighted = index === highlightedIndex;
                      return (
                        <li
                          key={v.id}
                          id={`validator-option-${v.id}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setSelectedTargetId(v.id);
                            setIsDropdownOpen(false);
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 text-[12px] cursor-pointer transition-colors",
                            isHighlighted ? "bg-surface-2 text-ink" : "text-ink-2",
                            isSelected && "font-semibold text-brand",
                          )}
                        >
                          <span>{v.name}</span>
                          <span className="text-[11px] text-ink-4">
                            APY: {v.apyPct}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-start">
            {/* Amount input */}
            <div className="flex-1 min-w-[140px]">
              <Input
                label={
                  mode === "delegate"
                    ? "Amount to add (XLM)"
                    : mode === "undelegate"
                    ? "Amount to remove (XLM)"
                    : "Amount to redelegate (XLM)"
                }
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
                : mode === "undelegate"
                ? `undelegate ${formatXlm(amountRaw)} from ${validator.name}`
                : `redelegate ${formatXlm(amountRaw)} from ${validator.name} to ${
                    selectedTargetValidator?.name ?? "selected validator"
                  }`}
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
              {mode === "delegate"
                ? "Confirm Delegation"
                : mode === "undelegate"
                ? "Confirm Undelegation"
                : "Confirm Redelegation"}
            </Button>
            <Button size="sm" variant="ghost" disabled={isSubmitting} onClick={close}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* ── Undelegation Confirmation Modal ──────────────────────────────── */}
      <Dialog.Root open={showUndelegateModal} onOpenChange={setShowUndelegateModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 animate-in fade-in" />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl focus:outline-none animate-in fade-in zoom-in-95"
            aria-describedby="undelegate-dialog-desc"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <Dialog.Title className="text-[15px] font-semibold text-ink">
                Confirm Undelegation
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close dialog"
                  className="text-ink-4 hover:text-ink transition-colors"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={16} color="currentColor" strokeWidth={1.5} />
                </button>
              </Dialog.Close>
            </div>

            <div id="undelegate-dialog-desc" className="py-4 flex flex-col gap-3 text-[13px] text-ink-2">
              <p>
                Are you sure you want to undelegate{" "}
                <span className="font-semibold text-ink">{formatXlm(amountRaw)}</span> from{" "}
                <span className="font-semibold text-ink">{validator.name}</span>?
              </p>
              <div className="rounded-lg bg-surface-2 p-3 flex flex-col gap-2 text-[12px] border border-line">
                <div className="flex justify-between">
                  <span className="text-ink-3">Estimated Network Fee:</span>
                  <span className="font-medium text-ink">{formatXlm(feeXlm, 6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">Unbonding Period:</span>
                  <span className="font-medium text-orange">21 days</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-ink-3 bg-warning-dim/30 p-2.5 rounded-lg border border-orange/20">
                <HugeiconsIcon icon={Alert01Icon} size={16} color="currentColor" className="text-orange shrink-0 mt-0.5" />
                <span>
                  Notice: During the 21-day unbonding period, your funds will be locked, non-transferable, and will not earn staking rewards.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUndelegateModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                loading={isSubmitting}
                onClick={() => void handleConfirmUndelegate()}
                data-testid="modal-confirm-undelegate"
              >
                Confirm & Undelegate
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

