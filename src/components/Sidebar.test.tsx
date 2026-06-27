import { fireEvent,render, screen } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import { Sidebar } from "./Sidebar";

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
});
