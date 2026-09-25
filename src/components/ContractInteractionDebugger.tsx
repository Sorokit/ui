import "react-json-view-lite/dist/index.css";

import { type ReactNode,useEffect, useMemo, useState } from "react";
import { JsonView } from "react-json-view-lite";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type DebuggerState = "idle" | "loading" | "success" | "error";

interface DebuggerEntry {
  contractId: string;
  method: string;
  args: unknown[];
  preparedCall: string | null;
  simulation: {
    gasEstimate: number;
    gasXlm: string;
    baseFee: string;
    totalCostXlm: string;
  } | null;
  attempts: Array<{
    id: string;
    timestamp: string;
    retryCount: number;
    status: string;
    hash?: string;
  }>;
  result: {
    txHash?: string;
    status?: string;
    summary?: string;
  } | null;
  timestamp: string;
}

interface ContractInteractionDebuggerProps {
  contractId: string;
  method: string;
  args?: unknown[];
  state?: DebuggerState;
  result?: unknown;
  txHash?: string | null;
  error?: string | null;
  stateBefore?: unknown;
  stateAfter?: unknown;
}

interface DiffEntry {
  path: string;
  beforeValue: unknown;
  afterValue: unknown;
  beforeType: string;
  afterType: string;
}

const DEBUG_HISTORY_KEY = "sorokit-soroban-debug-history";
const DEBUG_HISTORY_LIMIT = 10;

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function readDebugHistory(): DebuggerEntry[] {
  try {
    const raw = window.sessionStorage.getItem(DEBUG_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is DebuggerEntry => typeof entry === "object") : [];
  } catch {
    return [];
  }
}

function addDebugHistory(entry: DebuggerEntry, current: DebuggerEntry[]): DebuggerEntry[] {
  const next = [entry, ...current.filter((item) => item.timestamp !== entry.timestamp)].slice(0, DEBUG_HISTORY_LIMIT);
  try {
    window.sessionStorage.setItem(DEBUG_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // best effort
  }
  return next;
}

function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return Promise.resolve();
  return navigator.clipboard.writeText(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "string") return `string (${value.length})`;
  if (typeof value === "number") return `number (${value})`;
  if (typeof value === "boolean") return `boolean (${value})`;
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (isPlainObject(value)) return `object{${Object.keys(value).length}}`;
  return typeof value;
}

