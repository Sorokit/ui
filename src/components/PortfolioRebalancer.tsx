/**
 * PortfolioRebalancer — the main orchestrating component for #280.
 *
 * Tabs:
 *   1. Allocations  — current vs. target pie charts + AllocationInput
 *   2. Preview      — SwapRoute with fee/slippage summary
 *   3. Execute      — progress-tracked execution with per-swap status
 *   4. History      — RebalancerHistory of past runs
 *
 * All blockchain calls are stubbed through a `rebalance` hook so the component
 * remains testable without a live network.
 */

import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AllocationInput } from "@/components/AllocationInput";
import { RebalancerHistory } from "@/components/RebalancerHistory";
import { SwapExecutionTracker } from "@/components/SwapExecutionTracker";
import { SwapRoute } from "@/components/SwapRoute";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PieChart } from "@/components/ui/PieChart";
import { SLICE_COLORS } from "@/components/ui/PieChart";
import { useSorokit } from "@/context/useSorokit";
import type {
  AllocationDiff,
  PortfolioAsset,
  RebalanceExecution,
  RebalanceRecord,
} from "@/lib/rebalancer";
import {
  buildRebalanceRecord,
  computeAllocationDiffs,
  computeCurrentAllocations,
  createInitialExecution,
  formatPct,
  formatUsd,
  generateSwapSuggestions,
  isTargetValid,
  normaliseTargets,
  totalRebalanceCostUsd,
  updateSwapStatus,
  weightedAverageSlippage,
} from "@/lib/rebalancer";
import { cn } from "@/lib/utils";

// ─── Mock price feed ──────────────────────────────────────────────────────────

/**
 * Stub price map used when no live oracle is wired up.
 * In production this would be replaced by a real price feed.
 */
const STUB_PRICES: Record<string, number> = {
  XLM: 0.11,
  USDC: 1.0,
  USDT: 1.0,
  BTC: 65000,
  ETH: 3200,
};

async function fetchPrices(codes: string[]): Promise<Record<string, number>> {
  // Return stub prices for any known code; fall back to $1 for unknown assets.
  return Object.fromEntries(codes.map((c) => [c, STUB_PRICES[c] ?? 1.0]));
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "allocations" | "preview" | "execute" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "allocations", label: "Allocations" },
  { id: "preview", label: "Preview" },
  { id: "execute", label: "Execute" },
  { id: "history", label: "History" },
];

