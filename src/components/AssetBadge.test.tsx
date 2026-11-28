import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Balance } from "@/lib/client";

import {
  ASSET_COLORS,
  AssetBadge,
  AssetPill,
  getAssetColor,
  isKnownAsset,
} from "./AssetBadge";

const mockWriteText = vi.fn().mockResolvedValue(undefined);
beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: mockWriteText },
    configurable: true,
    writable: true,
  });
});

beforeEach(() => {
  vi.useRealTimers();
  mockWriteText.mockReset().mockResolvedValue(undefined);
});

const nativeBalance: Balance = {
  asset: "XLM",
  assetType: "native",
  assetCode: undefined,
  assetIssuer: undefined,
  balance: "100",
};

const usdcBalance: Balance = {
  asset: "USDC",
  assetType: "credit_alphanum4",
  assetCode: "USDC",
  assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  balance: "50",
};

const unknownBalance: Balance = {
  asset: "WAVEX",
  assetType: "credit_alphanum12",
  assetCode: "WAVEX",
  assetIssuer: "GBBB4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
  balance: "10",
};

const yxlmBalance: Balance = {
  asset: "yXLM",
  assetType: "credit_alphanum4",
  assetCode: "yXLM",
  assetIssuer: "GARDNDAXRNQT623AZHGITHCUASUYATJOGDSEVP6ARVEIQDTBDYT2ENJW",
  balance: "20",
};

const lpSharesBalance: Balance = {
  asset: "LP",
  assetType: "liquidity_pool_shares",
  assetCode: undefined,
  assetIssuer: undefined,
  balance: "25",
};

const longCodeBalance: Balance = {
  asset: "SUPERLONGASSETCODE123",
  assetType: "credit_alphanum12",
  assetCode: "SUPERLONGASSETCODE123",
  assetIssuer: "GBBB4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
  balance: "15",
};

