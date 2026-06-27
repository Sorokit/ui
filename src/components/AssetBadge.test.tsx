import { render, screen } from "@testing-library/react";
import { describe, expect,it } from "vitest";

import type { Balance } from "@/lib/client";

import { AssetBadge, AssetPill } from "./AssetBadge";

const nativeBalance: Balance = {
  assetType: "native",
  assetCode: null,
  assetIssuer: null,
  balance: "100",
  balanceFloat: 100,
};

const usdcBalance: Balance = {
  assetType: "credit_alphanum4",
  assetCode: "USDC",
  assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  balance: "50",
  balanceFloat: 50,
};

const unknownBalance: Balance = {
  assetType: "credit_alphanum12",
  assetCode: "WAVEX",
  assetIssuer: "GBBB4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
  balance: "10",
  balanceFloat: 10,
};

describe("AssetBadge", () => {
  it("renders 'XLM' for native asset type", () => {
    render(<AssetBadge balance={nativeBalance} />);
    expect(screen.getByText("XLM")).toBeInTheDocument();
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

  it("falls back to grey/surface-2 for an unknown asset", () => {
    const { container } = render(<AssetBadge balance={unknownBalance} />);
    const icon = container.querySelector(".bg-surface-2");
    expect(icon).toBeInTheDocument();
  });

  it("renders the asset code for an unknown asset", () => {
    render(<AssetBadge balance={unknownBalance} />);
    expect(screen.getByText("WAVEX")).toBeInTheDocument();
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

  it("falls back to grey for an unknown asset code", () => {
    render(<AssetPill assetCode="WAVEX" />);
    const pill = screen.getByText("WAVEX");
    expect(pill).toHaveClass("bg-surface-2");
    expect(pill).toHaveClass("text-ink-2");
  });

  it("merges a custom className", () => {
    render(<AssetPill assetCode="XLM" className="my-pill" />);
    expect(screen.getByText("XLM")).toHaveClass("my-pill");
  });
});
