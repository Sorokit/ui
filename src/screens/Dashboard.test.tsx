import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NavSection } from "@/components/Sidebar";

import { Dashboard } from "./Dashboard";

// Toggled from within a test to make the mocked TransactionsScreen throw on
// render, then recover once cleared — used by the per-screen ErrorBoundary
// tests below.
const { getTransactionsShouldThrow, setTransactionsShouldThrow } = vi.hoisted(
  () => {
    let shouldThrow = false;
    return {
      getTransactionsShouldThrow: () => shouldThrow,
      setTransactionsShouldThrow: (value: boolean) => {
        shouldThrow = value;
      },
    };
  },
);

// Dashboard composes every screen; stub the chrome and screens so these tests
// cover only Dashboard's own controlled/uncontrolled section logic.
vi.mock("@/components/Sidebar", () => ({
  Sidebar: ({
    active,
    onNavigate,
  }: {
    active: NavSection;
    onNavigate: (s: NavSection) => void;
  }) => (
    <nav aria-label="Main navigation">
      <span data-testid="sidebar-active">{active}</span>
      {(["wallet", "transactions", "soroban", "network"] as NavSection[]).map(
        (section) => (
          <button key={section} onClick={() => onNavigate(section)}>
            {section}
          </button>
        ),
      )}
    </nav>
  ),
}));
vi.mock("@/components/TopBar", () => ({
  TopBar: ({ active }: { active: NavSection }) => (
    <div data-testid="topbar-active">{active}</div>
  ),
}));
vi.mock("@/components/NetworkBanner", () => ({
  NetworkBanner: () => null,
}));

function stubScreen(name: string) {
  return () => <div data-testid={`screen-${name}`}>{name} screen</div>;
}

