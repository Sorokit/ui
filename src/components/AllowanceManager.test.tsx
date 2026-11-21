import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { AllowanceEntry, SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

import {
  AllowanceManager,
  estimateLedgerExpiry,
  formatCurrency,
  isExpired,
  validateSpender,
} from "./AllowanceManager";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));
vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

const ADDRESS = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34KZVN";

const MOCK_ALLOWANCE: AllowanceEntry = {
  asset: "USDC",
  spender: "CAIBNITKJZ2P2H3XJ2VW2YOX4X3JQBQ3F6VXZ4X3J2Q3X4X3J2Q3X4",
  spenderName: "DeFi Protocol",
  amount: "500.00",
  expirationDate: "2026-12-31T23:59:59Z",
  tokenCode: "USDC",
  tokenIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34KZVN",
};

function mockGetAllowances(allowances: AllowanceEntry[]) {
  vi.mocked(getClient).mockReturnValue({
    allowance: {
      getAllowances: vi.fn().mockResolvedValue({ data: allowances, error: null }),
      approveAllowance: vi.fn(),
      revokeAllowance: vi.fn(),
      estimateAllowanceFee: vi.fn(),
    },
  } as unknown as SorokitClient);
}

function mockApproveAllowance(shouldSucceed = true, allowances: AllowanceEntry[] = [MOCK_ALLOWANCE]) {
  vi.mocked(getClient).mockReturnValue({
    allowance: {
      getAllowances: vi.fn().mockResolvedValue({ data: allowances, error: null }),
      approveAllowance: vi.fn().mockResolvedValue({
        data: { hash: "hash1234567890", ledger: 12345, successful: shouldSucceed },
        error: null,
        status: "success",
      }),
      revokeAllowance: vi.fn(),
      estimateAllowanceFee: vi.fn(),
    },
  } as unknown as SorokitClient);
}

function mockRevokeAllowance(shouldSucceed = true, allowances: AllowanceEntry[] = [MOCK_ALLOWANCE]) {
  vi.mocked(getClient).mockReturnValue({
    allowance: {
      getAllowances: vi.fn().mockResolvedValue({ data: allowances, error: null }),
      approveAllowance: vi.fn(),
      revokeAllowance: vi.fn().mockResolvedValue({
        data: { hash: "hash1234567890", ledger: 12345, successful: shouldSucceed },
        error: null,
        status: "success",
      }),
      estimateAllowanceFee: vi.fn(),
    },
  } as unknown as SorokitClient);
}

