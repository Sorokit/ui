import { fireEvent,render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { afterEach,describe, expect,it, vi } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("renders the input element", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("renders a label and associates it with the input using htmlFor and id", () => {
    render(<Input label="Username" />);
    const label = screen.getByText("Username");
    const input = screen.getByRole("textbox");
    
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe("LABEL");
    expect(input).toBeInTheDocument();
    
    const id = input.getAttribute("id");
    expect(id).toBe("username");
    expect(label.getAttribute("for")).toBe("username");
  });

  it("uses an auto-generated id if label is present but id is not specified", () => {
    // If we have a label with spaces, it formats it
    render(<Input label="My Custom Field" />);
    const label = screen.getByText("My Custom Field");
    const input = screen.getByRole("textbox");
    
    expect(input.getAttribute("id")).toBe("my-custom-field");
    expect(label.getAttribute("for")).toBe("my-custom-field");
  });

  it("uses the provided id if id prop is supplied", () => {
    render(<Input label="Email Address" id="custom-email-id" />);
    const label = screen.getByText("Email Address");
    const input = screen.getByRole("textbox");
    
    expect(input.getAttribute("id")).toBe("custom-email-id");
    expect(label.getAttribute("for")).toBe("custom-email-id");
  });

  it("renders error message and applies opacity-100 to the error block", () => {
    render(<Input placeholder="Test Input" error="This field is required" />);
    const errorText = screen.getByText("This field is required");
    
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("text-red");
    expect(errorText.className).toContain("opacity-100");
  });

  it("renders hint message when error is not present", () => {
    render(<Input placeholder="Test Input" hint="Must be 8 characters long" />);
    const hintText = screen.getByText("Must be 8 characters long");
    
    expect(hintText).toBeInTheDocument();
    expect(hintText.className).toContain("text-ink-3");
    expect(hintText.className).toContain("opacity-100");
  });

  it("hides the hint message and shows the error message when error is present", () => {
    render(<Input placeholder="Test Input" hint="Must be 8 characters long" error="Invalid format" />);
    const errorText = screen.getByText("Invalid format");
    const hintText = screen.getByText("Must be 8 characters long");
    
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("opacity-100");
    expect(hintText.className).toContain("opacity-0");
  });

  it("applies disabled attributes and classes when disabled is true", () => {
    render(<Input placeholder="Test Input" disabled />);
    const input = screen.getByPlaceholderText("Test Input");
    
    expect(input).toBeDisabled();
    expect(input.className).toContain("disabled:opacity-40");
    expect(input.className).toContain("disabled:cursor-not-allowed");
  });

  it("renders a textarea when multiline prop is true", () => {
    render(<Input multiline placeholder="Enter text" />);
    const textarea = screen.getByPlaceholderText("Enter text");
    
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toBeInTheDocument();
  });

  it("associates label with textarea using htmlFor and id when multiline is true", () => {
    render(<Input label="Description" multiline />);
    const label = screen.getByText("Description");
    const textarea = screen.getByRole("textbox");
    
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe("LABEL");
    expect(textarea.tagName).toBe("TEXTAREA");
    
    const id = textarea.getAttribute("id");
    expect(id).toBe("description");
    expect(label.getAttribute("for")).toBe("description");
  });

  it("renders error message correctly in multiline mode", () => {
    render(<Input multiline placeholder="Test Input" error="This field is required" />);
    const textarea = screen.getByPlaceholderText("Test Input");
    const errorText = screen.getByText("This field is required");
    
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("text-red");
    expect(errorText.className).toContain("opacity-100");
  });

  it("renders hint message correctly in multiline mode when error is not present", () => {
    render(<Input multiline placeholder="Test Input" hint="Must be 8 characters long" />);
    const textarea = screen.getByPlaceholderText("Test Input");
    const hintText = screen.getByText("Must be 8 characters long");
    
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(hintText).toBeInTheDocument();
    expect(hintText.className).toContain("text-ink-3");
    expect(hintText.className).toContain("opacity-100");
  });

  it("hides hint and shows error when error is present in multiline mode", () => {
    render(<Input multiline placeholder="Test Input" hint="Must be 8 characters long" error="Invalid format" />);
    const textarea = screen.getByPlaceholderText("Test Input");
    const errorText = screen.getByText("Invalid format");
    const hintText = screen.getByText("Must be 8 characters long");

    expect(textarea.tagName).toBe("TEXTAREA");
    expect(errorText).toBeInTheDocument();
    expect(errorText.className).toContain("opacity-100");
    expect(hintText.className).toContain("opacity-0");
  });

  // ── Prefix / suffix ────────────────────────────────────────────────────
  describe("prefix and suffix", () => {
    it("renders a prefix element inside the input container", () => {
      render(<Input prefix="$" placeholder="Amount" />);
      expect(screen.getByText("$")).toBeInTheDocument();
    });

    it("renders a suffix element inside the input container", () => {
      render(<Input suffix="USD" placeholder="Amount" />);
      expect(screen.getByText("USD")).toBeInTheDocument();
    });

    it("renders both prefix and suffix simultaneously", () => {
      render(<Input prefix="$" suffix=".00" placeholder="Amount" />);
      expect(screen.getByText("$")).toBeInTheDocument();
      expect(screen.getByText(".00")).toBeInTheDocument();
    });
  });

  // ── Controlled value warning ────────────────────────────────────────────
  describe("controlled value warning", () => {
    it("warns via console.warn when value is provided without onChange", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(<Input value="readonly" />);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("controlled"),
      );
      warnSpy.mockRestore();
    });

    it("does not warn when value and onChange are both provided", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(<Input value="editable" onChange={() => {}} />);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not warn when value is undefined", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(<Input placeholder="uncontrolled" />);
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  // ── Password toggle (#205) ──────────────────────────────────────────────
  describe("password toggle", () => {
    it("does not render a toggle button for non-password inputs", () => {
      render(<Input placeholder="Enter text" />);
      expect(
        screen.queryByRole("button", { name: /show password/i }),
      ).not.toBeInTheDocument();
    });

    it("renders type=password and a Show password toggle button", () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText("Password");

      expect(input).toHaveAttribute("type", "password");
      expect(
        screen.getByRole("button", { name: "Show password" }),
      ).toBeInTheDocument();
    });

    it("toggles the input type from password to text and back when the eye button is clicked", () => {
      render(<Input type="password" placeholder="Password" />);
      const input = screen.getByPlaceholderText("Password");
      const toggle = screen.getByRole("button", { name: "Show password" });

      fireEvent.click(toggle);
      expect(input).toHaveAttribute("type", "text");
      expect(
        screen.getByRole("button", { name: "Hide password" }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
      expect(input).toHaveAttribute("type", "password");
    });

    it("still renders label, error, and hint correctly for password inputs", () => {
      render(
        <Input
          type="password"
          label="Passphrase"
          hint="Must be 8 characters long"
          error="Too short"
        />,
      );

      expect(screen.getByText("Passphrase")).toBeInTheDocument();
      const errorText = screen.getByText("Too short");
      expect(errorText.className).toContain("opacity-100");
    });
  });

  // ── hint testid (#311) ──────────────────────────────────────────────────
  it("renders the hint paragraph with data-testid='input-hint'", () => {
    render(<Input placeholder="Test Input" hint="Must be 8 characters long" />);
    const hintEl = screen.getByTestId("input-hint");

    expect(hintEl).toBeInTheDocument();
    expect(hintEl).toHaveTextContent("Must be 8 characters long");
  });

  // ── prefix/suffix (#311) ─────────────────────────────────────────────────
  describe("prefix/suffix", () => {
    it("renders a prefix and suffix inside the input container", () => {
      render(
        <Input placeholder="Amount" prefix={<span>$</span>} suffix="XLM" />,
      );

      expect(screen.getByPlaceholderText("Amount")).toBeInTheDocument();
      expect(screen.getByText("$")).toBeInTheDocument();
      expect(screen.getByText("XLM")).toBeInTheDocument();
    });

    it("does not render prefix/suffix elements when not provided", () => {
      render(<Input placeholder="Amount" />);

      expect(screen.queryByText("$")).not.toBeInTheDocument();
      expect(screen.queryByText("XLM")).not.toBeInTheDocument();
    });
  });

  // ── controlled without onChange dev warning (#311) ──────────────────────
  describe("controlled input without onChange warning", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("warns when value is provided without onChange or readOnly", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(<Input value="foo" />);

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not warn when onChange is also provided", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(<Input value="foo" onChange={() => {}} />);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("does not warn when readOnly is true instead of onChange", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(<Input value="foo" readOnly />);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("clearable (#694)", () => {
    function Controlled({
      initial = "hello",
      onClear,
    }: {
      initial?: string;
      onClear?: () => void;
    }) {
      const [value, setValue] = useState(initial);
      return (
        <>
          <Input
            label="Search"
            clearable
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onClear={onClear}
          />
          <output data-testid="state">{value}</output>
        </>
      );
    }

    it("does not render a clear button unless clearable is set", () => {
      render(<Input defaultValue="text" />);
      expect(
        screen.queryByRole("button", { name: "Clear input" }),
      ).not.toBeInTheDocument();
    });

    it("hides the clear button while the input is empty", () => {
      render(<Input clearable defaultValue="" />);
      expect(
        screen.queryByRole("button", { name: "Clear input" }),
      ).not.toBeInTheDocument();
    });

    it("clears a controlled input through onChange", async () => {
      const user = userEvent.setup();
      const onClear = vi.fn();
      render(<Controlled onClear={onClear} />);

      await user.click(screen.getByRole("button", { name: "Clear input" }));

      expect(screen.getByLabelText("Search")).toHaveValue("");
      expect(screen.getByTestId("state")).toHaveTextContent("");
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("button", { name: "Clear input" }),
      ).not.toBeInTheDocument();
    });

    it("clears an uncontrolled input and calls the consumer onChange with ''", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<Input label="Memo" clearable defaultValue="abc" onChange={onChange} />);

      await user.click(screen.getByRole("button", { name: "Clear input" }));

      expect(screen.getByLabelText("Memo")).toHaveValue("");
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].target.value).toBe("");
    });

    it("shows the clear button once the user types into an uncontrolled input", async () => {
      const user = userEvent.setup();
      render(<Input label="Name" clearable />);
      expect(
        screen.queryByRole("button", { name: "Clear input" }),
      ).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Name"), "x");
      expect(
        screen.getByRole("button", { name: "Clear input" }),
      ).toBeInTheDocument();
    });

    it("is reachable and operable with the keyboard", async () => {
      const user = userEvent.setup();
      render(<Controlled />);
      const input = screen.getByLabelText("Search");

      await user.click(input);
      await user.tab();
      const clear = screen.getByRole("button", { name: "Clear input" });
      expect(clear).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(input).toHaveValue("");
      // Focus returns to the field once the button disappears.
      expect(input).toHaveFocus();
    });

    it("can be activated with Space", async () => {
      const user = userEvent.setup();
      render(<Controlled />);
      screen.getByRole("button", { name: "Clear input" }).focus();
      await user.keyboard(" ");
      expect(screen.getByLabelText("Search")).toHaveValue("");
    });

    it("links the clear button to its input and supports a custom label", () => {
      render(
        <Input id="addr" clearable clearLabel="Clear address" defaultValue="G" />,
      );
      const clear = screen.getByRole("button", { name: "Clear address" });
      expect(clear).toHaveAttribute("type", "button");
      expect(clear).toHaveAttribute("aria-controls", "addr");
    });

    it("does not offer clearing when disabled or read-only", () => {
      const { rerender } = render(<Input clearable disabled defaultValue="x" />);
      expect(screen.queryByRole("button", { name: "Clear input" })).toBeNull();
      rerender(<Input clearable readOnly value="x" />);
      expect(screen.queryByRole("button", { name: "Clear input" })).toBeNull();
    });

    it("does not submit an enclosing form", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Input clearable defaultValue="x" />
        </form>,
      );
      await user.click(screen.getByRole("button", { name: "Clear input" }));
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("sits beside a suffix or password toggle instead of on top of it", () => {
      render(<Input clearable type="password" defaultValue="secret" />);
      const clear = screen.getByRole("button", { name: "Clear input" });
      expect(clear).toHaveClass("right-8");
      expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
      expect(document.querySelector("input")).toHaveClass("pr-14");
    });

    it("still forwards the ref to the input element", () => {
      const ref = createRef<HTMLInputElement>();
      render(<Input ref={ref} clearable defaultValue="x" />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.value).toBe("x");
    });
  });
});
