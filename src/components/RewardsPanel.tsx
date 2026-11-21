/**
 * RewardsPanel — shows claimable rewards, pending rewards, and upcoming
 * reward schedule across all validators.
 */

import {
  Clock01Icon,
  GiftIcon,
  TimeQuarterIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Delegation, RewardScheduleEntry, Validator } from "@/lib/staking";
import {
  formatXlm,
  totalClaimableXlm,
  totalPendingXlm,
} from "@/lib/staking";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardsPanelProps {
  delegations: Delegation[];
  validators: Validator[];
  schedule: RewardScheduleEntry[];
  /** Called when the user claims rewards for a specific validator */
  onClaim?: (validatorId: string) => Promise<void>;
  /** Called when the user claims all rewards at once */
  onClaimAll?: () => Promise<void>;
  /** IDs of validators with in-flight claim operations */
  claimingIds?: string[];
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validatorName(validators: Validator[], id: string): string {
  return validators.find((v) => v.id === id)?.name ?? id;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-surface-2 border border-line px-4 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-ink-3">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
          {label}
        </span>
      </div>
      <span className={cn("text-[18px] font-semibold leading-snug", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RewardsPanel({
  delegations,
  validators,
  schedule,
  onClaim,
  onClaimAll,
  claimingIds = [],
  className,
}: RewardsPanelProps) {
  const totalClaimable = totalClaimableXlm(delegations);
  const totalPending = totalPendingXlm(delegations);

  const claimableDelegations = delegations.filter(
    (d) => parseFloat(d.claimableReward) > 0,
  );
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const claimAllInFlightRef = useRef(false);

  const handleClaimAll = async () => {
    if (!onClaimAll || claimAllInFlightRef.current || claimingIds.length > 0) {
      return;
    }

    claimAllInFlightRef.current = true;
    setIsClaimingAll(true);
    try {
      await onClaimAll();
    } catch {
      // The parent owns transaction error feedback; always release the local guard.
    } finally {
      claimAllInFlightRef.current = false;
      setIsClaimingAll(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>

      {/* ── Summary tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryTile
          label="Claimable Now"
          value={formatXlm(totalClaimable)}
          valueClassName="text-green"
          icon={
            <HugeiconsIcon
              icon={GiftIcon}
              size={13}
              color="currentColor"
              strokeWidth={1.5}
            />
          }
        />
        <SummaryTile
          label="Pending Next Epoch"
          value={formatXlm(totalPending)}
          valueClassName="text-ink"
          icon={
            <HugeiconsIcon
              icon={Clock01Icon}
              size={13}
              color="currentColor"
              strokeWidth={1.5}
            />
          }
        />
      </div>

      {/* ── Claim all ──────────────────────────────────────────────────────── */}
      {totalClaimable > 0 && onClaimAll && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-success-dim-strong bg-success-dim px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-green">
              {formatXlm(totalClaimable)} ready to claim
            </p>
            <p className="text-[11px] text-ink-3 mt-0.5">
              Across {claimableDelegations.length} validator
              {claimableDelegations.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => void handleClaimAll()}
            loading={isClaimingAll || claimingIds.length > 0}
            disabled={isClaimingAll || claimingIds.length > 0}
            aria-label="Claim all rewards"
          >
            Claim All
          </Button>
        </div>
      )}

      {totalClaimable === 0 && (
        <p className="text-[12px] text-ink-3 text-center py-2">
          No claimable rewards at this time.
        </p>
      )}

      {/* ── Per-validator claimable rewards ────────────────────────────────── */}
      {claimableDelegations.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            <Tooltip content="Rewards available to withdraw immediately.">
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                Claimable Now
              </span>
            </Tooltip>
          </p>
          {claimableDelegations.map((d) => {
            const isClaiming = claimingIds.includes(d.validatorId);
            const claimable = parseFloat(d.claimableReward);
            const pending = parseFloat(d.pendingReward);

            return (
              <div
                key={d.validatorId}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">
                    {validatorName(validators, d.validatorId)}
                  </p>
                  {pending > 0 && (
                    <span className="text-[11px] text-ink-3">
                      Pending: {formatXlm(pending)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[14px] font-semibold text-green">
                    {formatXlm(claimable)}
                  </span>
                  {onClaim && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={isClaiming}
                      disabled={isClaiming || claimingIds.length > 0}
                      onClick={() => void onClaim(d.validatorId)}
                      aria-label={`Claim rewards from ${validatorName(validators, d.validatorId)}`}
                    >
                      Claim
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pending rewards ─────────────────────────────────────────────────── */}
      {totalPending > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            <Tooltip content="Rewards still vesting and expected in the next epoch; they cannot be withdrawn yet.">
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                Pending Next Epoch
              </span>
            </Tooltip>
          </p>
          {delegations
            .filter((d) => parseFloat(d.pendingReward) > 0)
            .map((d) => (
              <div
                key={d.validatorId}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-2"
              >
                <p className="text-[12px] text-ink-2 truncate">
                  {validatorName(validators, d.validatorId)}
                </p>
                <Badge variant="default">
                  <HugeiconsIcon
                    icon={Clock01Icon}
                    size={10}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                  {formatXlm(d.pendingReward)}
                </Badge>
              </div>
            ))}
        </div>
      )}

      {/* ── Upcoming schedule ──────────────────────────────────────────────── */}
      {schedule.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Upcoming Schedule
          </p>
          {schedule.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <HugeiconsIcon
                  icon={TimeQuarterIcon}
                  size={13}
                  color="currentColor"
                  strokeWidth={1.5}
                  className="text-ink-3 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-ink">
                    {formatDate(entry.estimatedDate)}
                  </p>
                  <p className="text-[11px] text-ink-3 truncate">
                    {validatorName(validators, entry.validatorId)}
                  </p>
                </div>
              </div>
              <span className="text-[13px] font-semibold text-teal shrink-0">
                ~{formatXlm(entry.estimatedAmount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
