/**
 * SwapRoute — displays a list of suggested swaps needed to reach the target
 * allocation, with per-swap fee/slippage estimates, multi-hop route inspection
 * (fee tiers and pool liquidity depth), responsive directional connectors,
 * circular route detection and rejection, and execution status indicators.
 */

import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Copy01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { AssetPill } from "@/components/AssetBadge";
import { Badge } from "@/components/ui/Badge";
import type { RouteHop, SwapStatus, SwapSuggestion } from "@/lib/rebalancer";
import {
  formatPct,
  formatUsd,
  totalFeeStroops,
  totalRebalanceCostUsd,
  weightedAverageSlippage,
} from "@/lib/rebalancer";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { RouteHop };

export interface NormalizedHop {
  asset: string;
  feeTier?: string;
  poolDepth?: string;
}

export interface SwapRouteProps {
  swaps: SwapSuggestion[];
  /** Optional per-swap execution status array (must match swaps length) */
  statuses?: SwapStatus[];
  /** Optional per-swap tx hashes revealed after execution */
  txHashes?: (string | null)[];
  /** Optional per-swap error messages */
  errors?: (string | null)[];
  className?: string;
}

export interface RouteValidationResult {
  isValid: boolean;
  isCircular: boolean;
  error?: string;
  path: string[];
}

// ─── Format & Route Inspection Helpers ────────────────────────────────────────

/**
 * Format a fee tier for display badge, e.g. 0.3 -> "0.3%".
 */
export function formatFeeTier(fee?: number | string): string | undefined {
  if (fee == null) return undefined;
  if (typeof fee === "number") {
    return `${fee}%`;
  }
  const str = String(fee).trim();
  if (!str) return undefined;
  if (str.endsWith("%")) return str;
  const parsed = parseFloat(str);
  if (!Number.isNaN(parsed)) {
    return `${parsed}%`;
  }
  return str;
}

/**
 * Format a pool liquidity depth for display indicator, e.g. 1200000 -> "$1.2M".
 */
