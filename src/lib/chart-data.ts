/** Historical price data helpers for ChartingScreen. */

export interface OhlcPoint {
  /** Unix timestamp in milliseconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** True when the point was imputed to fill a gap in the source data */
  imputed?: boolean;
}

export type RawDataPoint = Partial<
  Record<"time" | "timestamp" | "t" | "open" | "high" | "low" | "close" | "volume", unknown>
>;

/** Candle interval in milliseconds for each supported timeframe. */
export const TIMEFRAME_MS = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "1d": 24 * 60 * 60_000,
} as const;

export type Timeframe = keyof typeof TIMEFRAME_MS;

/** Parse an ISO string, numeric string, seconds or milliseconds epoch into ms. Returns null if invalid. */
export function parseTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()))) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    // Values below 1e11 are epoch seconds (valid until year 5138)
    return n < 1e11 ? Math.round(n * 1000) : Math.round(n);
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Parse raw historical rows into sorted, de-duplicated OHLC points.
 * Rows with an unparseable timestamp or price fields are dropped.
 */
export function parseHistoricalData(rows: readonly RawDataPoint[]): OhlcPoint[] {
  const byTime = new Map<number, OhlcPoint>();
  for (const row of rows) {
    const time = parseTimestamp(row.time ?? row.timestamp ?? row.t);
    const open = toNumber(row.open);
    const high = toNumber(row.high);
    const low = toNumber(row.low);
    const close = toNumber(row.close);
    if (time === null || open === null || high === null || low === null || close === null) continue;
    byTime.set(time, { time, open, high, low, close, volume: toNumber(row.volume) ?? 0 });
  }
  return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
}

/**
 * Impute candles for missing timestamps between the first and last point.
 * A gap candle is flat at the previous close with zero volume.
 */
export function fillMissingTimestamps(points: readonly OhlcPoint[], intervalMs: number): OhlcPoint[] {
  if (points.length === 0 || intervalMs <= 0) return [...points];
  const result: OhlcPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const next = points[i];
    for (let t = prev.time + intervalMs; t < next.time; t += intervalMs) {
      const last = result[result.length - 1];
      result.push({
        time: t,
        open: last.close,
        high: last.close,
        low: last.close,
        close: last.close,
        volume: 0,
        imputed: true,
      });
    }
    result.push(next);
  }
  return result;
}
