import { fireEvent,render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import packageJson from "../../package.json";
import { NAV, Sidebar } from "./Sidebar";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("./AccountCard", () => ({
  AccountCardCompact: () => <div data-testid="account-card-compact" />,
}));

describe("Sidebar", () => {
  const onNavigate = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
  });

  it("calls onNavigate with the correct NavSection when a nav button is clicked", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /account/i }));
    expect(onNavigate).toHaveBeenCalledWith("account");
  });

  it("calls onNavigate before onClose when a nav item is selected", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /account/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.invocationCallOrder[0]).toBeLessThan(
      onClose.mock.invocationCallOrder[0],
    );
  });

  it("calls onNavigate with each available section", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /transactions/i }));
    expect(onNavigate).toHaveBeenCalledWith("transactions");

    fireEvent.click(screen.getByRole("button", { name: /soroban/i }));
    expect(onNavigate).toHaveBeenCalledWith("soroban");

    fireEvent.click(screen.getByRole("button", { name: /network/i }));
    expect(onNavigate).toHaveBeenCalledWith("network");
  });

  it("applies active styles and aria-current='page' to the current nav item", () => {
    render(
      <Sidebar active="network" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    const networkBtn = screen.getByRole("button", { name: /network/i });
    expect(networkBtn.className).toContain("bg-surface-3");
    expect(networkBtn).toHaveAttribute("aria-current", "page");
  });

  it("does not apply active styles or aria-current to inactive nav items", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    const accountBtn = screen.getByRole("button", { name: /account/i });
    expect(accountBtn.className).not.toContain("bg-surface-3");
    expect(accountBtn).not.toHaveAttribute("aria-current");
  });

  it("calls onClose when the mobile backdrop is clicked", () => {
    const { container } = render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={true} onClose={onClose} />,
    );
    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render the mobile backdrop when open is false", () => {
    const { container } = render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    expect(container.querySelector(".fixed.inset-0")).toBeNull();
  });

  it("renders AccountCardCompact when isConnected is true", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    expect(screen.getByTestId("account-card-compact")).toBeInTheDocument();
  });

  it("does not render AccountCardCompact when isConnected is false", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: false,
    } as ReturnType<typeof useSorokit>);
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    expect(screen.queryByTestId("account-card-compact")).not.toBeInTheDocument();
  });

  it("renders nav element with correct aria-label", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    const navElement = screen.getByRole("navigation");
    expect(navElement).toHaveAttribute("aria-label", "Main navigation");
  });

  it("reads localStorage on mount for visual selection without navigating", () => {
    localStorage.setItem("sorokit-active-nav", "network");

    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /network/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    localStorage.removeItem("sorokit-active-nav");
  });

  it("does not call onNavigate when localStorage has no saved section", () => {
    localStorage.removeItem("sorokit-active-nav");

    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("updates localStorage when navigating to a new section", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /account/i }));

    expect(localStorage.getItem("sorokit-active-nav")).toBe("account");
  });

  it("traps focus and handles escape/restoration on mobile", () => {
    vi.stubGlobal("innerWidth", 375);

    // Create a dummy trigger element and focus it
    const trigger = document.createElement("button");
    trigger.setAttribute("id", "trigger-btn");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Render Sidebar with open={true}
    const { rerender } = render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={true} onClose={onClose} />
    );

    // Verify first nav button is focused
    const sidebarContainer = document.querySelector("aside")!;
    const sidebarButtons = sidebarContainer.querySelectorAll("button");
    const walletButton = sidebarButtons[0];
    const lastButton = sidebarButtons[sidebarButtons.length - 1];
    expect(document.activeElement).toBe(walletButton);

    // Test Escape key closes the sidebar
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();

    // Test Tab trap: Shift+Tab on first element wraps to last element
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);

    // Test Tab trap: Tab on last element wraps to first element
    lastButton.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(walletButton);

    // Test returning focus when closing
    rerender(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />
    );
    expect(document.activeElement).toBe(trigger);

    // Clean up
    document.body.removeChild(trigger);
    vi.unstubAllGlobals();
  });

  describe("version footer (#351)", () => {
    it("renders the version string from package.json in the footer", () => {
      render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );
      expect(screen.getByText(`v${packageJson.version}`)).toBeInTheDocument();
    });
  });

  describe("logo click navigation (#351)", () => {
    it("fires onNavigate('wallet') when the logo is clicked", () => {
      render(
        <Sidebar active="soroban" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sorokit/i }));
      expect(onNavigate).toHaveBeenCalledWith("wallet");
    });

    it("fires onNavigate('wallet') from the logo even when already on the wallet screen", () => {
      render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );
      fireEvent.click(screen.getByRole("button", { name: /sorokit/i }));
      expect(onNavigate).toHaveBeenCalledWith("wallet");
    });
  });

  describe("issue #678 fixes", () => {
    it("locks body scroll overflow to hidden when mobile navigation drawer is open and restores on close", () => {
      document.body.style.overflow = "auto";

      const { rerender } = render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={true} onClose={onClose} />,
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      expect(document.body.style.overflow).toBe("auto");

      // Verify unmount cleanup when open
      const { unmount: unmountOpen } = render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={true} onClose={onClose} />,
      );
      expect(document.body.style.overflow).toBe("hidden");
      unmountOpen();
      expect(document.body.style.overflow).toBe("auto");
    });

    it("highlights parent sidebar navigation item for nested routes", () => {
      render(
        <Sidebar active="/nfts/collection/123" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      const nftsBtn = screen.getByRole("button", { name: /nfts/i });
      expect(nftsBtn).toHaveAttribute("aria-current", "page");
      expect(nftsBtn.className).toContain("bg-surface-3");
    });

    it("highlights parent item for nested section route without leading slash", () => {
      render(
        <Sidebar active="nfts/collection/456" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      const nftsBtn = screen.getByRole("button", { name: /nfts/i });
      expect(nftsBtn).toHaveAttribute("aria-current", "page");
    });
  });

  describe("nav semantics and keyboard access (#550)", () => {
    const NAV_ITEMS = [
      "Wallet",
      "Account",
      "Transactions",
      "Soroban",
      "Network",
      "Recovery Assistant",
      "Advanced Charting",
      "Yield Farming",
      "Budget Manager",
      "NFTs",
      "Governance",
    ];

    it("renders every nav item as a natively focusable button, not a div", () => {
      render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      const navButtons = within(nav).getAllByRole("button");

      expect(navButtons).toHaveLength(NAV_ITEMS.length);
      navButtons.forEach((button, index) => {
        expect(button.tagName).toBe("BUTTON");
        expect(button).toHaveAttribute("type", "button");
        expect(button).toHaveAccessibleName(NAV_ITEMS[index]);
        expect(button).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("activates the focused nav item with Enter and with Space", async () => {
      const user = userEvent.setup();
      render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      const transactions = screen.getByRole("button", { name: "Transactions" });
      transactions.focus();
      expect(transactions).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(onNavigate).toHaveBeenCalledWith("transactions");

      onNavigate.mockClear();

      const soroban = screen.getByRole("button", { name: "Soroban" });
      soroban.focus();
      await user.keyboard(" ");
      expect(onNavigate).toHaveBeenCalledWith("soroban");
    });

    it("keeps an accessible name on the icon-only collapsed nav items", () => {
      localStorage.setItem("sorokit-sidebar-collapsed", "true");

      render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      // Collapsed buttons render no text, so the name has to come from aria-label.
      const transactions = screen.getByRole("button", { name: "Transactions" });
      expect(transactions).toHaveAccessibleName("Transactions");
      expect(transactions).not.toHaveTextContent("Transactions");

      localStorage.removeItem("sorokit-sidebar-collapsed");
    });
  });

  describe("distinct nav section icons (#744)", () => {
    it("assigns a unique icon to every NavSection entry in NAV", () => {
      expect(NAV.length).toBeGreaterThan(0);
      const icons = NAV.map((item) => item.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(NAV.length);
    });

    it("verifies each nav item renders a distinct icon in the DOM", () => {
      render(
        <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
      );

      const nav = screen.getByRole("navigation", { name: "Main navigation" });
      const navButtons = within(nav).getAllByRole("button");
      expect(navButtons).toHaveLength(NAV.length);

      const renderedSvgs = navButtons.map((button) => {
        const svg = button.querySelector("svg");
        expect(svg).toBeInTheDocument();
        return svg!.innerHTML;
      });

      const uniqueSvgs = new Set(renderedSvgs);
      expect(uniqueSvgs.size).toBe(NAV.length);
    });

    it("uses semantically appropriate icons for charts, farming, budget, recovery, and governance", () => {
      const chartsItem = NAV.find((item) => item.id === "charts");
      const farmingItem = NAV.find((item) => item.id === "farming");
      const budgetItem = NAV.find((item) => item.id === "budget");
      const transactionsItem = NAV.find((item) => item.id === "transactions");
      const sorobanItem = NAV.find((item) => item.id === "soroban");
      const walletItem = NAV.find((item) => item.id === "wallet");
      const accountItem = NAV.find((item) => item.id === "account");
      const recoveryItem = NAV.find((item) => item.id === "recovery");
      const governanceItem = NAV.find((item) => item.id === "governance");

      expect(chartsItem?.icon).not.toBe(transactionsItem?.icon);
      expect(farmingItem?.icon).not.toBe(sorobanItem?.icon);
      expect(budgetItem?.icon).not.toBe(walletItem?.icon);
      expect(recoveryItem?.icon).not.toBe(accountItem?.icon);
      expect(governanceItem?.icon).not.toBe(accountItem?.icon);
      expect(recoveryItem?.icon).not.toBe(governanceItem?.icon);
    });
  });
});