export function formatPoolDepth(depth?: number | string): string | undefined {
  if (depth == null) return undefined;
  if (typeof depth === "number") {
    if (depth >= 1_000_000) {
      return `$${(depth / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (depth >= 1_000) {
      return `$${(depth / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return `$${depth.toLocaleString()}`;
  }
  const str = String(depth).trim();
  return str || undefined;
}

/**
 * Normalise intermediate hops for a swap suggestion into a standard array of nodes.
 */
export function getIntermediateHops(swap: SwapSuggestion): NormalizedHop[] {
  if (swap.hops && swap.hops.length > 0) {
    // If hops represent explicit legs (each has from & to, length >= 2)
    const isLegs = swap.hops.length >= 2 && swap.hops.every((h) => Boolean(h.from && h.to));
    if (isLegs) {
      const intermediate: NormalizedHop[] = [];
      for (let i = 0; i < swap.hops.length - 1; i++) {
        const leg = swap.hops[i];
        const nextLeg = swap.hops[i + 1];
        const asset = leg.to || leg.asset || `HOP${i + 1}`;
        const feeTier = formatFeeTier(leg.feeTier ?? leg.feeTierPct ?? nextLeg?.feeTier);
        const poolDepth = formatPoolDepth(
          leg.poolDepth ??
            leg.liquidityDepth ??
            leg.poolLiquidityDepth ??
            leg.poolDepthUsd ??
            nextLeg?.poolDepth ??
            nextLeg?.liquidityDepth,
        );
        intermediate.push({ asset, feeTier, poolDepth });
      }
      return intermediate;
    }

    // Otherwise, each entry represents an intermediate hop node
    return swap.hops.map((hop, i) => {
      const asset = hop.asset || hop.to || (swap.path && swap.path[i + 1]) || `HOP${i + 1}`;
      const feeTier = formatFeeTier(hop.feeTier ?? hop.feeTierPct);
      const poolDepth = formatPoolDepth(
        hop.poolDepth ?? hop.liquidityDepth ?? hop.poolLiquidityDepth ?? hop.poolDepthUsd,
      );
      return { asset, feeTier, poolDepth };
    });
  }

  // If path is provided without hops array, e.g. ["XLM", "USDC", "BTC"]
  if (swap.path && swap.path.length > 2) {
    const intermediateAssets = swap.path.slice(1, -1);
    return intermediateAssets.map((asset) => ({
      asset,
      feeTier: formatFeeTier(swap.swapFeePct),
      poolDepth: undefined,
    }));
  }

  return [];
}

/**
 * Extract the full ordered sequence of assets for a given swap route.
 */
export function getSwapPath(swap: SwapSuggestion): string[] {
  if (swap.path && swap.path.length > 0) {
    return swap.path;
  }
  const intermediateHops = getIntermediateHops(swap);
  if (intermediateHops.length > 0) {
    return [swap.from, ...intermediateHops.map((h) => h.asset), swap.to];
  }
  return [swap.from, swap.to];
}

// ─── Circular Route Detection & Validation ───────────────────────────────────

/**
 * Returns true if a swap route contains circular hops/loops
 * (e.g. XLM -> USDC -> XLM, or from === to).
 */
export function isCircularRoute(
  route: SwapSuggestion | string[] | RouteHop[],
): boolean {
  if (Array.isArray(route)) {
    if (route.length <= 1) return false;
    // Array of asset codes: e.g. ["XLM", "USDC", "XLM"]
    if (typeof route[0] === "string") {
      const seen = new Set<string>();
      for (const asset of route as string[]) {
        const key = asset.toUpperCase();
        if (seen.has(key)) return true;
        seen.add(key);
      }
      return false;
    }

    // Array of RouteHops (legs): e.g. [{ from: "XLM", to: "USDC" }, { from: "USDC", to: "XLM" }]
    const hops = route as RouteHop[];
    const seen = new Set<string>();
    for (const hop of hops) {
      if (hop.from && hop.to && hop.from.toUpperCase() === hop.to.toUpperCase()) return true;
      if (hop.from) {
        const k = hop.from.toUpperCase();
        if (seen.has(k)) return true;
        seen.add(k);
      }
      if (hop.asset) {
        const k = hop.asset.toUpperCase();
        if (seen.has(k)) return true;
        seen.add(k);
      }
      if (hop.to) {
        const k = hop.to.toUpperCase();
        if (seen.has(k)) return true;
        seen.add(k);
      }
    }
    return false;
  }

  if (!route) return false;

  // Direct swap where from === to (e.g. XLM -> XLM)
  if (route.from && route.to && route.from.toUpperCase() === route.to.toUpperCase()) {
    return true;
  }

  const path = getSwapPath(route);
  if (path.length > 1) {
    const seen = new Set<string>();
    for (const asset of path) {
      const upper = asset.toUpperCase();
      if (seen.has(upper)) {
        return true;
      }
      seen.add(upper);
    }
  }

  return false;
}

/**
 * Validates a swap route, specifically detecting and rejecting circular paths.
 */
export function validateSwapRoute(swap: SwapSuggestion): RouteValidationResult {
  const path = getSwapPath(swap);
  const circular = isCircularRoute(swap);

  if (circular) {
    return {
      isValid: false,
      isCircular: true,
      error: `Circular route rejected: route cannot loop back to the same asset (${path.join(" → ")})`,
      path,
    };
  }

  return {
    isValid: true,
    isCircular: false,
    path,
  };
}

/**
 * Detects if a list of swaps forms a circular dependency or cycle
 * (either intra-swap or across swaps, e.g. Swap 1: XLM->USDC, Swap 2: USDC->XLM).
 */
export function detectCircularRoutes(swaps: SwapSuggestion[]): {
  hasCycle: boolean;
  circularIndices: number[];
  cycleDetails: string[];
} {
  const circularIndices = new Set<number>();
  const cycleDetails: string[] = [];

  // 1. Check intra-swap circular routes
  swaps.forEach((swap, idx) => {
    if (isCircularRoute(swap)) {
      circularIndices.add(idx);
      cycleDetails.push(`Swap ${idx + 1}: ${getSwapPath(swap).join(" → ")}`);
    }
  });

  // 2. Check inter-swap cycles across swaps (e.g. XLM -> USDC and USDC -> XLM)
  const graph = new Map<string, Array<{ to: string; swapIndex: number }>>();
  swaps.forEach((s, idx) => {
    const from = s.from.toUpperCase();
    const to = s.to.toUpperCase();
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push({ to, swapIndex: idx });
  });

  const visited = new Set<string>();

  function dfs(node: string, currentPath: Array<{ node: string; swapIndex: number }>) {
    visited.add(node);
    const edges = graph.get(node) || [];
    for (const edge of edges) {
      const idxInPath = currentPath.findIndex((p) => p.node === edge.to);
      if (idxInPath !== -1) {
        const cycle = currentPath.slice(idxInPath);
        cycle.push({ node: edge.to, swapIndex: edge.swapIndex });
        cycle.forEach((c) => {
          if (c.swapIndex >= 0) circularIndices.add(c.swapIndex);
        });
        cycleDetails.push(
          `Cycle detected across swaps: ${cycle.map((c) => c.node).join(" → ")}`,
        );
      } else if (!visited.has(edge.to)) {
        dfs(edge.to, [...currentPath, { node: edge.to, swapIndex: edge.swapIndex }]);
      }
    }
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, [{ node, swapIndex: -1 }]);
    }
  }

  return {
    hasCycle: circularIndices.size > 0,
    circularIndices: Array.from(circularIndices).sort((a, b) => a - b),
    cycleDetails,
  };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SwapStatus }) {
  switch (status) {
    case "success":
      return (
        <div className="w-6 h-6 rounded-full bg-success-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={CheckmarkCircle01Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-green"
          />
        </div>
      );
    case "failed":
      return (
        <div className="w-6 h-6 rounded-full bg-error-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-red"
          />
        </div>
      );
    case "submitting":
      return (
        <div className="w-6 h-6 rounded-full bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={Loading03Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-brand animate-spin"
          />
        </div>
      );
    case "skipped":
      return (
        <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-ink-3"
          />
        </div>
      );
    default:
      return (
        <div
          aria-hidden="true"
          className="w-6 h-6 rounded-full bg-surface-2 border border-line-2 shrink-0"
        />
      );
  }
}

