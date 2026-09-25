/**
 * StakingDashboard — main orchestrating component for the staking feature.
 *
 * Tabs:
 *   1. Validators  — searchable/filterable validator list with delegate CTA
 *   2. Delegations — user's active delegations with inline adjustment
 *   3. Rewards     — claimable & pending rewards with claim controls
 *   4. History     — 30-day reward history chart + event table
 *
 * All blockchain calls are stubbed through the mock data layer so the
 * component is fully testable without a live network.
 */

import {
  Award01Icon,
  Refresh01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DelegationRow } from "@/components/DelegationRow";
import { RewardHistory } from "@/components/RewardHistory";
import { RewardsPanel } from "@/components/RewardsPanel";
import { Badge } from "@/components/ui/Badge";
import { ValidatorCard } from "@/components/ValidatorCard";
import { ValidatorSearch } from "@/components/ValidatorSearch";
import { useSorokit } from "@/context/useSorokit";
import type {
  DailyReward,
  Delegation,
  RewardEvent,
  RewardScheduleEntry,
  Validator,
  ValidatorFilter,
} from "@/lib/staking";
import {
  aggregateDailyRewards,
  createDefaultFilter,
  filterValidators,
  formatXlm,
  generateMockRewardHistory,
  MOCK_DELEGATIONS,
  MOCK_REWARD_SCHEDULE,
  MOCK_VALIDATORS,
  totalClaimableXlm,
  totalDelegatedXlm,
} from "@/lib/staking";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "validators" | "delegations" | "rewards" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "validators", label: "Validators" },
  { id: "delegations", label: "Delegations" },
  { id: "rewards", label: "Rewards" },
  { id: "history", label: "History" },
];

export interface StakingDashboardProps {
  /**
   * Override validators for testing or custom integrations.
   * Defaults to MOCK_VALIDATORS.
   */
  validators?: Validator[];
  /**
   * Override delegations for testing or custom integrations.
   * Defaults to MOCK_DELEGATIONS when wallet is connected.
   */
  delegations?: Delegation[];
  /**
   * Override reward events for testing.
   * Defaults to generateMockRewardHistory().
   */
  rewardEvents?: RewardEvent[];
  /**
   * Override reward schedule for testing.
   * Defaults to MOCK_REWARD_SCHEDULE.
   */
  rewardSchedule?: RewardScheduleEntry[];
  className?: string;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ValidatorListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Loading validators">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-line bg-surface h-44 animate-pulse"
        />
      ))}
    </div>
  );
}

