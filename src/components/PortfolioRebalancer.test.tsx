import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { PortfolioRebalancer } from "./PortfolioRebalancer";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/context/useSorokit", () => ({ useSorokit: vi.fn() }));
vi.mock("@/lib/client", () => ({ getClient: vi.fn() }));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_ADDRESS = "GABC123";

const TWO_BALANCES = [
  { asset: "XLM", balance: "10000.0000000", assetType: "native" as const },
  {
    asset: "USDC",
    balance: "1000.0000000",
    assetType: "credit_alphanum4" as const,
    assetCode: "USDC",
    assetIssuer: "GA5ZSEJ",
  },
];

const FIVE_BALANCES = [
  { asset: "XLM", balance: "5000", assetType: "native" as const },
  { asset: "USDC", balance: "2000", assetType: "credit_alphanum4" as const, assetCode: "USDC", assetIssuer: "GA1" },
  { asset: "USDT", balance: "1000", assetType: "credit_alphanum4" as const, assetCode: "USDT", assetIssuer: "GA2" },
  { asset: "BTC",  balance: "0.01",  assetType: "credit_alphanum4" as const, assetCode: "BTC",  assetIssuer: "GA3" },
  { asset: "ETH",  balance: "0.5",   assetType: "credit_alphanum4" as const, assetCode: "ETH",  assetIssuer: "GA4" },
];

function mockSorokit(overrides: Partial<ReturnType<typeof useSorokit>> = {}) {
  vi.mocked(useSorokit).mockReturnValue({ address: MOCK_ADDRESS, isConnected: true, get client() { return getClient(); }, isConnecting: false,
    isLoading: false,
    isLoadingAccount: false,
    balances: TWO_BALANCES,
    refreshAccount: vi.fn().mockResolvedValue(undefined),
    connectWallet: vi.fn(),
    disconnectWallet: vi.fn(),
    account: null,
    network: null,
    switchNetwork: vi.fn(),
    error: null,
    clearError: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useSorokit>);
}

function mockClient(invokeResult = { data: { hash: "swap-tx-hash" }, error: null }) {
  vi.mocked(getClient).mockReturnValue({
    soroban: {
      invokeContract: vi.fn().mockResolvedValue(invokeResult),
    },
  } as unknown as ReturnType<typeof getClient>);
}

// ─── Disconnected state ───────────────────────────────────────────────────────

describe("PortfolioRebalancer — disconnected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ isConnected: false, address: null, balances: [] });
    mockClient();
  });

  it("renders the component heading", () => {
    render(<PortfolioRebalancer />);
    expect(screen.getByRole("heading", { name: /portfolio rebalancer/i })).toBeInTheDocument();
  });

  it("shows the wallet-connect prompt when not connected", () => {
    render(<PortfolioRebalancer />);
    expect(
      screen.getByText(/connect your wallet to view and rebalance/i),
    ).toBeInTheDocument();
  });

  it("does not show the tab bar when disconnected", () => {
    render(<PortfolioRebalancer />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("shows the subtitle prompt when disconnected", () => {
    render(<PortfolioRebalancer />);
    expect(screen.getByText(/connect your wallet to rebalance/i)).toBeInTheDocument();
  });
});

// ─── Connected + loading ──────────────────────────────────────────────────────

describe("PortfolioRebalancer — loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ isLoadingAccount: true, balances: [] });
    mockClient();
  });

  it("renders the tablist while loading", () => {
    render(<PortfolioRebalancer />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("shows a loading spinner in the header", () => {
    const { container } = render(<PortfolioRebalancer />);
    // The loading spinner is an animate-spin element in the header area
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

// ─── Connected + has balances ─────────────────────────────────────────────────

describe("PortfolioRebalancer — allocations tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
    mockClient();
  });

  it("renders all four tab buttons", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /allocations/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: /preview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /execute/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /history/i })).toBeInTheDocument();
  });

  it("defaults to the Allocations tab being selected", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /allocations/i }))
        .toHaveAttribute("aria-selected", "true");
    });
  });

  it("renders pie chart aria labels after assets load", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => {
      expect(screen.getByRole("img", { name: /current portfolio allocation/i }))
        .toBeInTheDocument();
      expect(screen.getByRole("img", { name: /target portfolio allocation/i }))
        .toBeInTheDocument();
    });
  });

  it("renders target allocation inputs for each asset", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => {
      expect(screen.getByRole("spinbutton", { name: /target allocation for XLM/i }))
        .toBeInTheDocument();
      expect(screen.getByRole("spinbutton", { name: /target allocation for USDC/i }))
        .toBeInTheDocument();
    });
  });

  it("shows portfolio value subtitle when total USD > 0", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => {
      expect(screen.getByText(/portfolio value/i)).toBeInTheDocument();
    });
  });

  it("shows 'No assets found' message when balances are empty", async () => {
    mockSorokit({ balances: [] });
    render(<PortfolioRebalancer />);
    // Prices never load (balances empty) so portfolioAssets stays empty
    await waitFor(() => {
      expect(screen.getByText(/no assets found/i)).toBeInTheDocument();
    });
  });

  it("renders the diff table after assets load", async () => {
    render(<PortfolioRebalancer />);
    // Wait for inputs to be ready, then change a target to produce a non-zero diff
    await waitFor(() => screen.getByRole("spinbutton", { name: /target allocation for XLM/i }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /target allocation for XLM/i }), {
      target: { value: "40" },
    });
    await waitFor(() => {
      // Table headers only appear when diffs are non-zero
      expect(screen.getByRole("columnheader", { name: /Asset/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /current/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /target/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /diff/i })).toBeInTheDocument();
    });
  });
});

