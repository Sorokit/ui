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
});
