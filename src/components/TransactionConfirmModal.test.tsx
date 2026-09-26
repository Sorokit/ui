import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  TransactionConfirmModal,
  type TransactionPreviewData,
} from "./TransactionConfirmModal";

const SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

function makePreview(overrides: Partial<TransactionPreviewData> = {}): TransactionPreviewData {
  return {
    transactionType: "Payment",
    operations: [{ type: "Payment", description: "Send 10 XLM to GBCD…WXYZ" }],
    fee: { baseFeeStroops: "100", totalStroops: "100" },
    sourceAccount: SOURCE,
    sequenceNumber: "123456789",
    ...overrides,
  };
}

describe("TransactionConfirmModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <TransactionConfirmModal
        open={false}
        transaction={makePreview()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when transaction is null, even if open", () => {
    const { container } = render(
      <TransactionConfirmModal
        open={true}
        transaction={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the transaction type and operation count", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({
          operations: [
            { type: "Payment", description: "a" },
            { type: "Payment", description: "b" },
          ],
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Payment — 2 operations")).toBeInTheDocument();
  });

  it("lists every operation with its description", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({
          operations: [
            { type: "Payment", description: "Send 10 XLM to GBCD" },
            { type: "Change Trust", description: "Establish trustline for USDC" },
          ],
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Send 10 XLM to GBCD")).toBeInTheDocument();
    expect(screen.getByText("Establish trustline for USDC")).toBeInTheDocument();
  });

  it("shows the full fee breakdown in stroops and XLM", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({
          fee: {
            baseFeeStroops: "100",
            networkFeeStroops: "5000",
            totalStroops: "5100",
          },
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/^100 stroops/)).toBeInTheDocument();
    expect(screen.getByText(/^5000 stroops/)).toBeInTheDocument();
    expect(screen.getByText(/^5100 stroops/)).toBeInTheDocument();
    // 5100 stroops = 0.00051 XLM
    expect(screen.getByText(/0\.00051 XLM/)).toBeInTheDocument();
  });

  it("omits the network fee row when not provided", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({
          fee: { baseFeeStroops: "100", totalStroops: "100" },
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText("Network fee")).not.toBeInTheDocument();
  });

  it("shows the truncated source account address", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/GAAZI4TC/)).toBeInTheDocument();
  });

  it("shows the sequence number and timeout ledger when provided", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({ sequenceNumber: "42", timeoutLedger: 999 })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("999")).toBeInTheDocument();
  });

  it("falls back to 'Determined by wallet' when sequence/timeout are absent", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({ sequenceNumber: undefined, timeoutLedger: undefined })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Determined by wallet")).toHaveLength(2);
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Confirm & Sign is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Cancel and shows a signing state on Confirm while isSigning", () => {
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSigning={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Signing…/i })).toBeInTheDocument();
  });

  it("preserves precision for stroop amounts beyond Number.MAX_SAFE_INTEGER", () => {
    const stroops = "9007199254740993";
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({
          fee: { baseFeeStroops: stroops, totalStroops: stroops },
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/900,719,925\.4740993 XLM/).length).toBeGreaterThan(0);
  });

  it("wraps long operation descriptions instead of overflowing", () => {
    const description = `invoke ${"A".repeat(180)}`;
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview({
          operations: [{ type: "Invoke Contract", description }],
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const node = screen.getByText(description);
    expect(node).toHaveClass("break-words");
    expect(node).toHaveStyle({ overflowWrap: "anywhere" });
  });

  it("shows an alert and re-enables actions when signing is rejected", async () => {
    function Harness() {
      const [signing, setSigning] = useState(false);
      return (
        <TransactionConfirmModal
          open={true}
          transaction={makePreview()}
          isSigning={signing}
          onCancel={vi.fn()}
          onConfirm={async () => {
            setSigning(true);
            throw new Error("User rejected the request");
          }}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Sign" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("User rejected the request");
    expect(screen.getByRole("button", { name: "Confirm & Sign" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("calls onCancel on Escape (unless signing)", () => {
    const onCancel = vi.fn();
    render(
      <TransactionConfirmModal
        open={true}
        transaction={makePreview()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