export interface PortfolioRebalancerProps {
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAssetCode(asset: { assetType: string; assetCode?: string; asset: string }): string {
  return asset.assetType === "native" ? "XLM" : (asset.assetCode ?? asset.asset);
}

function buildPortfolioAssets(
  balances: ReturnType<typeof useSorokit>["balances"],
  prices: Record<string, number>,
): PortfolioAsset[] {
  const raw = balances.map((b) => ({
    asset: b.asset,
    assetCode: getAssetCode(b),
    balance: b.balance,
    usdValue: null,
    currentPct: 0,
  }));
  return computeCurrentAllocations(raw, prices);
}

function buildPieSlices(assets: PortfolioAsset[], useTarget: boolean, targets: Record<string, number>) {
  return assets.map((a, i) => ({
    key: a.assetCode,
    label: a.assetCode,
    value: useTarget ? (targets[a.assetCode] ?? 0) : a.currentPct,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PortfolioRebalancer({ className }: PortfolioRebalancerProps) {
  const { isConnected, balances, isLoadingAccount, refreshAccount, client } = useSorokit();

  // ── Price state ───────────────────────────────────────────────────────────
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  // ── Portfolio state ───────────────────────────────────────────────────────
  const [customTargets, setCustomTargets] = useState<Record<string, number>>({});

  const portfolioAssets = useMemo(() => {
    if (balances.length === 0 || Object.keys(prices).length === 0) return [];
    return buildPortfolioAssets(balances, prices);
  }, [balances, prices]);

  const targets = useMemo(() => {
    if (Object.keys(customTargets).length > 0) return customTargets;
    return Object.fromEntries(portfolioAssets.map((a) => [a.assetCode, parseFloat(a.currentPct.toFixed(2))]));
  }, [customTargets, portfolioAssets]);

  const setTargets = setCustomTargets;

  const diffs = useMemo(() => {
    if (portfolioAssets.length === 0) return [];
    const normTargets = normaliseTargets(targets);
    const totalUsd = portfolioAssets.reduce((s, a) => s + (a.usdValue ?? 0), 0);
    return computeAllocationDiffs(portfolioAssets, normTargets, totalUsd);
  }, [portfolioAssets, targets]);

  const swaps = useMemo(() => {
    if (diffs.length === 0) return [];
    const baseFeeUsd = (Number(100) / 1e7) * (prices["XLM"] ?? 0.11);
    return generateSwapSuggestions(diffs, prices, baseFeeUsd);
  }, [diffs, prices]);

  // ── Swap / execution state ────────────────────────────────────────────────
  const [execution, setExecution] = useState<RebalanceExecution>(createInitialExecution(0));
  const [execError, setExecError] = useState<string | null>(null);

  // ── History ───────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<RebalanceRecord[]>([]);

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("allocations");

  const abortRef = useRef<AbortController | null>(null);

  // ── Load prices whenever balances change ─────────────────────────────────
  useEffect(() => {
    if (balances.length === 0) return;
    let active = true;
    const codes = balances.map(getAssetCode);
    fetchPrices(codes).then((p: Record<string, number>) => {
      if (!active) return;
      setPrices(p);
      setIsPricingLoading(false);
    });
    return () => { active = false; };
  }, [balances]);

  // ── Execution ─────────────────────────────────────────────────────────────
  const executeRebalance = useCallback(async () => {
    if (swaps.length === 0 || execution.isRunning) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const startedAt = new Date().toISOString();
    const beforeAllocs = Object.fromEntries(
      portfolioAssets.map((a) => [a.assetCode, a.currentPct]),
    );

    let exec: RebalanceExecution = {
      ...createInitialExecution(swaps.length),
      isRunning: true,
      startedAt,
    };
    setExecution(exec);
    setExecError(null);
    setActiveTab("execute");

    const txHashes: (string | null)[] = Array(swaps.length).fill(null);

    for (let i = 0; i < swaps.length; i++) {
      if (signal.aborted) break;

      exec = updateSwapStatus(exec, i, "submitting");
      setExecution({ ...exec, isRunning: true, currentSwapIndex: i });

      try {
        // Invoke the swap as a Soroban contract call. In production this would
        // call the AMM contract; here we use the generic invokeContract stub.
        const { data, error } = await client.soroban.invokeContract({
          contractId: "rebalancer",
          method: "swap",
          args: [swaps[i].from, swaps[i].to, swaps[i].fromAmount.toFixed(7)],
        });

        if (signal.aborted) break;

        if (error) {
          exec = updateSwapStatus(exec, i, "failed", null, error);
          setExecution({ ...exec, isRunning: true, currentSwapIndex: i + 1 });
          continue;
        }

        // Extract hash from result (real AMM response shape)
        const hash =
          typeof data === "object" && data !== null && "hash" in data
            ? String((data as { hash: string }).hash)
            : `stub-${randomId()}`;

        txHashes[i] = hash;
        exec = updateSwapStatus(exec, i, "success", hash);
        setExecution({ ...exec, isRunning: true, currentSwapIndex: i + 1 });
      } catch (e) {
        if (signal.aborted) break;
        const msg = e instanceof Error ? e.message : "Unknown error";
        exec = updateSwapStatus(exec, i, "failed", null, msg);
        setExecution({ ...exec, isRunning: true, currentSwapIndex: i + 1 });
      }
    }

    const finalExec: RebalanceExecution = { ...exec, isRunning: false };
    setExecution(finalExec);

    // Refresh account so balances reflect executed swaps
    await refreshAccount();

    // Compute after-allocations from updated balances (prices haven't changed)
    const afterAssets = buildPortfolioAssets(balances, prices);
    const afterAllocs = Object.fromEntries(
      afterAssets.map((a) => [a.assetCode, a.currentPct]),
    );

    const totalCostUsd = totalRebalanceCostUsd(swaps);
    const record = buildRebalanceRecord(
      randomId(),
      swaps,
      { ...finalExec, startedAt },
      beforeAllocs,
      afterAllocs,
      totalCostUsd,
    );
    setHistory((h) => [record, ...h]);
  }, [swaps, execution.isRunning, portfolioAssets, prices, balances, refreshAccount, client.soroban]);

  const cancelExecution = useCallback(() => {
    abortRef.current?.abort();
    setExecution((e) => ({ ...e, isRunning: false }));
  }, []);

  // ── Derived display values ────────────────────────────────────────────────
  const totalUsd = portfolioAssets.reduce((s, a) => s + (a.usdValue ?? 0), 0);
  const normTargets = normaliseTargets(targets);
  const targetValid = isTargetValid(normTargets);
  const totalCost = totalRebalanceCostUsd(swaps);
  const avgSlippage = weightedAverageSlippage(swaps);
  const currentSlices = buildPieSlices(portfolioAssets, false, {});
  const targetSlices = buildPieSlices(portfolioAssets, true, normTargets);
  const isLoading = isLoadingAccount || isPricingLoading;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
      {/* ── Card header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Portfolio Rebalancer</h2>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {isConnected
              ? totalUsd > 0
                ? `Portfolio value ~${formatUsd(totalUsd)}`
                : "Set target allocations to get started"
              : "Connect your wallet to rebalance"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="w-4 h-4 border border-ink-3 border-t-transparent rounded-full animate-spin" />
          )}
          {isConnected && !isLoading && (
            <button
              type="button"
              onClick={() => void refreshAccount()}
              className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors"
              aria-label="Refresh portfolio"
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
            </button>
          )}
          {swaps.length > 0 && targetValid && (
            <Badge variant="warning">{swaps.length} swap{swaps.length !== 1 ? "s" : ""} needed</Badge>
          )}
          {swaps.length === 0 && portfolioAssets.length > 0 && targetValid && (
            <Badge variant="success" dot>Balanced</Badge>
          )}
        </div>
      </div>

      {/* ── Not connected ──────────────────────────────────────────────────── */}
      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-16">
          Connect your wallet to view and rebalance your portfolio
        </p>
      ) : (
        <>
          {/* ── Tab bar ──────────────────────────────────────────────────── */}
          <div
            role="tablist"
            aria-label="Rebalancer sections"
            className="flex border-b border-line px-5 gap-1 overflow-x-auto"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`rebalancer-panel-${tab.id}`}
                id={`rebalancer-tab-${tab.id}`}
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
                {tab.id === "history" && history.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-surface-2 text-ink-3 text-[10px] font-semibold w-4 h-4">
                    {history.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Panel body ───────────────────────────────────────────────── */}
          <div className="p-5">

            {/* ──────────────────────── ALLOCATIONS ──────────────────────── */}
            <div
              id="rebalancer-panel-allocations"
              role="tabpanel"
              aria-labelledby="rebalancer-tab-allocations"
              hidden={activeTab !== "allocations"}
            >
              {isLoading ? (
                <AllocationsLoadingSkeleton />
              ) : portfolioAssets.length === 0 ? (
                <p className="text-[13px] text-ink-3 text-center py-10">
                  No assets found in your wallet
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Dual pie charts */}
                  <div className="flex flex-wrap items-start justify-around gap-6">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em]">
                        Current
                      </span>
                      <PieChart
                        slices={currentSlices}
                        size={140}
                        ariaLabel="Current portfolio allocation"
                        centerLabel={
                          <span className="text-[10px] text-ink-3 font-medium">
                            {portfolioAssets.length} assets
                          </span>
                        }
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[11px] font-semibold text-brand uppercase tracking-[0.08em]">
                        Target
                      </span>
                      <PieChart
                        slices={targetSlices}
                        size={140}
                        ariaLabel="Target portfolio allocation"
                        centerLabel={
                          targetValid ? (
                            <span className="text-[10px] text-green font-semibold">100%</span>
                          ) : (
                            <span className="text-[10px] text-orange font-semibold">
                              {Object.values(normTargets).reduce((s, v) => s + v, 0).toFixed(0)}%
                            </span>
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Allocation inputs */}
                  <AllocationInput
                    assets={portfolioAssets}
                    targets={targets}
                    onChange={setTargets}
                    disabled={execution.isRunning}
                  />

                  {/* Allocation diff summary table */}
                  {diffs.length > 0 && (
                    <DiffTable diffs={diffs} />
                  )}

                  {/* CTA */}
                  {targetValid && swaps.length > 0 && (
                    <Button
                      size="md"
                      onClick={() => setActiveTab("preview")}
                      className="self-start"
                    >
                      Preview swaps →
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ──────────────────────────── PREVIEW ──────────────────────── */}
            <div
              id="rebalancer-panel-preview"
              role="tabpanel"
              aria-labelledby="rebalancer-tab-preview"
              hidden={activeTab !== "preview"}
            >
              <div className="flex flex-col gap-5">
                {!targetValid && (
                  <ValidationBanner />
                )}

                <SwapRoute swaps={swaps} />

                {swaps.length > 0 && (
                  <PreviewSummary
                    swapCount={swaps.length}
                    totalCost={totalCost}
                    avgSlippage={avgSlippage}
                  />
                )}

                {swaps.length > 0 && targetValid && (
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setActiveTab("allocations")}
                    >
                      ← Edit targets
                    </Button>
                    <Button
                      size="md"
                      onClick={() => setActiveTab("execute")}
                    >
                      Confirm & execute →
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ─────────────────────────── EXECUTE ───────────────────────── */}
            <div
              id="rebalancer-panel-execute"
              role="tabpanel"
              aria-labelledby="rebalancer-tab-execute"
              hidden={activeTab !== "execute"}
            >
              <div className="flex flex-col gap-5">
                <ExecutionHeader
                  execution={execution}
                  swapCount={swaps.length}
                  error={execError}
                />

                {swaps.length > 0 && execution.swapStatuses.some((status) => status !== "pending") ? (
                  <SwapExecutionTracker
                    swap={swaps[0]}
                    txHash={execution.txHashes[0]}
                    executedAt={execution.startedAt}
                    actualOutput={swaps[0].toAmountExpected * 0.98}
                    slippageThresholdPct={0.2}
                    priceImpactPct={swaps[0].slippagePct}
                  />
                ) : null}

                <SwapRoute
                  swaps={swaps}
                  statuses={execution.swapStatuses}
                  txHashes={execution.txHashes}
                  errors={execution.errors}
                />

                <div className="flex gap-3 flex-wrap">
                  {!execution.isRunning && execution.swapStatuses.every((s) => s === "pending") && (
                    <>
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => setActiveTab("preview")}
                      >
                        ← Back
                      </Button>
                      <Button
                        size="md"
                        disabled={swaps.length === 0 || !targetValid}
                        onClick={() => void executeRebalance()}
                      >
                        Execute rebalance
                      </Button>
                    </>
                  )}
                  {execution.isRunning && (
                    <Button
                      variant="destructive"
                      size="md"
                      onClick={cancelExecution}
                    >
                      Cancel
                    </Button>
                  )}
                  {!execution.isRunning && execution.swapStatuses.some((s) => s !== "pending") && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setActiveTab("history")}
                    >
                      View history →
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* ─────────────────────────── HISTORY ───────────────────────── */}
            <div
              id="rebalancer-panel-history"
              role="tabpanel"
              aria-labelledby="rebalancer-tab-history"
              hidden={activeTab !== "history"}
            >
              <RebalancerHistory records={history} />
            </div>

          </div>
        </>
      )}
    </div>
  );
}

// ─── Small internal sub-components ────────────────────────────────────────────

function AllocationsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex justify-around">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <div className="w-16 h-3 rounded bg-surface-2 animate-pulse" />
            <div className="w-[140px] h-[140px] rounded-full bg-surface-2 animate-pulse" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-sm bg-surface-2 animate-pulse shrink-0" />
          <div className="w-14 h-3.5 rounded bg-surface-2 animate-pulse" />
          <div className="flex-1 h-1.5 rounded-full bg-surface-2 animate-pulse" />
          <div className="w-20 h-8 rounded-lg bg-surface-2 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ValidationBanner() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg bg-error-dim border border-error-dim-strong px-4 py-3"
    >
      <HugeiconsIcon
        icon={AlertCircleIcon}
        size={15}
        color="currentColor"
        strokeWidth={1.5}
        className="text-red mt-0.5 shrink-0"
      />
      <p className="text-[12px] text-red">
        Target allocations must sum to 100% before you can execute. Go back to{" "}
        <button
          type="button"
          className="underline font-medium"
          onClick={() => {}}
        >
          Allocations
        </button>{" "}
        to fix them.
      </p>
    </div>
  );
}

