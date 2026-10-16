import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  describe("offline banner (#966)", () => {
    afterEach(() => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: true,
      });
    });

    it("does not render the offline banner while online", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });

    it("shows a persistent offline notification when the browser loses connectivity", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      const banner = screen.getByTestId("offline-banner");
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute("role", "status");
      expect(banner).toHaveTextContent(/offline/i);
    });

    it("hides the offline banner again once connectivity is restored", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
      expect(screen.getByTestId("offline-banner")).toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(screen.queryByTestId("offline-banner")).not.toBeInTheDocument();
    });

    it("renders the banner immediately on mount if the browser is already offline", () => {
      Object.defineProperty(window.navigator, "onLine", {
        configurable: true,
        value: false,
      });
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      expect(screen.getByTestId("offline-banner")).toBeInTheDocument();
    });
  });

  describe("skip-to-content link (#966)", () => {
    it("renders a skip link targeting the main content region", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      const skipLink = screen.getByText("Skip to main content");
      expect(skipLink.tagName).toBe("A");
      expect(skipLink).toHaveAttribute("href", "#main-content");
    });

    it("is the first focusable element so Tab on initial load reaches it first", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      const { container } = render(<App client={createMockClient() as SorokitClient} />);

      const focusable = container.querySelectorAll("a, button, [href]");
      expect(focusable[0]).toHaveTextContent("Skip to main content");
    });

    it("points to an element with a matching id", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      const { container } = render(<App client={createMockClient() as SorokitClient} />);

      expect(container.querySelector("#main-content")).toBeInTheDocument();
    });
  });

  describe("404 fallback for unknown routes (#966)", () => {
    it("shows a 404 card instead of a blank layout for an unmapped path", () => {
      setPath("/this-route-does-not-exist");
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      expect(screen.getByText("Page not found")).toBeInTheDocument();
      expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    });

    it("shows the 404 card for an unmapped path even when signed out", () => {
      setPath("/also-not-a-real-route");
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: false,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      expect(screen.getByText("Page not found")).toBeInTheDocument();
      expect(screen.queryByTestId("connect-screen")).not.toBeInTheDocument();
    });

    it("returns to the dashboard section when clicking Back to Dashboard", () => {
      setPath("/nonexistent");
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      fireEvent.click(screen.getByText("Back to Dashboard"));

      expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
    });

    it("does not show the 404 card for a known dashboard path", () => {
      setPath("/transactions");
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
      } as ReturnType<typeof useSorokit>);
      render(<App client={createMockClient() as SorokitClient} />);

      expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
      expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    });
  });
});
