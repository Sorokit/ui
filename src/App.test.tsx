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

  it("deep-linking to /soroban lands on the Soroban screen without being overridden (#850)", () => {
    localStorage.setItem("sorokit-active-nav", "wallet");
    setPath("/soroban");
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App client={createMockClient() as SorokitClient} />);
    expect(screen.getByTestId("active-section")).toHaveTextContent("soroban");
    expect(window.location.pathname).toBe("/soroban");
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
});
