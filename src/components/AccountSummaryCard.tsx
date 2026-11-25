import { Activity01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Badge } from "@/components/ui/Badge";
import { useSorokit } from "@/context/useSorokit";
import type { AccountData, Balance } from "@/lib/client";

export type HealthStatusLevel = "green" | "yellow" | "red";

export interface AccountHealth {
  status: "good" | "warning" | "danger";
  color: HealthStatusLevel;
  label: "Healthy" | "Attention" | "At Risk";
}

const BASE_RESERVE_XLM = 0.5;

export function computeAccountHealth(
  account: AccountData | null,
  balances: Balance[] = [],
): AccountHealth {
  if (!account) {
    return { status: "danger", color: "red", label: "At Risk" };
  }

  // Explicit health override if provided in mock / custom account
  const explicit =
    (account as Record<string, unknown>).health ??
    (account as Record<string, unknown>).healthStatus;
  if (explicit) {
    const norm = String(explicit).toLowerCase();
    if (norm === "green" || norm === "good" || norm === "healthy") {
      return { status: "good", color: "green", label: "Healthy" };
    }
    if (
      norm === "yellow" ||
      norm === "warning" ||
      norm === "medium" ||
      norm === "attention"
    ) {
      return { status: "warning", color: "yellow", label: "Attention" };
    }
    if (
      norm === "red" ||
      norm === "danger" ||
      norm === "poor" ||
      norm === "critical" ||
      norm === "at risk"
    ) {
      return { status: "danger", color: "red", label: "At Risk" };
    }
  }

  const nativeBalance = Number.parseFloat(
    balances.find((b) => b.assetType === "native")?.balance ?? "0",
  );
  // Stellar account reserve: 1.0 XLM base account + 0.5 XLM per subentry
  const requiredReserve = (account.subentryCount ?? 0) * BASE_RESERVE_XLM + 1.0;
  const availableBalance = nativeBalance - requiredReserve;

  // Red: Balance is below required reserve or non-existent
  if (nativeBalance <= 0 || availableBalance < 0.5) {
    return { status: "danger", color: "red", label: "At Risk" };
  }

  // Yellow: Balance is low (< 2 XLM available) or subentries are high
  if (availableBalance < 2.0 || (account.subentryCount ?? 0) > 50) {
    return { status: "warning", color: "yellow", label: "Attention" };
  }

  // Green: Healthy buffer available
  return { status: "good", color: "green", label: "Healthy" };
}

export interface AccountSummaryCardProps {
  account?: AccountData | null;
  balances?: Balance[];
}

export function AccountSummaryCard(props?: AccountSummaryCardProps) {
  const context = useSorokit();
  const account =
    props?.account !== undefined ? props.account : context.account;
  const balances =
    props?.balances !== undefined ? props.balances : context.balances;

  if (!account) {
    return null;
  }

  const health = computeAccountHealth(account, balances);

  const signersCount = Array.isArray(
    (account as Record<string, unknown>).signers,
  )
    ? ((account as Record<string, unknown>).signers as unknown[]).length
    : typeof (account as Record<string, unknown>).signerCount === "number"
      ? ((account as Record<string, unknown>).signerCount as number)
      : 1;

  const reserveImpact =
    (account as Record<string, unknown>).reserveImpact !== undefined
      ? String((account as Record<string, unknown>).reserveImpact)
      : `${((account.subentryCount ?? 0) * BASE_RESERVE_XLM).toFixed(2)} XLM`;

  const trustlineCount =
    (account as Record<string, unknown>).trustlineCount !== undefined
      ? Number((account as Record<string, unknown>).trustlineCount)
      : Array.isArray((account as Record<string, unknown>).trustlines)
        ? ((account as Record<string, unknown>).trustlines as unknown[]).length
        : (balances || []).filter((b) => b.assetType !== "native").length;

  return (
    <div
      className="rounded-xl border border-line bg-surface p-5 overflow-hidden"
      data-testid="account-summary-card"
    >
      <div className="flex items-center justify-between pb-4 border-b border-line">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Activity01Icon}
            size={18}
            className="text-ink-2"
          />
          <div>
            <h3 className="text-[14px] font-semibold text-ink">
              Account Summary
            </h3>
            <p className="text-[12px] text-ink-3">
              Quick overview of account health and metrics
            </p>
          </div>
        </div>
        <div
          data-testid="summary-health-status"
          data-health={health.color}
          className="flex items-center gap-1.5"
        >
          <Badge
            variant={
              health.color === "green"
                ? "success"
                : health.color === "yellow"
                  ? "warning"
                  : "error"
            }
            dot
          >
            {health.label}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Sequence
          </span>
          <span
            className="font-mono text-[14px] font-medium text-ink"
            data-testid="summary-sequence"
          >
            {account.sequence}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Signers
          </span>
          <span
            className="text-[14px] font-medium text-ink"
            data-testid="summary-signers"
          >
            {signersCount}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Reserve Impact
          </span>
          <span
            className="text-[14px] font-medium text-ink"
            data-testid="summary-reserve"
          >
            {reserveImpact}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
            Trustlines
          </span>
          <span
            className="text-[14px] font-medium text-ink"
            data-testid="summary-trustlines"
          >
            {trustlineCount}
          </span>
        </div>
      </div>
    </div>
  );
}
