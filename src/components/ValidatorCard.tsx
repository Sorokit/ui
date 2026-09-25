/**
 * ValidatorCard — displays a single validator's metrics.
 *
 * Shows: logo/avatar, name, description, status badge, commission, APY,
 * uptime, total staked, delegator count, and an optional "Delegate" CTA.
 * Validators that aren't active carry a warning and can't be delegated to.
 */

import {
  Alert01Icon,
  Award01Icon,
  Globe02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Delegation, Validator } from "@/lib/staking";
import { computeUptimePct, formatPct, formatXlm } from "@/lib/staking";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidatorCardProps {
  validator: Validator;
  /** Current user delegation to this validator, if any */
  delegation?: Delegation;
  /** Called when the user clicks "Delegate" */
  onDelegate?: (validatorId: string) => void;
  /** Whether a delegation action is in-flight for this validator */
  isActing?: boolean;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadgeVariant(
  status: Validator["status"],
): "success" | "error" | "warning" {
  if (status === "active") return "success";
  if (status === "jailed") return "error";
  return "warning";
}

function statusLabel(status: Validator["status"]): string {
  if (status === "active") return "Active";
  if (status === "jailed") return "Jailed";
  return "Inactive";
}

function uptimeClassName(pct: number | null): string {
  if (pct === null) return "text-ink-2";
  if (pct >= 99) return "text-green";
  if (pct >= 95) return "text-orange";
  return "text-red";
}

/** Why delegation is unavailable, shown to users before they try. */
function unavailableMessage(status: Validator["status"]): string | null {
  if (status === "jailed") {
    return "This validator is jailed for downtime or misbehaviour and is not earning rewards. New delegations are disabled.";
  }
  if (status === "inactive") {
    return "This validator is inactive and is not earning rewards. New delegations are disabled.";
  }
  return null;
}

/** Fallback letter-avatar when no logo URL is provided */
function ValidatorAvatar({ name, logoUrl }: { name: string; logoUrl?: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className="w-9 h-9 rounded-full bg-surface-2 object-cover shrink-0"
        onError={(e) => {
          // Fall back to initials avatar on load error
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="w-9 h-9 rounded-full bg-brand-dim text-brand flex items-center justify-center text-[12px] font-bold shrink-0 select-none"
    >
      {initials}
    </span>
  );
}

// ─── Metric cell ──────────────────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
        {label}
      </span>
      <span className={cn("text-[13px] font-semibold text-ink leading-snug", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValidatorCard({
  validator,
  delegation,
  onDelegate,
  isActing = false,
  className,
}: ValidatorCardProps) {
  const {
    id,
    name,
    logoUrl,
    commissionPct,
    apyPct,
    totalStaked,
    delegatorCount,
    status,
    rank,
    website,
    description,
  } = validator;

  const warningId = useId();
  const hasDelegation = delegation != null && parseFloat(delegation.amount) > 0;
  const uptime = computeUptimePct(validator);
  const warning = unavailableMessage(status);
  // Existing delegators keep "Manage" so they can move stake off a validator
  // that went inactive or got jailed; only new delegations are blocked.
  const delegationBlocked = warning !== null && !hasDelegation;

  return (
    <article
      aria-label={`Validator ${name}`}
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden transition-shadow hover:shadow-sm",
        status === "jailed" && "opacity-70",
        className,
      )}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ValidatorAvatar name={name} logoUrl={logoUrl} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Visually truncated only — the full name stays in the DOM for
                  assistive tech, and the tooltip reveals it on hover. */}
              <Tooltip content={name}>
                <h3 className="min-w-0 text-[13px] font-semibold text-ink leading-snug truncate">
                  {name}
                </h3>
              </Tooltip>
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${name} website`}
                  className="text-ink-3 hover:text-ink-2 transition-colors shrink-0"
                >
                  <HugeiconsIcon
                    icon={Globe02Icon}
                    size={12}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                </a>
              )}
            </div>
            <span className="text-[11px] text-ink-3">Rank #{rank}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge variant={statusBadgeVariant(status)} dot>
            {statusLabel(status)}
          </Badge>
          {hasDelegation && (
            <Badge variant="primary">
              <HugeiconsIcon icon={Award01Icon} size={10} color="currentColor" strokeWidth={2} />
              Delegating
            </Badge>
          )}
        </div>
      </div>

      {description && (
        <div className="px-4 pb-3">
          <Tooltip content={description}>
            <p
              data-testid="validator-description"
              className="line-clamp-2 break-words text-[12px] leading-relaxed text-ink-3"
            >
              {description}
            </p>
          </Tooltip>
        </div>
      )}

      {/* ── Inactive / jailed warning ───────────────────────────────────────── */}
      {warning && (
        <div className="px-4 pb-3">
          <p
            id={warningId}
            role="note"
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-snug",
              status === "jailed"
                ? "bg-error-dim border-error-dim-strong text-red"
                : "bg-[rgba(249,115,22,0.1)] border-[rgba(249,115,22,0.2)] text-orange",
            )}
          >
            <HugeiconsIcon
              icon={Alert01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.8}
              className="mt-px shrink-0"
              aria-hidden="true"
            />
            <span>{warning}</span>
          </p>
        </div>
      )}

      {/* ── Metrics grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 px-4 pb-3 border-b border-line">
        <MetricCell
          label="APY"
          value={formatPct(apyPct)}
          valueClassName="text-green"
        />
        <MetricCell
          label="Commission"
          value={formatPct(commissionPct)}
        />
        <MetricCell
          label="Uptime"
          value={
            uptime === null ? (
              <span
                className={uptimeClassName(uptime)}
                title="No uptime data recorded yet"
              >
                New
              </span>
            ) : (
              <span className={uptimeClassName(uptime)}>
                {formatPct(uptime)}
              </span>
            )
          }
        />
        <MetricCell
          label="Total Staked"
          value={formatXlm(parseFloat(totalStaked), 0)}
        />
        <MetricCell
          label="Delegators"
          value={
            <span className="flex items-center gap-1">
              <HugeiconsIcon
                icon={UserGroupIcon}
                size={11}
                color="currentColor"
                strokeWidth={1.5}
                className="text-ink-3"
              />
              {delegatorCount.toLocaleString()}
            </span>
          }
        />
        {hasDelegation && (
          <MetricCell
            label="My Delegation"
            value={formatXlm(delegation!.amount)}
            valueClassName="text-brand"
          />
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {hasDelegation ? (
          <span className="text-[11px] text-ink-3">
            Claimable:{" "}
            <span className="text-green font-semibold">
              {formatXlm(delegation!.claimableReward)}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-ink-4">No active delegation</span>
        )}

        {onDelegate && (
          <Button
            size="sm"
            variant={hasDelegation ? "secondary" : "primary"}
            disabled={delegationBlocked || isActing}
            aria-describedby={warning ? warningId : undefined}
            loading={isActing}
            onClick={() => onDelegate(id)}
            aria-label={`${hasDelegation ? "Manage delegation to" : "Delegate to"} ${name}`}
          >
            {hasDelegation ? "Manage" : "Delegate"}
          </Button>
        )}
      </div>
    </article>
  );
}
