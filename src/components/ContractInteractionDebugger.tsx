import "react-json-view-lite/dist/index.css";

import { type ReactNode, useMemo, useState } from "react";
import { defaultStyles, JsonView, type StyleProps } from "react-json-view-lite";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export type DebuggerState = "idle" | "loading" | "success" | "error";

export interface DebuggerEntry {
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

export interface ContractInteractionDebuggerProps {
  contractId: string;
  method: string;
  args?: unknown[];
  state?: DebuggerState;
  result?: unknown;
  txHash?: string | null;
  error?: string | null;
  stateBefore?: unknown;
  stateAfter?: unknown;
  history?: DebuggerEntry[];
  onHistoryChange?: (history: DebuggerEntry[]) => void;
  /** Re-run a previous invocation with the same contract, method and args. */
  onReplay?: (entry: DebuggerEntry) => void;
}

type DiffKind = "added" | "removed" | "changed";

interface DiffEntry {
  path: string;
  beforeValue: unknown;
  afterValue: unknown;
  beforeType: string;
  afterType: string;
  kind: DiffKind;
}

const DEBUG_HISTORY_KEY = "sorokit-soroban-debug-history";
const DEBUG_HISTORY_LIMIT = 10;

/**
 * Simulation results can carry large byte buffers (WASM, blobs, hashes).
 * Persisting them verbatim can blow through the browser storage quota, so
 * history entries are trimmed to lightweight previews before saving (#907).
 */
const MAX_STORED_STRING_LENGTH = 256;
const MAX_STORED_ARRAY_LENGTH = 32;
const MAX_STORED_DEPTH = 6;

/**
 * JsonView class names layered on top of the library defaults so labels and
 * values pick up theme tokens with high contrast in light and dark mode.
 */
const jsonViewStyles: StyleProps = {
  ...defaultStyles,
  container: `${defaultStyles.container} sorokit-json-view`,
  label: `${defaultStyles.label} sorokit-json-label`,
  clickableLabel: `${defaultStyles.clickableLabel} sorokit-json-label`,
  stringValue: `${defaultStyles.stringValue} sorokit-json-string`,
  numberValue: `${defaultStyles.numberValue} sorokit-json-number`,
  booleanValue: `${defaultStyles.booleanValue} sorokit-json-boolean`,
  nullValue: `${defaultStyles.nullValue} sorokit-json-null`,
  undefinedValue: `${defaultStyles.undefinedValue} sorokit-json-null`,
  otherValue: `${defaultStyles.otherValue} sorokit-json-other`,
  punctuation: `${defaultStyles.punctuation} sorokit-json-punctuation`,
};

const DIFF_KIND_LABELS: Record<DiffKind, string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
};

/**
 * Soroban VM diagnostics are sometimes returned with raw ANSI colour codes
 * (e.g. `\u001b[31m`). Strip them so they render as readable text instead of
 * garbled escape sequences (issue #668).
 */
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;]*m/g;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, "");
}

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

export function readDebugHistory(): DebuggerEntry[] {
  try {
    const raw = window.sessionStorage.getItem(DEBUG_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is DebuggerEntry => typeof entry === "object",
        )
      : [];
  } catch {
    return [];
  }
}

