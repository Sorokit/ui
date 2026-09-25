import {
  CancelCircleIcon,
  CheckmarkCircle01Icon,
  CircleDotIcon,
  CircleXIcon,
  ClockIcon,
  CloudDownloadIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  HashIcon,
  Loading01Icon,
  PauseIcon,
  PlayIcon,
  UploadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { type BatchEntry, type BatchEntryResult, type BatchProgress } from "@/lib/client";
import { cn, truncateAddress } from "@/lib/utils";

const STATUS_BADGE: Record<BatchEntryResult["status"], { variant: "default" | "warning" | "primary" | "success" | "error"; label: string }> = {
  queued: { variant: "default", label: "Queued" },
  signing: { variant: "warning", label: "Signing" },
  submitted: { variant: "primary", label: "Submitted" },
  confirmed: { variant: "success", label: "Confirmed" },
  failed: { variant: "error", label: "Failed" },
};

const VALID_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const VALID_AMOUNT_RE = /^\d+(\.\d+)?$/;
const MAX_RETRY_OPTIONS = [1, 2, 3, 4, 5];

function parseCSV(text: string): BatchEntry[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const addrIdx = header.indexOf("address");
  const amtIdx = header.indexOf("amount");
  if (addrIdx === -1 || amtIdx === -1) return [];
  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split(",");
      return { address: (cols[addrIdx] ?? "").trim(), amount: (cols[amtIdx] ?? "").trim(), asset: "", memo: "" };
    })
    .filter((e) => e.address && e.amount);
}

function parseJSON(text: string): BatchEntry[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        address: String(item.address ?? ""),
        amount: String(item.amount ?? ""),
        asset: String(item.asset ?? ""),
        memo: String(item.memo ?? ""),
      }))
      .filter((e) => e.address && e.amount);
  } catch {
    return [];
  }
}

function validateEntries(entries: BatchEntry[]): string[] {
  const errors: string[] = [];
  entries.forEach((entry, i) => {
    if (!VALID_ADDRESS_RE.test(entry.address)) {
      errors.push(`Row ${i + 2}: Invalid Stellar address "${entry.address}"`);
    }
    if (!VALID_AMOUNT_RE.test(entry.amount) || parseFloat(entry.amount) <= 0) {
      errors.push(`Row ${i + 2}: Invalid amount "${entry.amount}"`);
    }
  });
  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    if (seen.has(entry.address)) {
      errors.push(`Row ${i + 2}: Duplicate address "${entry.address}"`);
    }
    seen.add(entry.address);
  });
  return errors;
}

function generateCSVTemplate(): string {
  return "address,amount\nGAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA,100\n";
}

function formatETA(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `~${mins}m ${secs}s`;
}

interface BatchPaymentProcessorProps {
  className?: string;
  defaultAsset?: string;
}

