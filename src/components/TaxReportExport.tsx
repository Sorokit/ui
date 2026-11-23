import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { fetchAccountOperations } from "@/lib/account-operations";
import type { Operation } from "@/lib/client";
import { getClient } from "@/lib/client";
import {
  buildTaxReport,
  type PriceTable,
  priceKey,
  requiredPrices,
  taxReportToCsv,
  totalGainLoss,
} from "@/lib/tax-report";

function downloadCsv(content: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8;" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exports a FIFO capital gain/loss CSV. The client exposes no historical price
 * feed, so the unit price for each asset and day is entered by the user.
 */
export function TaxReportExport() {
  const { address, client: contextClient } = useSorokit();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [operations, setOperations] = useState<Operation[] | null>(null);
  const [prices, setPrices] = useState<PriceTable>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  const needed = useMemo(
    () =>
      operations && address
        ? requiredPrices(operations, address, endDate || undefined)
        : [],
    [operations, address, endDate],
  );
  const rows = useMemo(
    () =>
      operations && address && !invalidRange
        ? buildTaxReport(operations, address, prices, {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          })
        : [],
    [operations, address, prices, startDate, endDate, invalidRange],
  );
  const incomplete = rows.filter((row) => row.note).length;

  async function loadTransactions() {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      const client = contextClient ?? getClient();
      setOperations(await fetchAccountOperations(client, address));
    } catch (err) {
      setOperations(null);
      setError(err instanceof Error ? err.message : "Could not load transactions.");
    } finally {
      setIsLoading(false);
    }
  }

  function updatePrice(key: string, value: string) {
    setPrices((current) => {
      const next = { ...current };
      const price = Number(value);
      if (value === "" || !Number.isFinite(price) || price < 0) delete next[key];
      else next[key] = price;
      return next;
    });
  }

  function download() {
    const suffix = `${startDate || "start"}-to-${endDate || "latest"}`;
    downloadCsv(taxReportToCsv(rows), `tax-report-${suffix}.csv`);
  }

  return (
    <section
      aria-labelledby="tax-report-title"
      data-testid="tax-report-export"
      className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3"
    >
      <div>
        <h3 id="tax-report-title" className="text-[13px] font-semibold text-ink">
          Tax report
        </h3>
        <p className="text-[11px] text-ink-3 mt-0.5">
          Capital gains and losses using FIFO cost basis. Network fees are not
          included. Check the results with a tax professional.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          type="date"
          label="From"
          aria-label="Tax report from date"
          value={startDate}
          max={endDate || undefined}
          onChange={(e) => setStartDate(e.target.value)}
          className="text-[12px]"
        />
        <Input
          type="date"
          label="To"
          aria-label="Tax report to date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
          className="text-[12px]"
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={!address || isLoading}
          onClick={() => void loadTransactions()}
        >
          {isLoading ? "Loading…" : "Load transactions"}
        </Button>
      </div>

      {invalidRange && (
        <p role="alert" className="text-[12px] text-red">
          The from date must be on or before the to date.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-red">
          {error}
        </p>
      )}

      {operations && needed.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[12px] font-medium text-ink-2">
            Unit prices on each transaction date
          </legend>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {needed.map(({ asset, date }) => {
              const key = priceKey(asset, date);
              return (
                <Input
                  key={key}
                  type="number"
                  min="0"
                  step="any"
                  label={`${asset} on ${date}`}
                  aria-label={`${asset} price on ${date}`}
                  value={prices[key] ?? ""}
                  onChange={(e) => updatePrice(key, e.target.value)}
                />
              );
            })}
          </div>
        </fieldset>
      )}

      {operations && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-ink-3" data-testid="tax-report-summary">
            {rows.length} {rows.length === 1 ? "entry" : "entries"} · Net
            gain/loss{" "}
            <strong className="text-ink tabular-nums">
              {totalGainLoss(rows).toFixed(2)}
            </strong>
            {incomplete > 0 && ` · ${incomplete} incomplete`}
          </p>
          <Button
            variant="primary"
            size="sm"
            disabled={rows.length === 0 || invalidRange}
            onClick={download}
          >
            Download tax report
          </Button>
        </div>
      )}
    </section>
  );
}