function statusBadge(status: SwapStatus) {
  switch (status) {
    case "success":
      return <Badge variant="success" dot>Done</Badge>;
    case "failed":
      return <Badge variant="error" dot>Failed</Badge>;
    case "submitting":
      return <Badge variant="primary" dot live>Submitting…</Badge>;
    case "skipped":
      return <Badge variant="warning">Skipped</Badge>;
    default:
      return null;
  }
}

// ─── Responsive Connector & Hop Sub-components ────────────────────────────────

/**
 * Responsive directional connector between hops:
 * - Renders a vertical arrow (downwards) on small viewports (<640px)
 * - Renders a horizontal arrow (rightwards) on screens 640px and up (>=sm)
 */
function RouteConnector() {
  return (
    <div
      data-testid="route-connector"
      aria-hidden="true"
      className="flex items-center justify-center text-ink-3 shrink-0 py-0.5 sm:py-0 px-0 sm:px-1"
    >
      {/* Down arrow on viewports under 640px */}
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        size={13}
        color="currentColor"
        strokeWidth={2}
        className="block sm:hidden text-ink-3 shrink-0"
        data-testid="vertical-connector"
      />
      {/* Right arrow on viewports 640px and up */}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={13}
        color="currentColor"
        strokeWidth={2}
        className="hidden sm:block text-ink-3 shrink-0"
        data-testid="horizontal-connector"
      />
    </div>
  );
}

/**
 * Intermediate hop node displaying asset pill, pool fee tier badge, and liquidity depth indicator.
 */