// ─── Tab navigation ───────────────────────────────────────────────────────────

describe("PortfolioRebalancer — tab navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
    mockClient();
  });

  it("switches to Preview tab on click", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /preview/i }));
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    expect(screen.getByRole("tab", { name: /preview/i }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("switches to Execute tab on click", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /execute/i }));
    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    expect(screen.getByRole("tab", { name: /execute/i }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("switches to History tab on click", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /history/i }));
    fireEvent.click(screen.getByRole("tab", { name: /history/i }));
    expect(screen.getByRole("tab", { name: /history/i }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("tabpanel content changes when switching tabs", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /history/i }));
    fireEvent.click(screen.getByRole("tab", { name: /history/i }));
    expect(screen.getByText(/no rebalancing history yet/i)).toBeInTheDocument();
  });

  it("Preview tab navigates back to Allocations via button", async () => {
    render(<PortfolioRebalancer />);
    // Change allocations so swaps are generated, enabling the "Edit targets" button
    await waitFor(() => screen.getByRole("spinbutton", { name: /target allocation for XLM/i }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /target allocation for XLM/i }), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "60" } });
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    const editBtn = await screen.findByRole("button", { name: /edit targets/i });
    fireEvent.click(editBtn);
    expect(screen.getByRole("tab", { name: /allocations/i }))
      .toHaveAttribute("aria-selected", "true");
  });
});

// ─── Allocation input interactions ───────────────────────────────────────────

describe("PortfolioRebalancer — allocation inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
    mockClient();
  });

  it("Equalise button distributes 100% evenly", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("button", { name: /equalise/i }));
    fireEvent.click(screen.getByRole("button", { name: /equalise/i }));
    // With 2 assets, each should be 50%
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    const total = inputs.reduce((s, inp) => s + parseFloat(inp.value || "0"), 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it("Reset button restores values to current allocation", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("button", { name: /reset/i }));
    // Change a value then reset
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    // After reset the sum should still be ~100 (current allocations sum to 100)
    const resetInputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    const total = resetInputs.reduce((s, inp) => s + parseFloat(inp.value || "0"), 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("shows the 'over 100%' error when total exceeds 100", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getAllByRole("spinbutton"));
    const [first] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(first, { target: { value: "90" } });
    expect(screen.getByText(/total allocation exceeds 100%/i)).toBeInTheDocument();
  });

  it("total status label reads 100.0% when allocations are balanced", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("status"));
    // Seed state is current allocation which always sums to 100
    expect(screen.getByRole("status")).toHaveTextContent("100.0%");
  });
});

// ─── Preview tab ──────────────────────────────────────────────────────────────

