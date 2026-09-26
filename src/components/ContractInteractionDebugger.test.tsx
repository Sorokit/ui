import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContractInteractionDebugger } from "./ContractInteractionDebugger";

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

    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
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

    const stored = window.sessionStorage.getItem("sorokit-soroban-debug-history");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? "[]");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].contractId).toBe("C123");
  });
});
