import { act,fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RecoveryScreen } from "./RecoveryScreen";

describe("RecoveryScreen", () => {
  it("renders Recovery Screen heading and audit panel", () => {
    render(<RecoveryScreen />);
    expect(screen.getByText("Account Recovery Assistant")).toBeInTheDocument();
    expect(screen.getByTestId("audit-badge")).toBeInTheDocument();
  });

  it("can add and revoke a recovery signer", () => {
    render(<RecoveryScreen />);
    
    // Add signer
    const addressInput = screen.getByLabelText("Signer Address");
    const nameInput = screen.getByLabelText("Signer Name");
    const submitBtn = screen.getByRole("button", { name: "Register Recovery Signer" });

    fireEvent.change(addressInput, { target: { value: "GDDDD...4444" } });
    fireEvent.change(nameInput, { target: { value: "New Ledger Key" } });
    fireEvent.click(submitBtn);

    expect(screen.getByText("New Ledger Key")).toBeInTheDocument();

    // Revoke signer
    const revokeBtn = screen.getByLabelText("Revoke New Ledger Key");
    fireEvent.click(revokeBtn);

    expect(screen.queryByText("New Ledger Key")).not.toBeInTheDocument();
  });

  it("runs the dry-run recovery simulation", async () => {
    vi.useFakeTimers();
    render(<RecoveryScreen />);

    const simBtn = screen.getByRole("button", { name: "Initiate Dry-run" });
    fireEvent.click(simBtn);

    expect(screen.getByText(/Initiating account recovery assistant/i)).toBeInTheDocument();

    // Advance first step
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText(/Step 1: Validating primary key credentials/i)).toBeInTheDocument();

    // Advance second step
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText(/Success: Co-signer signatures verified successfully/i)).toBeInTheDocument();

    vi.useRealTimers();
  });

  describe("Threshold validation (Issue #1142)", () => {
    it("validates that threshold cannot exceed total signer count", () => {
      render(<RecoveryScreen />);
      
      const thresholdInput = screen.getByTestId("threshold-input");
      const saveBtn = screen.getByRole("button", { name: "Save Recovery Config" });
      
      // Default: 3 signers, threshold 2 -> valid
      expect(saveBtn).not.toBeDisabled();
      expect(screen.queryByTestId("threshold-error")).not.toBeInTheDocument();

      // Set threshold to 10 with only 3 signers
      fireEvent.change(thresholdInput, { target: { value: "10" } });

      // Error shown and submit disabled
      expect(screen.getByTestId("threshold-error")).toBeInTheDocument();
      expect(screen.getByTestId("threshold-error")).toHaveTextContent(
        /Threshold cannot exceed total signer count \(3\)/i,
      );
      expect(saveBtn).toBeDisabled();
      expect(screen.getByRole("button", { name: "Initiate Dry-run" })).toBeDisabled();

      // Lower threshold back to 2 -> valid again
      fireEvent.change(thresholdInput, { target: { value: "2" } });
      expect(screen.queryByTestId("threshold-error")).not.toBeInTheDocument();
      expect(saveBtn).not.toBeDisabled();
    });

    it("disables submit and shows error if revoking signers causes threshold > signers.length", () => {
      render(<RecoveryScreen />);

      const thresholdInput = screen.getByTestId("threshold-input");
      const saveBtn = screen.getByRole("button", { name: "Save Recovery Config" });

      // Set threshold to 3 (equal to 3 initial signers) -> valid
      fireEvent.change(thresholdInput, { target: { value: "3" } });
      expect(saveBtn).not.toBeDisabled();

      // Revoke one signer so count drops to 2
      const revokeBtn = screen.getByLabelText("Revoke Personal Backup Key");
      fireEvent.click(revokeBtn);

      // Now threshold 3 > 2 signers -> error & disabled
      expect(screen.getByTestId("threshold-error")).toBeInTheDocument();
      expect(screen.getByTestId("threshold-error")).toHaveTextContent(
        /Threshold cannot exceed total signer count \(2\)/i,
      );
      expect(saveBtn).toBeDisabled();
    });
  });
});
