import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient } from "@/lib/client";
import { createMockClient } from "@/lib/mock-client";

import { BatchPaymentProcessor, parseCSV, validateEntries } from "./BatchPaymentProcessor";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const VALID_ADDR = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
const VALID_ADDR2 = "GBXGQJWVLWHKUXJW2GLKZOMHCPZN5RPKXRM4QYQRDDXQJ2DCXKLMWQMA";

describe("parseCSV — field parsing", () => {
  it("parses a plain two-column CSV with no quotes", () => {
    const csv = `address,amount\n${VALID_ADDR},100\n`;
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].address).toBe(VALID_ADDR);
    expect(entries[0].amount).toBe("100");
  });

  it("handles quoted fields containing commas without splitting them", () => {
    const memo = '"hello, world"';
    const csv = `address,amount,memo\n${VALID_ADDR},50,${memo}\n`;
    const entries = parseCSV(csv);
    expect(entries).toHaveLength(1);
    expect(entries[0].memo).toBe("hello, world");
  });

  it("extracts optional asset and memo columns when present in header", () => {
    const csv = `address,amount,asset,memo\n${VALID_ADDR},200,USDC,invoice-42\n`;
    const entries = parseCSV(csv);
    expect(entries[0].asset).toBe("USDC");
    expect(entries[0].memo).toBe("invoice-42");
  });

  it("returns empty array when required address or amount column is absent", () => {
    const csv = `wallet,value\n${VALID_ADDR},100\n`;
    expect(parseCSV(csv)).toHaveLength(0);
  });

  it("returns empty array for a header-only CSV", () => {
    expect(parseCSV("address,amount\n")).toHaveLength(0);
  });
});

