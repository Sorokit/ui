import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";

import { HardwareWalletBadge } from "./HardwareWalletBadge";

describe("HardwareWalletBadge (#1153)", () => {
  it("shows the Ledger label for a Ledger wallet", () => {
    render(<HardwareWalletBadge walletName="Ledger Nano X" />);
    expect(screen.getByTestId("hardware-badge")).toHaveTextContent("Ledger");
  });

  it("shows a localized generic label for other hardware wallets", () => {
    render(
      <I18nProvider initialLocale="es">
        <HardwareWalletBadge walletName="Unknown Hardware" />
      </I18nProvider>,
    );
    expect(screen.getByTestId("hardware-badge")).toHaveTextContent("Hardware");
  });

  it("supports a custom test id for the compact dropdown badge", () => {
    render(
      <HardwareWalletBadge
        walletName="Ledger"
        compact
        testId="hardware-badge-dropdown"
      />,
    );
    expect(screen.getByTestId("hardware-badge-dropdown")).toBeInTheDocument();
  });
});
