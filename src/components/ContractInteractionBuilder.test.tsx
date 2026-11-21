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

  describe("recursive nested-value validation for complex types (#906)", () => {
    it("flags a null element nested inside a vec", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "batch", args: [{ name: "items", type: "vec" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "batch" },
      });

      const textarea = screen.getByRole("textbox", { name: "items" });
      fireEvent.change(textarea, { target: { value: "[1, null, 3]" } });

      expect(screen.getByText(/value\[1\] is empty/)).toBeInTheDocument();
    });

    it("flags an empty-string element nested inside a tuple two levels deep", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "pair", args: [{ name: "data", type: "tuple" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "pair" },
      });

      const textarea = screen.getByRole("textbox", { name: "data" });
      fireEvent.change(textarea, { target: { value: '[1, ["ok", ""]]' } });

      expect(screen.getByText(/value\[1\]\[1\] is empty/)).toBeInTheDocument();
    });

    it("flags a missing field nested inside a map/struct", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "configure", args: [{ name: "settings", type: "map" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "configure" },
      });

      const textarea = screen.getByRole("textbox", { name: "settings" });
      fireEvent.change(textarea, { target: { value: '{"owner": "GABC", "backup": null}' } });

      expect(screen.getByText(/value\.backup is empty/)).toBeInTheDocument();
    });

    it("accepts a fully populated nested vec/tuple/map with no empty elements", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "batch", args: [{ name: "items", type: "vec" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "batch" },
      });

      const textarea = screen.getByRole("textbox", { name: "items" });
      fireEvent.change(textarea, {
        target: { value: '[1, ["ok", "also-ok"], {"k": "v"}]' },
      });

      expect(screen.queryByText("Invalid JSON")).not.toBeInTheDocument();
      expect(screen.queryByText(/is empty/)).not.toBeInTheDocument();
    });

    it("does not flag an empty value before the user has typed anything", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "batch", args: [{ name: "items", type: "vec" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "batch" },
      });

      expect(screen.queryByText(/is empty/)).not.toBeInTheDocument();
      expect(screen.queryByText("Invalid JSON")).not.toBeInTheDocument();
    });
  });

  describe("safe BigInt parsing for u128/i128 (#906)", () => {
    it("rejects a decimal value for i128 with an inline error instead of throwing", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "setAmount", args: [{ name: "amount", type: "i128" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "setAmount" },
      });

      const input = screen.getByRole("textbox", { name: "amount" });
      fireEvent.change(input, { target: { value: "12.5" } });

      expect(
        screen.getByText(/Enter a whole number for i128/),
      ).toBeInTheDocument();
    });

    it("rejects non-numeric text for u128 with an inline error instead of throwing", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "setAmount", args: [{ name: "amount", type: "u128" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "setAmount" },
      });

      const input = screen.getByRole("textbox", { name: "amount" });
      fireEvent.change(input, { target: { value: "not-a-number" } });

      expect(
        screen.getByText(/Enter a whole number for u128/),
      ).toBeInTheDocument();
    });

    it("rejects a negative value for u128 as out of range", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "setAmount", args: [{ name: "amount", type: "u128" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "setAmount" },
      });

      const input = screen.getByRole("textbox", { name: "amount" });
      fireEvent.change(input, { target: { value: "-5" } });

      expect(screen.getByText(/out of range for u128/)).toBeInTheDocument();
    });

    it("rejects a value above the 128-bit bound as out of range", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "setAmount", args: [{ name: "amount", type: "u128" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "setAmount" },
      });

      const input = screen.getByRole("textbox", { name: "amount" });
      // 2^128, one past the unsigned 128-bit maximum.
      fireEvent.change(input, {
        target: { value: "340282366920938463463374607431768211456" },
      });

      expect(screen.getByText(/out of range for u128/)).toBeInTheDocument();
    });

    it("accepts a large valid i128 value with no error", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "setAmount", args: [{ name: "amount", type: "i128" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "setAmount" },
      });

      const input = screen.getByRole("textbox", { name: "amount" });
      fireEvent.change(input, { target: { value: "-170141183460469231731687303715884105728" } });

      expect(screen.queryByText(/Enter a whole number/)).not.toBeInTheDocument();
      expect(screen.queryByText(/out of range/)).not.toBeInTheDocument();
      expect(screen.queryByText(/is not a valid/)).not.toBeInTheDocument();
    });

    it("does not show an error before the user has typed anything", () => {
      const spec: ContractSpec = {
        ...MOCK_SPEC,
        methods: [{ name: "setAmount", args: [{ name: "amount", type: "i128" }] }],
      };
      render(<ContractInteractionBuilder contractSpec={spec} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "setAmount" },
      });

      expect(screen.queryByText(/Enter a whole number/)).not.toBeInTheDocument();
    });
  });

  describe("multi-auth entry review (#906)", () => {
    it("shows an authorization entry per address argument when a method has more than one", () => {
      render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "transfer" },
      });

      expect(screen.getByText("Authorization Entries")).toBeInTheDocument();
      expect(screen.getByText("Signer: from")).toBeInTheDocument();
      expect(screen.getByText("Signer: to")).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "from requires authorization" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "to requires authorization" }),
      ).toBeInTheDocument();
    });

    it("does not show the authorization panel for a method with fewer than two address arguments", () => {
      render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "balance" },
      });

      expect(screen.queryByText("Authorization Entries")).not.toBeInTheDocument();
    });

    it("defaults each authorization entry to requiring auth and allows unchecking it", () => {
      render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "transfer" },
      });

      const fromCheckbox = screen.getByRole("checkbox", {
        name: "from requires authorization",
      });
      expect(fromCheckbox).toBeChecked();

      fireEvent.click(fromCheckbox);
      expect(fromCheckbox).not.toBeChecked();

      // Unrelated entry is unaffected by toggling "from".
      expect(
        screen.getByRole("checkbox", { name: "to requires authorization" }),
      ).toBeChecked();
    });

    it("reflects the filled-in address value next to each authorization entry", () => {
      render(<ContractInteractionBuilder contractSpec={MOCK_SPEC} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "transfer" },
      });

      // The input's accessible name is the arg name ("from"); the arg's
      // `description` ("Sender account address") labels a separate tooltip
      // span, not the input itself.
      fireEvent.change(screen.getByRole("textbox", { name: "from" }), {
        target: { value: "GSENDER123" },
      });

      expect(screen.getByText("GSENDER123")).toBeInTheDocument();
    });

    it("passes authEntries through to onParamsReady reflecting the current toggle state", () => {
      const onParamsReady = vi.fn();
      render(
        <ContractInteractionBuilder
          contractSpec={MOCK_SPEC}
          onParamsReady={onParamsReady}
        />,
      );

      fireEvent.change(screen.getByRole("textbox", { name: "Contract Address" }), {
        target: { value: MOCK_SPEC.contractId },
      });
      fireEvent.change(screen.getByRole("combobox", { name: "Method" }), {
        target: { value: "transfer" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "from" }), {
        target: { value: "GSENDER123" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "to" }), {
        target: { value: "GRECIPIENT456" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: "amount" }), {
        target: { value: "100" },
      });

      fireEvent.click(
        screen.getByRole("checkbox", { name: "to requires authorization" }),
      );
      fireEvent.click(screen.getByText("Generate Contract Call"));

      expect(onParamsReady).toHaveBeenCalledWith(
        expect.objectContaining({
          authEntries: [
            { argName: "from", address: "GSENDER123", needsAuth: true },
            { argName: "to", address: "GRECIPIENT456", needsAuth: false },
          ],
        }),
      );
    });
  });
});