describe("validateEntries — validation rules", () => {
  it("passes a well-formed entry", () => {
    const errors = validateEntries([{ address: VALID_ADDR, amount: "100", asset: "XLM", memo: "" }]);
    expect(errors).toHaveLength(0);
  });

  it("rejects an invalid Stellar address", () => {
    const errors = validateEntries([{ address: "BADADDR", amount: "1", asset: "", memo: "" }]);
    expect(errors.some((e) => e.includes("Invalid Stellar address"))).toBe(true);
  });

  it("rejects a memo that exceeds 28 UTF-8 bytes", () => {
    const longMemo = "this-memo-is-definitely-too-long-for-stellar";
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo: longMemo }]);
    expect(errors.some((e) => e.includes("28 bytes"))).toBe(true);
  });

  it("accepts a memo of exactly 28 bytes", () => {
    const memo28 = "a".repeat(28);
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo: memo28 }]);
    expect(errors.every((e) => !e.includes("28 bytes"))).toBe(true);
  });

  it("rejects a 10-emoji memo even though it is only 10 characters long", () => {
    // 10 emoji = 10 chars but 40 UTF-8 bytes — a character-length check would
    // wrongly accept this.
    const emojiMemo = "\u{1F600}".repeat(10);
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo: emojiMemo }]);
    expect(errors.some((e) => e.includes("28 bytes"))).toBe(true);
  });

  it("rejects a mixed-script memo whose byte length exceeds 28 despite fewer than 28 characters", () => {
    // 14 CJK characters = 14 chars but 42 UTF-8 bytes (3 bytes each).
    const cjkMemo = "你好世界你好世界你好世界你好";
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo: cjkMemo }]);
    expect(errors.some((e) => e.includes("28 bytes"))).toBe(true);
  });

  it("accepts a mixed-script memo within the 28-byte budget", () => {
    // 14 characters, but accented Latin characters keep it at 17 UTF-8 bytes.
    const memo = "café ñandú hi";
    const errors = validateEntries([{ address: VALID_ADDR, amount: "1", asset: "", memo } ]);
    expect(errors.every((e) => !e.includes("28 bytes"))).toBe(true);
  });

  it("rejects duplicate addresses", () => {
    const entries = [
      { address: VALID_ADDR, amount: "1", asset: "", memo: "" },
      { address: VALID_ADDR, amount: "2", asset: "", memo: "" },
    ];
    const errors = validateEntries(entries);
    expect(errors.some((e) => e.includes("Duplicate address"))).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    const errors = validateEntries([{ address: VALID_ADDR, amount: "0", asset: "", memo: "" }]);
    expect(errors.some((e) => e.includes("Invalid amount"))).toBe(true);
  });

  it("accumulates errors for multiple invalid rows", () => {
    const entries = [
      { address: "BAD1", amount: "abc", asset: "", memo: "" },
      { address: VALID_ADDR2, amount: "10", asset: "", memo: "x".repeat(30) },
    ];
    const errors = validateEntries(entries);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("BatchPaymentProcessor UI render tests", () => {
  const VALID_CSV = `address,amount\n${VALID_ADDR},100\n${VALID_ADDR2},50\n`;
  const INVALID_CSV = "address,amount\nINVALID_ADDR,-50\n";
  let mockClient: SorokitClient;

  function setupMockContext(overrides = {}) {
    mockClient = createMockClient();
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
      isConnecting: false,
      address: VALID_ADDR,
      walletName: "Freighter",
      client: mockClient,
      error: null,
      clearError: vi.fn(),
      disconnectWallet: vi.fn(),
      isDisconnecting: false,
      network: { name: "testnet", network: "testnet", status: "online" },
      ...overrides,
    } as unknown as ReturnType<typeof useSorokit>);
    return mockClient;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupMockContext();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function triggerUpload(container: HTMLElement, content: string, filename = "recipients.csv") {
    const file = new File([content], filename, { type: "text/csv" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [file],
      writable: true,
      configurable: true,
    });
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("renders upload UI and displays entry list on valid CSV upload", async () => {
    const { container } = render(<BatchPaymentProcessor />);

    expect(
      screen.getByText("Drop a CSV or JSON file here"),
    ).toBeInTheDocument();

    triggerUpload(container, VALID_CSV, "payments.csv");

    await waitFor(() => {
      expect(screen.getByText("payments.csv")).toBeInTheDocument();
      expect(screen.getByText("2 entries found")).toBeInTheDocument();
    });

    const entryList = screen.getByTestId("batch-entry-list");
    expect(entryList).toBeInTheDocument();

    // The Process Batch button is displayed and enabled
    const processBtn = screen.getByRole("button", { name: /process batch/i });
    expect(processBtn).toBeInTheDocument();
    expect(processBtn).not.toBeDisabled();
  });

  it("displays validation error when an invalid CSV is uploaded", async () => {
    const { container } = render(<BatchPaymentProcessor />);
    triggerUpload(container, INVALID_CSV, "invalid.csv");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Validation Errors")).toBeInTheDocument();
      expect(
        screen.getByText(/Invalid Stellar address "INVALID_ADDR"/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Invalid amount "-50"/i),
      ).toBeInTheDocument();
    });

    // Process Batch should not be available
    expect(
      screen.queryByRole("button", { name: /process batch/i }),
    ).not.toBeInTheDocument();
  });

  it("submits batch when Process Batch button is clicked, calling client.batch.submitBatch()", async () => {
    const submitSpy = vi.spyOn(mockClient.batch, "submitBatch").mockResolvedValue({
      data: null,
      error: null,
      batchId: "batch-mock-123",
    });

    const { container } = render(<BatchPaymentProcessor />);
    triggerUpload(container, VALID_CSV);

    const processBtn = await screen.findByRole("button", { name: /process batch/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(submitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          entries: expect.arrayContaining([
            expect.objectContaining({ address: VALID_ADDR, amount: "100" }),
            expect.objectContaining({ address: VALID_ADDR2, amount: "50" }),
          ]),
          sourceAccount: VALID_ADDR,
          asset: "XLM",
          maxRetries: 3,
        }),
      );
    });

    // View transitions to batch progress
    await waitFor(() => {
      expect(screen.getByText("Batch Progress")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  it("updates progress bar aria-valuenow and role='progressbar' as getBatchStatus() polls via fake timers", async () => {
    vi.spyOn(mockClient.batch, "submitBatch").mockResolvedValue({
      data: null,
      error: null,
      batchId: "batch-mock-123",
    });

    const statusSpy = vi.spyOn(mockClient.batch, "getBatchStatus").mockResolvedValue({
      data: {
        batchId: "batch-mock-123",
        total: 2,
        completed: 1,
        failed: 0,
        status: "processing",
        percentage: 50,
        etaSeconds: 15,
      },
      error: null,
    });

    const { container } = render(<BatchPaymentProcessor />);
    triggerUpload(container, VALID_CSV);

    const processBtn = await screen.findByRole("button", { name: /process batch/i });

    // Turn on fake timers for polling control before starting batch
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(processBtn);
    });

    // Verify initial progress bar state
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("role", "progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");

    // Advance 2000ms for first poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(statusSpy).toHaveBeenCalledWith("batch-mock-123");
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByText("50%")).toBeInTheDocument();

    // Next poll finishes batch to 100%
    statusSpy.mockResolvedValueOnce({
      data: {
        batchId: "batch-mock-123",
        total: 2,
        completed: 2,
        failed: 0,
        status: "completed",
        percentage: 100,
        etaSeconds: 0,
      },
      error: null,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(progressbar).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("cancels batch processing when Cancel button is clicked, stopping polling", async () => {
    vi.spyOn(mockClient.batch, "submitBatch").mockResolvedValue({
      data: null,
      error: null,
      batchId: "batch-mock-123",
    });

    const cancelSpy = vi.spyOn(mockClient.batch, "cancelBatch").mockResolvedValue({
      data: true,
      error: null,
    });

    const statusSpy = vi.spyOn(mockClient.batch, "getBatchStatus").mockResolvedValue({
      data: {
        batchId: "batch-mock-123",
        total: 2,
        completed: 1,
        failed: 0,
        status: "processing",
        percentage: 50,
        etaSeconds: 15,
      },
      error: null,
    });

    const { container } = render(<BatchPaymentProcessor />);
    triggerUpload(container, VALID_CSV);

    const processBtn = await screen.findByRole("button", { name: /process batch/i });

    // Turn on fake timers for polling control
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(processBtn);
    });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(cancelBtn);
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(cancelSpy).toHaveBeenCalledWith("batch-mock-123");

    // Clear calls and verify no further polling occurs
    statusSpy.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it("handles pause and resume controls during batch processing", async () => {
    vi.spyOn(mockClient.batch, "submitBatch").mockResolvedValue({
      data: null,
      error: null,
      batchId: "batch-mock-123",
    });

    const statusSpy = vi.spyOn(mockClient.batch, "getBatchStatus").mockResolvedValue({
      data: {
        batchId: "batch-mock-123",
        total: 2,
        completed: 0,
        failed: 0,
        status: "processing",
        percentage: 0,
        etaSeconds: 20,
      },
      error: null,
    });

    const { container } = render(<BatchPaymentProcessor />);
    triggerUpload(container, VALID_CSV);

    const processBtn = await screen.findByRole("button", { name: /process batch/i });

    // Turn on fake timers for polling control
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(processBtn);
    });

    const pauseBtn = screen.getByRole("button", { name: /pause/i });
    expect(pauseBtn).toBeInTheDocument();

    // Click Pause
    await act(async () => {
      fireEvent.click(pauseBtn);
    });

    expect(screen.getByText("Paused")).toBeInTheDocument();
    statusSpy.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(statusSpy).not.toHaveBeenCalled();

    // Click Resume
    const resumeBtn = screen.getByRole("button", { name: /resume/i });
    await act(async () => {
      fireEvent.click(resumeBtn);
    });
    expect(screen.queryByText("Paused")).not.toBeInTheDocument();
  });

  it("renders disconnected prompt when wallet is not connected", () => {
    setupMockContext({ isConnected: false, address: null });
    render(<BatchPaymentProcessor />);
    expect(
      screen.getByText("Connect your wallet to use Batch Payment Processor"),
    ).toBeInTheDocument();
  });
});
