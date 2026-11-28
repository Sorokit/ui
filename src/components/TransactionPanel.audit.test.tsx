import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getAuditLog, reloadAuditLog } from "@/lib/audit-log";

import { TransactionPanel } from "./TransactionPanel";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

const VALID_DEST = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
const MOCK_SOURCE = "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

function mockClient(submit: ReturnType<typeof vi.fn>) {
  const client = {
    transaction: {
      submit,
      estimateFee: vi
        .fn()
        .mockResolvedValue({ data: { baseFee: "100", recommended: "100" }, error: null }),
    },
  };
  vi.mocked(useSorokit).mockReturnValue({
    address: MOCK_SOURCE,
    client,
    isConnected: true,
    balances: [{ asset: "XLM", balance: "100" }],
  } as unknown as ReturnType<typeof useSorokit>);
}

async function sendTenXlm() {
  render(<TransactionPanel />);
  fireEvent.change(screen.getByLabelText("Destination Address"), {
    target: { value: VALID_DEST },
  });
  fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
  fireEvent.click(screen.getByTestId("submit-transaction"));
  await screen.findByRole("dialog", { name: /confirm transaction/i });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));
  });
}

describe("TransactionPanel audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    reloadAuditLog();
  });

  it("logs a send after a payment is submitted", async () => {
    mockClient(
      vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }),
    );

    await sendTenXlm();

    const log = getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe("send");
    expect(log[0].detail).toBe(`10 XLM to ${VALID_DEST}`);
  });

  it("does not log a send when the payment fails", async () => {
    mockClient(vi.fn().mockResolvedValue({ data: null, error: "tx_failed" }));

    await sendTenXlm();

    expect(getAuditLog()).toEqual([]);
  });
});
