import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDebugHistory,
  compactForStorage,
  ContractInteractionDebugger,
  createDebuggerEntry,
  type DebuggerEntry,
} from "./ContractInteractionDebugger";

describe("ContractInteractionDebugger", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("toggles the debugger panel and shows the prepared call details", () => {
    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="transfer"
        args={["GABC", "2"]}
        state="success"
        result={{ ok: true }}
        error={null}
      />,
    );

    expect(screen.getByRole("button", { name: /show debugger/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    expect(screen.getByText(/prepared contract call/i)).toBeInTheDocument();
    expect(screen.getByText(/simulation result/i)).toBeInTheDocument();
    expect(screen.getByText(/submission attempts/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /hide debugger/i }));

    expect(screen.queryByText(/prepared contract call/i)).not.toBeInTheDocument();
  });

  it("renders a nested state diff with before and after snapshots", () => {
    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="transfer"
        args={["GA123", "100"]}
        state="success"
        result={{ txHash: "abc123", status: "submitted" }}
        txHash="abc123"
        error={null}
        stateBefore={{ user: { balance: 100, name: "Ada" }, tokens: ["USDC", "XLM"] }}
        stateAfter={{ user: { balance: 150, name: "Ada" }, tokens: ["USDC", "XLM", "BTC"] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    expect(screen.getByText(/state diff/i)).toBeInTheDocument();
    expect(screen.getByText(/user\.balance/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/150/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/tokens\[2\]/i)[0]).toBeInTheDocument();
  });

  it("handles array and map changes with indices and types", () => {
    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="updateMap"
        args={[]}
        state="success"
        stateBefore={{ items: [1, 2], config: { key1: "val1" } }}
        stateAfter={{ items: [1, 3], config: { key1: "val2", key2: "new" } }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));
    expect(screen.getByText(/items\[1\]/i)).toBeInTheDocument();
    expect(screen.getByText(/config\.key1/i)).toBeInTheDocument();
    expect(screen.getByText(/config\.key2/i)).toBeInTheDocument();
  });

  it("strips ANSI escape codes from snapshot diagnostics (#668)", () => {
    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="log"
        args={[]}
        stateBefore={{ log: "\u001b[31mERROR\u001b[0m" }}
        stateAfter={{ log: "done" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    expect(screen.queryByText((content) => typeof content === "string" && content.includes("\u001b"))).not.toBeInTheDocument();
    expect(screen.getAllByText(/ERROR/).length).toBeGreaterThan(0);
  });

  it("renders failed simulation details and the gas breakdown (#668)", () => {
    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="transfer"
        args={[]}
        state="error"
        result={{ error: "resource limit exceeded" }}
        error="boom"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText(/gas estimate/i)).toBeInTheDocument();
    expect(screen.getByText(/cost breakdown/i)).toBeInTheDocument();
  });

  it("copies values and stores recent invocations in session storage", async () => {
    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="balance"
        args={["GA123"]}
        state="success"
        result={{ txHash: "abc123", status: "submitted" }}
        txHash="abc123"
        error={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    const copyButtons = screen.getAllByRole("button", { name: /copy/i });
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("C123"));

    // handleCopy awaits the clipboard write before recording the invocation, so
    // the history entry lands in a microtask after the click; wait for it.
    await waitFor(() => {
      expect(
        window.sessionStorage.getItem("sorokit-soroban-debug-history"),
      ).toBeTruthy();
    });
    const stored = window.sessionStorage.getItem("sorokit-soroban-debug-history");
    const parsed = JSON.parse(stored ?? "[]");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contractId).toBe("C123");
  });

  it("verifies a new invocation appends to history", () => {
    const entry = createDebuggerEntry({
      contractId: "C-NEW",
      method: "mint",
      args: ["user1", 100],
      state: "success",
    });

    addDebugHistory(entry, []);

    const stored = window.sessionStorage.getItem("sorokit-soroban-debug-history");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? "[]");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contractId).toBe("C-NEW");
    expect(parsed[0].method).toBe("mint");
  });

  it("tags diff rows as added, removed or changed for themed contrast (#907)", () => {
    const { container } = render(
      <ContractInteractionDebugger
        contractId="C123"
        method="update"
        args={[]}
        stateBefore={{ kept: 1, gone: "x" }}
        stateAfter={{ kept: 2, fresh: true }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    const kinds = Array.from(
      container.querySelectorAll<HTMLElement>(".sorokit-diff-row"),
    ).map((row) => row.dataset.diffKind);
    expect(kinds).toEqual(["changed", "removed", "added"]);
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
  });

  it("applies theme-aware classes to the JSON viewer (#907)", () => {
    const { container } = render(
      <ContractInteractionDebugger contractId="C123" method="transfer" args={["GA"]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));

    expect(container.querySelector(".sorokit-json-view")).not.toBeNull();
    expect(container.querySelector(".sorokit-json-string")).not.toBeNull();
  });

  it("truncates large byte buffers and strings before persisting (#907)", () => {
    const bytes = new Uint8Array(1024 * 1024);
    const compacted = compactForStorage({
      wasm: bytes,
      blob: "a".repeat(10_000),
      list: Array.from({ length: 500 }, (_, i) => i),
    }) as { wasm: string; blob: string; list: unknown[] };

    expect(compacted.wasm).toBe(`[bytes: ${bytes.byteLength}]`);
    expect(compacted.blob.length).toBeLessThan(400);
    expect(compacted.list.length).toBeLessThanOrEqual(33);

    const entry = createDebuggerEntry({
      contractId: "C-BIG",
      method: "upload",
      args: [Array.from({ length: 5000 }, () => 255)],
      state: "success",
      result: { data: "f".repeat(100_000) },
    });
    addDebugHistory(entry, []);

    const stored = window.sessionStorage.getItem("sorokit-soroban-debug-history") ?? "";
    expect(stored.length).toBeLessThan(5_000);
  });

  it("clamps history to 10 entries", () => {
    let history: DebuggerEntry[] = [];
    for (let i = 0; i < 15; i += 1) {
      history = addDebugHistory(
        { ...createDebuggerEntry({ contractId: `C${i}`, method: "m" }), timestamp: `t-${i}` },
        history,
      );
    }
    expect(history).toHaveLength(10);
    expect(history[0].contractId).toBe("C14");
    expect(JSON.parse(window.sessionStorage.getItem("sorokit-soroban-debug-history") ?? "[]")).toHaveLength(10);
  });

  it("does not throw when storage quota is exceeded", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });
    const entry = createDebuggerEntry({ contractId: "C1", method: "m" });

    expect(() => addDebugHistory(entry, [])).not.toThrow();
    expect(addDebugHistory(entry, [])).toHaveLength(1);
    setItem.mockRestore();
  });

  it("replays a history entry with the same arguments", () => {
    const onReplay = vi.fn();
    const entry = {
      ...createDebuggerEntry({ contractId: "C-OLD", method: "mint", args: ["user1", 100] }),
      timestamp: "2026-01-01T00:00:00.000Z",
    };

    render(
      <ContractInteractionDebugger
        contractId="C123"
        method="transfer"
        history={[entry]}
        onReplay={onReplay}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));
    fireEvent.click(screen.getByRole("button", { name: /replay mint with same arguments/i }));

    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReplay).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: "C-OLD", method: "mint", args: ["user1", 100] }),
    );
  });

  it("hides the replay button when no onReplay handler is provided", () => {
    const entry = createDebuggerEntry({ contractId: "C-OLD", method: "mint" });
    render(<ContractInteractionDebugger contractId="C123" method="transfer" history={[entry]} />);

    fireEvent.click(screen.getByRole("button", { name: /show debugger/i }));
    expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
  });
});
