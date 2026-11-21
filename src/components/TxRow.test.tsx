import { fireEvent, render, screen } from "@testing-library/react";

import type { Transaction } from "@/lib/client";

import { TxRow } from "./TransactionHistory";

const originalClipboard = navigator.clipboard;

describe("TxRow component", () => {
  it("renders transaction hash, ledger, status badge, fee, and date", () => {
    const tx: Transaction = {
      hash: "hash123",
      ledger: 1000,
      createdAt: new Date("2026-07-01T18:52:00").toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "100",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByText(/hash123/)).toBeInTheDocument();
    expect(screen.getByText(/Ledger 1000/)).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText(/100 stroops/)).toBeInTheDocument();
  });

  it("shows Failed badge for unsuccessful transactions", () => {
    const tx: Transaction = {
      hash: "hash-fail",
      ledger: 1002,
      createdAt: new Date().toISOString(),
      successful: false,
      operationCount: 1,
      feePaid: "0",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  // ── feePaid display (#178) ───────────────────────────────────────────────
  it("renders the feePaid value in stroops", () => {
    const tx: Transaction = {
      hash: "hash-fee",
      ledger: 1003,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "12345",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByText(/12345 stroops/)).toBeInTheDocument();
  });

  // ── Memo truncation (#178) ───────────────────────────────────────────────
  it("truncates a memo longer than 20 characters and shows the full memo in the title attribute", () => {
    const longMemo = "a".repeat(30);
    const tx: Transaction = {
      hash: "hash-memo",
      ledger: 1004,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "100",
      memo: longMemo,
    } as Transaction;
    render(<TxRow tx={tx} />);

    const truncated = `${longMemo.slice(0, 20)}…`;
    const memoEl = screen.getByText(`· ${truncated}`);
    expect(memoEl).toBeInTheDocument();
    expect(memoEl).toHaveAttribute("title", longMemo);
    expect(memoEl.textContent).not.toContain(longMemo);
  });

  it("does not truncate a memo of 20 characters or fewer", () => {
    const shortMemo = "short memo";
    const tx: Transaction = {
      hash: "hash-short-memo",
      ledger: 1005,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "100",
      memo: shortMemo,
    } as Transaction;
    render(<TxRow tx={tx} />);

    const memoEl = screen.getByText(`· ${shortMemo}`);
    expect(memoEl).toBeInTheDocument();
    expect(memoEl).toHaveAttribute("title", shortMemo);
  });

  // ── operationCount badge (#200) ──────────────────────────────────────────
  it("shows an operation count badge when operationCount > 1", () => {
    const tx: Transaction = {
      hash: "hash-multi-ops",
      ledger: 1006,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 3,
      feePaid: "300",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByText("3 ops")).toBeInTheDocument();
  });

  it("does not show an operation count badge when operationCount is 1", () => {
    const tx: Transaction = {
      hash: "hash-single-op",
      ledger: 1007,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "100",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.queryByText(/^\d+ ops$/)).not.toBeInTheDocument();
  });

  // ── Soroban Contract Invocations & Badges (#688) ────────────────────────
  it("displays Soroban contract icon and badge for contract invocations", () => {
    const tx: Transaction = {
      hash: "hash-contract-invoke",
      ledger: 2001,
      createdAt: new Date("2026-08-15T12:00:00Z").toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "500",
      operationType: "invoke_contract",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByTestId("op-badge")).toHaveTextContent("Soroban");
  });

  it("displays full UTC timestamp in title attribute on hover", () => {
    const createdAtDate = new Date("2026-08-15T14:30:00Z");
    const tx: Transaction = {
      hash: "hash-utc-time",
      ledger: 2002,
      createdAt: createdAtDate.toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "100",
    } as Transaction;
    render(<TxRow tx={tx} />);
    const timestampEl = screen.getByTestId("tx-timestamp");
    expect(timestampEl).toHaveAttribute("title", createdAtDate.toUTCString());
  });

  it("displays LP Deposit badge and icon for liquidity pool deposit operations", () => {
    const tx: Transaction = {
      hash: "hash-lp-deposit",
      ledger: 2003,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "200",
      operationType: "liquidity_pool_deposit",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByTestId("op-badge")).toHaveTextContent("LP Deposit");
  });

  it("displays LP Withdraw badge for liquidity pool withdraw operations", () => {
    const tx: Transaction = {
      hash: "hash-lp-withdraw",
      ledger: 2004,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "200",
      operationType: "liquidity_pool_withdraw",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByTestId("op-badge")).toHaveTextContent("LP Withdraw");
  });

  it("displays Claimable badge for claimable balance claim operations", () => {
    const tx: Transaction = {
      hash: "hash-claimable",
      ledger: 2005,
      createdAt: new Date().toISOString(),
      successful: true,
      operationCount: 1,
      feePaid: "150",
      operationType: "claim_claimable_balance",
    } as Transaction;
    render(<TxRow tx={tx} />);
    expect(screen.getByTestId("op-badge")).toHaveTextContent("Claimable");
  });

  // ── Mobile memo truncation, copy-hash tooltip, icon a11y (issue #961) ────

  describe("mobile and accessibility fixes", () => {
    afterEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    });

    it("applies a truncate class to the memo so it clips instead of pushing columns off-screen", () => {
      const tx: Transaction = {
        hash: "hash-long-memo",
        ledger: 3000,
        createdAt: new Date().toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
        memo: "a fairly long memo that could overflow a narrow mobile column",
      } as Transaction;
      render(<TxRow tx={tx} />);

      const memoEl = screen.getByTitle(
        "a fairly long memo that could overflow a narrow mobile column",
      );
      expect(memoEl).toHaveClass("truncate");
    });

    it("hides the decorative status icon from the accessibility tree", () => {
      const tx: Transaction = {
        hash: "hash-icon-a11y",
        ledger: 3001,
        createdAt: new Date().toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      } as Transaction;
      render(<TxRow tx={tx} />);

      expect(screen.getByTestId("status-icon-container")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it("hides the decorative status icon from the accessibility tree for a failed transaction too", () => {
      const tx: Transaction = {
        hash: "hash-icon-a11y-fail",
        ledger: 3002,
        createdAt: new Date().toISOString(),
        successful: false,
        operationCount: 1,
        feePaid: "0",
      } as Transaction;
      render(<TxRow tx={tx} />);

      expect(screen.getByTestId("status-icon-container")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it("renders a copy-hash control with an accessible name and tooltip", () => {
      const tx: Transaction = {
        hash: "hashcopytarget123456",
        ledger: 3003,
        createdAt: new Date().toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      } as Transaction;
      render(<TxRow tx={tx} />);

      const copyControl = screen.getByTitle("Copy transaction hash");
      expect(copyControl).toHaveAttribute(
        "aria-label",
        expect.stringContaining("Copy transaction hash"),
      );
    });

    it("copies the full transaction hash to the clipboard when the copy control is activated", () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      const tx: Transaction = {
        hash: "hashcopytarget123456",
        ledger: 3004,
        createdAt: new Date().toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      } as Transaction;
      render(<TxRow tx={tx} />);

      fireEvent.click(screen.getByTitle("Copy transaction hash"));
      expect(writeText).toHaveBeenCalledWith("hashcopytarget123456");
    });

    it("copies the hash on Enter and Space without navigating the row", () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      const tx: Transaction = {
        hash: "hashcopytarget123456",
        ledger: 3005,
        createdAt: new Date().toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      } as Transaction;
      render(<TxRow tx={tx} />);

      const copyControl = screen.getByTitle("Copy transaction hash");
      fireEvent.keyDown(copyControl, { key: "Enter" });
      expect(writeText).toHaveBeenCalledWith("hashcopytarget123456");

      fireEvent.keyDown(copyControl, { key: " " });
      expect(writeText).toHaveBeenCalledTimes(2);
    });

    it("does not navigate the row when the copy control inside an explorer-linked row is clicked", () => {
      const tx: Transaction = {
        hash: "hashcopytarget123456",
        ledger: 3006,
        createdAt: new Date().toISOString(),
        successful: true,
        operationCount: 1,
        feePaid: "100",
      } as Transaction;
      render(<TxRow tx={tx} networkName="mainnet" />);

      const copyControl = screen.getByTitle("Copy transaction hash");
      const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
      fireEvent(copyControl, clickEvent);
      expect(clickEvent.defaultPrevented).toBe(true);
    });
  });
});