// ─── Summary stat ─────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg bg-surface-2 border border-line min-w-[100px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-4">
        {label}
      </span>
      <span className={cn("text-[15px] font-semibold text-ink", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StakingDashboard({
  validators: validatorsProp,
  delegations: delegationsProp,
  rewardEvents: rewardEventsProp,
  rewardSchedule: rewardScheduleProp,
  className,
}: StakingDashboardProps) {
  const { isConnected, isLoadingAccount, refreshAccount } = useSorokit();

  // ── Data ──────────────────────────────────────────────────────────────────
  const validators = validatorsProp ?? MOCK_VALIDATORS;
  const delegations: Delegation[] = isConnected
    ? (delegationsProp ?? MOCK_DELEGATIONS)
    : [];
  const allRewardEvents: RewardEvent[] =
    rewardEventsProp ?? generateMockRewardHistory();
  const schedule: RewardScheduleEntry[] =
    rewardScheduleProp ?? MOCK_REWARD_SCHEDULE;

  // ── Local state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("validators");
  const [filter, setFilter] = useState<ValidatorFilter>(createDefaultFilter());
  const [actingValidatorId, setActingValidatorId] = useState<string | null>(null);
  const [claimingIds, setClaimingIds] = useState<string[]>([]);
  const [isClaimingAll, setIsClaimingAll] = useState(false);
  const [localDelegations, setLocalDelegations] = useState<Delegation[]>(delegations);

  // Keep localDelegations in sync if prop changes (test/integration use)
  const prevDelegationsProp = useRef(delegationsProp);
  useEffect(() => {
    if (delegationsProp !== prevDelegationsProp.current) {
      prevDelegationsProp.current = delegationsProp;
      setLocalDelegations(delegationsProp ?? MOCK_DELEGATIONS);
    }
  }, [delegationsProp]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredValidators = useMemo(
    () => filterValidators(validators, filter),
    [validators, filter],
  );

  const dailyRewards: DailyReward[] = useMemo(
    () => aggregateDailyRewards(allRewardEvents),
    [allRewardEvents],
  );

  const totalStaked = totalDelegatedXlm(localDelegations);
  const totalClaimable = totalClaimableXlm(localDelegations);

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Open the delegation adjustment panel for a validator */
  const handleDelegate = useCallback((validatorId: string) => {
    // Navigate to the Delegations tab so the user can adjust inline
    setFilter((f) => ({ ...f, query: "" }));
    setActiveTab("delegations");
    // Scroll to top if possible (no router, just a gentle flag)
    setActingValidatorId(validatorId);
    // Clear the acting state after a short animation frame
    setTimeout(() => setActingValidatorId(null), 1500);
  }, []);

  /** Handle delegation adjustment (delegate / undelegate) */
  const handleAdjust = useCallback(
    async (
      validatorId: string,
      type: "delegate" | "undelegate" | "redelegate",
      amount: string,
      targetValidatorId?: string,
    ) => {
      setActingValidatorId(validatorId);
      try {
        // In production: call getClient().staking.adjust(...)
        // Here we optimistically update local state to show immediate feedback.
        await new Promise<void>((resolve) => setTimeout(resolve, 800));

        setLocalDelegations((prev) => {
          const delta = parseFloat(amount);
          if (type === "redelegate" && targetValidatorId) {
            const next = prev.map((d) => {
              if (d.validatorId === validatorId) {
                const current = parseFloat(d.amount);
                return { ...d, amount: Math.max(0, current - delta).toFixed(7) };
              }
              if (d.validatorId === targetValidatorId) {
                const current = parseFloat(d.amount);
                return { ...d, amount: (current + delta).toFixed(7) };
              }
              return d;
            });
            if (!next.some((d) => d.validatorId === targetValidatorId)) {
              next.push({
                validatorId: targetValidatorId,
                amount: delta.toFixed(7),
                pendingReward: "0",
                claimableReward: "0",
                delegatedAt: new Date().toISOString(),
              });
            }
            return next.filter((d) => parseFloat(d.amount) > 0);
          }

          const existing = prev.find((d) => d.validatorId === validatorId);
          if (existing) {
            return prev
              .map((d) => {
                if (d.validatorId !== validatorId) return d;
                const current = parseFloat(d.amount);
                const next =
                  type === "delegate" ? current + delta : Math.max(0, current - delta);
                return { ...d, amount: next.toFixed(7) };
              })
              .filter((d) => parseFloat(d.amount) > 0);
          }
          // New delegation
          return [
            ...prev,
            {
              validatorId,
              amount: delta.toFixed(7),
              pendingReward: "0",
              claimableReward: "0",
              delegatedAt: new Date().toISOString(),
            },
          ];
        });

        await refreshAccount();
      } finally {
        setActingValidatorId(null);
      }
    },
    [refreshAccount],
  );

  /** Claim rewards for a single validator */
  const handleClaim = useCallback(
    async (validatorId: string) => {
      setClaimingIds((ids) => [...ids, validatorId]);
      try {
        // In production: call getClient().staking.claimRewards(validatorId)
        await new Promise<void>((resolve) => setTimeout(resolve, 800));

        setLocalDelegations((prev) =>
          prev.map((d) =>
            d.validatorId === validatorId
              ? { ...d, claimableReward: "0" }
              : d,
          ),
        );
      } finally {
        setClaimingIds((ids) => ids.filter((id) => id !== validatorId));
      }
    },
    [],
  );

  /** Claim all rewards at once */
  const handleClaimAll = useCallback(async () => {
    setIsClaimingAll(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      setLocalDelegations((prev) =>
        prev.map((d) => ({ ...d, claimableReward: "0" })),
      );
    } finally {
      setIsClaimingAll(false);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-line">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Staking Dashboard</h2>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {isConnected
              ? totalStaked > 0
                ? `${formatXlm(totalStaked, 2)} staked across ${localDelegations.length} validator${localDelegations.length !== 1 ? "s" : ""}`
                : "Delegate XLM to start earning rewards"
              : "Connect your wallet to manage staking"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoadingAccount && (
            <span className="w-4 h-4 border border-ink-3 border-t-transparent rounded-full animate-spin" />
          )}

          {isConnected && !isLoadingAccount && (
            <button
              type="button"
              onClick={() => void refreshAccount()}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors"
              aria-label="Refresh staking data"
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
            </button>
          )}

          {isConnected && totalClaimable > 0 && (
            <Badge variant="success" dot live>
              <HugeiconsIcon icon={Award01Icon} size={10} color="currentColor" strokeWidth={2} />
              {formatXlm(totalClaimable, 2)} claimable
            </Badge>
          )}

          {isConnected && localDelegations.length > 0 && (
            <Badge variant="primary">
              <HugeiconsIcon icon={Task01Icon} size={10} color="currentColor" strokeWidth={2} />
              {localDelegations.length} active
            </Badge>
          )}
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      {isConnected && localDelegations.length > 0 && (
        <div
          className="flex flex-wrap gap-2 px-5 py-3 border-b border-line overflow-x-auto"
          aria-label="Staking summary"
        >
          <StatChip
            label="Total Staked"
            value={formatXlm(totalStaked, 2)}
            valueClassName="text-brand"
          />
          <StatChip
            label="Claimable"
            value={formatXlm(totalClaimable, 4)}
            valueClassName="text-green"
          />
          <StatChip
            label="Validators"
            value={String(localDelegations.length)}
          />
        </div>
      )}

      {/* ── Not connected ─────────────────────────────────────────────────── */}
      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-16">
          Connect your wallet to view validators and manage delegations
        </p>
      ) : (
        <>
          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div
            role="tablist"
            aria-label="Staking sections"
            className="flex border-b border-line px-5 gap-1 overflow-x-auto"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`staking-panel-${tab.id}`}
                id={`staking-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative py-3 px-3 text-[12px] font-medium whitespace-nowrap transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand rounded-t",
                  activeTab === tab.id
                    ? "text-ink after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand after:rounded-t"
                    : "text-ink-3 hover:text-ink-2",
                )}
              >
                {tab.label}
                {tab.id === "delegations" && localDelegations.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-surface-2 text-ink-3 text-[10px] font-semibold w-4 h-4">
                    {localDelegations.length}
                  </span>
                )}
                {tab.id === "rewards" && totalClaimable > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-success-dim text-green text-[10px] font-semibold w-4 h-4">
                    !
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Panel body ──────────────────────────────────────────────── */}
          <div className="p-5">

            {/* ──────────────────────── VALIDATORS ──────────────────────── */}
            <div
              id="staking-panel-validators"
              role="tabpanel"
              aria-labelledby="staking-tab-validators"
              hidden={activeTab !== "validators"}
            >
              <div className="flex flex-col gap-4">
                <ValidatorSearch
                  filter={filter}
                  onChange={setFilter}
                  totalCount={validators.length}
                  filteredCount={filteredValidators.length}
                />

                {isLoadingAccount ? (
                  <ValidatorListSkeleton />
                ) : filteredValidators.length === 0 ? (
                  <p className="text-[13px] text-ink-3 text-center py-10">
                    No validators match your search
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredValidators.map((v) => (
                      <ValidatorCard
                        key={v.id}
                        validator={v}
                        delegation={localDelegations.find(
                          (d) => d.validatorId === v.id,
                        )}
                        onDelegate={handleDelegate}
                        isActing={actingValidatorId === v.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─────────────────────── DELEGATIONS ──────────────────────── */}
            <div
              id="staking-panel-delegations"
              role="tabpanel"
              aria-labelledby="staking-tab-delegations"
              hidden={activeTab !== "delegations"}
            >
              {localDelegations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[13px] text-ink-3">
                    You have no active delegations.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("validators")}
                    className="mt-3 text-[13px] text-brand hover:underline focus-visible:outline-none"
                  >
                    Browse validators →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {localDelegations.map((d) => {
                    const validator = validators.find(
                      (v) => v.id === d.validatorId,
                    );
                    if (!validator) return null;
                    return (
                      <DelegationRow
                        key={d.validatorId}
                        delegation={d}
                        validator={validator}
                        availableXlm={10000} // In production: derive from wallet balance
                        onAdjust={handleAdjust}
                        isSubmitting={actingValidatorId === d.validatorId}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* ──────────────────────────── REWARDS ─────────────────────── */}
            <div
              id="staking-panel-rewards"
              role="tabpanel"
              aria-labelledby="staking-tab-rewards"
              hidden={activeTab !== "rewards"}
            >
              {localDelegations.length === 0 ? (
                <p className="text-[13px] text-ink-3 text-center py-12">
                  Start delegating to earn rewards.
                </p>
              ) : (
                <RewardsPanel
                  delegations={localDelegations}
                  validators={validators}
                  schedule={schedule}
                  onClaim={handleClaim}
                  onClaimAll={handleClaimAll}
                  claimingIds={
                    isClaimingAll
                      ? localDelegations.map((d) => d.validatorId)
                      : claimingIds
                  }
                />
              )}
            </div>

            {/* ──────────────────────────── HISTORY ─────────────────────── */}
            <div
              id="staking-panel-history"
              role="tabpanel"
              aria-labelledby="staking-tab-history"
              hidden={activeTab !== "history"}
            >
              <RewardHistory
                dailyRewards={dailyRewards}
                events={allRewardEvents}
                validators={validators}
              />
            </div>

          </div>
        </>
      )}
    </div>
  );
}
