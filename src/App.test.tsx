import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";

import App from "./App";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/screens/ConnectScreen", () => ({
  ConnectScreen: () => <div data-testid="connect-screen" />,
}));

vi.mock("@/screens/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard" />,
}));

describe("App routing", () => {
  it("renders ConnectScreen when the wallet is not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: false,
    } as ReturnType<typeof useSorokit>);
    render(<App />);
    expect(screen.getByTestId("connect-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("renders Dashboard when the wallet is connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
    } as ReturnType<typeof useSorokit>);
    render(<App />);
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByTestId("connect-screen")).not.toBeInTheDocument();
  });
});
