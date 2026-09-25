import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LabelledValue } from "./LabelledValue";

describe("LabelledValue", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label and value", () => {
    render(<LabelledValue label="Balance" value="1,250.50 XLM" />);

    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("1,250.50 XLM")).toBeInTheDocument();
  });

  it("applies labelId to the label element", () => {
    render(
      <LabelledValue
        label="Account ID"
        value="GABC...1234"
        labelId="account-id-label"
      />,
    );

    const labelElement = screen.getByText("Account ID");
    expect(labelElement).toHaveAttribute("id", "account-id-label");
  });

  it("renders custom children instead of value when children are provided", () => {
    render(
      <LabelledValue label="Status">
        <span data-testid="custom-child">Active Validator</span>
      </LabelledValue>,
    );

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByTestId("custom-child")).toHaveTextContent("Active Validator");
  });

  it("applies monospace styling when mono is true", () => {
    render(<LabelledValue label="Contract ID" value="CA123456789" mono />);

    const valueSpan = screen.getByText("CA123456789");
    expect(valueSpan).toHaveClass("font-mono", "text-[12px]");
  });

  it("forwards custom className to the root container", () => {
    const { container } = render(
      <LabelledValue
        label="Fee"
        value="100 stroops"
        className="custom-labelled-value"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-labelled-value");
  });

  describe("copy functionality", () => {
    it("does not render copy button when copyable is omitted or false", () => {
      render(<LabelledValue label="Memo" value="Invoice #42" />);

      expect(
        screen.queryByRole("button", { name: /copy/i }),
      ).not.toBeInTheDocument();
    });

    it("renders copy button and copies value to clipboard on click", async () => {
      vi.useFakeTimers();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      render(
        <LabelledValue
          label="Secret Key"
          value="SABC123456789"
          copyable
        />,
      );

      const copyBtn = screen.getByRole("button", { name: "Copy Secret Key" });
      expect(copyBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith("SABC123456789");

      // Verify copied feedback state
      expect(
        screen.getByRole("button", { name: "Secret Key copied" }),
      ).toBeInTheDocument();
      expect(screen.getByTitle("Copied!")).toBeInTheDocument();

      // Advance timer by 2000ms to verify reset
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(
        screen.getByRole("button", { name: "Copy Secret Key" }),
      ).toBeInTheDocument();
      expect(screen.getByTitle("Copy Secret Key")).toBeInTheDocument();
    });

    it("copies empty string when value is undefined", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      render(<LabelledValue label="Optional Field" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Optional Field" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith("");
    });

    it("handles clipboard failure gracefully without throwing", async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error("Clipboard error"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      render(<LabelledValue label="Address" value="GBRP..." copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Address" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith("GBRP...");
      expect(screen.getByRole("button", { name: "Copy Address" })).toBeInTheDocument();
    });
  });
});
