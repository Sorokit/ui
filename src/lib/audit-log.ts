import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sorokit_audit_log";

/** Oldest entries are dropped past this, so the log can't fill up storage. */
export const AUDIT_LOG_MAX_ENTRIES = 500;

export type AuditAction = "connect" | "disconnect" | "send";

export interface AuditEntry {
  id: string;
  /** ISO 8601 timestamp, in UTC. */
  timestamp: string;
  action: AuditAction;
  detail: string;
}

const ACTIONS: readonly AuditAction[] = ["connect", "disconnect", "send"];

function isEntry(value: unknown): value is AuditEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.timestamp === "string" &&
    typeof e.detail === "string" &&
    ACTIONS.includes(e.action as AuditAction)
  );
}

function load(): AuditEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

let entries: AuditEntry[] = load();
let nextId = 0;
const listeners = new Set<() => void>();

/** Entries in the order they happened, oldest first. */
export function getAuditLog(): AuditEntry[] {
  return entries;
}

/** Appends an entry stamped with the current time. */
export function logAuditEvent(action: AuditAction, detail = ""): void {
  const entry: AuditEntry = {
    id: `${Date.now()}-${nextId++}`,
    timestamp: new Date().toISOString(),
    action,
    detail,
  };
  entries = [...entries, entry].slice(-AUDIT_LOG_MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage is blocked; the entry stays in memory for this session.
  }
  listeners.forEach((listener) => listener());
}

/** Re-reads storage. Used by tests, and after another tab changes it. */
export function reloadAuditLog(): void {
  entries = load();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuditLog(): AuditEntry[] {
  return useSyncExternalStore(subscribe, getAuditLog, getAuditLog);
}

function csvField(value: string): string {
  // A field starting with =, +, - or @ runs as a formula in a spreadsheet, so
  // prefix it with a single quote to keep it literal text.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function auditLogToCsv(log: AuditEntry[]): string {
  const rows = log.map((entry) =>
    [entry.timestamp, entry.action, entry.detail].map(csvField).join(","),
  );
  return ["Timestamp,Action,Details", ...rows].join("\n");
}

/** Saves the audit log as a CSV file download. */
export function downloadAuditLog(log: AuditEntry[] = entries): void {
  const blob = new Blob([auditLogToCsv(log)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sorokit-audit-log.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
