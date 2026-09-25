import { AlertCircleIcon, Copy01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";
import { type NetworkInfo, type TxStatus } from "@/lib/client";
import { cn } from "@/lib/utils";

type TrackerStatus = "pending" | "confirmed" | "failed" | "network_error";

interface TrackedTransaction {
  hash: string;
  status: TrackerStatus;
  submittedAt: string;
  confirmedAt: string | null;
  error: string | null;
  lastCheckedAt: string | null;
  networkError: string | null;
}

interface TransactionStatusTrackerProps {
  hash?: string;
  hashes?: string[];
  pollIntervalMs?: number;
  className?: string;
}

function explorerTxUrl(network: NetworkInfo | null, hash: string): string | null {
  if (!network) return null;
  const segment =
    network.name === "mainnet"
      ? "public"
      : network.name === "testnet"
        ? "testnet"
        : null;
  if (!segment) return null;
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusLabel(status: TrackerStatus): string {
  switch (status) {
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    case "network_error":
      return "Pending";
    default:
      return "Pending";
  }
}

function getStatusTone(status: TrackerStatus): "success" | "error" | "warning" {
  switch (status) {
    case "confirmed":
      return "success";
    case "failed":
      return "error";
    case "network_error":
      return "warning";
    default:
      return "warning";
  }
}

function isTerminalStatus(status: TrackerStatus): boolean {
  return status === "confirmed" || status === "failed";
}

function createTrackedTransaction(hash: string): TrackedTransaction {
  return {
    hash,
    status: "pending",
    submittedAt: new Date().toISOString(),
    confirmedAt: null,
    error: null,
    lastCheckedAt: null,
    networkError: null,
  };
}

export function TransactionStatusTracker({
  hash,
  hashes = [],
  pollIntervalMs = 2000,
  className,
}: TransactionStatusTrackerProps) {
  const { network, client } = useSorokit();
  const initialHashes = useMemo(() => {
    const combined = [hash, ...hashes].filter(Boolean) as string[];
    return [...new Set(combined)];
  }, [hash, hashes]);
  const [tracked, setTracked] = useState<TrackedTransaction[]>(() =>
    initialHashes.map(createTrackedTransaction),
  );
  const trackedRef = useRef(tracked);
  const [inputValue, setInputValue] = useState("");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  useEffect(() => {
    trackedRef.current = tracked;
  }, [tracked]);

  useEffect(() => {
    if (initialHashes.length === 0) return;

    setTracked((prev) => {
      const next = [...prev];
      let changed = false;
      initialHashes.forEach((entryHash) => {
        if (!next.some((item) => item.hash === entryHash)) {
          next.push(createTrackedTransaction(entryHash));
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [initialHashes]);

  useEffect(() => {
    if (tracked.length === 0 || !client) return;

    const pollTransactions = async () => {
      const unresolved = trackedRef.current.filter((entry) => !isTerminalStatus(entry.status));
      if (unresolved.length === 0) return;

      await Promise.all(
        unresolved.map(async (entry) => {
          try {
            const { data, error } = await client.transaction.getStatus(entry.hash);
            const nextStatus = mapStatus(data, error);
            setTracked((prev) =>
              prev.map((item) => {
                if (item.hash !== entry.hash) return item;
                const confirmedAt = nextStatus === "confirmed" ? new Date().toISOString() : item.confirmedAt;
                const networkError = nextStatus === "network_error" ? (error ?? "Network issue while polling") : null;
                return {
                  ...item,
                  status: nextStatus,
                  confirmedAt,
                  error: nextStatus === "failed" ? (error ?? "Transaction failed") : null,
                  lastCheckedAt: new Date().toISOString(),
                  networkError,
                };
              }),
            );
          } catch (e) {
            setTracked((prev) =>
              prev.map((item) =>
                item.hash === entry.hash
                  ? {
                      ...item,
                      status: "network_error",
                      error: null,
                      lastCheckedAt: new Date().toISOString(),
                      networkError: e instanceof Error ? e.message : "Network issue while polling",
                    }
                  : item,
              ),
            );
          }
        }),
      );
    };

    void pollTransactions();
    const timerId = window.setInterval(() => {
      void pollTransactions();
    }, pollIntervalMs);

    return () => window.clearInterval(timerId);
  }, [client, pollIntervalMs, tracked.length]);

  const addTrackedHash = () => {
    const nextHash = inputValue.trim();
    if (!nextHash || tracked.some((item) => item.hash === nextHash)) return;
    setTracked((prev) => [...prev, createTrackedTransaction(nextHash)]);
    setInputValue("");
  };

  const handleCopy = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      window.setTimeout(() => setCopiedHash((current) => (current === hash ? null : current)), 1800);
    } catch {
      // Ignore clipboard failures and keep the UI responsive.
    }
  };

  return (
    <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Transaction Status Tracker</h3>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Watch transaction progress in real time and inspect failures.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Enter a transaction hash"
            className="flex-1"
          />
          <Button variant="secondary" size="sm" onClick={addTrackedHash}>
            Track transaction
          </Button>
        </div>
      </div>

      <div className="p-5">
        {tracked.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-line px-4 py-5 text-[13px] text-ink-3">
            <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.5} />
            <span>Add a transaction hash to start tracking it.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tracked.map((entry) => {
              const explorerUrl = explorerTxUrl(network, entry.hash);
              const statusLabel = getStatusLabel(entry.status);
              return (
                <div key={entry.hash} className="rounded-lg border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusTone(entry.status)}>{statusLabel}</Badge>
                        {entry.status === "network_error" && (
                          <span className="text-[11px] text-ink-3">Network issue — retrying soon</span>
                        )}
                      </div>
                      <p className="mt-2 text-[12px] font-medium text-ink" data-testid={`tracker-hash-${entry.hash}`}>Tracking {entry.hash}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleCopy(entry.hash)}
                        className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] text-ink-3 transition-colors hover:bg-surface-2"
                        aria-label={`Copy transaction hash ${entry.hash}`}
                        title="Copy transaction hash"
                      >
                        <span className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Copy01Icon} size={12} strokeWidth={1.5} />
                          {copiedHash === entry.hash ? "Copied" : "Copy"}
                        </span>
                      </button>
                      {explorerUrl && (
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] text-brand hover:underline"
                          aria-label={`View transaction ${entry.hash} on block explorer`}
                        >
                          View on block explorer
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-[12px] text-ink-3 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold uppercase tracking-[0.08em] text-ink-4">Submitted</p>
                      <p>{formatTimestamp(entry.submittedAt)}</p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-[0.08em] text-ink-4">
                        {entry.status === "confirmed" ? "Confirmed" : entry.status === "failed" ? "Failed" : "Last checked"}
                      </p>
                      <p>{entry.status === "confirmed" ? formatTimestamp(entry.confirmedAt) : formatTimestamp(entry.lastCheckedAt)}</p>
                    </div>
                  </div>

                  {entry.status === "failed" && entry.error ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-error-dim-strong bg-error-dim px-3 py-2 text-[12px] text-red">
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={1.5} />
                      <p>{entry.error}</p>
                    </div>
                  ) : null}

                  {entry.status === "network_error" && entry.networkError ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink-3">
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={1.5} />
                      <p>{entry.networkError}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function mapStatus(status: TxStatus | null | undefined, error: string | null): TrackerStatus {
  if (error) {
    return "failed";
  }

  switch (status) {
    case "success":
      return "confirmed";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    case "not_found":
      return "failed";
    default:
      return "pending";
  }
}