export function BatchPaymentProcessor({ className, defaultAsset = "XLM" }: BatchPaymentProcessorProps) {
  const { isConnected, address, client } = useSorokit();
  const [fileEntries, setFileEntries] = useState<BatchEntry[] | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [results, setResults] = useState<BatchEntryResult[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [maxRetries, setMaxRetries] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null);
  const [reportFormat, setReportFormat] = useState<"csv" | "json">("csv");
  const [currentView, setCurrentView] = useState<"upload" | "results" | "progress">("upload");
  const pollRef = useRef<number | null>(null);

  const clearState = useCallback(() => {
    setFileEntries(null);
    setFileErrors([]);
    setFileName("");
    setResults(null);
    setBatchId(null);
    setProgress(null);
    setIsPaused(false);
    setIsProcessing(false);
    setCurrentView("upload");
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      setResults(null);
      setBatchId(null);
      setProgress(null);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        let entries: BatchEntry[];
        if (file.name.endsWith(".json")) {
          entries = parseJSON(text);
        } else {
          entries = parseCSV(text);
        }

        if (entries.length === 0) {
          setFileEntries(null);
          setFileErrors(["No valid entries found in file. Check format."]);
          return;
        }

        setFileEntries(entries);
        const errors = validateEntries(entries);
        setFileErrors(errors);

        if (errors.length === 0 && entries.length > 0) {
          setCurrentView("progress");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const input = document.createElement("input");
      input.type = "file";
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handleFileUpload({ target: input } as unknown as React.ChangeEvent<HTMLInputElement>);
    },
    [handleFileUpload],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const downloadCSVReport = useCallback(
    (reportEntries: BatchEntryResult[], _totalFee: string) => {
      const header = "address,amount,status,txHash,error,retryCount";
      const rows = reportEntries.map(
        (r) =>
          `${r.address},${r.amount},${r.status},${r.txHash ?? ""},${r.error ?? ""},${r.retryCount}`,
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch-report-${batchId ?? "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [batchId],
  );

  const downloadJSONReport = useCallback(
    (reportEntries: BatchEntryResult[], totalFee: string) => {
      const report = {
        batchId,
        totalEntries: reportEntries.length,
        successful: reportEntries.filter((r) => r.status === "confirmed").length,
        failed: reportEntries.filter((r) => r.status === "failed").length,
        totalFee,
        entries: reportEntries.map((r) => ({
          address: r.address,
          amount: r.amount,
          status: r.status,
          txHash: r.txHash,
          error: r.error,
          retryCount: r.retryCount,
        })),
      };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `batch-report-${batchId ?? "export"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [batchId],
  );

  const handleExportReport = useCallback(() => {
    if (!results) return;
    const totalFee = feeEstimate ?? "0";
    if (reportFormat === "csv") {
      downloadCSVReport(results, totalFee);
    } else {
      downloadJSONReport(results, totalFee);
    }
  }, [results, feeEstimate, reportFormat, downloadCSVReport, downloadJSONReport]);

  const handleStartBatch = useCallback(async () => {
    if (!fileEntries || fileEntries.length === 0 || !address || !client) return;

    setIsProcessing(true);
    setCurrentView("progress");

    try {
      const { error, batchId: bid } = await client.batch.submitBatch({
        entries: fileEntries,
        sourceAccount: address,
        asset: defaultAsset,
        maxRetries,
      });

      if (error) {
        setFileErrors([error]);
        setIsProcessing(false);
        return;
      }

      setBatchId(bid);
      setProgress({
        batchId: bid,
        total: fileEntries.length,
        completed: 0,
        failed: 0,
        status: "processing",
        percentage: 0,
      });

      setResults(
        fileEntries.map((e) => ({
          address: e.address,
          amount: e.amount,
          status: "queued" as const,
          retryCount: 0,
        })),
      );

      const { data: feeData, error: feeErr } = await client.transaction.estimateFee();
      if (!feeErr && feeData) {
        setFeeEstimate(feeData.recommended);
      }
    } catch (err: unknown) {
      setFileErrors([err instanceof Error ? err.message : "Batch submission failed"]);
    } finally {
      setIsProcessing(false);
    }
  }, [fileEntries, address, client, defaultAsset, maxRetries]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!batchId || !client) return;
    await client.batch.cancelBatch(batchId);
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsProcessing(false);
    setIsPaused(false);
    setCurrentView("results");
  }, [batchId, client]);

  const handleRetry = useCallback(async (index: number) => {
    if (!batchId || !results || !client) return;
    try {
      const { data, error } = await client.batch.retryEntry({ batchId, entryIndex: index });
      if (error) return;
      if (data) {
        const updated = [...results];
        updated[index] = data;
        setResults(updated);
      }
    } catch {
      /* ignore */
    }
  }, [batchId, results, client]);

  const pollProgress = useCallback(async () => {
    if (!batchId || isPaused || !client) return;
    try {
      const { data, error } = await client.batch.getBatchStatus(batchId);
      if (error || !data) return;
      setProgress(data);

      setResults((prev) => {
        if (!prev) return prev;
        const updated = [...prev];
        let changed = false;
        const completedCount = data.completed;
        for (let i = 0; i < updated.length; i++) {
          if (i < completedCount && updated[i].status === "queued") {
            const newStatus: BatchEntryResult["status"] = i < completedCount / 2 ? "signing" : "submitted";
            if (newStatus !== updated[i].status) {
              updated[i] = { ...updated[i], status: newStatus };
              changed = true;
            }
          }
        }
        return changed ? updated : prev;
      });
    } catch {
      /* ignore network errors during polling */
    }
  }, [batchId, isPaused, client]);

  useEffect(() => {
    if (batchId && isProcessing) {
      pollRef.current = window.setInterval(pollProgress, 2000);
      return () => {
        if (pollRef.current) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [batchId, isProcessing, pollProgress]);

  const successfulCount = results?.filter((r) => r.status === "confirmed").length ?? 0;
  const failedCount = results?.filter((r) => r.status === "failed").length ?? 0;
  const totalEntries = results?.length ?? fileEntries?.length ?? 0;
  const percentage = progress?.percentage ?? (totalEntries > 0 ? Math.round((successfulCount / totalEntries) * 100) : 0);
  const etaSeconds = progress?.etaSeconds ?? 0;

  const hasFile = fileEntries !== null;
  const isValid = hasFile && fileErrors.length === 0;

  return (
    <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
      <div className="px-5 py-4 border-b border-line">
        <h3 className="text-[14px] font-semibold text-ink">Batch Payment Processor</h3>
        <p className="text-[12px] text-ink-3 mt-0.5">
          Process multiple payments in a single batch with progress tracking
        </p>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {!hasFile && currentView === "upload" && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload CSV or JSON file with recipient addresses and amounts"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById("batch-file-input")?.click()}
            className="border-2 border-dashed border-line rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-brand hover:bg-brand-dim/30 transition-colors"
          >
            <HugeiconsIcon icon={UploadIcon} size={32} className="text-ink-3" strokeWidth={1.5} />
            <div>
              <p className="text-[13px] font-medium text-ink">Drop a CSV or JSON file here</p>
              <p className="text-[11px] text-ink-3 mt-1">or click to browse — supports .csv and .json</p>
            </div>
            <Input id="batch-file-input" type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" />
          </div>
        )}

        {hasFile && currentView === "upload" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink flex items-center gap-2">
                <HugeiconsIcon icon={FileSpreadsheetIcon} size={14} strokeWidth={1.5} />
                {fileName}
              </span>
              <Button variant="ghost" size="sm" onClick={clearState}>
                Remove
              </Button>
            </div>
            {fileEntries && (
              <p className="text-[12px] text-ink-3">{fileEntries.length} entries found</p>
            )}
          </div>
        )}

        {fileErrors.length > 0 && (
          <div className="rounded-lg bg-error-dim border border-error-dim-strong p-3 flex flex-col gap-1.5" role="alert">
            <p className="text-[12px] font-semibold text-red">Validation Errors</p>
            {fileErrors.map((err, i) => (
              <p key={i} className="text-[11px] text-red">
                {err}
              </p>
            ))}
          </div>
        )}

        {hasFile && isValid && currentView === "upload" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-[12px] text-ink-3" htmlFor="max-retries">
                Max retries:
              </label>
              <select
                id="max-retries"
                value={maxRetries}
                onChange={(e) => setMaxRetries(Number(e.target.value))}
                className="bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-[12px] text-ink focus:outline-none focus:border-brand"
              >
                {MAX_RETRY_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleStartBatch} disabled={!isValid}>
                Start Batch ({fileEntries!.length} payments)
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const template = generateCSVTemplate();
                  const blob = new Blob([template], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "batch-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <HugeiconsIcon icon={CloudDownloadIcon} size={12} color="currentColor" strokeWidth={1.5} />
                Download CSV Template
              </Button>
            </div>

            <details className="text-[11px] text-ink-3">
              <summary className="cursor-pointer hover:text-ink">JSON format example</summary>
              <pre className="mt-2 bg-surface-2 rounded-lg p-3 text-[10px] overflow-x-auto font-mono text-ink-4">
{`[
  { "address": "GAAZI...", "amount": "100", "asset": "XLM", "memo": "" }
]`}
              </pre>
            </details>
          </div>
        )}

        {currentView === "progress" && results && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold text-ink">Batch Progress</h4>
              <span className="text-[12px] text-ink-3 font-mono">{percentage}%</span>
            </div>

            <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
              <div
                className="h-full bg-brand rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green" /> {successfulCount} confirmed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red" /> {failedCount} failed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-ink-3" /> {results.filter((r) => r.status === "queued").length} queued
                </span>
              </div>
              <span className="text-ink-3 flex items-center gap-1.5">
                <HugeiconsIcon icon={ClockIcon} size={12} strokeWidth={1.5} />
                ETA: {formatETA(etaSeconds)}
              </span>
            </div>

            {isPaused && (
              <div className="flex items-center gap-2">
                <Badge variant="warning">Paused</Badge>
              </div>
            )}

            <div className="flex gap-2">
              {!isPaused ? (
                <Button variant="secondary" size="sm" onClick={handlePause}>
                  <HugeiconsIcon icon={PauseIcon} size={12} color="currentColor" strokeWidth={1.5} />
                  Pause
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleResume}>
                  <HugeiconsIcon icon={PlayIcon} size={12} color="currentColor" strokeWidth={1.5} />
                  Resume
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={handleCancel}>
                <HugeiconsIcon icon={CancelCircleIcon} size={12} color="currentColor" strokeWidth={1.5} />
                Cancel
              </Button>
            </div>

            {batchId && (
              <div className="flex items-center gap-2 text-[11px] text-ink-3">
                <HugeiconsIcon icon={HashIcon} size={12} strokeWidth={1.5} />
                Batch ID: {truncateAddress(batchId, 8, 6)}
              </div>
            )}
          </div>
        )}

        {currentView === "progress" && results && results.length > 0 && (
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {results.map((entry, i) => {
              const badge = STATUS_BADGE[entry.status];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-2/50 text-[12px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <HugeiconsIcon
                      icon={
                        entry.status === "confirmed"
                          ? CheckmarkCircle01Icon
                          : entry.status === "failed"
                            ? CircleXIcon
                            : entry.status === "signing"
                              ? Loading01Icon
                              : CircleDotIcon
                      }
                      size={12}
                      color="currentColor"
                      strokeWidth={1.5}
                      className={cn(
                        entry.status === "confirmed" ? "text-green" :
                        entry.status === "failed" ? "text-red" :
                        entry.status === "signing" ? "text-orange animate-spin" : "text-ink-3",
                      )}
                    />
                    <span className="truncate">{truncateAddress(entry.address, 8, 4)}</span>
                    <span className="text-ink-3">{entry.amount}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.txHash && (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline"
                        title={entry.txHash}
                      >
                        <HugeiconsIcon icon={HashIcon} size={12} strokeWidth={1.5} />
                      </a>
                    )}
                    <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                    {entry.status === "failed" && entry.retryCount < maxRetries && (
                      <Button variant="ghost" size="sm" className="text-[10px] px-2 py-0.5" onClick={() => handleRetry(i)}>
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {results && results.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold text-ink">Summary</h4>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-green">{successfulCount} succeeded</span>
                <span className="text-red">{failedCount} failed</span>
                <span className="text-ink-3">{totalEntries} total</span>
              </div>
            </div>

            {feeEstimate && (
              <div className="rounded-lg bg-brand-dim border border-brand/20 px-4 py-3 flex items-center justify-between">
                <span className="text-[12px] text-ink-3">Estimated batch fee</span>
                <span className="text-[14px] font-semibold text-brand">{feeEstimate} stroops</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button variant="primary" size="sm" onClick={handleExportReport}>
                <HugeiconsIcon icon={DownloadIcon} size={12} color="currentColor" strokeWidth={1.5} />
                Download Report
              </Button>
              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as "csv" | "json")}
                className="bg-surface-2 border border-line rounded-lg px-3 py-1.5 text-[12px] text-ink focus:outline-none focus:border-brand"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
          </div>
        )}

        {!isConnected && (
          <p className="text-[12px] text-ink-3 text-center py-4">
            Connect your wallet to use Batch Payment Processor
          </p>
        )}
      </div>
    </div>
  );
}