describe("AssetBadge", () => {
  it("renders 'XLM' for native asset type", () => {
    render(<AssetBadge balance={nativeBalance} />);
    expect(screen.getAllByText("XLM").length).toBeGreaterThanOrEqual(1);
  });

  it("renders 'Stellar Lumens' sub-label for native when showIssuer is true", () => {
    render(<AssetBadge balance={nativeBalance} showIssuer />);
    expect(screen.getByText("Stellar Lumens")).toBeInTheDocument();
  });

  it("applies teal color class for XLM", () => {
    const { container } = render(<AssetBadge balance={nativeBalance} />);
    const icon = container.querySelector(".text-teal");
    expect(icon).toBeInTheDocument();
  });

  it("renders the asset code for a known asset (USDC)", () => {
    render(<AssetBadge balance={usdcBalance} />);
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("applies brand color class for USDC", () => {
    const { container } = render(<AssetBadge balance={usdcBalance} />);
    const icon = container.querySelector(".text-brand");
    expect(icon).toBeInTheDocument();
  });

  it("renders the truncated issuer when showIssuer is true", () => {
    render(<AssetBadge balance={usdcBalance} showIssuer />);
    const issuerEl = document.querySelector("[data-address]");
    expect(issuerEl).toBeInTheDocument();
    // Issuer is truncated (not the full key)
    expect(issuerEl?.textContent?.length).toBeLessThan(usdcBalance.assetIssuer!.length);
  });

  it("hides the issuer when showIssuer is false", () => {
    render(<AssetBadge balance={usdcBalance} showIssuer={false} />);
    expect(document.querySelector("[data-address]")).not.toBeInTheDocument();
  });

  it("renders deterministic color for unknown assets (not grey)", () => {
    const { container } = render(<AssetBadge balance={unknownBalance} />);
    const icon = container.querySelector(".bg-surface-2");
    expect(icon).not.toBeInTheDocument();
  });

  it("renders the asset code for an unknown asset", () => {
    render(<AssetBadge balance={unknownBalance} />);
    expect(screen.getByText("WAVEX")).toBeInTheDocument();
  });

  it("renders yXLM with distinct green color", () => {
    const yxlmBalance: Balance = {
      asset: "yXLM",
      assetType: "credit_alphanum12",
      assetCode: "yXLM",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTJGIP5FB4M3US5VM5NGVLYELM",
      balance: "100",
    };
    const { container } = render(<AssetBadge balance={yxlmBalance} />);
    const icon = container.querySelector(".text-green");
    expect(icon).toBeInTheDocument();
  });

  it("renders AQUA with distinct blue color", () => {
    const aquaBalance: Balance = {
      asset: "AQUA",
      assetType: "credit_alphanum12",
      assetCode: "AQUA",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTJGIP5FB4M3US5VM5NGVLYELM",
      balance: "50",
    };
    const { container } = render(<AssetBadge balance={aquaBalance} />);
    const icon = container.querySelector(".text-blue");
    expect(icon).toBeInTheDocument();
  });

  it("renders SHX with distinct pink color", () => {
    const shxBalance: Balance = {
      asset: "SHX",
      assetType: "credit_alphanum12",
      assetCode: "SHX",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTJGIP5FB4M3US5VM5NGVLYELM",
      balance: "25",
    };
    const { container } = render(<AssetBadge balance={shxBalance} />);
    const icon = container.querySelector(".text-pink");
    expect(icon).toBeInTheDocument();
  });

  it("renders BLND with distinct yellow color", () => {
    const blndBalance: Balance = {
      asset: "BLND",
      assetType: "credit_alphanum12",
      assetCode: "BLND",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTJGIP5FB4M3US5VM5NGVLYELM",
      balance: "75",
    };
    const { container } = render(<AssetBadge balance={blndBalance} />);
    const icon = container.querySelector(".text-yellow");
    expect(icon).toBeInTheDocument();
  });

  it("assigns deterministic colors to unknown assets and not grey", () => {
    const customBalance1: Balance = {
      asset: "CUSTOM1",
      assetType: "credit_alphanum12",
      assetCode: "CUSTOM1",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTJGIP5FB4M3US5VM5NGVLYELM",
      balance: "10",
    };
    const customBalance2: Balance = {
      asset: "CUSTOM2",
      assetType: "credit_alphanum12",
      assetCode: "CUSTOM2",
      assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTJGIP5FB4M3US5VM5NGVLYELM",
      balance: "20",
    };
    const { container: c1 } = render(<AssetBadge balance={customBalance1} />);
    const { container: c2 } = render(<AssetBadge balance={customBalance2} />);

    expect(c1.querySelector(".bg-surface-2")).not.toBeInTheDocument();
    expect(c2.querySelector(".bg-surface-2")).not.toBeInTheDocument();
  });

  it("renders 'LP' for liquidity_pool_shares without undefined display", () => {
    const { container } = render(<AssetBadge balance={lpSharesBalance} />);
    expect(screen.getAllByText("LP").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    const icon = container.querySelector(".bg-surface-2.text-ink-2");
    expect(icon).toBeInTheDocument();
    expect(icon?.textContent).toBe("LP");
  });

  it("renders 'Liquidity Pool Shares' sub-label for LP when showIssuer is true", () => {
    render(<AssetBadge balance={lpSharesBalance} showIssuer />);
    expect(screen.getByText("Liquidity Pool Shares")).toBeInTheDocument();
  });

  describe("colorMap", () => {
    it("applies custom colors from colorMap for an unknown asset like yXLM", () => {
      const customMap = {
        yXLM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
      };
      const { container } = render(
        <AssetBadge balance={yxlmBalance} colorMap={customMap} />,
      );
      const icon = container.querySelector(".rounded-full");
      expect(icon).toHaveClass("bg-yellow-500/20");
      expect(icon).toHaveClass("text-yellow-400");
    });

    it("leaves default colors for XLM and USDC unchanged when colorMap is supplied for other tokens", () => {
      const customMap = {
        yXLM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
      };
      const { container: xlmContainer } = render(
        <AssetBadge balance={nativeBalance} colorMap={customMap} />,
      );
      expect(xlmContainer.querySelector(".text-teal")).toBeInTheDocument();

      const { container: usdcContainer } = render(
        <AssetBadge balance={usdcBalance} colorMap={customMap} />,
      );
      expect(usdcContainer.querySelector(".text-brand")).toBeInTheDocument();
    });

    it("allows overriding built-in default colors via colorMap", () => {
      const customMap = {
        XLM: { bg: "bg-purple-500/20", text: "text-purple-400" },
      };
      const { container } = render(
        <AssetBadge balance={nativeBalance} colorMap={customMap} />,
      );
      const icon = container.querySelector(".rounded-full");
      expect(icon).toHaveClass("bg-purple-500/20");
      expect(icon).toHaveClass("text-purple-400");
    });

    it("supports case-insensitive matching for colorMap keys", () => {
      const customMap = {
        wavex: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
      };
      const { container } = render(
        <AssetBadge balance={unknownBalance} colorMap={customMap} />,
      );
      const icon = container.querySelector(".rounded-full");
      expect(icon).toHaveClass("bg-cyan-500/20");
      expect(icon).toHaveClass("text-cyan-400");
    });
  });

  describe("showIssuerForUnknown", () => {
    it("hides the issuer for a known asset (USDC)", () => {
      render(<AssetBadge balance={usdcBalance} showIssuerForUnknown />);
      expect(document.querySelector("[data-address]")).not.toBeInTheDocument();
    });

    it("hides the 'Stellar Lumens' sub-label for native XLM", () => {
      render(<AssetBadge balance={nativeBalance} showIssuerForUnknown />);
      expect(screen.queryByText("Stellar Lumens")).not.toBeInTheDocument();
    });

    it("shows the issuer for an unknown asset", () => {
      render(<AssetBadge balance={unknownBalance} showIssuerForUnknown />);
      expect(document.querySelector("[data-address]")).toBeInTheDocument();
    });

    it("takes precedence over showIssuer", () => {
      render(
        <AssetBadge balance={usdcBalance} showIssuer showIssuerForUnknown />,
      );
      expect(document.querySelector("[data-address]")).not.toBeInTheDocument();
    });
  });

  describe("onClick", () => {
    it("renders a button with asset-selection semantics when onClick is given", () => {
      render(<AssetBadge balance={usdcBalance} onClick={() => {}} />);
      expect(
        screen.getByRole("button", { name: "Select USDC" }),
      ).toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
      const onClick = vi.fn();
      render(<AssetBadge balance={usdcBalance} onClick={onClick} />);
      fireEvent.click(screen.getByRole("button", { name: "Select USDC" }));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("stays a non-interactive div without onClick", () => {
      render(<AssetBadge balance={usdcBalance} />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("merges a custom className onto the interactive wrapper", () => {
      render(
        <AssetBadge balance={usdcBalance} onClick={() => {}} className="my-badge" />,
      );
      expect(screen.getByRole("button")).toHaveClass("my-badge");
    });
  });

  describe("icon character count", () => {
    it("shows full 3 characters for 3-character codes ('XLM') at default size", () => {
      const { container } = render(<AssetBadge balance={nativeBalance} />);
      expect(container.querySelector(".rounded-full")?.textContent).toBe("XLM");
    });

    it("shows 2 characters ('US') for 4-character codes ('USDC') at default size", () => {
      const { container } = render(<AssetBadge balance={usdcBalance} />);
      expect(container.querySelector(".rounded-full")?.textContent).toBe("US");
    });

    it("shows 2 characters ('WA') for 5-character codes at default size", () => {
      const { container } = render(<AssetBadge balance={unknownBalance} />);
      expect(container.querySelector(".rounded-full")?.textContent).toBe("WA");
    });

    it("shows up to 4 characters at size lg", () => {
      const { container } = render(
        <AssetBadge balance={unknownBalance} size="lg" />,
      );
      expect(container.querySelector(".rounded-full")?.textContent).toBe("WAVE");
    });

    it("does not pad short codes at size lg", () => {
      const { container } = render(
        <AssetBadge balance={nativeBalance} size="lg" />,
      );
      expect(container.querySelector(".rounded-full")?.textContent).toBe("XLM");
    });
  });

  describe("showIssuerSuffix", () => {
    it("appends short issuer suffix (first 4 + last 4) when showIssuerSuffix is true", () => {
      render(<AssetBadge balance={usdcBalance} showIssuerSuffix />);
      expect(screen.getByText("(GA5Z...KZVN)")).toBeInTheDocument();
    });

    it("does not render suffix when showIssuerSuffix is false", () => {
      render(<AssetBadge balance={usdcBalance} showIssuerSuffix={false} />);
      expect(screen.queryByText("(GA5Z...KZVN)")).not.toBeInTheDocument();
    });

    it("does not render suffix for native asset even if showIssuerSuffix is true", () => {
      render(<AssetBadge balance={nativeBalance} showIssuerSuffix />);
      expect(screen.queryByText(/\(.*\)/)).not.toBeInTheDocument();
    });
  });

  describe("issuer tooltip on hover and focus (#915)", () => {
    it("displays the truncated issuer address and copy button in a tooltip when hovering a non-native asset", async () => {
      render(<AssetBadge balance={usdcBalance} />);
      const trigger = screen.getByText("USDC").closest("[tabindex]")!;

      fireEvent.pointerMove(trigger, { pointerType: "mouse" });

      await waitFor(() => {
        expect(screen.getAllByTestId("issuer-tooltip-address").length).toBeGreaterThan(0);
      });

      const tooltipAddr = screen.getAllByTestId("issuer-tooltip-address")[0];
      expect(tooltipAddr).toHaveTextContent("GA5ZSE...KZVN");
      expect(tooltipAddr).toHaveAttribute("title", usdcBalance.assetIssuer);

      const copyBtns = screen.getAllByRole("button", {
        name: "Copy issuer address",
      });
      expect(copyBtns.length).toBeGreaterThan(0);
    });

    it("displays the issuer tooltip when a non-native asset badge receives keyboard focus", async () => {
      render(<AssetBadge balance={unknownBalance} />);
      const trigger = screen.getByText("WAVEX").closest("[tabindex]")!;

      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(screen.getAllByTestId("issuer-tooltip-address").length).toBeGreaterThan(0);
      });

      expect(screen.getAllByTestId("issuer-tooltip-address")[0]).toHaveTextContent(
        "GBBB4T...CWNA",
      );
    });

    it("copies the full issuer address to clipboard when clicking the 1-click copy action in the tooltip", async () => {
      render(<AssetBadge balance={usdcBalance} />);
      const trigger = screen.getByText("USDC").closest("[tabindex]")!;

      fireEvent.focus(trigger);

      await waitFor(() => {
        expect(
          screen.getAllByRole("button", { name: "Copy issuer address" }).length,
        ).toBeGreaterThan(0);
      });

      const copyBtn = screen.getAllByRole("button", {
        name: "Copy issuer address",
      })[0];

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(mockWriteText).toHaveBeenCalledWith(usdcBalance.assetIssuer);
      expect(
        screen.getAllByRole("button", { name: "Issuer address copied" }).length,
      ).toBeGreaterThan(0);
    });

    it("does not display an issuer tooltip for native XLM or LP share assets", async () => {
      const { container: xlmContainer } = render(
        <AssetBadge balance={nativeBalance} />,
      );
      expect(xlmContainer.querySelector("[tabindex]")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("issuer-tooltip-address"),
      ).not.toBeInTheDocument();

      const { container: lpContainer } = render(
        <AssetBadge balance={lpSharesBalance} />,
      );
      expect(lpContainer.querySelector("[tabindex]")).not.toBeInTheDocument();
    });
  });

  describe("long asset code truncation (#915)", () => {
    it("truncates long asset codes (> 12 chars) with truncate and max-w-[12ch] classes to prevent layout overflow", () => {
      render(<AssetBadge balance={longCodeBalance} />);
      const codeEl = screen.getByText("SUPERLONGASSETCODE123");
      expect(codeEl).toHaveClass("truncate");
      expect(codeEl).toHaveClass("max-w-[12ch]");
      expect(codeEl).toHaveAttribute("title", "SUPERLONGASSETCODE123");
    });

    it("truncates long asset codes in AssetPill as well", () => {
      render(<AssetPill assetCode="SUPERLONGASSETCODE123" />);
      const pill = screen.getByText("SUPERLONGASSETCODE123");
      expect(pill).toHaveClass("truncate");
      expect(pill).toHaveClass("max-w-[12ch]");
    });
  });

  describe("testnet vs mainnet badge color variants (#915)", () => {
    it("renders default mainnet palette colors when network is mainnet or omitted", () => {
      const { container: mainnetUsdc } = render(
        <AssetBadge balance={usdcBalance} network="mainnet" />,
      );
      const usdcIcon = mainnetUsdc.querySelector(".rounded-full");
      expect(usdcIcon).toHaveClass("bg-[rgba(86,69,212,0.12)]", "text-brand");

      const { container: mainnetXlm } = render(
        <AssetBadge balance={nativeBalance} network="mainnet" />,
      );
      const xlmIcon = mainnetXlm.querySelector(".rounded-full");
      expect(xlmIcon).toHaveClass("bg-[rgba(20,184,166,0.12)]", "text-teal");
    });

    it("applies testnet warning badge styling when network is 'testnet'", () => {
      const { container: testnetUsdc } = render(
        <AssetBadge balance={usdcBalance} network="testnet" />,
      );
      const usdcIcon = testnetUsdc.querySelector(".rounded-full");
      expect(usdcIcon).toHaveClass("bg-warning-dim", "text-warning");

      const { container: testnetCustom } = render(
        <AssetBadge balance={unknownBalance} network="testnet" />,
      );
      const customIcon = testnetCustom.querySelector(".rounded-full");
      expect(customIcon).toHaveClass("bg-warning-dim", "text-warning");
    });

    it("allows custom colorMap overrides on testnet asset badges", () => {
      const testnetColorMap = {
        USDC: { bg: "bg-orange-500/20", text: "text-orange" },
      };
      const { container } = render(
        <AssetBadge
          balance={usdcBalance}
          network="testnet"
          colorMap={testnetColorMap}
        />,
      );
      const icon = container.querySelector(".rounded-full");
      expect(icon).toHaveClass("bg-orange-500/20", "text-orange");
    });

    it("applies testnet vs mainnet styling in AssetPill", () => {
      render(<AssetPill assetCode="USDC" network="mainnet" />);
      expect(screen.getByText("USDC")).toHaveClass("text-brand");

      const { unmount } = render(<AssetPill assetCode="TESTUSDC" network="testnet" />);
      expect(screen.getByText("TESTUSDC")).toHaveClass(
        "bg-warning-dim",
        "text-warning",
      );
      unmount();
    });
  });
});

describe("ASSET_COLORS & getAssetColor", () => {
  it("exports default ASSET_COLORS map with standard tokens", () => {
    expect(ASSET_COLORS).toBeDefined();
    expect(ASSET_COLORS.XLM).toEqual({
      bg: "bg-[rgba(20,184,166,0.12)]",
      text: "text-teal",
    });
    expect(ASSET_COLORS.USDC).toEqual({
      bg: "bg-[rgba(86,69,212,0.12)]",
      text: "text-brand",
    });
    expect(ASSET_COLORS.USDT).toBeDefined();
    expect(ASSET_COLORS.BTC).toBeDefined();
    expect(ASSET_COLORS.ETH).toBeDefined();
  });

  it("getAssetColor merges colorMap with built-in defaults", () => {
    const customMap = {
      AQUA: { bg: "bg-blue-500", text: "text-blue-100" },
    };
    expect(getAssetColor("AQUA", customMap)).toEqual({
      bg: "bg-blue-500",
      text: "text-blue-100",
    });
    expect(getAssetColor("UNKNOWN")).toBeDefined();
    expect(getAssetColor("UNKNOWN").bg).toBeDefined();
    expect(getAssetColor("UNKNOWN").text).toBeDefined();
  });
});

describe("isKnownAsset", () => {
  it("recognises the built-in registry", () => {
    for (const code of ["XLM", "USDC", "USDT", "BTC", "ETH"]) {
      expect(isKnownAsset(code)).toBe(true);
    }
  });

  it("is case-insensitive", () => {
    expect(isKnownAsset("usdc")).toBe(true);
  });

  it("returns false for an unlisted asset", () => {
    expect(isKnownAsset("WAVEX")).toBe(false);
  });
});

describe("AssetPill", () => {
  it("renders the asset code", () => {
    render(<AssetPill assetCode="XLM" />);
    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("applies the teal colour for XLM", () => {
    render(<AssetPill assetCode="XLM" />);
    expect(screen.getByText("XLM")).toHaveClass("text-teal");
  });

  it("applies the brand colour for USDC", () => {
    render(<AssetPill assetCode="USDC" />);
    expect(screen.getByText("USDC")).toHaveClass("text-brand");
  });

  it("uses deterministic color for unknown asset code (not grey)", () => {
    render(<AssetPill assetCode="WAVEX" />);
    const pill = screen.getByText("WAVEX");
    expect(pill).not.toHaveClass("bg-surface-2");
    expect(pill).not.toHaveClass("text-ink-2");
  });

  it("merges a custom className", () => {
    render(<AssetPill assetCode="XLM" className="my-pill" />);
    expect(screen.getByText("XLM")).toHaveClass("my-pill");
  });

  it("applies custom color from colorMap", () => {
    const customMap = {
      yXLM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
    };
    render(<AssetPill assetCode="yXLM" colorMap={customMap} />);
    const pill = screen.getByText("yXLM");
    expect(pill).toHaveClass("bg-yellow-500/20");
    expect(pill).toHaveClass("text-yellow-400");
  });
});
