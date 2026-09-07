import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { AllowanceEntry, SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

import { AllowanceManager } from "./AllowanceManager";

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
});