describe("AllowanceManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useSorokit).mockReturnValue({ address: ADDRESS, isConnected: true, get client() { return getClient(); },  } as unknown as ReturnType<typeof useSorokit>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'Connect your wallet' when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: null,
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      allowance: {
        getAllowances: vi.fn().mockResolvedValue({ data: [], error: null }),
        approveAllowance: vi.fn(),
        revokeAllowance: vi.fn(),
        estimateAllowanceFee: vi.fn(),
      },
    } as unknown as SorokitClient);

    render(<AllowanceManager />);
    expect(screen.getByText("Connect your wallet")).toBeInTheDocument();
  });

  it("renders 'No allowances found' when the list is empty", async () => {
    mockGetAllowances([]);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("No allowances found")).toBeInTheDocument();
    });
  });

  it("renders allowance entries", async () => {
    mockGetAllowances([MOCK_ALLOWANCE]);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/USDC/)).toBeInTheDocument();
      expect(screen.getByText(/DeFi Protocol/)).toBeInTheDocument();
      expect(screen.getByText(/500\.00/)).toBeInTheDocument();
    });
  });

  it("handles error state", async () => {
    vi.mocked(getClient).mockReturnValue({
      allowance: {
        getAllowances: vi.fn().mockResolvedValue({
          data: null,
          error: "Failed to fetch allowances",
        }),
        approveAllowance: vi.fn(),
        revokeAllowance: vi.fn(),
        estimateAllowanceFee: vi.fn(),
      },
    } as unknown as SorokitClient);

    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load allowances/)).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch allowances/)).toBeInTheDocument();
      expect(screen.getByText(/Try again/)).toBeInTheDocument();
    });
  });

  it("expands and collapses allowance card", async () => {
    mockGetAllowances([MOCK_ALLOWANCE]);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/USDC/));
    await waitFor(() => {
      expect(screen.getByText(/Token Code/)).toBeInTheDocument();
      expect(screen.getByText(/Spender/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText(/USDC/)[0]);
    await waitFor(() => {
      expect(screen.queryByText(/Token Code/)).not.toBeInTheDocument();
    });
  });

  it("increases allowance", async () => {
    mockApproveAllowance(true);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/USDC/));
    await waitFor(() => {
      expect(screen.getByText(/Increase/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Increase/));
    await waitFor(() => {
      expect(getClient().allowance.approveAllowance).toHaveBeenCalled();
      expect(vi.mocked(getClient().allowance.approveAllowance)).toHaveBeenCalledWith({
        sourceAccount: ADDRESS,
        asset: "USDC",
        spender: MOCK_ALLOWANCE.spender,
        amount: "100.00",
      });
    });
  });

  it("handles increase failure", async () => {
    mockApproveAllowance(false);
    vi.mocked(getClient).mockReturnValue({
      allowance: {
        getAllowances: vi.fn().mockResolvedValue({ data: [MOCK_ALLOWANCE], error: null }),
        approveAllowance: vi.fn().mockResolvedValue({
          data: null,
          error: "Insufficient funds",
        }),
        revokeAllowance: vi.fn(),
        estimateAllowanceFee: vi.fn(),
      },
    } as unknown as SorokitClient);

    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/USDC/));
    await waitFor(() => {
      expect(screen.getByText(/Increase/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Increase/));
    await waitFor(() => {
      expect(vi.mocked(getClient().allowance.approveAllowance)).toHaveBeenCalled();
    });
  });

  it("decreases allowance", async () => {
    mockApproveAllowance(true);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/USDC/));
    await waitFor(() => {
      expect(screen.getByText(/Decrease/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Decrease/));
    fireEvent.change(screen.getByPlaceholderText(/0\.00/), { target: { value: "200.00" } });

    await waitFor(() => {
      expect(screen.getByText(/Decrease Allowance/)).toBeInTheDocument();
    });

    const decreaseButtons = screen.getAllByRole("button", { name: /decrease/i });
    fireEvent.click(decreaseButtons[decreaseButtons.length - 1]);
    await waitFor(() => {
      expect(vi.mocked(getClient().allowance.approveAllowance)).toHaveBeenCalled();
    });
  });

  it("revokes allowance", async () => {
    mockRevokeAllowance(true);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/USDC/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/USDC/));
    await waitFor(() => {
      expect(screen.getByText(/Revoke/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Revoke/));
    await waitFor(() => {
      expect(screen.getByText(/Confirm Revoke/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Cancel/));
    await waitFor(() => {
      expect(screen.queryByText(/Confirm Revoke/)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Revoke/));
    await waitFor(() => {
      expect(screen.getByText(/Confirm Revoke/)).toBeInTheDocument();
    });

    const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
    fireEvent.click(revokeButtons[revokeButtons.length - 1]);
    await waitFor(() => {
      expect(vi.mocked(getClient().allowance.revokeAllowance)).toHaveBeenCalled();
      expect(vi.mocked(getClient().allowance.revokeAllowance)).toHaveBeenCalledWith({
        sourceAccount: ADDRESS,
        asset: "USDC",
        spender: MOCK_ALLOWANCE.spender,
      });
    });
  });

  it("refreshes on retry", async () => {
    mockGetAllowances([]);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("No allowances found")).toBeInTheDocument();
    });

    const refreshButton = screen.getByTitle(/refresh/i);
    fireEvent.click(refreshButton);
    await waitFor(() => {
      expect(getClient().allowance.getAllowances).toHaveBeenCalledTimes(2);
    });
  });

  it("marks a ledger-expired allowance as EXPIRED", async () => {
    mockGetAllowances([
      { ...MOCK_ALLOWANCE, expirationDate: undefined, expirationLedger: 500 },
    ]);
    render(<AllowanceManager currentLedger={500} />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("EXPIRED")).toBeInTheDocument();
    });
  });

  it("marks an allowance expiring today as EXPIRED", async () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    mockGetAllowances([
      { ...MOCK_ALLOWANCE, expirationDate: "2026-01-15T00:00:00Z" },
    ]);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("EXPIRED")).toBeInTheDocument();
    });
  });

  it("does not mark an allowance expiring tomorrow as EXPIRED", async () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    mockGetAllowances([
      { ...MOCK_ALLOWANCE, expirationDate: "2026-01-16T00:00:00Z" },
    ]);
    render(<AllowanceManager />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText(/DeFi Protocol/)).toBeInTheDocument();
    });
    expect(screen.queryByText("EXPIRED")).not.toBeInTheDocument();
  });
});

