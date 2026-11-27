import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./I18nProvider";
import { LOCALE_STORAGE_KEY } from "./translations";

function LocaleProbe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="title">{t("connect.title")}</span>
      <button type="button" onClick={() => setLocale("es")}>
        to-es
      </button>
      <button type="button" onClick={() => setLocale("zh")}>
        to-zh
      </button>
      <button type="button" onClick={() => setLocale("ja")}>
        to-ja
      </button>
    </div>
  );
}

describe("I18nProvider (#1157)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
  });

  it("defaults to English and uses the English catalogue", () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(screen.getByTestId("title")).toHaveTextContent("Connect Wallet");
  });

  it("translates strings for Spanish, Chinese, and Japanese", () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText("to-es"));
    expect(screen.getByTestId("title")).toHaveTextContent("Conectar billetera");
    fireEvent.click(screen.getByText("to-zh"));
    expect(screen.getByTestId("title")).toHaveTextContent("连接钱包");
    fireEvent.click(screen.getByText("to-ja"));
    expect(screen.getByTestId("title")).toHaveTextContent("ウォレットを接続");
  });

  it("persists the selection to localStorage and updates the document language", () => {
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText("to-ja"));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
  });

  it("restores a previously persisted locale on mount", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "es");
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("es");
    expect(screen.getByTestId("title")).toHaveTextContent("Conectar billetera");
  });

  it("falls back to English for an invalid stored locale", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "klingon");
    render(
      <I18nProvider>
        <LocaleProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("falls back to English when no provider is mounted", () => {
    render(<LocaleProbe />);
    expect(screen.getByTestId("title")).toHaveTextContent("Connect Wallet");
  });
});
