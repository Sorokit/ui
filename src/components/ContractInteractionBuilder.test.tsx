import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContractSpec } from "./ContractInteractionBuilder";
import { ContractInteractionBuilder } from "./ContractInteractionBuilder";

const MOCK_SPEC: ContractSpec = {
  contractId: "CA3Q5T6Y5H7XQWZ5X4X7Y5H7XQWZ5X4X7Y5H7XQWZ5X4X7Y5H7XQWZ5X4",
  methods: [
    {
      name: "transfer",
      args: [
        { name: "from", type: "address", description: "Sender account address" },
        { name: "to", type: "address", description: "Recipient account address" },
        { name: "amount", type: "i128", description: "Amount in smallest units" },
      ],
      description: "Transfer tokens from one account to another",
    },
    {
      name: "balance",
      args: [{ name: "id", type: "address" }],
      description: "Get the balance of an account",
    },
    {
      name: "name",
      args: [],
      description: "Get the token name",
      returnType: "string",
    },
  ],
};

describe("ContractInteractionBuilder", () => {
  it("renders the section title", () => {
    render(<ContractInteractionBuilder />);
    expect(screen.getByText("Contract Interaction Builder")).toBeInTheDocument();
  });

  it("renders contract address input", () => {
    render(<ContractInteractionBuilder />);
    expect(
      screen.getByRole("textbox", { name: "Contract Address" }),
    ).toBeInTheDocument();
  });

  it("validates contract address starts with C", () => {
    render(<ContractInteractionBuilder />);
    const input = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(input, { target: { value: "invalid" } });
    expect(
      screen.getByText("Contract address must start with 'C'"),
    ).toBeInTheDocument();
  });

  it("validates contract address is required", () => {
    render(<ContractInteractionBuilder />);
    const input = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(input, { target: { value: "C" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(
      screen.getByText("Contract address is required"),
    ).toBeInTheDocument();
  });

  it("renders method selector dropdown when contract spec is provided", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
    expect(
      screen.getByRole("combobox", { name: "Method" }),
    ).toBeInTheDocument();
  });

  it("displays methods from contract spec in dropdown", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
    const select = screen.getByRole("combobox", { name: "Method" });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /transfer/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /balance/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^name/ })).toBeInTheDocument();
  });

  it("renders dynamic argument inputs when a method is selected", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "transfer" } });

    expect(screen.getByText("from")).toBeInTheDocument();
    expect(screen.getByText("to")).toBeInTheDocument();
    expect(screen.getByText("amount")).toBeInTheDocument();
  });

  it("shows type labels next to argument names", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "transfer" } });

    expect(screen.getAllByText("address").length).toBe(2);
    expect(screen.getByText("i128")).toBeInTheDocument();
  });

  it("shows 'no arguments' message for methods without args", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "name" } });

    expect(
      screen.getByText("This method takes no arguments."),
    ).toBeInTheDocument();
  });

  it("generates call preview when contract ID and method are filled", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);

    const contractInput = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(contractInput, {
      target: { value: MOCK_SPEC.contractId },
    });

    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "transfer" } });

    expect(screen.getByText("Generated Call Preview")).toBeInTheDocument();
  });

  it("renders copy button for the generated XDR preview", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);

    const contractInput = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(contractInput, {
      target: { value: MOCK_SPEC.contractId },
    });

    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "transfer" } });

    expect(
      screen.getByRole("button", { name: "Copy generated XDR" }),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "u64",
      [{ name: "amount", type: "u64" as const }],
      { amount: "42" },
      "eyJjb250cmFjdElkIjoiQ0EzUTVUNlk1SDdYUVdaNVg0WDdZNUg3WFFXWjVYNFg3WTVIN1hRV1o1WDRYN1k1SDdYUVdaNVg0IiwibWV0aG9kIjoicmVhZCIsImFyZ3MiOlt7Im5hbWUiOiJhbW91bnQiLCJ0eXBlIjoidTY0IiwidmFsdWUiOiI0MiJ9XX0=",
    ],
    [
      "string",
      [{ name: "message", type: "string" as const }],
      { message: "hello" },
      "eyJjb250cmFjdElkIjoiQ0EzUTVUNlk1SDdYUVdaNVg0WDdZNUg3WFFXWjVYNFg3WTVIN1hRV1o1WDRYN1k1SDdYUVdaNVg0IiwibWV0aG9kIjoicmVhZCIsImFyZ3MiOlt7Im5hbWUiOiJtZXNzYWdlIiwidHlwZSI6InN0cmluZyIsInZhbHVlIjoiaGVsbG8ifV19",
    ],
    [
      "address",
      [{ name: "owner", type: "address" as const }],
      { owner: "GABC" },
      "eyJjb250cmFjdElkIjoiQ0EzUTVUNlk1SDdYUVdaNVg0WDdZNUg3WFFXWjVYNFg3WTVIN1hRV1o1WDRYN1k1SDdYUVdaNVg0IiwibWV0aG9kIjoicmVhZCIsImFyZ3MiOlt7Im5hbWUiOiJvd25lciIsInR5cGUiOiJhZGRyZXNzIiwidmFsdWUiOiJHQUJDIn1dfQ==",
    ],
  ])("generates the expected XDR preview for a %s argument", (_type, args, values, expectedXdr) => {
    const spec: ContractSpec = {
      contractId: MOCK_SPEC.contractId,
      methods: [{ name: "read", args }],
    };
    render(<ContractInteractionBuilder contractSpec={spec} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Contract Address" }), {
      target: { value: MOCK_SPEC.contractId },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
      target: { value: "read" },
    });
    const [argName] = Object.keys(values);
    const input =
      screen.queryByRole("textbox", { name: argName }) ??
      screen.getByRole("spinbutton", { name: argName });
    fireEvent.change(input, {
      target: { value: (values as Record<string, string>)[argName] },
    });

    expect(screen.getByText(expectedXdr)).toBeInTheDocument();
  });

  it("calls onParamsReady when Generate button is clicked", () => {
    const onParamsReady = vi.fn();
    render(
      <ContractInteractionBuilder
        contractSpec={MOCK_SPEC}
        onParamsReady={onParamsReady}
      />,
    );

    const contractInput = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(contractInput, {
      target: { value: MOCK_SPEC.contractId },
    });

    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "name" } });

    fireEvent.click(screen.getByText("Generate Contract Call"));

    expect(onParamsReady).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: MOCK_SPEC.contractId,
        method: "name",
        xdr: expect.any(String),
      }),
    );
  });

  it("disables generate button when method not selected", () => {
    const onParamsReady = vi.fn();
    render(
      <ContractInteractionBuilder
        contractSpec={MOCK_SPEC}
        onParamsReady={onParamsReady}
      />,
    );

    expect(screen.getByText("Generate Contract Call")).toBeDisabled();
  });

  it("disables generate button when contract ID is empty", () => {
    const onParamsReady = vi.fn();
    render(
      <ContractInteractionBuilder
        contractSpec={{ ...MOCK_SPEC, contractId: "" }}
        onParamsReady={onParamsReady}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "transfer" } });

    expect(screen.getByText("Generate Contract Call")).toBeDisabled();
  });

  it("renders accessible region landmark", () => {
    render(<ContractInteractionBuilder />);
    expect(
      screen.getByRole("region", {
        name: "Contract Interaction Builder",
      }),
    ).toBeInTheDocument();
  });

  it("renders bool type as a select dropdown", () => {
    const specWithBool: ContractSpec = {
      ...MOCK_SPEC,
      methods: [
        {
          name: "toggle",
          args: [{ name: "enabled", type: "bool" }],
        },
      ],
    };
    render(<ContractInteractionBuilder contractSpec={specWithBool} />);
    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "toggle" } });

    const boolSelect = screen.getByRole("combobox", { name: "enabled" });
    expect(boolSelect).toBeInTheDocument();
    expect(boolSelect).toContainHTML("option");
  });

  it("displays tooltip info for arguments with description", () => {
    render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
    const select = screen.getByRole("combobox", { name: "Method" });
    fireEvent.change(select, { target: { value: "transfer" } });

    expect(screen.getByLabelText("Sender account address")).toBeInTheDocument();
    expect(screen.getByLabelText("Recipient account address")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount in smallest units")).toBeInTheDocument();
  });

  it("works without contract spec (manual input mode)", () => {
    render(<ContractInteractionBuilder />);

    const contractInput = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(contractInput, {
      target: { value: "CA3Q5T6Y5H7XQWZ5X4X7Y5H7XQWZ5X4X7Y5H7XQWZ5X4X7Y5H7XQWZ5X4" },
    });

    expect(
      screen.queryByRole("combobox", { name: "Method" }),
    ).not.toBeInTheDocument();
  });

  it("rejects a contract address that is too short", () => {
    render(<ContractInteractionBuilder />);
    const input = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(input, { target: { value: `C${"A".repeat(14)}` } });
    expect(
      screen.getByText("Contract address is too short"),
    ).toBeInTheDocument();
  });

  it("rejects a 56-char contract address with invalid base32 characters", () => {
    render(<ContractInteractionBuilder />);
    const input = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(input, { target: { value: `C${"0".repeat(55)}` } });
    expect(
      screen.getByText("Contract address is not a valid Soroban contract ID"),
    ).toBeInTheDocument();
  });

  it("accepts a strict 56-char contract address", () => {
    render(<ContractInteractionBuilder />);
    const input = screen.getByRole("textbox", { name: "Contract Address" });
    fireEvent.change(input, { target: { value: `C${"A".repeat(55)}` } });
    expect(
      screen.queryByText(/not a valid Soroban contract ID/),
    ).not.toBeInTheDocument();
  });

  it("renders a JSON input with live validation for complex types", () => {
    const spec: ContractSpec = {
      ...MOCK_SPEC,
      methods: [{ name: "batch", args: [{ name: "items", type: "vec" }] }],
    };
    render(<ContractInteractionBuilder contractSpec={spec} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
      target: { value: "batch" },
    });

    const textarea = screen.getByRole("textbox", { name: "items" });
    fireEvent.change(textarea, { target: { value: "{bad" } });
    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "[1, 2, 3]" } });
    expect(screen.queryByText("Invalid JSON")).not.toBeInTheDocument();
  });

  // ── Issue #910: boundary values, bool and Option<T> coverage ──────────────

  type ArgType = ContractSpec["methods"][number]["args"][number]["type"];

  /** Renders a single-arg method, selects it, and returns the arg input. */
  function renderSingleArg(type: ArgType, onParamsReady = vi.fn()) {
    const spec: ContractSpec = {
      contractId: MOCK_SPEC.contractId,
      methods: [{ name: "call", args: [{ name: "value", type }] }],
    };
    render(
      <ContractInteractionBuilder contractSpec={spec} onParamsReady={onParamsReady} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
      target: { value: "call" },
    });
    return onParamsReady;
  }

  /** Decodes the base64 call preview and returns the single argument's value. */
  function previewArgValue(): unknown {
    const encoded = screen.getByText("Generated Call Preview").closest("div")!
      .parentElement!.querySelector("pre")!.textContent ?? "";
    const decoded = JSON.parse(atob(encoded)) as {
      args: Array<{ value: unknown }>;
    };
    return decoded.args[0]?.value;
  }

  describe("integer boundary values (#910)", () => {
    it.each([
      ["u32", "spinbutton", "0"],
      ["u32", "spinbutton", "4294967295"],
      ["i32", "spinbutton", "-2147483648"],
      ["i32", "spinbutton", "2147483647"],
      ["u64", "spinbutton", "0"],
      ["u64", "spinbutton", "18446744073709551615"],
      ["i64", "spinbutton", "-9223372036854775808"],
      ["i64", "spinbutton", "9223372036854775807"],
      ["u128", "textbox", "0"],
      ["u128", "textbox", "340282366920938463463374607431768211455"],
      ["i128", "textbox", "-170141183460469231731687303715884105728"],
      ["i128", "textbox", "170141183460469231731687303715884105727"],
    ] as const)(
      "preserves %s boundary value %s exactly",
      (type, role, value) => {
        const onParamsReady = renderSingleArg(type);
        const input = screen.getByRole(role, { name: "value" });
        fireEvent.change(input, { target: { value } });

        // No precision loss in the preview or the generated params, even for
        // values far beyond Number.MAX_SAFE_INTEGER.
        expect(previewArgValue()).toBe(value);
        fireEvent.click(screen.getByText("Generate Contract Call"));
        expect(onParamsReady).toHaveBeenCalledWith(
          expect.objectContaining({ method: "call", args: [value] }),
        );
      },
    );

    it.each(["i32", "u32", "i64", "u64"] as const)(
      "renders %s as a numeric input",
      (type) => {
        renderSingleArg(type);
        expect(screen.getByRole("spinbutton", { name: "value" })).toHaveAttribute(
          "type",
          "number",
        );
      },
    );

    it.each(["i128", "u128"] as const)(
      "renders %s as a text input so 128-bit values are not rounded",
      (type) => {
        renderSingleArg(type);
        const input = screen.getByRole("textbox", { name: "value" });
        expect(input).toHaveAttribute("type", "text");
        expect(input).toHaveAttribute("placeholder", `Enter ${type} (e.g. 1000000)`);
      },
    );
  });

  describe("bool arguments (#910)", () => {
    it("offers an empty placeholder plus true and false options", () => {
      renderSingleArg("bool");
      const select = screen.getByRole("combobox", { name: "value" });
      const options = Array.from(select.querySelectorAll("option")).map(
        (option) => option.getAttribute("value"),
      );
      expect(options).toEqual(["", "true", "false"]);
      expect(select).toHaveValue("");
    });

    it("keeps Generate disabled until a bool is chosen", () => {
      renderSingleArg("bool");
      expect(screen.getByText("Generate Contract Call")).toBeDisabled();
    });

    it.each(["true", "false"])("passes the %s selection through", (value) => {
      const onParamsReady = renderSingleArg("bool");
      fireEvent.change(screen.getByRole("combobox", { name: "value" }), {
        target: { value },
      });

      expect(screen.getByRole("combobox", { name: "value" })).toHaveValue(value);
      expect(previewArgValue()).toBe(value);
      fireEvent.click(screen.getByText("Generate Contract Call"));
      expect(onParamsReady).toHaveBeenCalledWith(
        expect.objectContaining({ args: [value] }),
      );
    });
  });

  describe("Option<T> arguments (#910)", () => {
    it("renders an option argument as a text input with its type label", () => {
      renderSingleArg("option");
      expect(screen.getByText("option")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "value" })).toHaveAttribute(
        "placeholder",
        "Enter option value",
      );
    });

    it("previews an unset option as empty and keeps Generate disabled", () => {
      renderSingleArg("option");
      expect(previewArgValue()).toBe("");
      expect(screen.getByText("Generate Contract Call")).toBeDisabled();
    });

    it("passes a provided option value through", () => {
      const onParamsReady = renderSingleArg("option");
      fireEvent.change(screen.getByRole("textbox", { name: "value" }), {
        target: { value: "42" },
      });

      expect(previewArgValue()).toBe("42");
      fireEvent.click(screen.getByText("Generate Contract Call"));
      expect(onParamsReady).toHaveBeenCalledWith(
        expect.objectContaining({ args: ["42"] }),
      );
    });
  });
});
