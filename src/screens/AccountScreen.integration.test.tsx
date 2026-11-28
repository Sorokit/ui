import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { AccountScreen } from "./AccountScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/components/AccountCard", () => ({
  AccountCard: () => <div>Account Card</div>,
}));

vi.mock("@/components/AccountSummaryCard", () => ({
  AccountSummaryCard: () => <div>Account Summary</div>,
}));

vi.mock("@/components/ClaimableBalanceCard", () => ({
  ClaimableBalanceCard: () => <div>Claimable Balances</div>,
}));

vi.mock("@/components/KeystoreBackup", () => ({
  KeystoreBackup: () => <div>Keystore Backup</div>,
}));

// reads the same mocked context as the screen so it reacts to loading state
vi.mock("@/components/BalanceList", () => ({
  BalanceList: () => {
    const { isLoadingAccount, balances } = useSorokit();
    if (isLoadingAccount) return <div>Loading balances</div>;
    return (
      <ul>
        {(balances as unknown as Array<{ asset: string; balance: string }>).map(
          (b) => (
            <li key={b.asset}>{`${b.asset}: ${b.balance}`}</li>
          ),
        )}
      </ul>
    );
  },
}));

type Ctx = ReturnType<typeof useSorokit>;

function mockContext(overrides: Partial<Ctx> = {}) {
  vi.mocked(useSorokit).mockReturnValue({
    isConnected: true,
    isLoadingAccount: false,
    refreshAccount: vi.fn(),
    balances: [],
    ...overrides,
  } as unknown as Ctx);
}

describe("AccountScreen integration (#1065)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("goes from loading to balances displayed with every sub-component present", () => {
    mockContext({ isLoadingAccount: true });
    const { rerender } = render(<AccountScreen />);

    // loading state while data fetches
    expect(
      screen.getByRole("button", { name: /refresh account data/i }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading balances")).toBeInTheDocument();

    // balances arrive
    mockContext({
      isLoadingAccount: false,
      balances: [
        { asset: "XLM", balance: "100.0000000" },
        { asset: "USDC", balance: "25.5000000" },
      ] as unknown as Ctx["balances"],
    });
    rerender(<AccountScreen />);

    expect(screen.queryByText("Loading balances")).not.toBeInTheDocument();
    expect(screen.getByText("XLM: 100.0000000")).toBeInTheDocument();
    expect(screen.getByText("USDC: 25.5000000")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh account data/i }),
    ).not.toHaveAttribute("aria-busy", "true");

    // all sub-components in the final render
    expect(screen.getByText("Account Card")).toBeInTheDocument();
    expect(screen.getByText("Claimable Balances")).toBeInTheDocument();
    expect(screen.getByText("Keystore Backup")).toBeInTheDocument();
  });
});
