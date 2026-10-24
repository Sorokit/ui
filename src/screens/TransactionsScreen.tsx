import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState } from "react";

import { ActivityTimeline } from "@/components/ActivityTimeline";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FeeEstimator } from "@/components/FeeEstimator";
import { GasOptimizer } from "@/components/GasOptimizer";
import { MultiSigTransactionBuilder } from "@/components/MultiSigTransactionBuilder";
import { TransactionHistory } from "@/components/TransactionHistory";
import { TransactionPanel } from "@/components/TransactionPanel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import type { Transaction } from "@/lib/client";
import { getClient } from "@/lib/client";
import { SCREEN_LABELS } from "@/lib/nav-labels";

/** Exports at or above this many records show the progress modal. */
const EXPORT_PROGRESS_THRESHOLD = 500;
/** Page size used when paging through history for export. */
const EXPORT_PAGE_SIZE = 200;

/** Today's date as a `YYYY-MM-DD` string in the viewer's local timezone. */
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: Transaction[]): string {
  const headers = [
    "Hash",
    "Ledger",
    "CreatedAt",
    "Status",
    "Fee (stroops)",
    "Operations",
    "Memo",
  ];
  const lines: string[] = [headers.join(",")];
  for (const tx of rows) {
    lines.push(
      [
        escapeCsv(tx.hash),
        tx.ledger,
        escapeCsv(tx.createdAt),
        tx.successful ? "Success" : "Failed",
        tx.feePaid,
        tx.operationCount,
        escapeCsv(tx.memo ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type ExportFormat = "csv" | "json";

interface ExportState {
  format: ExportFormat;
  fetched: number;
  total: number;
  cancelled: boolean;
  done: boolean;
  error: string | null;
}
// Shared by GasOptimizer and FeeEstimator so both tick in lockstep;
// FeeEstimator's useFeeData() hook dedupes their estimateFee() calls to one
// request per tick regardless of how many components are polling.
const FEE_REFRESH_INTERVAL_MS = 15_000;

export function TransactionsScreen() {
  const { title, sub } = SCREEN_LABELS.transactions;
  const { address, client: contextClient } = useSorokit();
  const client = contextClient ?? getClient();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportState, setExportState] = useState<ExportState | null>(null);
  const cancelRef = useRef(false);

  const today = todayIsoDate();

  function handleStartDateChange(value: string) {
    setStartDate(value);
    // Keep the end date from preceding the (possibly later) new start date.
    if (value && endDate && endDate < value) {
      setEndDate(value);
    }
  }

  function handleEndDateChange(value: string) {
    // Clamp to [startDate, today] so an out-of-range pick never produces an
    // inverted or future-dated range.
    let clamped = value;
    if (clamped > today) clamped = today;
    if (startDate && clamped < startDate) clamped = startDate;
    setEndDate(clamped);
  }

  async function runExport(format: ExportFormat) {
    if (!address) return;
    cancelRef.current = false;

    const all: Transaction[] = [];
    let page = 1;
    let total = 0;
    let showProgress = false;

    setExportState({
      format,
      fetched: 0,
      total: 0,
      cancelled: false,
      done: false,
      error: null,
    });

    try {
      while (true) {
        if (cancelRef.current) {
          setExportState((prev) =>
            prev ? { ...prev, cancelled: true, done: true } : prev,
          );
          return;
        }

        const { data, error, total: t } = await client.transaction.getHistory(
          address,
          page,
          EXPORT_PAGE_SIZE,
        );
        if (error) {
          setExportState((prev) => (prev ? { ...prev, error, done: true } : prev));
          return;
        }

        const batch = data ?? [];
        all.push(...batch);
        total = Number.isFinite(t) && t > 0 ? t : all.length;

        if (total >= EXPORT_PROGRESS_THRESHOLD) showProgress = true;
        if (showProgress) {
          setExportState((prev) =>
            prev ? { ...prev, fetched: all.length, total } : prev,
          );
        }

        if (batch.length < EXPORT_PAGE_SIZE || all.length >= total) break;
        page += 1;
      }

      if (cancelRef.current) {
        setExportState((prev) =>
          prev ? { ...prev, cancelled: true, done: true } : prev,
        );
        return;
      }

      const filtered = all.filter((tx) => {
        if (startDate && new Date(tx.createdAt) < new Date(startDate)) return false;
        if (endDate && new Date(tx.createdAt) > new Date(endDate + "T23:59:59"))
          return false;
        return true;
      });

      const content =
        format === "csv" ? toCsv(filtered) : JSON.stringify(filtered, null, 2);
      const extension = format === "csv" ? "csv" : "json";
      const mimeType =
        format === "csv" ? "text/csv;charset=utf-8;" : "application/json";
      downloadFile(content, `transactions-${todayIsoDate()}.${extension}`, mimeType);

      setExportState((prev) =>
        prev ? { ...prev, fetched: filtered.length, total: filtered.length, done: true } : prev,
      );
    } catch {
      setExportState((prev) =>
        prev
          ? { ...prev, error: "Export failed. Please try again.", done: true }
          : prev,
      );
    }
  }

  function cancelExport() {
    cancelRef.current = true;
  }

  function closeExportModal() {
    setExportState(null);
  }

  const showModal = exportState !== null && !exportState.done;
  const percent =
    exportState && exportState.total > 0
      ? Math.min(100, Math.round((exportState.fetched / exportState.total) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink leading-none">
          {title}
        </h2>
        <p className="text-[11px] text-ink-3 mt-0.5">{sub}</p>
      </div>
      <GasOptimizer refreshInterval={FEE_REFRESH_INTERVAL_MS} />
      <FeeEstimator refreshInterval={FEE_REFRESH_INTERVAL_MS} />
      <MultiSigTransactionBuilder />
      <ErrorBoundary isolate>
        <TransactionPanel />
      </ErrorBoundary>

      <div className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-ink">
          Export transaction history
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            type="date"
            label="Start date"
            value={startDate}
            max={endDate || today}
            onChange={(e) => handleStartDateChange(e.target.value)}
            aria-label="Export start date"
            className="text-[12px]"
          />
          <Input
            type="date"
            label="End date"
            value={endDate}
            min={startDate || undefined}
            max={today}
            onChange={(e) => handleEndDateChange(e.target.value)}
            aria-label="Export end date"
            className="text-[12px]"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!address || showModal}
            onClick={() => void runExport("csv")}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!address || showModal}
            onClick={() => void runExport("json")}
          >
            Export JSON
          </Button>
        </div>
      </div>

      <ErrorBoundary isolate>
        <TransactionHistory startDate={startDate} endDate={endDate} />
      </ErrorBoundary>
      <ActivityTimeline />

      <Dialog.Root open={showModal} onOpenChange={(next) => !next && cancelExport()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content
            className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-2xl focus:outline-none"
            aria-describedby="export-progress-desc"
          >
            <Dialog.Title className="text-[14px] font-semibold text-ink">
              Exporting transactions…
            </Dialog.Title>
            <p id="export-progress-desc" className="text-[12px] text-ink-3 mt-1">
              {exportState?.fetched ?? 0} of {exportState?.total ?? 0} records
              {" "}({percent}%)
            </p>
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-2 w-full rounded-full bg-surface-2 overflow-hidden"
            >
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="secondary" size="sm" onClick={cancelExport}>
                Cancel
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {exportState?.done && (exportState.cancelled || exportState.error) && (
        <div
          role="alert"
          className="rounded-lg border border-error-dim-strong bg-error-dim px-3 py-2 text-[12px] text-red flex items-center justify-between gap-3"
        >
          <span>
            {exportState.cancelled
              ? "Export cancelled."
              : exportState.error}
          </span>
          <button
            type="button"
            onClick={closeExportModal}
            className="text-red font-medium hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
