import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { ClaimableBalance } from "@/lib/client";

import { BalanceRow, ClaimableBalanceCard } from "./ClaimableBalanceCard";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

type AccountStub = {
  getClaimableBalances: ReturnType<typeof vi.fn>;
  claimBalance: ReturnType<typeof vi.fn>;
};

describe("ClaimableBalanceCard", () => {
  /**
   * The component reads its client from the SorokitContext (see `useSorokit`),
   * so the hook mock has to carry the account stub the rows call into.
   */
  function mockConnected(account: AccountStub, address = "GABC123") {
    vi.mocked(useSorokit).mockReturnValue({
      address,
      isConnected: true,
      client: { account },
    } as unknown as ReturnType<typeof useSorokit>);
    return account;
  }

  function balance(overrides: Partial<ClaimableBalance> = {}): ClaimableBalance {
    return {
      id: "cb1",
      asset: "native",
      amount: "10.0",
      sponsor: "GDEF",
      claimants: [{ destination: "GDEF", predicate: { unconditional: true } }],
      ...overrides,
    } as ClaimableBalance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("connection state", () => {
    it("renders nothing when not connected", () => {
      vi.mocked(useSorokit).mockReturnValue({
        address: null,
        isConnected: false,
        client: null,
      } as unknown as ReturnType<typeof useSorokit>);
      const { container } = render(<ClaimableBalanceCard />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("fetch states", () => {
    it("shows fetch error when getClaimableBalances returns an error", async () => {
      mockConnected({
        getClaimableBalances: vi
          .fn()
          .mockResolvedValue({ data: null, error: "Failed to fetch balances" }),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("Failed to fetch balances")).toBeInTheDocument();
    });

    it("shows an error instead of hanging when getClaimableBalances rejects", async () => {
      mockConnected({
        getClaimableBalances: vi.fn().mockRejectedValue(new Error("Horizon down")),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("Horizon down")).toBeInTheDocument();
    });

    it("shows empty state when no claimable balances exist", async () => {
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({ data: [], error: null }),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText(/no claimable balances/i)).toBeInTheDocument();
    });
  });

  // Issue #441 acceptance criteria.
  describe("claim flow", () => {
    it("shows error and re-enables button on claim failure, removes the row on success", async () => {
      const mockClaimBalance = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: "Network error" })
        .mockResolvedValueOnce({ data: { hash: "tx123" }, error: null });
      const account = mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({ id: "cb1", amount: "10.0" }),
            balance({ id: "cb2", amount: "20.0" }),
          ],
          error: null,
        }),
        claimBalance: mockClaimBalance,
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();
      expect(screen.getByText("2 pending")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: "Claim" })[0]);

      const inlineError = await screen.findByTestId("claim-error-cb1");
      expect(inlineError).toHaveTextContent("Network error");
      expect(screen.getByText("2 pending")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: "Claim" })[0]);

      await waitFor(() => expect(screen.queryByText("10.00")).not.toBeInTheDocument());
      expect(account.claimBalance).toHaveBeenCalledWith("cb1");
      expect(screen.getByText("20.00")).toBeInTheDocument();
      expect(screen.getByText("1 pending")).toBeInTheDocument();
    });

    it("keeps a claimed balance out of the list when the re-fetch still returns it", async () => {
      const account = mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [balance(), balance({ id: "cb2", amount: "20.0" })],
          error: null,
        }),
        claimBalance: vi.fn().mockResolvedValue({ data: { hash: "tx123" }, error: null }),
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: "Claim" })[0]);

      // A re-fetch is triggered after the claim; Horizon may still report the
      // claimed balance, but it must not reappear in the list.
      await waitFor(() => expect(account.getClaimableBalances).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getByText("20.00")).toBeInTheDocument());
      expect(screen.queryByText("10.00")).not.toBeInTheDocument();
    });

    it("shows an inline error and re-enables the button when the claim fails", async () => {
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({ data: [balance()], error: null }),
        claimBalance: vi
          .fn()
          .mockResolvedValueOnce({ data: null, error: "Network error" })
          .mockResolvedValueOnce({ data: { hash: "tx123" }, error: null }),
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Claim" }));

      const inlineError = await screen.findByTestId("claim-error-cb1");
      expect(inlineError).toHaveTextContent("Network error");
      expect(inlineError).toHaveAttribute("role", "alert");

      // The row survives a failure and the button is usable again for a retry.
      const claimButton = screen.getByRole("button", { name: "Claim" });
      expect(claimButton).not.toBeDisabled();

      fireEvent.click(claimButton);
      await waitFor(() => expect(screen.queryByText("10.00")).not.toBeInTheDocument());
    });

    it("surfaces a rejected claimBalance call as an inline error instead of an unhandled rejection", async () => {
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({ data: [balance()], error: null }),
        claimBalance: vi.fn().mockRejectedValue(new Error("Wallet rejected")),
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Claim" }));

      expect(await screen.findByTestId("claim-error-cb1")).toHaveTextContent("Wallet rejected");
      expect(screen.getByRole("button", { name: "Claim" })).not.toBeDisabled();
      expect(screen.getByText("10.00")).toBeInTheDocument();
    });

    it("shows an error and does not remove the row when the API resolves with no data and no error", async () => {
      const mockClaimBalance = vi.fn().mockResolvedValue({ data: null, error: null });
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [balance({ id: "cb1", amount: "10.0" })],
          error: null,
        }),
        claimBalance: mockClaimBalance,
      });

      render(<ClaimableBalanceCard />);
      const claimButton = await screen.findByRole("button", { name: "Claim" });
      fireEvent.click(claimButton);

      expect(await screen.findByText(/claim did not complete/i)).toBeInTheDocument();
      expect(claimButton).not.toBeDisabled();
      expect(screen.queryByText("Claimed")).not.toBeInTheDocument();
      expect(screen.getByText("10.00")).toBeInTheDocument();
    });

    it("removes only the claimed balance and updates the header count when multiple balances exist", async () => {
      const mockClaimBalance = vi.fn().mockResolvedValue({ data: { hash: "tx123" }, error: null });
      const account = mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({ id: "cb1", amount: "10.0" }),
            balance({ id: "cb2", amount: "20.0" }),
          ],
          error: null,
        }),
        claimBalance: mockClaimBalance,
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();
      expect(screen.getByText("20.00")).toBeInTheDocument();
      expect(screen.getByText("2 pending")).toBeInTheDocument();

      const claimButtons = screen.getAllByRole("button", { name: "Claim" });
      fireEvent.click(claimButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText("10.00")).not.toBeInTheDocument();
      });
      expect(screen.getByText("20.00")).toBeInTheDocument();
      expect(screen.getByText("1 pending")).toBeInTheDocument();
      expect(account.claimBalance).toHaveBeenCalledWith("cb1");
    });
  });

  describe("balance ID copy", () => {
    function setupBalanceIdTest() {
      return mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [balance({ id: "BALANCE_ID_1234567890", amount: "5.0" })],
          error: null,
        }),
        claimBalance: vi.fn(),
      });
    }

    function stubClipboard() {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });
      return writeText;
    }

    it("shows balance ID", async () => {
      setupBalanceIdTest();
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("5.00")).toBeInTheDocument();
    });

    it("copies balance ID to clipboard on click", async () => {
      const writeText = stubClipboard();
      setupBalanceIdTest();
      render(<ClaimableBalanceCard />);
      await screen.findByText("5.00");
      fireEvent.click(screen.getByRole("button", { name: /copy balance id/i }));
      expect(writeText).toHaveBeenCalledWith("BALANCE_ID_1234567890");
    });

    it("shows copied state briefly after copying balance ID", async () => {
      stubClipboard();
      setupBalanceIdTest();
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("5.00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /copy balance id/i }));
      expect(screen.getByRole("button", { name: /balance id copied/i })).toBeInTheDocument();
    });

    it("does not blow up when the clipboard write is rejected", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
        configurable: true,
        writable: true,
      });
      setupBalanceIdTest();
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("5.00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /copy balance id/i }));
      expect(screen.getByRole("button", { name: /balance id copied/i })).toBeInTheDocument();
    });
  });

  describe("predicate expiry disabled state", () => {
    it("disables Claim button and shows Expired badge when predicate has expired timebound", async () => {
      const expiredTime = Date.now() - 10000;
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({
              id: "cb-expired",
              amount: "100.0",
              claimants: [
                { destination: "GDEF", predicate: { timeBound: { start: 0, end: expiredTime } } },
              ],
            } as Partial<ClaimableBalance>),
          ],
          error: null,
        }),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("Expired")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Claim" })).toBeDisabled();
    });

    it("keeps Claim button enabled when predicate is unconditional", async () => {
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [balance({ id: "cb-active", amount: "50.0" })],
          error: null,
        }),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("50.00")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Claim" })).not.toBeDisabled();
    });

    it("keeps Claim button enabled when predicate has a future timebound", async () => {
      const futureTime = Date.now() + 100000;
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({
              id: "cb-future",
              amount: "25.0",
              claimants: [
                { destination: "GDEF", predicate: { timeBound: { start: 0, end: futureTime } } },
              ],
            } as Partial<ClaimableBalance>),
          ],
          error: null,
        }),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("25.00")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Claim" })).not.toBeDisabled();
    });
  });

  describe("confirmThreshold dialog", () => {
    function setupThresholdTest(amount: string) {
      return mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [balance({ id: "cb-threshold", amount })],
          error: null,
        }),
        claimBalance: vi.fn().mockResolvedValue({ data: { hash: "tx123" }, error: null }),
      });
    }

    it("shows confirmation dialog when amount exceeds threshold", async () => {
      setupThresholdTest("5000.0");
      render(<ClaimableBalanceCard confirmThreshold="1000" />);
      expect(await screen.findByText("5,000.00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      expect(await screen.findByText("Confirm Claim")).toBeInTheDocument();
    });

    it("does not show confirmation dialog when amount is below threshold", async () => {
      setupThresholdTest("5.0");
      render(<ClaimableBalanceCard confirmThreshold="1000" />);
      expect(await screen.findByText("5.00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      await waitFor(() => expect(screen.queryByText("5.00")).not.toBeInTheDocument());
      expect(screen.queryByText("Confirm Claim")).not.toBeInTheDocument();
    });

    it("cancels the dialog and does not claim", async () => {
      const account = setupThresholdTest("5000.0");
      render(<ClaimableBalanceCard confirmThreshold="1000" />);
      expect(await screen.findByText("5,000.00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      expect(await screen.findByText("Confirm Claim")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByText("Confirm Claim")).not.toBeInTheDocument();
      expect(account.claimBalance).not.toHaveBeenCalled();
      expect(screen.getByText("5,000.00")).toBeInTheDocument();
    });

    it("proceeds with claim after confirming the dialog and removes the row", async () => {
      setupThresholdTest("5000.0");
      render(<ClaimableBalanceCard confirmThreshold="1000" />);
      expect(await screen.findByText("5,000.00")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      expect(await screen.findByText("Confirm Claim")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
      await waitFor(() => expect(screen.queryByText("5,000.00")).not.toBeInTheDocument());
      expect(await screen.findByText(/no claimable balances/i)).toBeInTheDocument();
    });
  });

  describe("live predicate countdown (#666)", () => {
    it("switches to Expired when a predicate deadline passes without a reload", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const deadline = Date.now() + 3000;
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({
              id: "cb-timer",
              amount: "10.0",
              claimants: [
                { destination: "GDEF", predicate: { timeBound: { start: 0, end: deadline } } },
              ],
            } as Partial<ClaimableBalance>),
          ],
          error: null,
        }),
        claimBalance: vi.fn(),
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();
      expect(screen.queryByText("Expired")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByText("Expired")).toBeInTheDocument();
      vi.useRealTimers();
    });

    it("keeps other cards claimable while one claim is in flight", async () => {
      let resolveClaim: ((value: unknown) => void) | undefined;
      const pending = new Promise((resolve) => {
        resolveClaim = resolve;
      });
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({ id: "cb1", amount: "10.0" }),
            balance({ id: "cb2", amount: "20.0" }),
          ],
          error: null,
        }),
        claimBalance: vi.fn().mockReturnValue(pending),
      });

      render(<ClaimableBalanceCard />);
      expect(await screen.findByText("10.00")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: "Claim" })[0]);

      const buttons = screen.getAllByRole("button", { name: /Claim/ });
      expect(buttons[1]).not.toBeDisabled();

      resolveClaim?.({ data: { hash: "x" }, error: null });
    });
  });

  describe("combined: balance ID + expiry + confirmThreshold", () => {
    it("renders all three b17 features together for a single balance", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });
      const futureTime = Date.now() + 100000;
      mockConnected({
        getClaimableBalances: vi.fn().mockResolvedValue({
          data: [
            balance({
              id: "FEATURE_COMBO_ID_123",
              asset: "USDC:GBPL",
              amount: "2500.0",
              sponsor: "GDEF456",
              claimants: [
                { destination: "GDEF456", predicate: { timeBound: { start: 0, end: futureTime } } },
              ],
            } as Partial<ClaimableBalance>),
          ],
          error: null,
        }),
        claimBalance: vi.fn(),
      });
      render(<ClaimableBalanceCard confirmThreshold="2000" />);

      expect(await screen.findByText("2,500.00")).toBeInTheDocument();

      expect(screen.queryByText("Expired")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Claim" })).not.toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      expect(await screen.findByText("Confirm Claim")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /copy balance id/i })).toBeInTheDocument();
    });
  });

  // Issue #920: optimistic removal, clipboard copy and expiry badge coverage.
  describe("onClaimed callback (#920)", () => {
    it("calls onClaimed with the balance id once the claim resolves", async () => {
      const onClaimed = vi.fn();
      const account = mockConnected({
        getClaimableBalances: vi.fn(),
        claimBalance: vi.fn().mockResolvedValue({ data: { hash: "tx123" }, error: null }),
      });

      render(<BalanceRow cb={balance({ id: "cb-optimistic" })} onClaimed={onClaimed} />);
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));

      await waitFor(() => expect(onClaimed).toHaveBeenCalledTimes(1));
      expect(onClaimed).toHaveBeenCalledWith("cb-optimistic");
      expect(account.claimBalance).toHaveBeenCalledWith("cb-optimistic");
    });

    it("does not call onClaimed until the claim has resolved", async () => {
      let resolveClaim: ((value: unknown) => void) | undefined;
      const onClaimed = vi.fn();
      mockConnected({
        getClaimableBalances: vi.fn(),
        claimBalance: vi.fn().mockReturnValue(
          new Promise((resolve) => {
            resolveClaim = resolve;
          }),
        ),
      });

      render(<BalanceRow cb={balance({ id: "cb-pending" })} onClaimed={onClaimed} />);
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      expect(onClaimed).not.toHaveBeenCalled();

      await act(async () => {
        resolveClaim?.({ data: { hash: "tx" }, error: null });
      });
      expect(onClaimed).toHaveBeenCalledWith("cb-pending");
    });

    it.each([
      ["an error result", () => Promise.resolve({ data: null, error: "Network error" })],
      ["an empty result", () => Promise.resolve({ data: null, error: null })],
      ["a rejection", () => Promise.reject(new Error("Wallet rejected"))],
    ])("does not call onClaimed when the claim resolves with %s", async (_label, result) => {
      const onClaimed = vi.fn();
      mockConnected({
        getClaimableBalances: vi.fn(),
        claimBalance: vi.fn().mockImplementation(result),
      });

      render(<BalanceRow cb={balance({ id: "cb-fail" })} onClaimed={onClaimed} />);
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));

      expect(await screen.findByTestId("claim-error-cb-fail")).toBeInTheDocument();
      expect(onClaimed).not.toHaveBeenCalled();
    });

    it("calls onClaimed only after the confirmation dialog is accepted", async () => {
      const onClaimed = vi.fn();
      mockConnected({
        getClaimableBalances: vi.fn(),
        claimBalance: vi.fn().mockResolvedValue({ data: { hash: "tx123" }, error: null }),
      });

      render(
        <BalanceRow
          cb={balance({ id: "cb-big", amount: "5000.0" })}
          confirmThreshold="1000"
          onClaimed={onClaimed}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));
      expect(screen.getByText("Confirm Claim")).toBeInTheDocument();
      expect(onClaimed).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
      await waitFor(() => expect(onClaimed).toHaveBeenCalledWith("cb-big"));
    });

    it("shows a Claimed badge in place of the Claim button when used standalone", async () => {
      mockConnected({
        getClaimableBalances: vi.fn(),
        claimBalance: vi.fn().mockResolvedValue({ data: { hash: "tx123" }, error: null }),
      });

      render(<BalanceRow cb={balance({ id: "cb-standalone" })} />);
      fireEvent.click(screen.getByRole("button", { name: "Claim" }));

      expect(await screen.findByText("Claimed")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Claim" })).not.toBeInTheDocument();
    });
  });

  describe("clipboard copy (#920)", () => {
    function stubClipboard() {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
        writable: true,
      });
      return writeText;
    }

    it("writes the full (untruncated) balance id to the clipboard", () => {
      const writeText = stubClipboard();
      const id = "00000000da0d57da7d4850e7fc10d2a9d0ebc731f7afb40574c03395b17d49149b91f5be";
      mockConnected({ getClaimableBalances: vi.fn(), claimBalance: vi.fn() });

      render(<BalanceRow cb={balance({ id })} />);
      // Only the truncated form is rendered...
      expect(screen.queryByText(id)).not.toBeInTheDocument();
      expect(screen.getByText("00000000...91f5be")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /copy balance id/i }));

      // ...but the clipboard receives the complete id.
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith(id);
    });

    it("reverts the copied indicator after a short delay", () => {
      vi.useFakeTimers();
      stubClipboard();
      mockConnected({ getClaimableBalances: vi.fn(), claimBalance: vi.fn() });

      render(<BalanceRow cb={balance({ id: "cb-copy" })} />);
      fireEvent.click(screen.getByRole("button", { name: /copy balance id/i }));

      const copied = screen.getByRole("button", { name: /balance id copied/i });
      expect(copied).toHaveTextContent("✓");

      act(() => {
        vi.advanceTimersByTime(1600);
      });

      expect(screen.getByRole("button", { name: /copy balance id/i })).toHaveTextContent("⎘");
      vi.useRealTimers();
    });

    it("does not throw when the clipboard API is unavailable", () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      mockConnected({ getClaimableBalances: vi.fn(), claimBalance: vi.fn() });

      render(<BalanceRow cb={balance({ id: "cb-noclip" })} />);
      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: /copy balance id/i })),
      ).not.toThrow();
      expect(screen.getByRole("button", { name: /balance id copied/i })).toBeInTheDocument();
    });

    it("does not trigger a claim when copying the id", () => {
      stubClipboard();
      const account = mockConnected({ getClaimableBalances: vi.fn(), claimBalance: vi.fn() });

      render(<BalanceRow cb={balance({ id: "cb-copy-only" })} />);
      fireEvent.click(screen.getByRole("button", { name: /copy balance id/i }));

      expect(account.claimBalance).not.toHaveBeenCalled();
    });
  });

  describe("expiry status badges (#920)", () => {
    const NOW = 1_700_000_000_000;

    function renderWithPredicate(predicate: unknown) {
      mockConnected({ getClaimableBalances: vi.fn(), claimBalance: vi.fn() });
      return render(
        <BalanceRow
          cb={balance({
            id: "cb-predicate",
            claimants: [{ destination: "GDEF", predicate }],
          } as Partial<ClaimableBalance>)}
          currentTime={NOW}
        />,
      );
    }

    it("renders an error-styled Expired badge and a disabled, dimmed Claim button for an expired balance", () => {
      renderWithPredicate({ timeBound: { start: 0, end: NOW - 1 } });

      const badge = screen.getByText("Expired");
      expect(badge).toHaveClass("bg-error-dim", "text-red");

      const claim = screen.getByRole("button", { name: "Claim" });
      expect(claim).toBeDisabled();
      expect(claim).toHaveClass("opacity-40", "cursor-not-allowed");
    });

    it("renders no Expired badge and an enabled Claim button for a claimable balance", () => {
      renderWithPredicate({ timeBound: { start: 0, end: NOW + 60_000 } });

      expect(screen.queryByText("Expired")).not.toBeInTheDocument();
      const claim = screen.getByRole("button", { name: "Claim" });
      expect(claim).toBeEnabled();
      expect(claim).not.toHaveClass("opacity-40");
    });

    it("always shows the asset badge with its teal styling regardless of expiry", () => {
      renderWithPredicate({ timeBound: { start: 0, end: NOW - 1 } });
      expect(screen.getByText("XLM")).toHaveClass("text-teal");
    });

    it.each([
      ["a not-yet-started time bound", { timeBound: { start: NOW + 1000 } }, true],
      ["a past endTime", { endTime: NOW - 1 }, true],
      ["an unconditional predicate", { unconditional: true }, false],
      ["an AND of an expired and a valid bound", { and: [{ endTime: NOW - 1 }, { endTime: NOW + 1000 }] }, false],
      ["an AND of two expired bounds", { and: [{ endTime: NOW - 1 }, { endTime: NOW - 2 }] }, true],
      ["an OR containing an expired bound", { or: [{ endTime: NOW - 1 }, { unconditional: true }] }, true],
      ["a NOT of an expired bound", { not: { endTime: NOW - 1 } }, false],
    ])("treats %s as expired=%s", (_label, predicate, expired) => {
      renderWithPredicate(predicate);
      if (expired) {
        expect(screen.getByText("Expired")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Claim" })).toBeDisabled();
      } else {
        expect(screen.queryByText("Expired")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Claim" })).toBeEnabled();
      }
    });

    it("flips from claimable to Expired when currentTime passes the deadline", () => {
      mockConnected({ getClaimableBalances: vi.fn(), claimBalance: vi.fn() });
      const cb = balance({
        id: "cb-rerender",
        claimants: [{ destination: "GDEF", predicate: { endTime: NOW + 1000 } }],
      } as Partial<ClaimableBalance>);

      const { rerender } = render(<BalanceRow cb={cb} currentTime={NOW} />);
      expect(screen.queryByText("Expired")).not.toBeInTheDocument();

      rerender(<BalanceRow cb={cb} currentTime={NOW + 2000} />);
      expect(screen.getByText("Expired")).toHaveClass("bg-error-dim");
      expect(screen.getByRole("button", { name: "Claim" })).toBeDisabled();
    });
  });
});
