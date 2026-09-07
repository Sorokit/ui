import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProvider } from "@/__tests__/utils";
import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient, TxResult } from "@/lib/client";
import { createMockClient, MOCK_ADDRESS } from "@/lib/mock-client";

import { TransactionPanel } from "./TransactionPanel";

const DESTINATION =
  "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
const SUCCESS_RESULT: TxResult = {
  hash: "transaction-hash-598",
  ledger: 598,
  successful: true,
};

function ConnectedPanel() {
  const { connectWallet, isConnected } = useSorokit();

  return isConnected ? (
    <TransactionPanel previewMode={false} />
  ) : (
    <button type="button" onClick={() => void connectWallet()}>
      Connect test wallet
    </button>
  );
}

function clientWithSubmit(
  submit: ReturnType<typeof vi.fn>,
): SorokitClient {
  const client = createMockClient();
  return {
    ...client,
    transaction: {
      ...client.transaction,
      submit,
    },
  } as SorokitClient;
}

async function renderConnected(
  submit = vi.fn().mockResolvedValue({
    data: SUCCESS_RESULT,
    error: null,
  }),
) {
  const user = userEvent.setup();
  const client = clientWithSubmit(submit);
  renderWithProvider(<ConnectedPanel />, { client });
  await user.click(
    screen.getByRole("button", { name: "Connect test wallet" }),
  );
  await screen.findByLabelText("Destination Address");
  return { client, submit, user };
}

async function fillValidPayment(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Destination Address"), DESTINATION);
  await user.type(screen.getByLabelText("Amount (XLM)"), "10");
}

describe("TransactionPanel form flow with SorokitProvider", () => {
  it("disables Send when the destination is empty", async () => {
    await renderConnected();

    expect(screen.getByRole("button", { name: "Send XLM" })).toBeDisabled();
  });

  it.each(["0", "-1"])(
    "disables Send when the amount is %s",
    async (amount) => {
      const { user } = await renderConnected();
      await user.type(
        screen.getByLabelText("Destination Address"),
        DESTINATION,
      );
      await user.type(screen.getByLabelText("Amount (XLM)"), amount);

      expect(screen.getByRole("button", { name: "Send XLM" })).toBeDisabled();
    },
  );

  it("submits the expected payment payload and renders the hash and ledger", async () => {
    const { submit, user } = await renderConnected();
    await fillValidPayment(user);
    await user.click(screen.getByRole("button", { name: "Send XLM" }));

    expect(submit).toHaveBeenCalledWith({
      source: MOCK_ADDRESS,
      destination: DESTINATION,
      amount: "10",
      asset: "XLM",
      memoType: "text",
      memo: undefined,
    });
    expect(await screen.findByText("Transaction submitted")).toBeVisible();
    expect(screen.getByText(SUCCESS_RESULT.hash)).toBeVisible();
    expect(screen.getByText(`Ledger #${SUCCESS_RESULT.ledger}`)).toBeVisible();
  });

  it("renders the client error when submission fails", async () => {
    const submit = vi.fn().mockResolvedValue({
      data: null,
      error: "Payment was rejected",
    });
    const { user } = await renderConnected(submit);
    await fillValidPayment(user);
    await user.click(screen.getByRole("button", { name: "Send XLM" }));

    expect(await screen.findByText("Transaction failed")).toBeVisible();
    expect(screen.getByText("Payment was rejected")).toBeVisible();
  });

  it("returns to an empty idle form after New Transaction", async () => {
    const { user } = await renderConnected();
    await fillValidPayment(user);
    await user.click(screen.getByRole("button", { name: "Send XLM" }));
    await user.click(
      await screen.findByRole("button", { name: "New Transaction" }),
    );

    expect(screen.getByLabelText("Destination Address")).toHaveValue("");
    expect(screen.getByLabelText("Amount (XLM)")).toHaveValue(null);
    expect(screen.getByRole("button", { name: "Send XLM" })).toBeDisabled();
  });

  it.each(["Destination Address", "Amount (XLM)"])(
    "submits when Enter is pressed in the %s field",
    async (fieldLabel) => {
      const { submit, user } = await renderConnected();
      await fillValidPayment(user);
      await user.click(screen.getByLabelText(fieldLabel));
      await user.keyboard("{Enter}");

      expect(submit).toHaveBeenCalledTimes(1);
      expect(await screen.findByText("Transaction submitted")).toBeVisible();
    },
  );
});