describe("AllowanceManager helpers", () => {
  it("formats long token amounts without floating-point truncation", () => {
    expect(formatCurrency("12345678901234567890.123456789", "USDC")).toBe(
      "12,345,678,901,234,567,890.1234567",
    );
  });

  it("detects timestamp-based expiry", () => {
    expect(isExpired("2000-01-01T00:00:00Z")).toBe(true);
    expect(isExpired("2999-01-01T00:00:00Z")).toBe(false);
  });

  it("detects ledger-based expiry", () => {
    expect(isExpired(undefined, 1000, 1000)).toBe(true);
    expect(isExpired(undefined, 1000, 999)).toBe(false);
  });
});

// ── Issue #917: self-approval, ledger expiry estimates, revoke confirmation ──
describe("AllowanceManager — issue #917", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useSorokit).mockReturnValue({ address: ADDRESS, isConnected: true, get client() { return getClient(); } } as unknown as ReturnType<typeof useSorokit>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderLoaded(props: Parameters<typeof AllowanceManager>[0] = {}) {
    render(<AllowanceManager {...props} />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => {
      expect(screen.getByText(/DeFi Protocol/)).toBeInTheDocument();
    });
  }

  function openNewAllowanceForm() {
    fireEvent.click(screen.getByRole("button", { name: "New allowance" }));
    return screen.getByRole("form", { name: "New allowance" });
  }

  function fillForm(values: { asset?: string; spender?: string; amount?: string }) {
    if (values.asset !== undefined) {
      fireEvent.change(screen.getByLabelText("Token"), { target: { value: values.asset } });
    }
    if (values.spender !== undefined) {
      fireEvent.change(screen.getByLabelText("Spender address"), {
        target: { value: values.spender },
      });
    }
    if (values.amount !== undefined) {
      fireEvent.change(screen.getByLabelText("Amount"), { target: { value: values.amount } });
    }
  }

  describe("self-approval validation", () => {
    it("blocks approving the active address with an inline error", async () => {
      mockApproveAllowance(true);
      await renderLoaded();
      const form = openNewAllowanceForm();

      fillForm({ asset: "XLM", spender: ADDRESS, amount: "10" });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "You can't approve your own address as a spender",
      );
      const spenderInput = screen.getByLabelText("Spender address");
      expect(spenderInput).toHaveAttribute("aria-invalid", "true");
      expect(spenderInput).toHaveAttribute(
        "aria-describedby",
        screen.getByRole("alert").id,
      );
      expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();

      // Even a forced submit must not reach the client.
      fireEvent.submit(form);
      expect(getClient().allowance.approveAllowance).not.toHaveBeenCalled();
    });

    it("blocks the active address regardless of letter case or surrounding whitespace", async () => {
      mockApproveAllowance(true);
      await renderLoaded();
      openNewAllowanceForm();

      fillForm({ asset: "XLM", spender: `  ${ADDRESS.toLowerCase()} `, amount: "10" });

      expect(screen.getByRole("alert")).toHaveTextContent(/own address/i);
      expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    });

    it("approves a different spender address", async () => {
      mockApproveAllowance(true);
      await renderLoaded();
      openNewAllowanceForm();

      fillForm({ asset: "XLM", spender: MOCK_ALLOWANCE.spender, amount: "10" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      const approve = screen.getByRole("button", { name: "Approve" });
      expect(approve).toBeEnabled();
      fireEvent.click(approve);

      await waitFor(() => {
        expect(getClient().allowance.approveAllowance).toHaveBeenCalledWith({
          sourceAccount: ADDRESS,
          asset: "XLM",
          spender: MOCK_ALLOWANCE.spender,
          amount: "10",
        });
      });
    });

    it("clears the error once the spender is corrected", async () => {
      mockApproveAllowance(true);
      await renderLoaded();
      openNewAllowanceForm();

      fillForm({ spender: ADDRESS });
      expect(screen.getByRole("alert")).toBeInTheDocument();

      fillForm({ spender: MOCK_ALLOWANCE.spender });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Spender address")).not.toHaveAttribute("aria-invalid");
    });
  });

  describe("ledger expiry estimate", () => {
    it("shows an estimated date and relative time for a ledger-based expiry", async () => {
      vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
      // 86,400 ledgers × 5s = 432,000s = 5 days.
      mockGetAllowances([
        { ...MOCK_ALLOWANCE, expirationDate: undefined, expirationLedger: 1000 + 86_400 },
      ]);
      await renderLoaded({ currentLedger: 1000 });

      fireEvent.click(screen.getByText(/DeFi Protocol/));

      const expiry = await screen.findByTestId("ledger-expiry");
      expect(expiry).toHaveTextContent("Expires at ledger 87400");
      expect(expiry).toHaveTextContent("~5 days from now");
      expect(expiry).toHaveTextContent(
        // Normalise ICU's narrow no-break spaces the way toHaveTextContent does.
        new Date("2026-01-20T12:00:00Z").toLocaleString().replace(/\s+/g, " "),
      );
    });

    it("shows only the ledger number when the current ledger is unknown", async () => {
      mockGetAllowances([
        { ...MOCK_ALLOWANCE, expirationDate: undefined, expirationLedger: 500 },
      ]);
      await renderLoaded();

      fireEvent.click(screen.getByText(/DeFi Protocol/));

      expect(await screen.findByText("Expires at ledger 500")).toBeInTheDocument();
      expect(screen.queryByTestId("ledger-expiry")).not.toBeInTheDocument();
      expect(screen.queryByText(/from now/)).not.toBeInTheDocument();
    });
  });

  describe("revoke confirmation", () => {
    async function openRevokeDialog() {
      mockRevokeAllowance(true);
      await renderLoaded();
      fireEvent.click(screen.getByText(/DeFi Protocol/));
      fireEvent.click(await screen.findByTestId("revoke-allowance-0"));
      return screen.getByRole("dialog", { name: "Confirm Revoke" });
    }

    it("opens a confirmation modal instead of revoking immediately", async () => {
      const dialog = await openRevokeDialog();

      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveTextContent(/cannot be undone/i);
      expect(getClient().allowance.revokeAllowance).not.toHaveBeenCalled();
    });

    it("does not revoke when the modal is cancelled", async () => {
      await openRevokeDialog();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(getClient().allowance.revokeAllowance).not.toHaveBeenCalled();
    });

    it("does not revoke when the backdrop is clicked", async () => {
      const dialog = await openRevokeDialog();

      fireEvent.click(dialog.parentElement!);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(getClient().allowance.revokeAllowance).not.toHaveBeenCalled();
    });

    it("revokes exactly once after explicit confirmation", async () => {
      await openRevokeDialog();

      fireEvent.click(screen.getByTestId("confirm-revoke"));

      await waitFor(() => {
        expect(getClient().allowance.revokeAllowance).toHaveBeenCalledTimes(1);
      });
      expect(getClient().allowance.revokeAllowance).toHaveBeenCalledWith({
        sourceAccount: ADDRESS,
        asset: "USDC",
        spender: MOCK_ALLOWANCE.spender,
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("helpers", () => {
    it("validateSpender rejects empty and self addresses", () => {
      expect(validateSpender("", ADDRESS)).toMatch(/required/i);
      expect(validateSpender(ADDRESS, ADDRESS)).toMatch(/own address/i);
      expect(validateSpender(MOCK_ALLOWANCE.spender, ADDRESS)).toBeNull();
    });

    it("estimateLedgerExpiry converts ledgers using 5-second close times", () => {
      const now = Date.UTC(2026, 0, 1);
      const { date, relative } = estimateLedgerExpiry(1720, 1000, now);
      expect(relative).toBe("~1 hour from now");
      expect(date.getTime()).toBe(now + 3600 * 1000);

      expect(estimateLedgerExpiry(1012, 1000, now).relative).toBe("~1 minute from now");
      expect(estimateLedgerExpiry(1006, 1000, now).relative).toBe("~30 seconds from now");
      expect(estimateLedgerExpiry(0, 17_280, now).relative).toBe("~1 day ago");
    });
  });
});