function truncateString(value: string): string {
  if (value.length <= MAX_STORED_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STORED_STRING_LENGTH)}… (${value.length} chars truncated)`;
}

/**
 * Returns a storage-safe copy of `value`: byte buffers are replaced with a
 * short summary, long strings and arrays are clipped, and deep nesting is
 * collapsed so a single entry can never exceed the storage quota.
 */
export function compactForStorage(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;

  if (value instanceof ArrayBuffer) {
    return `[bytes: ${value.byteLength}]`;
  }
  if (ArrayBuffer.isView(value)) {
    return `[bytes: ${value.byteLength}]`;
  }
  if (depth >= MAX_STORED_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_STORED_ARRAY_LENGTH)
      .map((item) => compactForStorage(item, depth + 1));
    if (value.length > MAX_STORED_ARRAY_LENGTH) {
      items.push(`… ${value.length - MAX_STORED_ARRAY_LENGTH} more items`);
    }
    return items;
  }

  const compacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    compacted[key] = compactForStorage(item, depth + 1);
  }
  return compacted;
}

function compactEntry(entry: DebuggerEntry): DebuggerEntry {
  return {
    ...entry,
    args: compactForStorage(entry.args) as unknown[],
    preparedCall: entry.preparedCall ? truncateString(entry.preparedCall) : null,
    result: entry.result
      ? {
          ...entry.result,
          summary: entry.result.summary
            ? truncateString(entry.result.summary)
            : undefined,
        }
      : null,
  };
}

function persistDebugHistory(entries: DebuggerEntry[]) {
  // Drop the oldest entries until the payload fits; never throw on quota errors.
  for (let count = entries.length; count >= 0; count -= 1) {
    try {
      window.sessionStorage.setItem(
        DEBUG_HISTORY_KEY,
        JSON.stringify(entries.slice(0, count)),
      );
      return;
    } catch {
      // quota exceeded or storage unavailable — retry with fewer entries
    }
  }
}

export function addDebugHistory(
  entry: DebuggerEntry,
  current: DebuggerEntry[],
): DebuggerEntry[] {
  const next = [
    compactEntry(entry),
    ...current.filter((item) => item.timestamp !== entry.timestamp),
  ].slice(0, DEBUG_HISTORY_LIMIT);
  persistDebugHistory(next);
  return next;
}

function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText)
    return Promise.resolve();
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
  if (typeof value === "string") return stripAnsi(value);
  try {
    return stripAnsi(JSON.stringify(value, null, 2));
  } catch {
    return stripAnsi(String(value));
  }
}

function diffKind(beforeValue: unknown, afterValue: unknown): DiffKind {
  if (beforeValue === undefined) return "added";
  if (afterValue === undefined) return "removed";
  return "changed";
}

function collectDiffEntries(
  before: unknown,
  after: unknown,
  basePath = "",
): DiffEntry[] {
  if (before === after) return [];

  if (Array.isArray(before) && Array.isArray(after)) {
    const entries: DiffEntry[] = [];
    const maxLength = Math.max(before.length, after.length);
    for (let index = 0; index < maxLength; index += 1) {
      const path = basePath ? `${basePath}[${index}]` : `[${index}]`;
      const beforeValue = before[index];
      const afterValue = after[index];
      if (beforeValue === afterValue) continue;
      if (
        Array.isArray(beforeValue) ||
        Array.isArray(afterValue) ||
        isPlainObject(beforeValue) ||
        isPlainObject(afterValue)
      ) {
        entries.push(...collectDiffEntries(beforeValue, afterValue, path));
      } else {
        entries.push({
          path,
          beforeValue: beforeValue,
          afterValue: afterValue,
          beforeType: describeValue(beforeValue),
          afterType: describeValue(afterValue),
          kind: diffKind(beforeValue, afterValue),
        });
      }
    }
    return entries;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const entries: DiffEntry[] = [];
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    );
    for (const key of keys) {
      const path = basePath ? `${basePath}.${key}` : key;
      const beforeValue = before[key];
      const afterValue = after[key];
      if (beforeValue === afterValue) continue;
      if (
        Array.isArray(beforeValue) ||
        Array.isArray(afterValue) ||
        isPlainObject(beforeValue) ||
        isPlainObject(afterValue)
      ) {
        entries.push(...collectDiffEntries(beforeValue, afterValue, path));
      } else {
        entries.push({
          path,
          beforeValue: beforeValue,
          afterValue: afterValue,
          beforeType: describeValue(beforeValue),
          afterType: describeValue(afterValue),
          kind: diffKind(beforeValue, afterValue),
        });
      }
    }
    return entries;
  }

  return [
    {
      path: basePath || "root",
      beforeValue: before,
      afterValue: after,
      beforeType: describeValue(before),
      afterType: describeValue(after),
      kind: diffKind(before, after),
    },
  ];
}

export function createDebuggerEntry(
  props: Omit<ContractInteractionDebuggerProps, "history" | "onHistoryChange">,
): DebuggerEntry {
  const preparedCall = JSON.stringify(
    {
      contractId: props.contractId,
      method: props.method,
      args: props.args || [],
    },
    null,
    2,
  );
  const simulation = {
    gasEstimate: 123456,
    gasXlm: "0.00123456",
    baseFee: "100000",
    totalCostXlm: "0.00133456",
  };
  const attempts = [
    {
      id: "attempt-1",
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status:
        props.state === "success"
          ? "submitted"
          : props.state === "error"
            ? "failed"
            : "pending",
      hash: props.txHash ?? undefined,
    },
  ];
  return {
    contractId: props.contractId,
    method: props.method,
    args: props.args || [],
    preparedCall,
    simulation,
    attempts,
    result:
      props.txHash || props.result
        ? {
            txHash: props.txHash ?? undefined,
            status:
              props.state === "success"
                ? "submitted"
                : props.state === "error"
                  ? "failed"
                  : "pending",
            summary: props.result
              ? stripAnsi(
                  typeof props.result === "string"
                    ? props.result
                    : JSON.stringify(props.result),
                )
              : undefined,
          }
        : null,
    timestamp: new Date().toISOString(),
  };
}

export function ContractInteractionDebugger({
  contractId,
  method,
  args = [],
  state = "idle",
  result,
  txHash,
  error,
  stateBefore,
  stateAfter,
  history = [],
  onHistoryChange,
  onReplay,
}: ContractInteractionDebuggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
      {
        id: "attempt-1",
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status:
          state === "success"
            ? "submitted"
            : state === "error"
              ? "failed"
              : "pending",
        hash: txHash ?? undefined,
      },
    ];
  }, [state, txHash]);

  const stateDiffEntries = useMemo(() => {
    if (stateBefore === undefined || stateAfter === undefined) return [];
    return collectDiffEntries(stateBefore, stateAfter);
  }, [stateAfter, stateBefore]);

  const handleCopy = async (key: string, value: string) => {
    await copyToClipboard(value);
    setCopiedKey(key);
    if (contractId && method) {
      const entry = createDebuggerEntry({
        contractId,
        method,
        args,
        state,
        result,
        txHash,
        error,
        stateBefore,
        stateAfter,
      });
      // Persist first: an optional call would skip `addDebugHistory` entirely
      // when no `onHistoryChange` handler is supplied, silently losing the entry.
      const nextHistory = addDebugHistory(entry, history);
      onHistoryChange?.(nextHistory);
    }
    window.setTimeout(
      () => setCopiedKey((current) => (current === key ? null : current)),
      1600,
    );
  };

  const buildSection = (
    title: string,
    description: string,
    children: ReactNode,
    copyLabel?: string,
    copyValue?: string,
  ) => (
    <section className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
          <p className="mt-1 text-[12px] text-ink-3">{description}</p>
        </div>
        {copyLabel && copyValue ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleCopy(copyLabel, copyValue)}
          >
            {copiedKey === copyLabel ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      <div className="mt-3 min-w-0 overflow-x-auto">{children}</div>
    </section>
  );

  return (
    <div className="mt-6 rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Contract Interaction Debugger
          </h3>
          <p className="mt-0.5 text-[12px] text-ink-3">
            Inspect prepared calls, simulations, retries, and results.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? "Hide debugger" : "Show debugger"}
        </Button>
      </div>

      {isOpen ? (
        <div className="flex flex-col gap-4 p-5">
          {buildSection(
            "Prepared contract call",
            "The contract invocation payload prepared for submission.",
            <div className="rounded-lg border border-line bg-surface p-3 overflow-x-auto">
              <JsonView
                data={{ contractId, method, args }}
                shouldExpandNode={() => true}
                style={jsonViewStyles}
              />
            </div>,
            "prepared-call",
            preparedCall,
          )}

          {stateBefore !== undefined || stateAfter !== undefined
            ? buildSection(
                "State diff",
                "Before and after snapshots for state-changing contract operations.",
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-line bg-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold text-ink">
                          Pre-invocation snapshot
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void handleCopy(
                              "state-before",
                              formatSnapshot(stateBefore),
                            )
                          }
                        >
                          {copiedKey === "state-before" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface-2 p-3">
                        <pre className="text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">
                          {formatSnapshot(stateBefore)}
                        </pre>
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[12px] font-semibold text-ink">
                          Post-invocation snapshot
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            void handleCopy(
                              "state-after",
                              formatSnapshot(stateAfter),
                            )
                          }
                        >
                          {copiedKey === "state-after" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface-2 p-3">
                        <pre className="text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">
                          {formatSnapshot(stateAfter)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-[12px] font-semibold text-ink">
                      Changed fields
                    </p>
                    {stateDiffEntries.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {stateDiffEntries.map((entry) => (
                          <details
                            key={entry.path}
                            className="sorokit-diff-row rounded-lg border p-3"
                            data-diff-kind={entry.kind}
                          >
                            <summary className="cursor-pointer text-[13px] font-semibold">
                              <span className="sorokit-diff-badge mr-2 rounded px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em]">
                                {DIFF_KIND_LABELS[entry.kind]}
                              </span>
                              {entry.path} · {entry.beforeType} →{" "}
                              {entry.afterType}
                            </summary>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="rounded-md border border-line bg-surface p-3">
                                <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">
                                  Before
                                </p>
                                <pre className="mt-2 text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">
                                  {formatSnapshot(entry.beforeValue)}
                                </pre>
                              </div>
                              <div className="rounded-md border border-line bg-surface p-3">
                                <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">
                                  After
                                </p>
                                <pre className="mt-2 text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">
                                  {formatSnapshot(entry.afterValue)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-[12px] text-ink-3">
                        No state differences detected.
                      </p>
                    )}
                  </div>
                </div>,
                "state-diff",
                JSON.stringify(
                  { before: stateBefore, after: stateAfter },
                  null,
                  2,
                ),
              )
            : null}

          {buildSection(
            "Simulation result",
            "Estimated gas and cost information from the simulation step.",
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">
                    Gas estimate
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-ink">
                    {simulation?.gasEstimate.toLocaleString()} stroops
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-surface p-3">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">
                    Gas in XLM
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-ink">
                    {simulation?.gasXlm} XLM
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-ink-4">
                  Cost breakdown
                </p>
                <p className="mt-1 text-[13px] text-ink-2">
                  Base fee: {simulation?.baseFee} stroops · Total cost:{" "}
                  {simulation?.totalCostXlm} XLM
                </p>
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
                <div
                  key={attempt.id}
                  className="rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {attempt.status}
                      </p>
                      <p className="text-[12px] text-ink-3">
                        {formatTimestamp(attempt.timestamp)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        attempt.status === "submitted" ? "success" : "warning"
                      }
                    >
                      Retry {attempt.retryCount}
                    </Badge>
                  </div>
                  {attempt.hash ? (
                    <p className="mt-2 text-[12px] text-ink-2">
                      Hash: {attempt.hash}
                    </p>
                  ) : null}
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
              {error ? (
                <p className="mb-3 rounded-md border border-error-dim bg-error-dim-muted px-3 py-2 text-[12px] font-mono text-red whitespace-pre-wrap break-words">
                  {stripAnsi(error)}
                </p>
              ) : null}
              {result ? (
                <JsonView
                  data={result}
                  shouldExpandNode={() => true}
                  style={jsonViewStyles}
                />
              ) : (
                <p className="text-[12px] text-ink-3">No final result yet.</p>
              )}
            </div>,
            "final-result",
            JSON.stringify(result ?? {}, null, 2),
          )}

          {history.length > 0 ? (
            <section className="rounded-lg border border-line bg-surface-2 p-4">
              <h4 className="text-[13px] font-semibold text-ink">
                Recent invocations
              </h4>
              <div className="mt-3 flex flex-col gap-2">
                {history.map((entry) => (
                  <div
                    key={`${entry.timestamp}-${entry.contractId}`}
                    className="rounded-lg border border-line bg-surface p-3 text-[12px] text-ink-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {entry.contractId} · {entry.method}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-3">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        {onReplay ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Replay ${entry.method} with same arguments`}
                            onClick={() => onReplay(entry)}
                          >
                            Replay
                          </Button>
                        ) : null}
                      </div>
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