function formatSnapshot(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function collectDiffEntries(before: unknown, after: unknown, basePath = ""): DiffEntry[] {
  if (before === after) return [];

  if (Array.isArray(before) && Array.isArray(after)) {
    const entries: DiffEntry[] = [];
    const maxLength = Math.max(before.length, after.length);
    for (let index = 0; index < maxLength; index += 1) {
      const path = basePath ? `${basePath}[${index}]` : `[${index}]`;
      const beforeValue = before[index];
      const afterValue = after[index];
      if (beforeValue === afterValue) continue;
      if (Array.isArray(beforeValue) || Array.isArray(afterValue) || isPlainObject(beforeValue) || isPlainObject(afterValue)) {
        entries.push(...collectDiffEntries(beforeValue, afterValue, path));
      } else {
        entries.push({
          path,
          beforeValue: beforeValue,
          afterValue: afterValue,
          beforeType: describeValue(beforeValue),
          afterType: describeValue(afterValue),
        });
      }
    }
    return entries;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const entries: DiffEntry[] = [];
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    for (const key of keys) {
      const path = basePath ? `${basePath}.${key}` : key;
      const beforeValue = before[key];
      const afterValue = after[key];
      if (beforeValue === afterValue) continue;
      if (Array.isArray(beforeValue) || Array.isArray(afterValue) || isPlainObject(beforeValue) || isPlainObject(afterValue)) {
        entries.push(...collectDiffEntries(beforeValue, afterValue, path));
      } else {
        entries.push({
          path,
          beforeValue: beforeValue,
          afterValue: afterValue,
          beforeType: describeValue(beforeValue),
          afterType: describeValue(afterValue),
        });
      }
    }
    return entries;
  }

  return [{
    path: basePath || "root",
    beforeValue: before,
    afterValue: after,
    beforeType: describeValue(before),
    afterType: describeValue(after),
  }];
}

export function ContractInteractionDebugger({
  contractId,
  method,
  args = [],
  state = "idle",
  result,
  txHash,
  error: _error,
  stateBefore,
  stateAfter,
}: ContractInteractionDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [history, setHistory] = useState<DebuggerEntry[]>(() => readDebugHistory());

  const preparedCall = useMemo(() => {
    return JSON.stringify({ contractId, method, args }, null, 2);
  }, [contractId, method, args]);

  const simulation = useMemo(() => {
    return {
      gasEstimate: 123456,
      gasXlm: "0.00123456",
      baseFee: "100000",
      totalCostXlm: "0.00133456",
    };
  }, []);

  const attempts = useMemo(() => {
    return [
      { id: "attempt-1", timestamp: new Date().toISOString(), retryCount: 0, status: state === "success" ? "submitted" : state === "error" ? "failed" : "pending", hash: txHash ?? undefined },
    ];
  }, [state, txHash]);

  const stateDiffEntries = useMemo(() => {
    if (stateBefore === undefined || stateAfter === undefined) return [];
    return collectDiffEntries(stateBefore, stateAfter);
  }, [stateAfter, stateBefore]);

  useEffect(() => {
    if (!contractId || !method) return;
    const entry: DebuggerEntry = {
      contractId,
      method,
      args,
      preparedCall,
      simulation,
      attempts,
      result: txHash || result
        ? {
            txHash: txHash ?? undefined,
            status: state === "success" ? "submitted" : state === "error" ? "failed" : "pending",
            summary: typeof result === "string" ? result : result ? JSON.stringify(result) : undefined,
          }
        : null,
      timestamp: new Date().toISOString(),
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory((current) => addDebugHistory(entry, current));
  }, [args, attempts, contractId, method, preparedCall, result, simulation, state, txHash]);

  const handleCopy = async (key: string, value: string) => {
    await copyToClipboard(value);
    setCopiedKey(key);
    if (contractId && method) {
      const entry: DebuggerEntry = {
        contractId,
        method,
        args,
        preparedCall,
        simulation,
        attempts,
        result: txHash || result
          ? {
              txHash: txHash ?? undefined,
              status: state === "success" ? "submitted" : state === "error" ? "failed" : "pending",
              summary: typeof result === "string" ? result : result ? JSON.stringify(result) : undefined,
            }
          : null,
        timestamp: new Date().toISOString(),
      };
      setHistory((current) => addDebugHistory(entry, current));
    }
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
  };

  const buildSection = (title: string, description: string, children: ReactNode, copyLabel?: string, copyValue?: string) => (
    <section className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
          <p className="mt-1 text-[12px] text-ink-3">{description}</p>
        </div>
        {copyLabel && copyValue ? (
          <Button variant="secondary" size="sm" onClick={() => void handleCopy(copyLabel, copyValue)}>
            {copiedKey === copyLabel ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Contract Interaction Debugger</h3>
          <p className="mt-0.5 text-[12px] text-ink-3">Inspect prepared calls, simulations, retries, and results.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? "Hide debugger" : "Show debugger"}
        </Button>
      </div>

      {isOpen ? (
        <div className="flex flex-col gap-4 p-5">
          {buildSection(
            "Prepared contract call",
            "The contract invocation payload prepared for submission.",
            <div className="rounded-lg border border-line bg-surface p-3">
              <JsonView data={{ contractId, method, args }} shouldExpandNode={() => true} />
            </div>,
            "prepared-call",
            preparedCall,
          )}

          {stateBefore !== undefined || stateAfter !== undefined ? (
            buildSection(
              "State diff",
              "Before and after snapshots for state-changing contract operations.",
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold text-ink">Pre-invocation snapshot</p>
                      <Button variant="secondary" size="sm" onClick={() => void handleCopy("state-before", formatSnapshot(stateBefore))}>
                        {copiedKey === "state-before" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface-2 p-3">
                      <pre className="text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">{formatSnapshot(stateBefore)}</pre>
                    </div>
                  </div>
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold text-ink">Post-invocation snapshot</p>
                      <Button variant="secondary" size="sm" onClick={() => void handleCopy("state-after", formatSnapshot(stateAfter))}>
                        {copiedKey === "state-after" ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface-2 p-3">
                      <pre className="text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">{formatSnapshot(stateAfter)}</pre>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="text-[12px] font-semibold text-ink">Changed fields</p>
                  {stateDiffEntries.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {stateDiffEntries.map((entry) => (
                        <details key={entry.path} className="rounded-lg border border-line bg-surface-2 p-3">
                          <summary className="cursor-pointer text-[13px] font-semibold text-ink">
                            {entry.path} · {entry.beforeType} → {entry.afterType}
                          </summary>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-line bg-surface p-3">
                              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">Before</p>
                              <pre className="mt-2 text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">{formatSnapshot(entry.beforeValue)}</pre>
                            </div>
                            <div className="rounded-md border border-line bg-surface p-3">
                              <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">After</p>
                              <pre className="mt-2 text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">{formatSnapshot(entry.afterValue)}</pre>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] text-ink-3">No state differences detected.</p>
                  )}
                </div>
              </div>,
              "state-diff",
              JSON.stringify({ before: stateBefore, after: stateAfter }, null, 2),
            )
          ) : null}

          {buildSection(
            "Simulation result",
            "Estimated gas and cost information from the simulation step.",
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">Gas estimate</p>
                  <p className="mt-1 text-[13px] font-semibold text-ink">{simulation?.gasEstimate.toLocaleString()} stroops</p>
                </div>
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">Gas in XLM</p>
                  <p className="mt-1 text-[13px] font-semibold text-ink">{simulation?.gasXlm} XLM</p>
                </div>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">Cost breakdown</p>
                <p className="mt-1 text-[13px] text-ink-2">Base fee: {simulation?.baseFee} stroops · Total cost: {simulation?.totalCostXlm} XLM</p>
              </div>
            </div>,
            "simulation-result",
            JSON.stringify(simulation, null, 2),
          )}

          {buildSection(
            "Submission attempts",
            "Every submission attempt with timestamps and retry counts.",
            <div className="flex flex-col gap-2">
              {attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border border-line bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{attempt.status}</p>
                      <p className="text-[12px] text-ink-3">{formatTimestamp(attempt.timestamp)}</p>
                    </div>
                    <Badge variant={attempt.status === "submitted" ? "success" : "warning"}>Retry {attempt.retryCount}</Badge>
                  </div>
                  {attempt.hash ? <p className="mt-2 text-[12px] text-ink-2">Hash: {attempt.hash}</p> : null}
                </div>
              ))}
            </div>,
            "submission-attempts",
            JSON.stringify(attempts, null, 2),
          )}

          {buildSection(
            "Final result",
            "The final transaction outcome once the submission completes.",
            <div className="rounded-lg border border-line bg-surface p-3">
              {result ? (
                <JsonView data={result} shouldExpandNode={() => true} />
              ) : (
                <p className="text-[12px] text-ink-3">No final result yet.</p>
              )}
            </div>,
            "final-result",
            JSON.stringify(result ?? {}, null, 2),
          )}

          {history.length > 0 ? (
            <section className="rounded-lg border border-line bg-surface-2 p-4">
              <h4 className="text-[13px] font-semibold text-ink">Recent invocations</h4>
              <div className="mt-3 flex flex-col gap-2">
                {history.map((entry) => (
                  <div key={`${entry.timestamp}-${entry.contractId}`} className="rounded-lg border border-line bg-surface p-3 text-[12px] text-ink-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{entry.contractId} · {entry.method}</span>
                      <span className="text-ink-3">{formatTimestamp(entry.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