vi.mock("@/screens/WalletScreen", () => ({
  WalletScreen: stubScreen("wallet"),
}));
vi.mock("@/screens/AccountScreen", () => ({
  AccountScreen: stubScreen("account"),
}));
vi.mock("@/screens/TransactionsScreen", () => ({
  TransactionsScreen: () => {
    if (getTransactionsShouldThrow()) {
      throw new Error("boom");
    }
    return <div data-testid="screen-transactions">transactions screen</div>;
  },
}));
vi.mock("@/screens/SorobanScreen", () => ({
  SorobanScreen: stubScreen("soroban"),
}));
vi.mock("@/screens/NetworkScreen", () => ({
  NetworkScreen: stubScreen("network"),
}));
vi.mock("@/screens/RecoveryScreen", () => ({
  RecoveryScreen: stubScreen("recovery"),
}));
vi.mock("@/screens/ChartingScreen", () => ({
  ChartingScreen: stubScreen("charts"),
}));
vi.mock("@/screens/YieldFarmingScreen", () => ({
  YieldFarmingScreen: stubScreen("farming"),
}));
vi.mock("@/screens/BudgetScreen", () => ({
  BudgetScreen: stubScreen("budget"),
}));
vi.mock("@/screens/NFTScreen", () => ({
  NFTScreen: stubScreen("nfts"),
}));

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setTransactionsShouldThrow(false);
  });

  describe("uncontrolled mode", () => {
    it("starts on the Wallet screen by default", () => {
      render(<Dashboard />);
      expect(screen.getByTestId("screen-wallet")).toBeInTheDocument();
    });

    it("initialises to defaultSection when provided", async () => {
      render(<Dashboard defaultSection="soroban" />);
      expect(await screen.findByTestId("screen-soroban")).toBeInTheDocument();
      expect(screen.queryByTestId("screen-wallet")).not.toBeInTheDocument();
    });

    it("changes the rendered screen when a nav item is clicked", async () => {
      render(<Dashboard />);
      fireEvent.click(screen.getByRole("button", { name: "transactions" }));

      expect(
        await screen.findByTestId("screen-transactions"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("screen-wrapper-wallet"),
      ).toHaveAttribute("hidden");
    });

    it("does not instantiate a screen before it has been visited", () => {
      render(<Dashboard />);
      expect(
        screen.queryByTestId("screen-wrapper-soroban"),
      ).not.toBeInTheDocument();
    });

    it("keeps a previously visited screen mounted (but hidden) after navigating away", async () => {
      render(<Dashboard />);
      fireEvent.click(screen.getByRole("button", { name: "soroban" }));
      expect(await screen.findByTestId("screen-soroban")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "wallet" }));
      expect(screen.getByTestId("screen-wallet")).toBeInTheDocument();
      // Soroban stays mounted so its in-progress form state survives.
      expect(
        screen.getByTestId("screen-wrapper-soroban"),
      ).toHaveAttribute("hidden");
    });

    it("still reports navigation through onSectionChange", async () => {
      const onSectionChange = vi.fn();
      render(<Dashboard onSectionChange={onSectionChange} />);

      fireEvent.click(screen.getByRole("button", { name: "network" }));

      expect(onSectionChange).toHaveBeenCalledWith("network");
      expect(await screen.findByTestId("screen-network")).toBeInTheDocument();
    });
  });

  describe("controlled mode", () => {
    it("renders the screen named by activeSection", () => {
      render(<Dashboard activeSection="transactions" />);
      expect(screen.getByTestId("screen-transactions")).toBeInTheDocument();
      expect(screen.queryByTestId("screen-wallet")).not.toBeInTheDocument();
    });

    it("fires onSectionChange but does not change the screen itself", () => {
      const onSectionChange = vi.fn();
      render(
        <Dashboard
          activeSection="transactions"
          onSectionChange={onSectionChange}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "soroban" }));

      expect(onSectionChange).toHaveBeenCalledWith("soroban");
      // The parent owns the state, so the view is unchanged until it updates.
      expect(screen.getByTestId("screen-transactions")).toBeInTheDocument();
      expect(
        screen.queryByTestId("screen-wrapper-soroban"),
      ).not.toBeInTheDocument();
    });

    it("follows the parent when activeSection changes", async () => {
      const { rerender } = render(<Dashboard activeSection="wallet" />);
      expect(screen.getByTestId("screen-wallet")).toBeInTheDocument();

      rerender(<Dashboard activeSection="network" />);
      expect(await screen.findByTestId("screen-network")).toBeInTheDocument();
      // Wallet stays mounted (hidden) so its state survives navigation.
      expect(
        screen.getByTestId("screen-wrapper-wallet"),
      ).toHaveAttribute("hidden");
    });

    it("ignores defaultSection when activeSection is set", () => {
      render(<Dashboard activeSection="wallet" defaultSection="soroban" />);
      expect(screen.getByTestId("screen-wallet")).toBeInTheDocument();
    });

    it("passes the active section down to the chrome", () => {
      render(<Dashboard activeSection="soroban" />);
      expect(screen.getByTestId("sidebar-active")).toHaveTextContent("soroban");
      expect(screen.getByTestId("topbar-active")).toHaveTextContent("soroban");
    });
  });

  describe("per-screen error boundaries (#564)", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("does not bring down the Sidebar or TopBar when a screen crashes", () => {
      setTransactionsShouldThrow(true);
      render(<Dashboard defaultSection="transactions" />);

      expect(screen.getByLabelText("Main navigation")).toBeInTheDocument();
      expect(screen.getByTestId("topbar-active")).toBeInTheDocument();
      expect(screen.getByText(/Transactions couldn't load/)).toBeInTheDocument();
    });

    it("shows the screen name and a Retry button in the fallback", () => {
      setTransactionsShouldThrow(true);
      render(<Dashboard defaultSection="transactions" />);

      expect(screen.getByText("Transactions couldn't load")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("recovers and re-mounts only the affected screen when Retry is clicked", async () => {
      setTransactionsShouldThrow(true);
      render(<Dashboard defaultSection="transactions" />);
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

      setTransactionsShouldThrow(false);
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(
        await screen.findByTestId("screen-transactions"),
      ).toBeInTheDocument();
      // The chrome was never affected by the crash or the retry.
      expect(screen.getByLabelText("Main navigation")).toBeInTheDocument();
    });

    it("leaves other screens working while a different screen is crashed", async () => {
      setTransactionsShouldThrow(true);
      render(<Dashboard defaultSection="transactions" />);
      expect(screen.getByText("Transactions couldn't load")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "wallet" }));
      expect(await screen.findByTestId("screen-wallet")).toBeInTheDocument();
    });
  });
});
