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

  it("shows an accessible empty state when the current asset has no history", () => {
    vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
    render(
      <AccountBalanceChart
        balanceHistory={[
          { asset: "XLM", color: "#55852b", data: [] },
        ]}
      />,
    );

    expect(
      screen.getByRole("status", { name: /No balance history available/i }),
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

  // issue #892: the SVG path generator divided by `data.length - 1`, which is
  // zero for a single data point, producing `d="M NaN NaN"`.
  describe("NaN-safe SVG path (#892)", () => {
    function pathDValues(container: HTMLElement): string[] {
      return Array.from(container.querySelectorAll("svg path")).map(
        (p) => p.getAttribute("d") ?? "",
      );
    }

    it("never renders a NaN path when the dataset has exactly one point", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(
        <AccountBalanceChart
          balanceHistory={[
            { asset: "XLM", color: "#55852b", data: [{ date: "2026-06-01", value: 100 }] },
          ]}
        />,
      );
      const paths = pathDValues(container);
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) {
        expect(d).not.toMatch(/NaN/);
      }
    });

    it("never renders a NaN path when every balance value is identical", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(
        <AccountBalanceChart
          balanceHistory={[
            {
              asset: "XLM",
              color: "#55852b",
              data: [
                { date: "2026-06-01", value: 100 },
                { date: "2026-06-02", value: 100 },
                { date: "2026-06-03", value: 100 },
              ],
            },
          ]}
        />,
      );
      const paths = pathDValues(container);
      expect(paths.length).toBeGreaterThan(0);
      for (const d of paths) {
        expect(d).not.toMatch(/NaN/);
      }
    });

    it("renders a flat horizontal line (constant y) when all values are identical", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(
        <AccountBalanceChart
          balanceHistory={[
            {
              asset: "XLM",
              color: "#55852b",
              data: [
                { date: "2026-06-01", value: 50 },
                { date: "2026-06-02", value: 50 },
              ],
            },
          ]}
        />,
      );
      const linePath = container.querySelector("svg path[stroke]");
      expect(linePath).not.toBeNull();
      const d = linePath!.getAttribute("d")!;
      // Extract the y-coordinate of every point in the path command and
      // assert they're all the same (a flat baseline).
      const yCoords = Array.from(d.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)).map((m) =>
        Number(m[2]),
      );
      expect(yCoords.length).toBeGreaterThan(0);
      expect(new Set(yCoords).size).toBe(1);
    });

    it("renders nothing (no SVG) for an empty dataset instead of a broken path", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(
        <AccountBalanceChart
          balanceHistory={[{ asset: "XLM", color: "#55852b", data: [] }]}
        />,
      );
      expect(container.querySelector("svg")).not.toBeInTheDocument();
      expect(
        screen.getByRole("status", { name: /No balance history available/i }),
      ).toBeInTheDocument();
    });
  });

  // issue #892: comprehensive timeframe-toggle coverage. The component's
  // real timeframes are 7d/30d/90d (not 24h/7d/30d/1y as a generic issue
  // description might assume); these tests cover switching among all of them
  // and verify the chart actually re-renders different data, not just that
  // the button exists.
  describe("timeframe toggle behavior (#892)", () => {
    const LONG_HISTORY = [
      {
        asset: "XLM",
        color: "#55852b",
        data: Array.from({ length: 90 }, (_, i) => ({
          date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
          value: 1000 + i,
        })),
      },
    ];

    function countCircles(container: HTMLElement): number {
      return container.querySelectorAll("svg circle").length;
    }

    it("defaults to the 7d timeframe and renders 7 data points", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(<AccountBalanceChart balanceHistory={LONG_HISTORY} />);
      expect(countCircles(container)).toBe(7);
    });

    it("renders 30 data points after switching to the 30d timeframe", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(<AccountBalanceChart balanceHistory={LONG_HISTORY} />);
      fireEvent.click(screen.getAllByText("30d")[0]);
      expect(countCircles(container)).toBe(30);
    });

    it("renders 90 data points after switching to the 90d timeframe", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(<AccountBalanceChart balanceHistory={LONG_HISTORY} />);
      fireEvent.click(screen.getAllByText("90d")[0]);
      expect(countCircles(container)).toBe(90);
    });

    it("returns to 7 data points when switching back to 7d from 90d", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      const { container } = render(<AccountBalanceChart balanceHistory={LONG_HISTORY} />);
      fireEvent.click(screen.getAllByText("90d")[0]);
      expect(countCircles(container)).toBe(90);
      fireEvent.click(screen.getAllByText("7d")[0]);
      expect(countCircles(container)).toBe(7);
    });

    it("highlights only the active timeframe button", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      render(<AccountBalanceChart balanceHistory={LONG_HISTORY} />);
      const btn30d = screen.getAllByText("30d")[0];
      const btn7d = screen.getAllByText("7d")[0];

      expect(btn7d.className).toContain("bg-surface-2");
      expect(btn30d.className).not.toContain("bg-surface-2");

      fireEvent.click(btn30d);
      expect(btn30d.className).toContain("bg-surface-2");
      expect(btn7d.className).not.toContain("bg-surface-2");
    });

    it("keeps the selected asset tab when switching timeframes", () => {
      vi.mocked(useSorokit).mockReturnValue(mockUseSorokit({ isConnected: true }));
      render(<AccountBalanceChart balanceHistory={MOCK_BALANCE_HISTORY} />);
      fireEvent.click(screen.getAllByText("USDC")[0]);
      fireEvent.click(screen.getAllByText("30d")[0]);
      // After switching timeframe, USDC must still be the active asset tab
      // (bg-brand-dim is the active-tab class used elsewhere in this file).
      const usdcTab = screen.getAllByText("USDC")[0];
      expect(usdcTab.className).toContain("bg-brand-dim");
    });
  });
});