function HopNode({ hop }: { hop: NormalizedHop }) {
  return (
    <div
      data-testid="intermediate-hop-node"
      className="inline-flex items-center gap-1.5 flex-wrap bg-surface-2/60 border border-line rounded-lg px-2 py-1"
    >
      <AssetPill assetCode={hop.asset} />

      {hop.feeTier && (
        <span
          data-testid="fee-tier-badge"
          aria-label={`Fee tier: ${hop.feeTier}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-dim text-brand border border-brand/20 tabular-nums"
        >
          {hop.feeTier}
        </span>
      )}

      {hop.poolDepth && (
        <span
          data-testid="liquidity-indicator"
          aria-label={`Pool depth: ${hop.poolDepth}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-2 text-ink-2 border border-line-2 tabular-nums"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
          <span className="text-ink-4 text-[9px] uppercase font-semibold">Depth:</span>
          <span>{hop.poolDepth}</span>
        </span>
      )}
    </div>
  );
}

// ─── SwapRow Component ────────────────────────────────────────────────────────

interface SwapRowProps {
  swap: SwapSuggestion;
  index: number;
  status: SwapStatus;
  txHash?: string | null;
  error?: string | null;
}

const EXPLORER_TX_BASE = "https://stellar.expert/explorer/public/tx/";

function SwapRow({ swap, index, status, txHash, error }: SwapRowProps) {
  const isCircular = isCircularRoute(swap);
  const effectiveStatus: SwapStatus = isCircular ? "failed" : status;
  const effectiveError = isCircular
    ? (error ?? `Circular route rejected: route cannot loop back to the same asset (${getSwapPath(swap).join(" → ")})`)
    : error;
  const badge = isCircular ? <Badge variant="error" dot>Rejected</Badge> : statusBadge(effectiveStatus);
  const [copied, setCopied] = useState(false);
  const intermediateHops = getIntermediateHops(swap);

  function handleCopyHash() {
    if (!txHash) return;
    // Issue #657: swallow clipboard rejections so they never escape unhandled.
    void Promise.resolve(navigator.clipboard?.writeText(txHash)).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const ariaDescription = isCircular
    ? `Swap ${index + 1}: circular route rejected (${getSwapPath(swap).join(" → ")})`
    : `Swap ${index + 1}: sell ${swap.fromAmount.toFixed(4)} ${swap.from} for ${swap.toAmountExpected.toFixed(4)} ${swap.to}`;

  return (
    <div
      role="listitem"
      aria-label={ariaDescription}
      className={cn(
        "px-4 py-3.5 border-b border-line last:border-0 flex flex-col gap-2",
        effectiveStatus === "submitting" && "bg-brand-dim/30",
        effectiveStatus === "success" && "opacity-70",
        isCircular && "bg-error-dim/20 border-red/20",
      )}
    >
      {/* Swap direction row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-ink-3 w-5 shrink-0 text-right">
          {index + 1}.
        </span>
        <StatusIcon status={effectiveStatus} />

        {/* Responsive route flow with vertical connectors on <640px and horizontal on >=640px */}
        <div className="flex flex-col sm:flex-row sm:items-center items-start gap-1.5 sm:gap-2 flex-1 min-w-0 flex-wrap">
          {/* Source node */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="tabular-nums text-[13px] font-medium text-ink">
              {swap.fromAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
            <AssetPill assetCode={swap.from} />
          </div>

          {/* Intermediate hops with fee tiers and pool depth */}
          {intermediateHops.map((hop, hopIdx) => (
            <div
              key={`${hop.asset}-${hopIdx}`}
              className="flex flex-col sm:flex-row sm:items-center items-start gap-1.5 sm:gap-2"
            >
              <RouteConnector />
              <HopNode hop={hop} />
            </div>
          ))}

          {/* Final connector to destination */}
          <RouteConnector />

          {/* Destination node */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="tabular-nums text-[13px] font-medium text-ink">
              ~{swap.toAmountExpected.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}
            </span>
            <AssetPill assetCode={swap.to} />
          </div>
        </div>

        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 pl-11 flex-wrap">
        <MetricPill label="Slippage" value={formatPct(swap.slippagePct)} />
        <MetricPill label="Swap fee" value={formatPct(swap.swapFeePct)} />
        <MetricPill label="Network fee" value={`${swap.feeStroops} stroops`} />
        <MetricPill label="Est. cost" value={formatUsd(swap.totalCostUsd)} highlight />
      </div>

      {/* Error message / circular route rejection */}
      {effectiveStatus === "failed" && effectiveError && (
        <p className="pl-11 text-[11px] text-red">{effectiveError}</p>
      )}

      {/* Tx hash — copy + explorer link (issue #657) */}
      {effectiveStatus === "success" && txHash && (
        <div className="pl-11 flex flex-wrap items-center gap-2">
          <p className="text-[10px] text-ink-3 font-mono break-all">{txHash}</p>
          <button
            type="button"
            onClick={handleCopyHash}
            aria-label={
              copied ? "Transaction hash copied" : "Copy transaction hash"
            }
            className="inline-flex items-center gap-1 text-[10px] text-ink-4 hover:text-ink-2 shrink-0"
          >
            <HugeiconsIcon
              icon={Copy01Icon}
              size={11}
              color="currentColor"
              strokeWidth={1.5}
            />
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={`${EXPLORER_TX_BASE}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-brand hover:underline shrink-0"
          >
            View on explorer
          </a>
        </div>
      )}
    </div>
  );
}

function MetricPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px]">
      <span className="text-ink-4 uppercase tracking-[0.08em] font-semibold">{label}</span>
      <span className={cn("font-semibold tabular-nums", highlight ? "text-ink" : "text-ink-2")}>
        {value}
      </span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SwapRoute({
  swaps,
  statuses,
  txHashes,
  errors,
  className,
}: SwapRouteProps) {
  if (swaps.length === 0) {
    return (
      <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
        <div className="px-5 py-4 border-b border-line">
          <h3 className="text-[14px] font-semibold text-ink">Suggested Swaps</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">Rebalancing path</p>
        </div>
        <p className="text-[13px] text-ink-3 text-center py-10">
          No swaps needed — portfolio is already at target allocation.
        </p>
      </div>
    );
  }

  // Detect any circular routes across swaps
  const cycleInfo = detectCircularRoutes(swaps);
  const hasCircularRoute = cycleInfo.hasCycle;

  // Issue #657: tolerate partial/mismatched status, hash and error arrays by
  // falling back per index rather than indexing past the array bounds.
  const resolvedStatuses: SwapStatus[] = statuses ?? swaps.map(() => "pending");
  const totalCost = totalRebalanceCostUsd(swaps);
  const totalFee = totalFeeStroops(swaps);
  const avgSlippage = weightedAverageSlippage(swaps);

  return (
    <div
      className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Suggested Swaps</h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {swaps.length} swap{swaps.length !== 1 ? "s" : ""} to reach target
          </p>
        </div>
        <Badge variant={hasCircularRoute ? "error" : "default"}>
          {hasCircularRoute ? `${cycleInfo.circularIndices.length} rejected` : swaps.length}
        </Badge>
      </div>

      {/* Circular route rejection alert banner */}
      {hasCircularRoute && (
        <div
          role="alert"
          aria-live="assertive"
          className="px-5 py-2.5 bg-error-dim border-b border-error-dim-strong flex items-center gap-2 text-[12px] text-red font-medium"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            size={15}
            color="currentColor"
            strokeWidth={1.5}
            className="shrink-0"
          />
          <span>
            Circular route detected and rejected ({cycleInfo.circularIndices.length} swap{cycleInfo.circularIndices.length > 1 ? "s" : ""}). Swaps cannot loop back to the same asset.
          </span>
        </div>
      )}

      {/* Swap list */}
      <div role="list" aria-label="Suggested swaps">
        {swaps.map((swap, i) => {
          const isInterCycle = cycleInfo.circularIndices.includes(i);
          const forcedStatus = isInterCycle ? "failed" : (resolvedStatuses[i] ?? "pending");
          const forcedError = isInterCycle && !errors?.[i]
            ? (isCircularRoute(swap)
                ? `Circular route rejected: route cannot loop back to the same asset (${getSwapPath(swap).join(" → ")})`
                : "Circular route rejected: swap is part of a circular cycle.")
            : errors?.[i];

          return (
            <SwapRow
              key={`${swap.from}-${swap.to}-${i}`}
              swap={swap}
              index={i}
              status={forcedStatus}
              txHash={txHashes?.[i]}
              error={forcedError}
            />
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="px-5 py-3.5 border-t border-line bg-surface-2/40 flex items-center gap-6 flex-wrap">
        <SummaryCell label="Total est. cost" value={formatUsd(totalCost)} highlight />
        <SummaryCell label="Total fees" value={`${totalFee} stroops`} />
        <SummaryCell label="Avg slippage" value={formatPct(avgSlippage)} />
        <SummaryCell label="Transactions" value={String(swaps.length)} />
      </div>
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
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          highlight ? "text-ink" : "text-ink-2",
        )}
      >
        {value}
      </span>
    </div>
  );
}

