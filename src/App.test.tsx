import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NavSection } from "@/components/Sidebar";
import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient } from "@/lib/client";
import { createMockClient } from "@/lib/mock-client";

import App from "./App";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/screens/ConnectScreen", () => ({
  ConnectScreen: () => <div data-testid="connect-screen" />,
}));

vi.mock("@/screens/Dashboard", () => ({
  Dashboard: ({
    activeSection,
    onSectionChange,
  }: {
    activeSection: NavSection;
    onSectionChange: (s: NavSection) => void;
  }) => (
    <div data-testid="dashboard">
      <span data-testid="active-section">{activeSection}</span>
      <button onClick={() => onSectionChange("soroban")}>go-soroban</button>
    </div>
  ),
}));

function setPath(path: string) {
  window.history.pushState(null, "", path);
}

describe("App routing", () => {
  beforeEach(() => {
    localStorage.clear();
    setPath("/");
  });

  it("renders ConnectScreen when the wallet is not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: false,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);
    expect(screen.getByTestId("connect-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("renders Dashboard when the wallet is connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-screen")).not.toBeInTheDocument();
  });

  it("redirects to / when a signed-out user is on a dashboard-section URL", () => {
    setPath("/soroban");
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: false,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);
    expect(window.location.pathname).toBe("/");
  });

  it("initialises the active section from the current URL (deep link)", () => {
    setPath("/transactions");
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);
    expect(screen.getByTestId("active-section")).toHaveTextContent(
      "transactions",
    );
  });

  it("updates the URL when the section changes", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);

    fireEvent.click(screen.getByText("go-soroban"));

    expect(window.location.pathname).toBe("/soroban");
    expect(screen.getByTestId("active-section")).toHaveTextContent("soroban");
  });

  it("responds to browser back/forward via popstate", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);

    setPath("/network");
    fireEvent.popState(window);

    expect(screen.getByTestId("active-section")).toHaveTextContent("network");
  });

  it("displays a persistent offline notification banner on offline event and clears on online (#966)", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);

    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();

    fireEvent(window, new Event("offline"));
    expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/offline/i);

    fireEvent(window, new Event("online"));
    expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
  });

  it("renders a focusable Skip to main content landmark link (#966)", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);

    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute("href", "#main-content");
    skipLink.focus();
    expect(document.activeElement).toBe(skipLink);
  });

  it("renders a 404 Not Found card for unknown route URLs with a Back to Dashboard button (#966)", () => {
    setPath("/unknown-route-xyz");
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);

    expect(screen.getByTestId("not-found-card")).toBeInTheDocument();
    expect(screen.getByText(/404/i)).toBeInTheDocument();

    const backBtn = screen.getByRole("button", { name: /back to dashboard/i });
    fireEvent.click(backBtn);

    expect(window.location.pathname).toBe("/");
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });
});

