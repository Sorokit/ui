import {
  assetKey,
  balanceAssetKey,
  operationDirection,
} from "@/lib/account-operations";
import type { Balance, Operation } from "@/lib/client";

const DAY_MS = 86_400_000;
const MAX_CHART_POINTS = 120;

export interface ValuePoint {
  date: string;
  value: number;
}

export interface AssetPerformance {
  asset: string;
  startValue: number;
  endValue: number;
  change: number;
  /** Null when the asset had no value at the start of the range. */
  changePct: number | null;
}

export interface PortfolioSeries {
  dates: string[];
  /** Asset -> end-of-day holdings, aligned with `dates`. */
  holdings: Record<string, number[]>;
}

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const end = Date.parse(`${endDate}T00:00:00Z`);
  for (let t = Date.parse(`${startDate}T00:00:00Z`); t <= end; t += DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * Rebuilds end-of-day holdings by walking back from current balances and
 * undoing each operation made after that day.
 */
export function buildHoldingsSeries(
  balances: Balance[],
  operations: Operation[],
  address: string,
  startDate: string,
  endDate: string,
): PortfolioSeries {
  const dates = dateRange(startDate, endDate);
  const current = new Map<string, number>();
  for (const balance of balances) {
    if (balance.assetType === "liquidity_pool_shares") continue;
    const key = balanceAssetKey(balance);
    current.set(key, (current.get(key) ?? 0) + (Number(balance.balance) || 0));
  }

  const moves = operations
    .map((op) => ({ op, direction: operationDirection(op, address) }))
    .filter((move) => move.direction !== null)
    .map(({ op, direction }) => ({
      asset: assetKey(op.asset),
      date: new Date(op.createdAt).toISOString().slice(0, 10),
      delta: (direction === "in" ? 1 : -1) * Number(op.amount),
    }))
    .filter((move) => current.has(move.asset));

  const holdings: Record<string, number[]> = {};
  for (const [asset, balance] of current) {
    const assetMoves = moves.filter((move) => move.asset === asset);
    holdings[asset] = dates.map((date) => {
      const later = assetMoves
        .filter((move) => move.date > date)
        .reduce((sum, move) => sum + move.delta, 0);
      return Math.max(0, balance - later);
    });
  }
  return { dates, holdings };
}

/** Total portfolio value per day at the supplied prices. */
export function buildValueSeries(
  series: PortfolioSeries,
  prices: Record<string, number>,
): ValuePoint[] {
  const points = series.dates.map((date, index) => ({
    date,
    value: Object.entries(series.holdings).reduce(
      (sum, [asset, amounts]) => sum + amounts[index] * (prices[asset] ?? 0),
      0,
    ),
  }));
  if (points.length <= MAX_CHART_POINTS) return points;
  const step = (points.length - 1) / (MAX_CHART_POINTS - 1);
  return Array.from(
    { length: MAX_CHART_POINTS },
    (_, i) => points[Math.round(i * step)],
  );
}

/** Priced assets ranked by value gained across the range. */
export function rankPerformers(
  series: PortfolioSeries,
  prices: Record<string, number>,
  limit = 3,
): AssetPerformance[] {
  return Object.entries(series.holdings)
    .filter(([asset, amounts]) => prices[asset] > 0 && amounts.length > 0)
    .map(([asset, amounts]) => {
      const startValue = amounts[0] * prices[asset];
      const endValue = amounts[amounts.length - 1] * prices[asset];
      const change = endValue - startValue;
      return {
        asset,
        startValue,
        endValue,
        change,
        changePct: startValue > 0 ? (change / startValue) * 100 : null,
      };
    })
    .sort((a, b) => b.change - a.change)
    .slice(0, limit);
}
