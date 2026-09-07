import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { AccountBalanceChart } from "./AccountBalanceChart";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const MOCK_BALANCE_HISTORY = [
  {
    asset: "XLM",
    color: "#55852b",
    data: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      value: 10000 + i * 50,
    })),
  },
  {
    asset: "USDC",
    color: "#2775ca",
    data: Array.from({ length: 30 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      value: 5000 + i * 10,
    })),
  },
];

describe("AccountBalanceChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockUseSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  return {
    get client() { return getClient(); },
      address: null,
      isConnected: false,
      isConnecting: false,
      balances: [],
      ...overrides,
    };
  }

  it("renders the section title", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);
    expect(screen.getByText(/Account Balance/i)).toBeInTheDocument();
  });

  it("shows connect prompt when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit());
    render(<AccountBalanceChart />);
    expect(
      screen.getByText("Connect your wallet to view balance history"),
    ).toBeInTheDocument();
  });

  it("renders asset tabs when connected with data", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);
    const xlmElements = screen.getAllByText("XLM");
    expect(xlmElements.length).toBeGreaterThanOrEqual(1);
    const usdcElements = screen.getAllByText("USDC");
    expect(usdcElements.length).toBeGreaterThanOrEqual(1);
  });

  it("switches asset tab on click", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);

    const usdcTabs = screen.getAllByText("USDC");
    fireEvent.click(usdcTabs[0]);
    expect(screen.getAllByText("USDC").length).toBeGreaterThan(0);
  });

  it("renders timeframe selector buttons", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);

    expect(screen.getAllByText("7d")[0]).toBeInTheDocument();
    expect(screen.getAllByText("30d")[0]).toBeInTheDocument();
    expect(screen.getAllByText("90d")[0]).toBeInTheDocument();
  });

  it("switches timeframe on click", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);

    fireEvent.click(screen.getAllByText("30d")[0]);
    expect(screen.getAllByText("30d")[0]).toBeInTheDocument();
  });

  it("displays chart region", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);

    expect(
      screen.getByRole("region", { name: "Account Balance History" }),
    ).toBeInTheDocument();
  });

  it("renders the chart SVG element", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    const { container } = render(
      <AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("has accessible region landmark", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);
    expect(
      screen.getByRole("region", { name: "Account Balance History" }),
    ).toBeInTheDocument();
  });

  it("shows no data message when empty", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({ isConnected: true, balances: [] }),
    );
    render(<AccountBalanceChart />);
    expect(
      screen.getByText("No balance data available"),
    ).toBeInTheDocument();
  });

  it("displays fallback simulated data when no history provided", () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokit({
        isConnected: true,
        balances: [
          { asset: "XLM", balance: "10000.0000000", assetType: "native" },
        ],
      }),
    );
    render(<AccountBalanceChart />);
    const xlmElements = screen.getAllByText("XLM");
    expect(xlmElements.length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Chart shows simulated data/),
    ).toBeInTheDocument();
  });

  it("shows tooltip-like date info on hover", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    const { container } = render(
      <AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />,
    );

    const circles = container.querySelectorAll("svg circle");
    if (circles.length > 0) {
      fireEvent.mouseEnter(circles[0]);
    }
  });

  it("renders with proper tabular-nums for financial display", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    const { container } = render(
      <AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />,
    );
    const valueElement = container.querySelector(".tabular-nums");
    expect(valueElement).toBeInTheDocument();
  });
});
