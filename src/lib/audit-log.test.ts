import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUDIT_LOG_MAX_ENTRIES,
  auditLogToCsv,
  downloadAuditLog,
  getAuditLog,
  logAuditEvent,
  reloadAuditLog,
  useAuditLog,
} from "./audit-log";

describe("audit log", () => {
  beforeEach(() => {
    window.localStorage.clear();
    reloadAuditLog();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts empty", () => {
    expect(getAuditLog()).toEqual([]);
  });

  it("records the action and detail, oldest first", () => {
    logAuditEvent("connect", "GABC");
    logAuditEvent("send", "10 XLM to GDEST");

    expect(getAuditLog().map(({ action, detail }) => ({ action, detail }))).toEqual([
      { action: "connect", detail: "GABC" },
      { action: "send", detail: "10 XLM to GDEST" },
    ]);
  });

  it("stamps each entry with the current time as ISO 8601", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T05:06:07.000Z"));

    logAuditEvent("disconnect", "GABC");

    expect(getAuditLog()[0].timestamp).toBe("2026-03-04T05:06:07.000Z");
  });

  it("gives entries unique ids even within the same millisecond", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T05:06:07.000Z"));

    logAuditEvent("connect", "a");
    logAuditEvent("connect", "b");

    const [first, second] = getAuditLog();
    expect(first.id).not.toBe(second.id);
  });

  it("persists entries and restores them on reload", () => {
    logAuditEvent("connect", "GABC");
    reloadAuditLog();

    expect(getAuditLog()).toHaveLength(1);
    expect(getAuditLog()[0].detail).toBe("GABC");
  });

  it("ignores corrupt stored data", () => {
    window.localStorage.setItem("sorokit_audit_log", "{nope");
    reloadAuditLog();
    expect(getAuditLog()).toEqual([]);

    window.localStorage.setItem(
      "sorokit_audit_log",
      JSON.stringify([{ id: "1" }, { id: "2", timestamp: "t", action: "send", detail: "ok" }]),
    );
    reloadAuditLog();
    expect(getAuditLog()).toHaveLength(1);
  });

  it("keeps only the most recent entries", () => {
    for (let i = 0; i < AUDIT_LOG_MAX_ENTRIES + 5; i++) {
      logAuditEvent("send", `payment ${i}`);
    }

    const log = getAuditLog();
    expect(log).toHaveLength(AUDIT_LOG_MAX_ENTRIES);
    expect(log[0].detail).toBe("payment 5");
    expect(log[log.length - 1].detail).toBe(`payment ${AUDIT_LOG_MAX_ENTRIES + 4}`);
  });

  it("still records an entry when storage is blocked", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => logAuditEvent("connect", "GABC")).not.toThrow();
    expect(getAuditLog()).toHaveLength(1);
  });

  it("re-renders hook users when an entry is added", () => {
    const { result } = renderHook(() => useAuditLog());
    expect(result.current).toEqual([]);

    act(() => logAuditEvent("connect", "GABC"));

    expect(result.current).toHaveLength(1);
  });
});

describe("auditLogToCsv", () => {
  it("writes a header row and one row per entry", () => {
    const csv = auditLogToCsv([
      { id: "1", timestamp: "2026-03-04T05:06:07.000Z", action: "connect", detail: "GABC" },
      { id: "2", timestamp: "2026-03-04T05:07:00.000Z", action: "send", detail: "10 XLM to GDEST" },
    ]);

    expect(csv.split("\n")).toEqual([
      "Timestamp,Action,Details",
      "2026-03-04T05:06:07.000Z,connect,GABC",
      "2026-03-04T05:07:00.000Z,send,10 XLM to GDEST",
    ]);
  });

  it("quotes commas and quotes, and guards spreadsheet formulas", () => {
    const csv = auditLogToCsv([
      { id: "1", timestamp: "t", action: "send", detail: 'say "hi", ok' },
      { id: "2", timestamp: "t", action: "send", detail: "=SUM(A1)" },
    ]);

    expect(csv.split("\n").slice(1)).toEqual([
      't,send,"say ""hi"", ok"',
      "t,send,'=SUM(A1)",
    ]);
  });

  it("is just the header for an empty log", () => {
    expect(auditLogToCsv([])).toBe("Timestamp,Action,Details");
  });
});

describe("downloadAuditLog", () => {
  it("downloads the log as a CSV file", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:audit");
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      downloadAuditLog([
        { id: "1", timestamp: "2026-03-04T05:06:07.000Z", action: "connect", detail: "GABC" },
      ]);

      expect(click).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe("text/csv;charset=utf-8;");
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
      });
      expect(text).toBe(
        "Timestamp,Action,Details\n2026-03-04T05:06:07.000Z,connect,GABC",
      );
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});
