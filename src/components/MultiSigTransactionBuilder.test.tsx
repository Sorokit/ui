import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MultiSigTransactionBuilder } from "./MultiSigTransactionBuilder";

describe("MultiSigTransactionBuilder", () => {
  beforeEach(() => {
    const storage = window.localStorage;
    if (storage && typeof storage.removeItem === "function") {
      storage.removeItem("sorokit-multisig-builder-state");
    }
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("walks through the wizard steps and validates threshold configuration", () => {
    render(<MultiSigTransactionBuilder />);

    expect(screen.getAllByText(/signer configuration/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/signer 1 address/i), { target: { value: "GABC" } });
    fireEvent.change(screen.getByLabelText(/signer 1 weight/i), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getAllByText(/build transaction/i).length).toBeGreaterThan(0);
  });

  it("saves and loads transactions from localStorage", async () => {
    const { rerender } = render(<MultiSigTransactionBuilder />);

    fireEvent.change(screen.getByLabelText(/signer 1 address/i), { target: { value: "GABC" } });
    fireEvent.change(screen.getByLabelText(/signer 1 weight/i), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /save json/i }));

    const storage = window.localStorage;
    const saved = storage && typeof storage.getItem === "function" ? storage.getItem("sorokit-multisig-builder-state") : null;
    expect(saved).toBeTruthy();

    rerender(<MultiSigTransactionBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /load saved/i }));
    expect(screen.getByText(/loaded saved transaction/i)).toBeInTheDocument();
  });

  it("blocks Next while the threshold exceeds total signer weight", () => {
    render(<MultiSigTransactionBuilder />);

    // Default: one signer of weight 1; threshold 2 is invalid.
    fireEvent.change(screen.getByLabelText(/threshold/i), { target: { value: "2" } });

    expect(
      screen.getByText(/Threshold exceeds available weight/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("keeps signer keys unique when adding after removing a middle signer", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MultiSigTransactionBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[1]);
    fireEvent.click(screen.getByRole("button", { name: /add signer/i }));

    const duplicateWarnings = consoleSpy.mock.calls.filter(
      ([msg]) => typeof msg === "string" && msg.includes("same key"),
    );
    expect(duplicateWarnings).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it("does not redefine window.localStorage when saving", () => {
    const original = window.localStorage;
    render(<MultiSigTransactionBuilder />);

    fireEvent.click(screen.getByRole("button", { name: /save json/i }));

    expect(window.localStorage).toBe(original);
  });
});
