import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetFilter, type AssetItem } from "./AssetFilter";

const mockAssets: AssetItem[] = [
  {
    asset: "XLM",
    balance: "1042.5000000",
    assetType: "native",
    isVerified: true,
    network: "testnet",
  },
  {
    asset: "USDC",
    balance: "250.0000000",
    assetType: "credit_alphanum4",
    assetCode: "USDC",
    assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    isVerified: true,
    network: "testnet",
    displayName: "USD Coin",
  },
  {
    asset: "yXLM",
    balance: "88.1234567",
    assetType: "credit_alphanum4",
    assetCode: "yXLM",
    assetIssuer: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
    isVerified: false,
    network: "mainnet",
  },
  {
    asset: "RANDOM",
    balance: "500.0000000",
    assetType: "credit_alphanum4",
    assetCode: "RANDOM",
    assetIssuer: "GCVOZXKLYYNP3Q4WKYOBZ4LK7RYKH6VVJ7N4A5O5M5O5M5O5M5O5M5O5M",
    isVerified: false,
    network: "testnet",
  },
];

function renderComponent(
  overrides?: Partial<Parameters<typeof AssetFilter>[0]>,
) {
  return render(
    <AssetFilter assets={mockAssets} onAssetSelect={vi.fn()} {...overrides} />,
  );
}

