import {
  assetKey,
  operationDirection,
} from "@/lib/account-operations";
import type { Operation } from "@/lib/client";

export interface TaxReportRow {
  date: string;
  type: "Acquisition" | "Disposal";
  asset: string;
  amount: number;
  /** Unit price in the report currency; null until supplied. */
  price: number | null;
  proceeds: number | null;
  costBasis: number | null;
  gainLoss: number | null;
  txHash: string;
  note: string;
}

export interface TaxReportRange {
  startDate?: string;
  endDate?: string;
}

/** Prices keyed by `priceKey(asset, date)`. */
export type PriceTable = Record<string, number>;

interface Lot {
  remaining: number;
  price: number | null;
}

export function priceKey(asset: string, date: string): string {
  return `${asset}|${date}`;
}

function utcDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** The asset/date pairs that need a price to report up to `endDate`. */
export function requiredPrices(
  operations: Operation[],
  address: string,
  endDate?: string,
): { asset: string; date: string }[] {
  const needed = new Map<string, { asset: string; date: string }>();
  for (const op of operations) {
    if (!operationDirection(op, address)) continue;
    const date = utcDate(op.createdAt);
    if (endDate && date > endDate) continue;
    const asset = assetKey(op.asset);
    needed.set(priceKey(asset, date), { asset, date });
  }
  return [...needed.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.asset.localeCompare(b.asset),
  );
}

/**
 * Builds FIFO capital gain/loss rows. Lots are matched across the full history
 * so a disposal inside the range keeps the basis of an earlier acquisition;
 * only rows inside the range are returned. A gain is left null, never guessed,
 * when a price or the matching acquisition is missing.
 */
export function buildTaxReport(
  operations: Operation[],
  address: string,
  prices: PriceTable,
  { startDate, endDate }: TaxReportRange = {},
): TaxReportRow[] {
  const lots = new Map<string, Lot[]>();
  const rows: TaxReportRow[] = [];
  const ordered = [...operations].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

  for (const op of ordered) {
    const direction = operationDirection(op, address);
    if (!direction) continue;

    const date = utcDate(op.createdAt);
    const asset = assetKey(op.asset);
    const amount = Number(op.amount);
    const price = prices[priceKey(asset, date)] ?? null;
    const assetLots = lots.get(asset) ?? [];
    lots.set(asset, assetLots);

    let row: TaxReportRow;
    if (direction === "in") {
      assetLots.push({ remaining: amount, price });
      row = {
        date,
        type: "Acquisition",
        asset,
        amount,
        price,
        proceeds: null,
        costBasis: price === null ? null : amount * price,
        gainLoss: null,
        txHash: op.txHash,
        note: price === null ? "Missing price" : "",
      };
    } else {
      let toMatch = amount;
      let basis = 0;
      let basisKnown = true;
      while (toMatch > 1e-9 && assetLots.length > 0) {
        const lot = assetLots[0];
        const used = Math.min(lot.remaining, toMatch);
        if (lot.price === null) basisKnown = false;
        else basis += used * lot.price;
        lot.remaining -= used;
        toMatch -= used;
        if (lot.remaining <= 1e-9) assetLots.shift();
      }
      const unmatched = toMatch > 1e-9;
      const costBasis = basisKnown && !unmatched ? basis : null;
      const proceeds = price === null ? null : amount * price;
      const notes = [
        price === null ? "Missing price" : "",
        unmatched ? "Acquisition not in history" : "",
        !basisKnown ? "Missing acquisition price" : "",
      ].filter(Boolean);
      row = {
        date,
        type: "Disposal",
        asset,
        amount,
        price,
        proceeds,
        costBasis,
        gainLoss:
          proceeds === null || costBasis === null ? null : proceeds - costBasis,
        txHash: op.txHash,
        note: notes.join("; "),
      };
    }

    if ((!startDate || date >= startDate) && (!endDate || date <= endDate)) {
      rows.push(row);
    }
  }
  return rows;
}

export function totalGainLoss(rows: TaxReportRow[]): number {
  return rows.reduce((sum, row) => sum + (row.gainLoss ?? 0), 0);
}

/** Quotes a text cell and neutralises spreadsheet formula prefixes. */
function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function csvNumber(value: number | null, digits: number): string {
  return value === null ? "" : value.toFixed(digits);
}

export function taxReportToCsv(rows: TaxReportRow[]): string {
  const header =
    "Date,Type,Asset,Amount,Price,Proceeds,Cost Basis,Gain/Loss,Transaction Hash,Note";
  const lines = rows.map((row) =>
    [
      row.date,
      row.type,
      csvText(row.asset),
      csvNumber(row.amount, 7),
      csvNumber(row.price, 7),
      csvNumber(row.proceeds, 2),
      csvNumber(row.costBasis, 2),
      csvNumber(row.gainLoss, 2),
      csvText(row.txHash),
      csvText(row.note),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
