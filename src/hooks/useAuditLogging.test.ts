import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getAuditLog, reloadAuditLog } from "@/lib/audit-log";

import { useAuditLogging } from "./useAuditLogging";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

function setAddress(address: string | null) {
  vi.mocked(useSorokit).mockReturnValue({ address } as unknown as ReturnType<
    typeof useSorokit
  >);
}

const summary = () => getAuditLog().map(({ action, detail }) => [action, detail]);

describe("useAuditLogging", () => {
  beforeEach(() => {
    window.localStorage.clear();
    reloadAuditLog();
  });

  it("logs nothing while no wallet is connected", () => {
    setAddress(null);
    renderHook(() => useAuditLogging());

    expect(getAuditLog()).toEqual([]);
  });

  it("logs a connect and then a disconnect with the address", () => {
    setAddress(null);
    const { rerender } = renderHook(() => useAuditLogging());

    setAddress("GABC");
    rerender();
    setAddress(null);
    rerender();

    expect(summary()).toEqual([
      ["connect", "GABC"],
      ["disconnect", "GABC"],
    ]);
  });

  it("logs a switch between accounts as a disconnect then a connect", () => {
    setAddress("GONE");
    const { rerender } = renderHook(() => useAuditLogging());

    setAddress("GTWO");
    rerender();

    expect(summary()).toEqual([
      ["connect", "GONE"],
      ["disconnect", "GONE"],
      ["connect", "GTWO"],
    ]);
  });

  it("does not log again when the address is unchanged", () => {
    setAddress("GABC");
    const { rerender } = renderHook(() => useAuditLogging());

    rerender();
    rerender();

    expect(getAuditLog()).toHaveLength(1);
  });
});
