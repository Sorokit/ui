import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LabelledValue } from "./LabelledValue";

describe("LabelledValue", () => {
  let writeTextSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
        writable: true,
      });
    }
  });

  beforeEach(() => {
    writeTextSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders label and value correctly", () => {
    render(<LabelledValue label="Transaction Hash" value="0x123abc" />);

    expect(screen.getByText("Transaction Hash")).toBeInTheDocument();
    expect(screen.getByText("0x123abc")).toBeInTheDocument();
  });

  it("applies monospace styling when mono is true", () => {
    render(<LabelledValue label="Hash" value="0x123abc" mono />);

    const valueEl = screen.getByText("0x123abc");
    expect(valueEl.className).toContain("font-mono");
  });

  it("applies custom className to root element", () => {
    const { container } = render(
      <LabelledValue label="Key" value="Val" className="custom-class" />,
    );

    expect(container.firstElementChild).toHaveClass("custom-class");
  });

  it("renders custom children instead of value when children prop is provided", () => {
    render(
      <LabelledValue label="Custom Section">
        <span data-testid="custom-child">Child Element</span>
      </LabelledValue>,
    );

    expect(screen.getByText("Custom Section")).toBeInTheDocument();
    expect(screen.getByTestId("custom-child")).toBeInTheDocument();
  });

  describe("labelId and aria-labelledby linkage", () => {
    it("sets id attribute on label element when labelId is provided", () => {
      render(
        <LabelledValue
          label="Account Balance"
          value="100.50 XLM"
          labelId="balance-label-id"
        />,
      );

      const labelEl = screen.getByText("Account Balance");
      expect(labelEl).toHaveAttribute("id", "balance-label-id");
    });

    it("does not set id attribute on label element when labelId is omitted", () => {
      render(<LabelledValue label="Account Balance" value="100.50 XLM" />);

      const labelEl = screen.getByText("Account Balance");
      expect(labelEl).not.toHaveAttribute("id");
    });

    it("allows external consumer to link aria-labelledby to labelId", () => {
      render(
        <div>
          <LabelledValue label="Search Query" labelId="search-input-label">
            <input aria-labelledby="search-input-label" placeholder="Search..." />
          </LabelledValue>
        </div>,
      );

      const input = screen.getByRole("textbox", { name: "Search Query" });
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-labelledby", "search-input-label");
    });
  });

  describe("copyable interaction", () => {
    it("does not render copy button when copyable is false or omitted", () => {
      render(<LabelledValue label="Sequence" value="12345" />);

      expect(
        screen.queryByRole("button", { name: /copy/i }),
      ).not.toBeInTheDocument();
    });

    it("renders copy button when copyable is true", () => {
      render(<LabelledValue label="Sequence" value="12345" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Sequence" });
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn).toHaveAttribute("title", "Copy Sequence");
    });

    it("does not render copy button when children are provided, even if copyable is true", () => {
      render(
        <LabelledValue label="Custom Action" copyable>
          <span>Child Content</span>
        </LabelledValue>,
      );

      expect(
        screen.queryByRole("button", { name: /copy/i }),
      ).not.toBeInTheDocument();
    });

    it("writes value to clipboard and switches button to copied state on click", async () => {
      render(<LabelledValue label="Secret" value="secret-val" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Secret" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledWith("secret-val");

      const copiedBtn = screen.getByRole("button", { name: "Secret copied" });
      expect(copiedBtn).toBeInTheDocument();
      expect(copiedBtn).toHaveAttribute("title", "Copied!");
    });

    it("resets copied state after 2 seconds", async () => {
      vi.useFakeTimers();
      render(<LabelledValue label="Secret" value="secret-val" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Secret" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(
        screen.getByRole("button", { name: "Secret copied" }),
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(
        screen.getByRole("button", { name: "Copy Secret" }),
      ).toBeInTheDocument();
    });

    it("handles empty or undefined value gracefully when copying", async () => {
      render(<LabelledValue label="Empty Value" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Empty Value" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith("");
      expect(
        screen.getByRole("button", { name: "Empty Value copied" }),
      ).toBeInTheDocument();
    });

    it("handles clipboard rejection gracefully without throwing", async () => {
      writeTextSpy.mockRejectedValueOnce(new Error("Denied"));

      render(<LabelledValue label="Secret" value="secret-val" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Secret" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith("secret-val");
      expect(
        screen.getByRole("button", { name: "Copy Secret" }),
      ).toBeInTheDocument();
    });
  });
});