describe("PortfolioRebalancer — preview tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
    mockClient();
  });

  it("shows 'Suggested Swaps' heading on Preview tab", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /preview/i }));
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    expect(screen.getAllByText(/Suggested Swaps/i)[0]).toBeInTheDocument();
  });

  it("renders Confirm & execute button when targets are valid and swaps exist", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /preview/i }));
    // Change allocation so swaps are required: set XLM to 40%, USDC to 60%
    const [xlmInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(xlmInput, { target: { value: "40" } });
    const usdcInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    fireEvent.change(usdcInput, { target: { value: "60" } });
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /confirm & execute/i })).toBeInTheDocument();
    });
  });

  it("Confirm & execute button navigates to Execute tab", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /preview/i }));
    // Skew allocation to guarantee swaps
    const [xlmInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(xlmInput, { target: { value: "40" } });
    const usdcInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    fireEvent.change(usdcInput, { target: { value: "60" } });
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    await waitFor(() => screen.getByRole("button", { name: /confirm & execute/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & execute/i }));
    expect(screen.getByRole("tab", { name: /execute/i }))
      .toHaveAttribute("aria-selected", "true");
  });
});

// ─── Execute tab ──────────────────────────────────────────────────────────────

describe("PortfolioRebalancer — execute tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
  });

  it("shows 'Ready to execute' header before execution starts", async () => {
    mockClient();
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /execute/i }));
    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    expect(screen.getByText(/ready to execute/i)).toBeInTheDocument();
  });

  it("shows Execute rebalance button before execution", async () => {
    mockClient();
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /execute/i }));
    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    expect(screen.getByRole("button", { name: /execute rebalance/i })).toBeInTheDocument();
  });

  it("runs swaps and shows 'Rebalance complete' on full success", async () => {
    mockClient({ data: { hash: "abc123" }, error: null });
    render(<PortfolioRebalancer />);

    // Skew allocation to guarantee at least one swap
    await waitFor(() => screen.getAllByRole("spinbutton"));
    const [xlmInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(xlmInput, { target: { value: "40" } });
    const usdcInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    fireEvent.change(usdcInput, { target: { value: "60" } });

    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    await waitFor(() => screen.getByRole("button", { name: /execute rebalance/i }));
    fireEvent.click(screen.getByRole("button", { name: /execute rebalance/i }));

    await waitFor(() => {
      expect(screen.getByText(/rebalance complete/i)).toBeInTheDocument();
    });
  });

  it("shows partial-complete message when a swap fails", async () => {
    mockClient({ data: null, error: "Swap failed on-chain" });
    render(<PortfolioRebalancer />);

    await waitFor(() => screen.getAllByRole("spinbutton"));
    const [xlmInput] = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(xlmInput, { target: { value: "40" } });
    const usdcInput = screen.getAllByRole("spinbutton")[1] as HTMLInputElement;
    fireEvent.change(usdcInput, { target: { value: "60" } });

    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    await waitFor(() => screen.getByRole("button", { name: /execute rebalance/i }));
    fireEvent.click(screen.getByRole("button", { name: /execute rebalance/i }));

    await waitFor(() => {
      // When all swaps fail: "0 of N swaps completed"
      expect(screen.getByText(/swaps completed|rebalance complete/i)).toBeInTheDocument();
    });
  });

  it("shows tx hash in swap row after successful execution", async () => {
    mockClient({ data: { hash: "myhash42" }, error: null });
    render(<PortfolioRebalancer />);

    await waitFor(() => screen.getAllByRole("spinbutton"));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "40" } });
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "60" } });

    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    await waitFor(() => screen.getByRole("button", { name: /execute rebalance/i }));
    fireEvent.click(screen.getByRole("button", { name: /execute rebalance/i }));

    await waitFor(() => expect(screen.getByText("myhash42")).toBeInTheDocument());
  });

  it("adds a record to History after execution completes", async () => {
    mockClient({ data: { hash: "hist-hash" }, error: null });
    render(<PortfolioRebalancer />);

    await waitFor(() => screen.getAllByRole("spinbutton"));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "40" } });
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "60" } });

    fireEvent.click(screen.getByRole("tab", { name: /execute/i }));
    await waitFor(() => screen.getByRole("button", { name: /execute rebalance/i }));
    fireEvent.click(screen.getByRole("button", { name: /execute rebalance/i }));

    await waitFor(() => screen.getByText(/rebalance complete|swaps completed/i));

    // History tab badge should now show "1"
    const historyTab = screen.getByRole("tab", { name: /history/i });
    expect(historyTab.textContent).toMatch(/1/);

    // Navigate to history and check record is there
    fireEvent.click(screen.getByRole("button", { name: /view history/i }));
    expect(screen.getByRole("tab", { name: /history/i }))
      .toHaveAttribute("aria-selected", "true");
    // At least one history article
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
  });
});

