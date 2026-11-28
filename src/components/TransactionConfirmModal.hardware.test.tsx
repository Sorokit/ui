import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  HARDWARE_HIGH_VALUE_THRESHOLD_STROOPS,
  TransactionConfirmModal,
  type TransactionPreviewData,
} from "./TransactionConfirmModal";

const SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

function makePreview(totalAmountStroops?: string): TransactionPreviewData {
  return {
    transactionType: "Payment",
    operations: [{ type: "Payment", description: "Send 100 XLM" }],
    fee: { baseFeeStroops: "100", totalStroops: "100" },
    sourceAccount: SOURCE,
    ...(totalAmountStroops ? { totalAmountStroops } : {}),
  };
}

function renderModal({
  amount,
  isHardwareWallet = true,
}: {
  amount?: string;
  isHardwareWallet?: boolean;
}) {
  const onConfirm = vi.fn();
  render(
    <TransactionConfirmModal
      open
      transaction={makePreview(amount)}
      isHardwareWallet={isHardwareWallet}
      highValueThresholdStroops={HARDWARE_HIGH_VALUE_THRESHOLD_STROOPS}
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return {
    onConfirm,
    confirmButton: screen.getByRole("button", { name: /Confirm & Sign/i }),
  };
}

describe("hardware wallet confirmation (#1153)", () => {
  it("surfaces the hardware badge inside the confirmation modal", () => {
    renderModal({ amount: "100" });
    expect(screen.getByTestId("tx-hardware-badge")).toBeInTheDocument();
  });

  it("requires an explicit on-device check for high-value hardware payments", () => {
    const { onConfirm, confirmButton } = renderModal({
      amount: HARDWARE_HIGH_VALUE_THRESHOLD_STROOPS,
    });

    expect(screen.getByTestId("hardware-confirmation")).toBeInTheDocument();
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("hardware-confirm-checkbox"));
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not gate hardware payments below the threshold", () => {
    const { onConfirm, confirmButton } = renderModal({ amount: "999999999" });

    expect(screen.queryByTestId("hardware-confirmation")).toBeNull();
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("does not gate high-value payments on software wallets", () => {
    const { onConfirm, confirmButton } = renderModal({
      amount: HARDWARE_HIGH_VALUE_THRESHOLD_STROOPS,
      isHardwareWallet: false,
    });

    expect(screen.queryByTestId("tx-hardware-badge")).toBeNull();
    expect(screen.queryByTestId("hardware-confirmation")).toBeNull();
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