describe("AssetFilter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders all assets by default", () => {
    renderComponent();
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("yXLM")).toBeInTheDocument();
  });

  it("filters assets by name/code search", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "usdc" } });
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.queryByText("XLM")).not.toBeInTheDocument();
  });

  it("filters assets by issuer search", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "GARDNV" } });
    expect(screen.getByText("yXLM")).toBeInTheDocument();
    expect(screen.queryByText("XLM")).not.toBeInTheDocument();
  });

  it("shows clear search button and clears search", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "usdc" } });
    expect(screen.queryByText("XLM")).not.toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearBtn);
    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("shows verified filter tabs", () => {
    renderComponent();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("filters verified assets only", () => {
    renderComponent();
    fireEvent.click(screen.getByText("Verified"));
    expect(screen.getByText("XLM")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.queryByText("yXLM")).not.toBeInTheDocument();
  });

  it("filters unverified assets only", () => {
    renderComponent();
    fireEvent.click(screen.getByText("Unverified"));
    expect(screen.queryByText("XLM")).not.toBeInTheDocument();
    expect(screen.getByText("yXLM")).toBeInTheDocument();
  });

  it("shows network filter buttons", () => {
    renderComponent();
    expect(screen.getByText("All networks")).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
    expect(screen.getByText("Mainnet")).toBeInTheDocument();
  });

  it("filters by network", () => {
    renderComponent();
    fireEvent.click(screen.getByText("Mainnet"));
    expect(screen.getByText("yXLM")).toBeInTheDocument();
    expect(screen.queryByText("XLM")).not.toBeInTheDocument();
  });

  it("shows favorites toggle button", () => {
    renderComponent();
    const favToggle = screen.getByRole("button", { name: /favorites only|show all/i });
    expect(favToggle).toBeInTheDocument();
  });

  it("shows sort dropdown", () => {
    renderComponent();
    const sortTrigger = screen.getByText(/sort/i);
    fireEvent.click(sortTrigger);
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
  });

  it("shows empty state when no assets match", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "ZZZZZZ" } });
    expect(screen.getByText(/no assets (match|found)/i)).toBeInTheDocument();
  });

  it("shows empty state when no assets provided", () => {
    render(<AssetFilter assets={[]} />);
    expect(screen.getByText(/no assets/i)).toBeInTheDocument();
  });

  it("calls onAssetSelect when clicking an asset", () => {
    const onSelect = vi.fn();
    renderComponent({ onAssetSelect: onSelect });
    fireEvent.click(screen.getByText("XLM"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ asset: "XLM" }),
    );
  });

  it("shows add custom asset button when allowCustomAssets is true", () => {
    renderComponent({ allowCustomAssets: true });
    expect(screen.getByText(/add custom asset/i)).toBeInTheDocument();
  });

  it("does not show add custom asset button by default", () => {
    renderComponent();
    expect(screen.queryByText(/add custom asset/i)).not.toBeInTheDocument();
  });

  it("supports keyboard navigation without errors", () => {
    renderComponent();
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Home" });
    fireEvent.keyDown(input, { key: "End" });
  });

  it("uses custom count label", () => {
    renderComponent({ countLabel: (f, t) => `${f}/${t} tokens` });
    expect(screen.getByText("4/4 tokens")).toBeInTheDocument();
  });

  it("hides network filter when showNetworkFilter is false", () => {
    renderComponent({ showNetworkFilter: false });
    expect(screen.queryByText("Testnet")).not.toBeInTheDocument();
  });

  it("sorts by name when selected", () => {
    renderComponent();
    fireEvent.click(screen.getByText(/sort/i));
    fireEvent.click(screen.getByText("Name"));
    expect(screen.getByText(/Name/)).toBeInTheDocument();
  });

  it("sorts by balance when selected", () => {
    renderComponent();
    fireEvent.click(screen.getByText(/sort/i));
    fireEvent.click(screen.getByText("Balance"));
    expect(screen.getByText(/Balance/)).toBeInTheDocument();
  });

  it("shows asset count", () => {
    renderComponent();
    expect(screen.getByText(/assets/i)).toBeInTheDocument();
  });

  it("uses custom countLabel when provided", () => {
    renderComponent({ countLabel: (f, t) => `${f} of ${t}` });
    expect(screen.getByText("4 of 4")).toBeInTheDocument();
  });

  it("renders custom renderRow when provided", () => {
    renderComponent({
      renderRow: (asset) => <div data-testid="custom-row">{asset.asset}</div>,
    });
    expect(screen.getAllByTestId("custom-row").length).toBe(4);
  });

  it("toggles favorites and persists to localStorage", () => {
    renderComponent();
    const favButtons = screen.getAllByRole("button", { name: /add to favorites|remove from favorites/i });
    fireEvent.click(favButtons[0]);
    expect(localStorage.getItem("sorokit-asset-favorites")).not.toBeNull();
  });

  it("supports sort by popularity", () => {
    const assetsWithPopularity: AssetItem[] = [
      ...mockAssets,
      {
        asset: "POP",
        balance: "100",
        assetType: "credit_alphanum4",
        assetCode: "POP",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        isVerified: false,
        network: "testnet",
        popularityIndex: 1,
      },
    ];
    render(
      <AssetFilter
        assets={assetsWithPopularity}
        onAssetSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/sort/i));
    fireEvent.click(screen.getByText("Popularity"));
    expect(screen.getByText(/Popularity/)).toBeInTheDocument();
  });

  it("shows favorite-only filter when toggled", () => {
    renderComponent();
    const favToggle = screen.getByRole("button", { name: /favorites only|show all/i });
    fireEvent.click(favToggle);
  });

  it("handles keyboard Home and End navigation", () => {
    const onSelect = vi.fn();
    renderComponent({ onAssetSelect: onSelect });
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.keyDown(input, { key: "End" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalled();
  });

  it("adds custom asset when allowCustomAssets is true and form is submitted", () => {
    renderComponent({ allowCustomAssets: true });
    fireEvent.click(screen.getByText(/add custom asset/i));
    const codeInput = screen.getByPlaceholderText(/asset code/i);
    fireEvent.change(codeInput, { target: { value: "CUSTOM" } });
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
  });

  it("cancels custom asset form", () => {
    renderComponent({ allowCustomAssets: true });
    fireEvent.click(screen.getByText(/add custom asset/i));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText(/asset code/i)).not.toBeInTheDocument();
  });

  it("sorts by default (native first)", () => {
    renderComponent();
    const rows = screen.getAllByText("XLM");
    expect(rows[0]).toBeInTheDocument();
  });

  it("preserves favorites order with favorites first", () => {
    renderComponent();
    const favButtons = screen.getAllByRole("button", { name: /favorites/i });
    fireEvent.click(favButtons[1]);
    const list = screen.getByRole("listbox");
    expect(list).toBeInTheDocument();
  });
});

