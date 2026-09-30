import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { SorobanPanel } from "./SorobanPanel";

const mockInvokeContract = vi.fn();
const mockSimulateContract = vi.fn();

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(() => ({
    isConnected: true,
    address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
    client: {
      soroban: {
        invokeContract: mockInvokeContract,
        simulateContract: mockSimulateContract,
      },
    },
  })),
}));

vi.mock("../lib/client", () => ({
  getClient: () => ({
    soroban: {
      invokeContract: mockInvokeContract,
      simulateContract: mockSimulateContract,
    },
  }),
}));

describe("SorobanPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
      client: {
        soroban: {
          invokeContract: mockInvokeContract,
          simulateContract: mockSimulateContract,
        },
      },
    } as unknown as ReturnType<typeof useSorokit>);
  });

  describe("invoke mode (default)", () => {
    it("should have invoke button disabled when method is empty", () => {
      render(<SorobanPanel contractId="" onContractIdChange={() => {}} />);
      expect(screen.getByTestId("soroban-submit")).toBeDisabled();
    });

    // Issue #581 — the Invoke button must submit the parent form natively
    // (type="submit") instead of re-dispatching the FormEvent handler through
    // an unsafe `as unknown as React.MouseEventHandler` onClick cast.
    it("submits the form natively via type=submit linked to the form's id", async () => {
      mockInvokeContract.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });

      const invokeButton = screen.getByTestId("soroban-submit");
      const form = document.querySelector("form");
      expect(invokeButton).toHaveAttribute("type", "submit");
      expect(form).not.toBeNull();
      expect(invokeButton).toHaveAttribute("form", form!.id);

      // Clicking the button reaches the form's onSubmit handler and produces
      // a real invocation — not "Not implemented".
      fireEvent.click(invokeButton);
      await screen.findByText("Result");
      expect(mockInvokeContract).toHaveBeenCalledOnce();
    });

    it("should show error when invalid JSON args are provided", async () => {
      let currentContractId = "";
      const setContractId = (id: string) => { currentContractId = id; };
      const { rerender } = render(<SorobanPanel contractId={currentContractId} onContractIdChange={setContractId} />);
      fireEvent.change(screen.getByPlaceholderText(/transfer/i), { target: { value: "mint" } });
      fireEvent.change(screen.getByPlaceholderText(/\[.*\]/i), { target: { value: "invalid json {" } });
      rerender(<SorobanPanel contractId="C123" onContractIdChange={setContractId} />);
      fireEvent.click(screen.getByTestId("soroban-submit"));
      expect(await screen.findByText(/Invalid JSON in arguments/i)).toBeInTheDocument();
    });

    it("rejects a JSON object with 'must be a JSON array' error", async () => {
      const { rerender } = render(<SorobanPanel contractId="" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByPlaceholderText(/c\.\.\./i), { target: { value: "C123" } });
      fireEvent.change(screen.getByPlaceholderText(/transfer/i), { target: { value: "mint" } });
      fireEvent.change(screen.getByPlaceholderText(/\[.*\]/i), { target: { value: "{}" } });
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      expect(await screen.findByText(/Arguments must be a JSON array/i)).toBeInTheDocument();
    });

    it("accepts a valid JSON array and reaches success state", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { success: true }, error: null });
      const { rerender } = render(<SorobanPanel contractId="" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByPlaceholderText(/c\.\.\./i), { target: { value: "C123" } });
      fireEvent.change(screen.getByPlaceholderText(/transfer/i), { target: { value: "mint" } });
      fireEvent.change(screen.getByPlaceholderText(/\[.*\]/i), { target: { value: '["arg1", 42]' } });
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      expect(await screen.findByText("Result", { selector: "span" })).toBeInTheDocument();
    });

    it("calls invokeContract with correct parameters", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { success: true, balance: 1000 }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.change(screen.getByLabelText("Arguments (JSON array)"), { target: { value: '["GAAZI...", 42]' } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });
      expect(mockInvokeContract).toHaveBeenCalledWith({
        contractId: "C123",
        method: "balance",
        args: ["GAAZI...", 42],
        sourceAccount: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
      });
    });

    it("shows error text when invokeContract returns an error", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: null, error: "Contract execution failed" });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "mint" } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      expect(await screen.findByText("Contract execution failed")).toBeInTheDocument();
    });

    it("resets state on Clear", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { success: true }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });
      fireEvent.click(screen.getByRole("button", { name: /clear/i }));
      expect(screen.queryByText("Result")).not.toBeInTheDocument();
    });

    it("invokes with Cmd+Enter from the arguments field", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });

      fireEvent.keyDown(screen.getByLabelText("Arguments (JSON array)"), {
        key: "Enter",
        metaKey: true,
      });

      expect(await screen.findByText("Result")).toBeInTheDocument();
      expect(mockInvokeContract).toHaveBeenCalledOnce();
    });

    it("grows the argument textarea as lines are added and remains user-resizable", () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const textarea = screen.getByLabelText("Arguments (JSON array)") as HTMLTextAreaElement;

      Object.defineProperty(textarea, "scrollHeight", { value: 120, configurable: true });
      fireEvent.input(textarea, { target: { value: "[\nline1\nline2\n]" } });

      expect(textarea.style.height).toBe("120px");
    });
  });

  it("grows the argument textarea as lines are added and remains user-resizable", () => {
    render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
    const textarea = screen.getByLabelText(
      "Arguments (JSON array)",
    ) as HTMLTextAreaElement;

    expect(textarea.rows).toBe(4);
    expect(textarea.className).toContain("resize-y");
    expect(textarea.className).toContain("min-h-[80px]");

    fireEvent.input(textarea, {
      target: { value: "[\n1,\n2,\n3,\n4\n]" },
    });

    expect(textarea.rows).toBe(6);
  });

  // Issue #543 — the Arguments textarea must be programmatically associated
  // with its label, and its validation error with the field itself.
  describe("arguments textarea accessibility", () => {
    it("associates the label with the textarea via htmlFor and id", () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const textarea = screen.getByRole("textbox", {
        name: "Arguments (JSON array)",
      });
      expect(textarea.tagName).toBe("TEXTAREA");
      expect(textarea.id).not.toBe("");

      const label = screen.getByText("Arguments (JSON array)");
      expect(label.tagName).toBe("LABEL");
      expect(label).toHaveAttribute("for", textarea.id);
    });

    it("points aria-describedby at the error message when the JSON is invalid", () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const textarea = screen.getByLabelText("Arguments (JSON array)");
      expect(textarea).not.toHaveAttribute("aria-describedby");
      expect(textarea).toHaveAttribute("aria-invalid", "false");

      fireEvent.change(textarea, { target: { value: "[1, 2" } });

      expect(textarea).toHaveAttribute("aria-invalid", "true");
      const describedBy = textarea.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(
        "Invalid JSON in arguments",
      );
    });
  });

  describe("simulate mode", () => {
    it("renders Simulate badge and subtitle", () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} mode="simulate" />);
      const badges = screen.getAllByText("Simulate");
      expect(badges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    });

    it("calls simulateContract instead of invokeContract", async () => {
      mockSimulateContract.mockResolvedValueOnce({ data: { gasEstimate: 123456 }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} mode="simulate" />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
      await screen.findByText("Simulation Result", { selector: "span" });
      expect(mockSimulateContract).toHaveBeenCalled();
      expect(mockInvokeContract).not.toHaveBeenCalled();
    });

    it("shows Simulation Result badge on success", async () => {
      mockSimulateContract.mockResolvedValueOnce({ data: { gasEstimate: 123456 }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} mode="simulate" />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
      expect(await screen.findByText("Simulation Result", { selector: "span" })).toBeInTheDocument();
    });
  });

  it("updates the textarea height style dynamically on input", () => {
    render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
    const textarea = screen.getByLabelText("Arguments (JSON array)") as HTMLTextAreaElement;

    Object.defineProperty(textarea, "scrollHeight", { value: 120, configurable: true });
    fireEvent.input(textarea, { target: { value: "[\nline1\nline2\n]" } });

    expect(textarea.style.height).toBe("120px");
  });

  // ── Contract ID history cap and ordering (#815) ────────────────────────
  describe("contract history — cap and ordering (#815)", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("caps stored history at 10 entries, evicting the oldest when an 11th is added", async () => {
      // Pre-populate localStorage with 10 distinct contract IDs (indices 01–10).
      const existing = Array.from({ length: 10 }, (_, i) =>
        `C${"A".repeat(54)}${String(i + 1).padStart(1, "0")}`,
      );
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify(existing),
      );

      // Render with the 11th contract ID already in the input.
      const eleventh = `C${"B".repeat(55)}`;
      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      render(
        <SorobanPanel contractId={eleventh} onContractIdChange={() => {}} />,
      );
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });

      const stored: string[] = JSON.parse(
        localStorage.getItem("sorokit-soroban-contract-history") ?? "[]",
      );
      expect(stored).toHaveLength(10);
      // The oldest entry (index 01) must have been evicted.
      expect(stored).not.toContain(existing[existing.length - 1]);
      // The newest entry is first.
      expect(stored[0]).toBe(eleventh);
    });

    it("stores the most-recently used contract ID first (newest-first ordering)", async () => {
      localStorage.clear();
      const contractA = `C${"A".repeat(55)}`;
      const contractB = `C${"B".repeat(55)}`;

      // Invoke with A first, then B.
      mockInvokeContract
        .mockResolvedValueOnce({ data: { ok: true }, error: null })
        .mockResolvedValueOnce({ data: { ok: true }, error: null });

      const { rerender } = render(
        <SorobanPanel contractId={contractA} onContractIdChange={() => {}} />,
      );
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });

      // Clear UI state, switch to contract B.
      fireEvent.click(screen.getByRole("button", { name: /clear/i }));
      rerender(
        <SorobanPanel contractId={contractB} onContractIdChange={() => {}} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });

      const stored: string[] = JSON.parse(
        localStorage.getItem("sorokit-soroban-contract-history") ?? "[]",
      );
      // B was used most recently, so it must appear before A.
      expect(stored.indexOf(contractB)).toBeLessThan(stored.indexOf(contractA));
    });
  });

  // ── Contract ID history (#205) ──────────────────────────────────────────
  describe("contract ID history", () => {
    it("shows Simulating… label while loading", async () => {
      let resolveSimulate: (v: { data: unknown; error: null }) => void = () => {};
      mockSimulateContract.mockReturnValueOnce(new Promise((resolve) => { resolveSimulate = resolve; }));
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} mode="simulate" />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
      expect(screen.getByText("Simulating…")).toBeInTheDocument();
      expect(screen.getByRole("status", { name: /simulating contract/i })).toBeInTheDocument();
      await act(async () => { resolveSimulate({ data: { ok: true }, error: null }); });
    });

    it("passes correct params to simulateContract", async () => {
      mockSimulateContract.mockResolvedValueOnce({ data: { gasEstimate: 50000 }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} mode="simulate" />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /simulate/i }));
      await screen.findByText("Simulation Result", { selector: "span" });
      expect(mockSimulateContract).toHaveBeenCalledWith({
        contractId: "C123",
        method: "balance",
        args: [],
        sourceAccount: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
      });
    });

    it("caps history at 20 by default and evicts the oldest entry when 21st contract is added", async () => {
      mockInvokeContract.mockResolvedValue({ data: { ok: true }, error: null });
      const { rerender } = render(<SorobanPanel contractId="C1" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "test" } });

      // Add 21 contracts sequentially
      for (let i = 1; i <= 21; i++) {
        const id = `C${i}`;
        rerender(<SorobanPanel contractId={id} onContractIdChange={() => {}} />);
        fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
        await screen.findByText("Result", { selector: "span" });
        fireEvent.click(screen.getByRole("button", { name: /clear/i }));
      }

      const raw = localStorage.getItem("sorokit-soroban-contract-history");
      const stored = JSON.parse(raw || "[]");
      expect(stored.length).toBe(20);
      expect(stored[0]).toBe("C21");
      expect(stored).not.toContain("C1");
    });

    it("respects custom maxHistory prop", async () => {
      mockInvokeContract.mockResolvedValue({ data: { ok: true }, error: null });
      const { rerender } = render(<SorobanPanel contractId="C1" onContractIdChange={() => {}} maxHistory={5} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "test" } });

      for (let i = 1; i <= 7; i++) {
        const id = `C${i}`;
        rerender(<SorobanPanel contractId={id} onContractIdChange={() => {}} maxHistory={5} />);
        fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
        await screen.findByText("Result", { selector: "span" });
        fireEvent.click(screen.getByRole("button", { name: /clear/i }));
      }

      const raw = localStorage.getItem("sorokit-soroban-contract-history");
      const stored = JSON.parse(raw || "[]");
      expect(stored.length).toBe(5);
      expect(stored[0]).toBe("C7");
      expect(stored).not.toContain("C1");
      expect(stored).not.toContain("C2");
    });
  });

  // ── ABI loader (#332) ──────────────────────────────────────────────────────
  describe("ABI loader (#332)", () => {
    /** Helper: open the ABI section and return the textarea. */
    async function openAbiSection() {
      fireEvent.click(screen.getByText("Load ABI"));
      // Wait for React state update to process
      await screen.findByPlaceholderText(/paste contract abi/i);
      return screen.getByPlaceholderText(/paste contract abi/i);
    }



    it("toggles the ABI paste section when clicking Load ABI", async () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const toggleBtn = screen.getByText("Load ABI");
      fireEvent.click(toggleBtn);
      expect(await screen.findByPlaceholderText(/paste contract abi/i)).toBeInTheDocument();
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/paste contract abi/i)).not.toBeInTheDocument();
      });
    });

    it("populates the method dropdown from a valid ABI array spec", async () => {
      const { rerender } = render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      await openAbiSection();
      const textarea = screen.getByPlaceholderText(/paste contract abi/i);
      const abiValue = JSON.stringify([{ name: "transfer" }, { name: "balance" }, { name: "mint" }]);
      fireEvent.change(textarea, { target: { value: abiValue } });
      // Force re-render so useCallback captures the new abiRaw
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: "Load" }));
      expect(await screen.findByText(/3 methods loaded/i)).toBeInTheDocument();

      // The method input should have a datalist with the loaded methods
      const methodInput = screen.getByLabelText("Method");
      expect(methodInput).toHaveAttribute("list", "soroban-abi-methods");
      const datalist = document.getElementById("soroban-abi-methods");
      expect(datalist).toBeInTheDocument();
      const options = datalist!.querySelectorAll("option");
      const optionValues = Array.from(options).map((o) => o.value);
      expect(optionValues).toEqual(["transfer", "balance", "mint"]);
    });

    it("populates the method dropdown from a spec sub-field", async () => {
      const { rerender } = render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      await openAbiSection();
      const textarea = screen.getByPlaceholderText(/paste contract abi/i);
      const abiValue = JSON.stringify({ spec: [{ name: "init" }, { name: "upgrade" }] });
      fireEvent.change(textarea, { target: { value: abiValue } });
      // Force re-render so useCallback captures the new abiRaw
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const buttons = screen.getAllByRole("button");
      const loadBtn = buttons.find((b) => b.textContent === "Load");
      fireEvent.click(loadBtn!);
      expect(await screen.findByText(/2 methods loaded/i)).toBeInTheDocument();

      const datalist = document.getElementById("soroban-abi-methods");
      const options = datalist!.querySelectorAll("option");
      const optionValues = Array.from(options).map((o) => o.value);
      expect(optionValues).toEqual(["init", "upgrade"]);
    });

    it("shows an error when no method names are found in the ABI", async () => {
      const { rerender } = render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      await openAbiSection();
      const textarea = screen.getByPlaceholderText(/paste contract abi/i);
      fireEvent.change(textarea, {
        target: { value: JSON.stringify([{ noName: true }]) },
      });
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const buttons = screen.getAllByRole("button");
      const loadBtn = buttons.find((b) => b.textContent === "Load");
      fireEvent.click(loadBtn!);
      expect(await screen.findByText(/No method names found/i)).toBeInTheDocument();
    });

    it("shows an error when the ABI JSON is invalid", async () => {
      const { rerender } = render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      await openAbiSection();
      const textarea = screen.getByPlaceholderText(/paste contract abi/i);
      fireEvent.change(textarea, { target: { value: "not json" } });
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const buttons = screen.getAllByRole("button");
      const loadBtn = buttons.find((b) => b.textContent === "Load");
      fireEvent.click(loadBtn!);
      expect(await screen.findByText(/Invalid JSON/i)).toBeInTheDocument();
    });

    it("disables Load button when the ABI textarea is empty", async () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.click(screen.getByText("Load ABI"));
      await screen.findByPlaceholderText(/paste contract abi/i);
      const buttons = screen.getAllByRole("button");
      const loadBtn = buttons.find((b) => b.textContent === "Load");
      expect(loadBtn).toBeDisabled();
    });

    it("clears ABI state when the Clear button is clicked", async () => {
      const { rerender } = render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.click(screen.getByText("Load ABI"));
      await screen.findByPlaceholderText(/paste contract abi/i);
      const textarea = screen.getByPlaceholderText(/paste contract abi/i);
      fireEvent.change(textarea, {
        target: { value: JSON.stringify([{ name: "transfer" }]) },
      });
      rerender(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      const loadBtn = screen.getAllByRole("button").find((b) => b.textContent === "Load");
      fireEvent.click(loadBtn!);
      expect(await screen.findByText(/1 method loaded/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      await waitFor(() => {
        expect(screen.queryByText(/1 method loaded/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Copy as cURL", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });
    });

    it("renders a Copy as cURL button in the success result section", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });
      const curlButtons = screen.getAllByRole("button", { name: /copy as cURL/i });
      expect(curlButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("copies a parseable cURL command to clipboard on click", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });
      const curlButtons = screen.getAllByRole("button", { name: /copy as cURL/i });
      fireEvent.click(curlButtons[0]);
      const curlText = writeText.mock.calls[0][0] as string;
      expect(curlText).toContain("curl -X POST");
      expect(curlText).toContain("https://soroban-rpc.example.com/invoke");
      expect(curlText).toContain("C123");
      expect(curlText).toContain("balance");
      expect(curlText).toContain("Content-Type: application/json");
    });

    it("shows Copied state briefly after clicking Copy as cURL", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });
      const curlButtons = screen.getAllByRole("button", { name: /copy as cURL/i });
      fireEvent.click(curlButtons[0]);
      expect(writeText).toHaveBeenCalled();
    });

    it("renders Copy as cURL in footbar for invoke mode success", async () => {
      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), { target: { value: "balance" } });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      await screen.findByText("Result", { selector: "span" });
      const buttons = screen.getAllByRole("button", { name: /copy as cURL/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("duplicate invocation guard", () => {
    /** Holds the in-flight call open so a second attempt can be made. */
    function pendingInvoke() {
      let resolveInvoke: (v: { data: unknown; error: null }) => void = () => {};
      mockInvokeContract.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
      );
      return () => resolveInvoke({ data: { ok: true }, error: null });
    }

    it("ignores a second click while an invocation is in flight", async () => {
      const finish = pendingInvoke();
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });

      const button = screen.getByRole("button", { name: /invoke/i });
      fireEvent.click(button);
      expect(mockInvokeContract).toHaveBeenCalledTimes(1);

      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockInvokeContract).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();

      await act(async () => { finish(); });
    });

    it("ignores Cmd+Enter while an invocation is in flight", async () => {
      const finish = pendingInvoke();
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });

      const argsField = screen.getByLabelText("Arguments (JSON array)");
      fireEvent.keyDown(argsField, { key: "Enter", metaKey: true });
      expect(mockInvokeContract).toHaveBeenCalledTimes(1);

      // The keyboard path calls doInvoke() directly, so the disabled button
      // can't block it — the guard at the top of the function has to.
      fireEvent.keyDown(argsField, { key: "Enter", metaKey: true });
      fireEvent.keyDown(argsField, { key: "Enter", ctrlKey: true });

      expect(mockInvokeContract).toHaveBeenCalledTimes(1);

      await act(async () => { finish(); });
    });

    it("allows a fresh invocation once the previous one settles", async () => {
      const finish = pendingInvoke();
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);
      fireEvent.change(screen.getByLabelText("Method"), {
        target: { value: "balance" },
      });

      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      expect(mockInvokeContract).toHaveBeenCalledTimes(1);

      await act(async () => { finish(); });
      await screen.findByText("Result", { selector: "span" });

      mockInvokeContract.mockResolvedValueOnce({ data: { ok: true }, error: null });
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));

      expect(mockInvokeContract).toHaveBeenCalledTimes(2);
    });

    it("does not invoke at all when the guard's preconditions are unmet", () => {
      render(<SorobanPanel contractId="C123" onContractIdChange={() => {}} />);

      // No method entered, so canInvoke is false.
      fireEvent.click(screen.getByRole("button", { name: /invoke/i }));
      fireEvent.keyDown(screen.getByLabelText("Arguments (JSON array)"), {
        key: "Enter",
        metaKey: true,
      });

      expect(mockInvokeContract).not.toHaveBeenCalled();
    });
  });
});
