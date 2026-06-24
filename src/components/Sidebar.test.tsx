import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sidebar } from "./Sidebar";
import { useSorokit } from "@/context/useSorokit";

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

  it("applies active styles to the current nav item", () => {
    render(
      <Sidebar active="network" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    const networkBtn = screen.getByRole("button", { name: /network/i });
    expect(networkBtn.className).toContain("bg-surface-3");
  });

  it("does not apply active styles to inactive nav items", () => {
    render(
      <Sidebar active="wallet" onNavigate={onNavigate} open={false} onClose={onClose} />,
    );
    const accountBtn = screen.getByRole("button", { name: /account/i });
    expect(accountBtn.className).not.toContain("bg-surface-3");
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
});