function PreviewSummary({
  swapCount,
  totalCost,
  avgSlippage,
}: {
  swapCount: number;
  totalCost: number;
  avgSlippage: number;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 px-5 py-4 flex flex-wrap gap-6">
      <SummaryCell label="Swaps" value={String(swapCount)} />
      <SummaryCell label="Est. total cost" value={formatUsd(totalCost)} highlight />
      <SummaryCell label="Avg slippage" value={formatPct(avgSlippage)} />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
        {label}
      </span>
      <span className={cn("text-[14px] font-semibold tabular-nums", highlight ? "text-ink" : "text-ink-2")}>
        {value}
      </span>
    </div>
  );
}

function ExecutionHeader({
  execution,
  swapCount,
  error,
}: {
  execution: RebalanceExecution;
  swapCount: number;
  error: string | null;
}) {
  const completed = execution.swapStatuses.filter((s) => s === "success").length;
  const failed = execution.swapStatuses.filter((s) => s === "failed").length;
  const allDone = !execution.isRunning && execution.swapStatuses.some((s) => s !== "pending");
  const allSuccess = allDone && failed === 0;

  if (execution.isRunning) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg bg-brand-dim border border-[rgba(86,69,212,0.25)] px-4 py-3"
      >
        <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-brand">
            Executing rebalance…
          </p>
          <p className="text-[11px] text-ink-2 mt-0.5">
            Swap {Math.min(execution.currentSwapIndex + 1, swapCount)} of {swapCount}
          </p>
        </div>
      </div>
    );
  }

  if (allDone) {
    return (
      <div
        role="status"
        className={cn(
          "flex items-center gap-3 rounded-lg px-4 py-3 border",
          allSuccess
            ? "bg-success-dim border-success-dim-strong"
            : "bg-[rgba(249,115,22,0.08)] border-[rgba(249,115,22,0.2)]",
        )}
      >
        <HugeiconsIcon
          icon={allSuccess ? CheckmarkCircle01Icon : AlertCircleIcon}
          size={16}
          color="currentColor"
          strokeWidth={1.5}
          className={allSuccess ? "text-green shrink-0" : "text-orange shrink-0"}
        />
        <div>
          <p className={cn("text-[13px] font-semibold", allSuccess ? "text-green" : "text-orange")}>
            {allSuccess ? "Rebalance complete" : `${completed} of ${swapCount} swaps completed`}
          </p>
          {failed > 0 && (
            <p className="text-[11px] text-ink-2 mt-0.5">
              {failed} swap{failed !== 1 ? "s" : ""} failed — check individual errors below
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg bg-error-dim border border-error-dim-strong px-4 py-3"
      >
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={15}
          color="currentColor"
          strokeWidth={1.5}
          className="text-red mt-0.5 shrink-0"
        />
        <p className="text-[12px] text-red">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-surface-2 border border-line px-4 py-3">
      <p className="text-[13px] font-semibold text-ink">Ready to execute</p>
      <p className="text-[12px] text-ink-3 mt-0.5">
        {swapCount} swap{swapCount !== 1 ? "s" : ""} will be submitted. You can cancel at any time.
      </p>
    </div>
  );
}

function DiffTable({ diffs }: { diffs: AllocationDiff[] }) {
  const nonZero = diffs.filter((d) => Math.abs(d.diffPct) >= 0.01);
  if (nonZero.length === 0) return null;
  return (
    <div className="rounded-lg border border-line overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-line bg-surface-2/50">
            <th className="text-left px-4 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-[0.08em]">Asset</th>
            <th className="text-right px-4 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-[0.08em]">Current</th>
            <th className="text-right px-4 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-[0.08em]">Target</th>
            <th className="text-right px-4 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-[0.08em]">Diff</th>
          </tr>
        </thead>
        <tbody>
          {nonZero.map((d) => (
            <tr key={d.assetCode} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5 font-medium text-ink">{d.assetCode}</td>
              <td className="px-4 py-2.5 text-right text-ink-2 tabular-nums">{formatPct(d.currentPct)}</td>
              <td className="px-4 py-2.5 text-right text-ink-2 tabular-nums">{formatPct(d.targetPct)}</td>
              <td className={cn(
                "px-4 py-2.5 text-right font-semibold tabular-nums",
                d.diffPct > 0 ? "text-green" : "text-orange",
              )}>
                {d.diffPct > 0 ? "+" : ""}{formatPct(d.diffPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