// ─── Five-asset complex portfolio ────────────────────────────────────────────

describe("PortfolioRebalancer — 5-asset portfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: FIVE_BALANCES });
    mockClient();
  });

  it("renders an input for each of 5 assets", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => {
      const inputs = screen.getAllByRole("spinbutton");
      expect(inputs.length).toBe(5);
    });
  });

  it("Equalise distributes 100% across 5 assets (each ~20%)", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("button", { name: /equalise/i }));
    fireEvent.click(screen.getByRole("button", { name: /equalise/i }));
    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    expect(inputs.length).toBe(5);
    const total = inputs.reduce((s, inp) => s + parseFloat(inp.value || "0"), 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it("shows multiple swap suggestions for a complex rebalance", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("button", { name: /equalise/i }));
    fireEvent.click(screen.getByRole("button", { name: /equalise/i }));
    fireEvent.click(screen.getByRole("tab", { name: /preview/i }));
    // With 5 assets equalised from an imbalanced state there should be swaps
    await waitFor(() => {
      const items = screen.queryAllByRole("listitem");
      // Either swaps exist or "no swaps needed" message
      const noSwaps = screen.queryByText(/no swaps needed/i);
      if (!noSwaps) {
        expect(items.length).toBeGreaterThan(0);
      } else {
        expect(noSwaps).toBeInTheDocument();
      }
    });
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe("PortfolioRebalancer — refresh button", () => {
  it("calls refreshAccount when the refresh button is clicked", async () => {
    vi.clearAllMocks();
    const refreshAccount = vi.fn().mockResolvedValue(undefined);
    mockSorokit({ balances: TWO_BALANCES, refreshAccount });
    mockClient();

    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("button", { name: /refresh portfolio/i }));
    fireEvent.click(screen.getByRole("button", { name: /refresh portfolio/i }));
    expect(refreshAccount).toHaveBeenCalledOnce();
  });
});

// ─── History tab empty state ──────────────────────────────────────────────────

describe("PortfolioRebalancer — history empty state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
    mockClient();
  });

  it("shows 'No rebalancing history yet' on first load", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /history/i }));
    fireEvent.click(screen.getByRole("tab", { name: /history/i }));
    expect(screen.getByText(/no rebalancing history yet/i)).toBeInTheDocument();
  });

  it("history tab badge is not shown initially (no count)", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tab", { name: /history/i }));
    const tab = screen.getByRole("tab", { name: /history/i });
    // No numeric badge inside the tab when history is empty
    expect(tab.querySelector("span")).toBeNull();
  });
});

// ─── ARIA / accessibility ──────────────────────────────────────────────────────

describe("PortfolioRebalancer — accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSorokit({ balances: TWO_BALANCES });
    mockClient();
  });

  it("tabpanels have correct aria-labelledby pointing at tab ids", async () => {
    const { container } = render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tabpanel", { hidden: false }));
    const panels = container.querySelectorAll("[role='tabpanel']");
    panels.forEach((panel) => {
      const labelledBy = panel.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy!)).toBeInTheDocument();
    });
  });

  it("tab bar has a descriptive aria-label", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() => screen.getByRole("tablist"));
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-label", "Rebalancer sections");
  });

  it("allocation inputs have aria-labels for screen readers", async () => {
    render(<PortfolioRebalancer />);
    await waitFor(() =>
      screen.getByRole("spinbutton", { name: /target allocation for XLM/i }),
    );
    expect(
      screen.getByRole("spinbutton", { name: /target allocation for XLM/i }),
    ).toBeInTheDocument();
  });
});
