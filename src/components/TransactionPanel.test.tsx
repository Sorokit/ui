import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import { getClient } from "@/lib/client";

import { TransactionPanel } from "./TransactionPanel";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

const DEFAULT_FEE = { baseFee: "100", recommended: "100" };
const VALID_DEST = "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ";
const MOCK_SOURCE = "GBRPYHIL2CI3WHGSUJGY6O7SROQOMJG7QBCACN4QPKUOQNXJDGONXHPA";

/**
 * Builds a useSorokit() mock return value with `client` wired to the
 * getClient mock. Since #452/#453/#454/#455 the panel reads `client` from
 * the useSorokit() context (via `const { client } = useSorokit()`), so a
 * plain object literal with no `client` key makes submitTransaction short-
 * circuit at `if (!address || !client)` and report "Wallet not connected".
 * Every override in this file must go through this helper.
 */
function mockUseSorokitValue(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof useSorokit> {
  return {
    balances: [{ asset: "XLM", balance: "100" }],
    ...overrides,
    get client() {
      return "client" in overrides ? overrides.client : getClient();
    },
  } as unknown as ReturnType<typeof useSorokit>;
}

function mockGetClient(
  submitImpl: ReturnType<typeof vi.fn>,
  feeImpl: ReturnType<typeof vi.fn> = vi
    .fn()
    .mockResolvedValue({ data: DEFAULT_FEE, error: null }),
) {
  const clientObj = {
    transaction: {
      submit: submitImpl,
      estimateFee: feeImpl,
    },
  } as unknown as ReturnType<typeof getClient>;
  vi.mocked(getClient).mockReturnValue(clientObj);
  vi.mocked(useSorokit).mockReturnValue({
    address: MOCK_SOURCE,
    client: clientObj,
    isConnected: true,
    balances: [{ asset: "XLM", balance: "100" }],
  } as unknown as ReturnType<typeof useSorokit>);
}

/** Clicks the Send button (label varies by selected asset), waits for the confirmation modal, then confirms. */
async function reviewAndConfirm() {
  fireEvent.click(screen.getByRole("button", { name: /^Send (XLM|USDC)/ }));
  await screen.findByRole("dialog", { name: /confirm transaction/i });
  // act()-wrapped: submitTransaction's state updates can land before this
  // call returns when the mocked API resolves immediately (no artificial
  // delay), which otherwise trips React's "not wrapped in act(...)" warning.
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /confirm & sign/i }));
  });
}

describe("TransactionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokitValue({ address: "GABC", isConnected: true }),
    );
  });

  it("opens a confirmation modal before submitting, showing the operation, fee, and source account", async () => {
    mockGetClient(vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }));
    render(<TransactionPanel />);

    fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: VALID_DEST } });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Send (XLM|USDC)/ }));

    const dialog = await screen.findByRole("dialog", { name: /confirm transaction/i });
    expect(dialog).toHaveTextContent("Payment — 1 operation");
    expect(dialog).toHaveTextContent("Send 10 XLM to");
    expect(dialog).toHaveTextContent("100 stroops");
    expect(dialog).toHaveTextContent("GBRPYHIL...ONXHPA");
  });

  // Issue #581 — the Send Payment button submits the form natively
  // (type="submit"), linked to the form via its `form` attribute, instead of
  // re-dispatching a FormEvent handler through an unsafe `as unknown as`
  // onClick cast.
  it("renders the Send Payment button as a type=submit button tied to the form", () => {
    render(<TransactionPanel />);

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    const sendButton = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });
    expect(sendButton).toHaveAttribute("type", "submit");
    expect(sendButton).toHaveAttribute("form", form!.id);
  });

  it("does not submit until Confirm & Sign is clicked in the modal", async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
    mockGetClient(mockSubmit);
    render(<TransactionPanel />);

    fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: VALID_DEST } });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Send (XLM|USDC)/ }));

    await screen.findByRole("dialog", { name: /confirm transaction/i });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("cancelling the modal does not submit and returns to the form", async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
    mockGetClient(mockSubmit);
    render(<TransactionPanel />);

    fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: VALID_DEST } });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Send (XLM|USDC)/ }));

    await screen.findByRole("dialog", { name: /confirm transaction/i });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Destination Address")).toHaveValue(VALID_DEST);
  });

  it("handles loading, success, and error states", async () => {
    const mockSubmit = vi.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve({ data: { hash: "txhash123", ledger: 100 }, error: null }), 50);
      });
    });
    mockGetClient(mockSubmit);

    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");

    fireEvent.change(destInput, { target: { value: VALID_DEST } });
    fireEvent.change(amountInput, { target: { value: "10" } });

    await reviewAndConfirm();

    // Check success state
    expect(await screen.findByText(/Transaction submitted/i)).toBeInTheDocument();
    expect(screen.getByText("Ledger #100")).toBeInTheDocument();
    expect(screen.getByText("txhash123")).toBeInTheDocument();

    // Test "New Transaction" button resets state
    const newTxBtn = screen.getByRole("button", { name: /New Transaction/i });
    fireEvent.click(newTxBtn);

    expect(screen.getByLabelText("Destination Address")).toHaveValue("");
    expect(screen.getByLabelText("Amount (XLM)")).toHaveValue(null);
  });

  it("handles error state", async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ data: null, error: "Submission rejected by network" });
    mockGetClient(mockSubmit);

    render(<TransactionPanel />);

    fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: VALID_DEST } });
    fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

    await reviewAndConfirm();

    expect(await screen.findByText("Transaction failed")).toBeInTheDocument();
    expect(screen.getByText("Submission rejected by network")).toBeInTheDocument();
  });

  it("shows validation error for invalid destination address", async () => {
    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });

    // Initially no error should be visible
    expect(screen.queryByText("Stellar address must be 56 characters")).not.toBeInTheDocument();

    // Type invalid address
    fireEvent.change(destInput, { target: { value: "GDEF" } });
    fireEvent.change(amountInput, { target: { value: "10" } });

    // Validation error should show up because field is dirty and invalid
    expect(screen.getByText("Stellar address must be 56 characters")).toBeInTheDocument();
    // Submit button should be disabled because canSubmit is false
    expect(submitBtn).toBeDisabled();

    // Type valid address
    fireEvent.change(destInput, { target: { value: VALID_DEST } });
    expect(screen.getByText("Stellar address must be 56 characters")).toHaveClass("opacity-0");
    expect(submitBtn).not.toBeDisabled();
  });

  it("shows error if address is null at submit time", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokitValue({ address: null, isConnected: true }),
    );

    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });

    fireEvent.change(destInput, { target: { value: VALID_DEST } });
    fireEvent.change(amountInput, { target: { value: "10" } });

    // With no address, canSubmit is false (isConnected relies on address in
    // the real provider, but this mock sets isConnected independently) — the
    // panel should not even attempt to open the review modal.
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows self-payment warning when destination equals source address", async () => {
    vi.mocked(useSorokit).mockReturnValue(
      mockUseSorokitValue({
        address: VALID_DEST,
        isConnected: true,
      }),
    );

    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });

    fireEvent.change(destInput, {
      target: { value: VALID_DEST },
    });
    fireEvent.change(amountInput, { target: { value: "10" } });

    expect(
      screen.getByText("Destination is the same as your wallet address"),
    ).toBeInTheDocument();
    expect(submitBtn).not.toBeDisabled();
  });

  // ── Submit guard and keyboard submission (#555) ───────────────────────────
  describe("submit guard (#555)", () => {
    const validDest = VALID_DEST;

    it("disables the Send button when the destination is empty", () => {
      render(<TransactionPanel />);

      const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });
      expect(submitBtn).toBeDisabled();

      // Even a valid amount is not enough — destination must be filled in.
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "10" },
      });
      expect(submitBtn).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });
      expect(submitBtn).not.toBeDisabled();
    });

    it("disables the Send button when the amount is zero", () => {
      render(<TransactionPanel />);

      const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });

      // Zero is below the 0.0000001 minimum, so the guard rejects it.
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "0" },
      });
      expect(screen.getByText("Amount must be greater than 0")).toBeInTheDocument();
      expect(submitBtn).toBeDisabled();

      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "0.0000001" },
      });
      expect(submitBtn).not.toBeDisabled();
    });

    it("opens the confirmation modal when Enter is pressed on the submit button", async () => {
      // jsdom does not implement implicit form submission (Enter inside a
      // text field), so the keyboard path is exercised the way a browser's
      // implicit submission lands: Enter on the focused submit button.
      const user = userEvent.setup();
      mockGetClient(
        vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }),
      );
      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "10" },
      });

      screen.getByRole("button", { name: /^Send (XLM|USDC)/ }).focus();
      await user.keyboard("{Enter}");

      expect(
        await screen.findByRole("dialog", { name: /confirm transaction/i }),
      ).toBeInTheDocument();
    });

    it("submits directly without a modal when Enter is pressed in previewMode=false", async () => {
      const user = userEvent.setup();
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
      mockGetClient(mockSubmit);
      render(<TransactionPanel previewMode={false} />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "10" },
      });

      screen.getByRole("button", { name: /^Send (XLM|USDC)/ }).focus();
      await user.keyboard("{Enter}");

      await screen.findByText("Transaction submitted");
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ destination: validDest, amount: "10" }),
      );
    });
  });

  it("shows error for amount below minimum threshold", async () => {
    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });

    fireEvent.change(destInput, { target: { value: VALID_DEST } });

    // Type amount below 0.0000001
    fireEvent.change(amountInput, { target: { value: "0.00000005" } });

    expect(screen.getByText("Minimum amount is 0.0000001 XLM")).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Type valid amount
    fireEvent.change(amountInput, { target: { value: "0.0000001" } });
    expect(screen.getByText("Minimum amount is 0.0000001 XLM")).toHaveClass(
      "opacity-0",
    );
    expect(submitBtn).not.toBeDisabled();
  });

  it("shows insufficient balance error when amount exceeds XLM balance", async () => {
    vi.mocked(useSorokit).mockReturnValue({
      address: MOCK_SOURCE,
      isConnected: true,
      balances: [{ asset: "XLM", balance: "10" }],
    } as unknown as ReturnType<typeof useSorokit>);

    render(<TransactionPanel />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });

    fireEvent.change(destInput, { target: { value: VALID_DEST } });

    // Type amount exceeding balance (10 XLM)
    fireEvent.change(amountInput, { target: { value: "15" } });

    expect(screen.getByText("Insufficient balance")).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();

    // Type amount within balance
    fireEvent.change(amountInput, { target: { value: "5" } });
    expect(screen.getByText("Insufficient balance")).toHaveClass("opacity-0");
    expect(submitBtn).not.toBeDisabled();
  });

  it("allows submission when amount is within XLM balance", async () => {
    const mockSubmit = vi.fn().mockResolvedValue({ data: { hash: "txhash123", ledger: 100 }, error: null });
    mockGetClient(mockSubmit);

    render(<TransactionPanel previewMode={false} />);

    const destInput = screen.getByLabelText("Destination Address");
    const amountInput = screen.getByLabelText("Amount (XLM)");
    const submitBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });

    fireEvent.change(destInput, { target: { value: VALID_DEST } });
    fireEvent.change(amountInput, { target: { value: "50" } });

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(await screen.findByText("Transaction submitted")).toBeInTheDocument();
  });

  // ── Asset selector (#178) ─────────────────────────────────────────────────
  describe("asset selector", () => {
    const balances = [
      { asset: "XLM", balance: "100.0000000", assetType: "native" as const },
      {
        asset: "USDC",
        balance: "50.0000000",
        assetType: "credit_alphanum4" as const,
        assetCode: "USDC",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      },
    ];

    it("populates the asset selector with the correct asset codes from context balances", () => {
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true, get client() { return getClient(); },
        balances,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      const select = screen.getByLabelText("Asset") as HTMLSelectElement;
      const optionValues = Array.from(select.options).map((o) => o.value);
      expect(optionValues).toEqual(["XLM", "USDC"]);
    });

    it("updates the submitted asset when USDC is selected", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
      mockGetClient(mockSubmit);
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true, get client() { return getClient(); },
        balances,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      const select = screen.getByLabelText("Asset");
      fireEvent.change(select, { target: { value: "USDC" } });
      expect(select).toHaveValue("USDC");
      expect(screen.getByLabelText("Amount (USDC)")).toBeInTheDocument();

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });
      fireEvent.change(screen.getByLabelText("Amount (USDC)"), {
        target: { value: "10" },
      });

      await reviewAndConfirm();

      await screen.findByText(/Transaction submitted/i);
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ asset: "USDC" }),
      );
    });

    it("disables the asset selector when no balances are loaded", () => {
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true, get client() { return getClient(); },
        balances: [],
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      const select = screen.getByLabelText("Asset");
      expect(select).toBeDisabled();
      expect(select).toHaveTextContent("Loading assets…");
    });

    it("includes the asset's issuer in the submitted payload for a non-native asset (#565)", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
      mockGetClient(mockSubmit);
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true,
        balances,
        // getClient() here returns the object mockGetClient() just wired up
        // above; TransactionPanel reads `client` from context, not from a
        // direct getClient() call, so the mocked client has to be threaded
        // through explicitly for the submission to actually run.
        client: getClient(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Asset"), {
        target: { value: "USDC" },
      });
      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });
      fireEvent.change(screen.getByLabelText("Amount (USDC)"), {
        target: { value: "10" },
      });

      await reviewAndConfirm();

      await screen.findByText("Transaction submitted");
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: "USDC",
          assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      );
    });

    it("omits assetIssuer for the native XLM asset (#565)", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
      mockGetClient(mockSubmit);
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true,
        balances,
        client: getClient(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: validDest },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "10" },
      });

      await reviewAndConfirm();

      await screen.findByText("Transaction submitted");
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ asset: "XLM", assetIssuer: undefined }),
      );
    });

    it("shows the selected asset's balance as a hint near the amount input (#565)", () => {
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true,
        balances,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      expect(screen.getByText("Balance: 100.0000000 XLM")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Asset"), {
        target: { value: "USDC" },
      });
      expect(screen.getByText("Balance: 50.0000000 USDC")).toBeInTheDocument();
    });
  });

  // ── Acceptance criteria ────────────────────────────────────────────────────
  describe("acceptance criteria", () => {
    it("AC1: Send button is disabled when destination field is empty", () => {
      render(<TransactionPanel />);

      const sendBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });
      // destination is empty by default — button must be disabled
      expect(sendBtn).toBeDisabled();

      // filling the destination (and a valid amount) re-enables it
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "1" },
      });
      expect(sendBtn).not.toBeDisabled();
    });

    it("AC2: Send button is disabled when amount is 0", () => {
      render(<TransactionPanel />);

      const sendBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });

      // amount = 0 → below the 0.0000001 minimum → canSubmit is false
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "0" },
      });
      expect(sendBtn).toBeDisabled();
    });

    it("AC2: Send button is disabled when amount is negative", () => {
      render(<TransactionPanel />);

      const sendBtn = screen.getByRole("button", { name: /^Send (XLM|USDC)/ });
      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });

      // negative amount → isAmountValid is false → canSubmit is false
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "-5" },
      });
      expect(sendBtn).toBeDisabled();
    });

    it("AC3: Successful submit renders the transaction hash in the success panel", async () => {
      const TX_HASH = "abc123def456abc123def456abc123def456abc123def456abc123def456";
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: TX_HASH, ledger: 42 }, error: null });
      mockGetClient(mockSubmit);

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });

      await reviewAndConfirm();

      // Success panel must display the transaction hash
      expect(await screen.findByText("Transaction submitted")).toBeInTheDocument();
      expect(screen.getByText(TX_HASH)).toBeInTheDocument();
    });

    it("AC4: Failed submit renders the error message in the error panel", async () => {
      const ERROR_MSG = "op_underfunded";
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: null, error: ERROR_MSG });
      mockGetClient(mockSubmit);

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });

      await reviewAndConfirm();

      expect(await screen.findByText("Transaction failed")).toBeInTheDocument();
      expect(screen.getByText(ERROR_MSG)).toBeInTheDocument();
    });

    it("AC5: clicking 'New Transaction' after success resets the form back to idle state", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "somehash", ledger: 1 }, error: null });
      mockGetClient(mockSubmit);

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });

      await reviewAndConfirm();
      await screen.findByText("Transaction submitted");

      // The idle form (destination input) should NOT be present yet
      expect(screen.queryByLabelText("Destination Address")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "New Transaction" }));

      // After reset the idle form is shown again
      expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
      // Success panel is gone
      expect(screen.queryByText("Transaction submitted")).not.toBeInTheDocument();
      // Send button is disabled because fields are empty
      expect(screen.getByRole("button", { name: /^Send (XLM|USDC)/ })).toBeDisabled();
    });

    it("AC5: clicking 'New Transaction' after error resets the form back to idle state", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: null, error: "Insufficient balance" });
      mockGetClient(mockSubmit);

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });

      await reviewAndConfirm();
      await screen.findByText("Transaction failed");

      fireEvent.click(screen.getByRole("button", { name: "New Transaction" }));

      // Error panel is gone, idle form is shown
      expect(screen.queryByText("Transaction failed")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Destination Address")).toBeInTheDocument();
    });

    it("AC6: pressing Enter inside the destination field submits the form (opens review modal)", async () => {
      mockGetClient(
        vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }),
      );

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });

      // Enter key on the destination field should trigger form onSubmit → handleReview
      fireEvent.submit(screen.getByLabelText("Destination Address").closest("form")!);

      expect(
        await screen.findByRole("dialog", { name: /confirm transaction/i }),
      ).toBeInTheDocument();
    });

    it("AC6: pressing Enter inside the amount field submits the form (opens review modal)", async () => {
      mockGetClient(
        vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }),
      );

      render(<TransactionPanel />);

      fireEvent.change(screen.getByLabelText("Destination Address"), {
        target: { value: VALID_DEST },
      });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), {
        target: { value: "5" },
      });

      // Enter key on the amount field triggers form onSubmit → handleReview
      fireEvent.submit(screen.getByLabelText("Amount (XLM)").closest("form")!);

      expect(
        await screen.findByRole("dialog", { name: /confirm transaction/i }),
      ).toBeInTheDocument();
    });
  });

  describe("success state details", () => {
    it("shows a Successful badge and an explorer link on a known network", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "txhash123", ledger: 100 }, error: null });
      mockGetClient(mockSubmit);
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true,
        client: getClient(),
        balances: [{ asset: "XLM", balance: "100" }],
        network: {
          name: "testnet",
          passphrase: "Test SDF Network ; September 2015",
          rpcUrl: "https://soroban-testnet.stellar.org",
          horizonUrl: "https://horizon-testnet.stellar.org",
        },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await reviewAndConfirm();
      await screen.findByText(/Transaction submitted/i);

      expect(screen.getByText("Successful")).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /view on stellar expert/i });
      expect(link).toHaveAttribute(
        "href",
        "https://testnet.stellar.expert/explorer/public/tx/txhash123",
      );
    });
  });

  describe("default prop pre-fill (#351)", () => {
    it("pre-fills the destination input from defaultDestination", () => {
      const validDest = VALID_DEST;
      render(<TransactionPanel defaultDestination={validDest} />);
      expect(screen.getByLabelText("Destination Address")).toHaveValue(validDest);
    });

    it("pre-fills the amount input from defaultAmount", () => {
      render(<TransactionPanel defaultAmount="42.5" />);
      expect(screen.getByLabelText("Amount (XLM)")).toHaveValue(42.5);
    });

    it("pre-fills the memo input from defaultMemo", () => {
      render(<TransactionPanel defaultMemo="Invoice #1001" />);
      expect(screen.getByLabelText("Memo (optional)")).toHaveValue("Invoice #1001");
    });

    it("leaves all fields empty when no defaults are provided", () => {
      render(<TransactionPanel />);
      expect(screen.getByLabelText("Destination Address")).toHaveValue("");
      expect(screen.getByLabelText("Amount (XLM)")).toHaveValue(null);
      expect(screen.getByLabelText("Memo (optional)")).toHaveValue("");
    });
  });

  describe("onSuccess / onError callbacks (#351)", () => {
    it("calls onSuccess with the transaction result after a successful submit", async () => {
      const txResult = { hash: "txhash123", ledger: 100 };
      const mockSubmit = vi.fn().mockResolvedValue({ data: txResult, error: null });
      mockGetClient(mockSubmit);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      render(<TransactionPanel onSuccess={onSuccess} onError={onError} />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await reviewAndConfirm();
      await screen.findByText(/Transaction submitted/i);

      expect(onSuccess).toHaveBeenCalledWith(txResult);
      expect(onError).not.toHaveBeenCalled();
    });

    it("calls onError with the error message when the API returns an error", async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ data: null, error: "Insufficient balance" });
      mockGetClient(mockSubmit);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      render(<TransactionPanel onSuccess={onSuccess} onError={onError} />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await reviewAndConfirm();
      await screen.findByText("Transaction failed");

      await waitFor(() => { expect(onError).toHaveBeenCalledWith("Insufficient balance"); });
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("calls onError with the thrown error's message when submit rejects", async () => {
      const mockSubmit = vi.fn().mockRejectedValue(new Error("Network unreachable"));
      mockGetClient(mockSubmit);
      const onSuccess = vi.fn();
      const onError = vi.fn();

      render(<TransactionPanel onSuccess={onSuccess} onError={onError} />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await reviewAndConfirm();
      await screen.findByText("Transaction failed");

      await waitFor(() => { expect(onError).toHaveBeenCalledWith("Network unreachable"); });
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("does not throw when onSuccess/onError are not provided", async () => {
      const mockSubmit = vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null });
      mockGetClient(mockSubmit);

      render(<TransactionPanel />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await reviewAndConfirm();
      expect(await screen.findByText(/Transaction submitted/i)).toBeInTheDocument();
    });
  });

  describe("memo character counter (#351)", () => {
    it("shows the counter in the default (non-red) color under 28 characters", () => {
      render(<TransactionPanel />);
      const memoInput = screen.getByLabelText("Memo (optional)");
      fireEvent.change(memoInput, { target: { value: "a".repeat(27) } });

      const counter = screen.getByText("27/28");
      expect(counter.className).toContain("text-ink-3");
      expect(counter.className).not.toContain("text-red");
    });

    it("turns the counter red at exactly 28 characters", () => {
      render(<TransactionPanel />);
      const memoInput = screen.getByLabelText("Memo (optional)");
      fireEvent.change(memoInput, { target: { value: "a".repeat(28) } });

      const counter = screen.getByText("28/28");
      expect(counter.className).toContain("text-red");
    });

    it("stays red beyond 28 characters", () => {
      render(<TransactionPanel />);
      const memoInput = screen.getByLabelText("Memo (optional)");
      fireEvent.change(memoInput, { target: { value: "a".repeat(35) } });

      const counter = screen.getByText("35/28");
      expect(counter.className).toContain("text-red");
    });

    it("does not render a counter for memo type ID or None", () => {
      render(<TransactionPanel />);
      fireEvent.change(screen.getByLabelText("Memo type"), { target: { value: "none" } });
      expect(screen.queryByText(/^\d+\/28$/)).not.toBeInTheDocument();
    });
  });

  // ── previewMode (#315) ──────────────────────────────────────────────────────
  describe("previewMode", () => {
    it("submits directly without a confirmation modal when previewMode is false", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "txhash123", ledger: 100 }, error: null });
      mockGetClient(mockSubmit);
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true,
        network: { name: "testnet", passphrase: "x", rpcUrl: "x", horizonUrl: "x" },
        balances: [{ asset: "XLM", balance: "100" }],
        client: getClient(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel previewMode={false} />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Send (XLM|USDC)/ }));
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await screen.findByText(/Transaction submitted/i);
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ destination: validDest, amount: "10" }),
      );
    });

    it("shows a confirmation modal by default (previewMode omitted)", async () => {
      mockGetClient(vi.fn().mockResolvedValue({ data: { hash: "h1", ledger: 1 }, error: null }));
      render(<TransactionPanel />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });
      fireEvent.click(screen.getByRole("button", { name: /^Send (XLM|USDC)/ }));

      expect(await screen.findByRole("dialog", { name: /confirm transaction/i })).toBeInTheDocument();
    });
  });

  // ── Asset-specific Send button label (#343) ────────────────────────────────
  describe("send button label is asset-specific (#343)", () => {
    const balances = [
      { asset: "XLM", balance: "100.0000000", assetType: "native" as const },
      {
        asset: "USDC",
        balance: "50.0000000",
        assetType: "credit_alphanum4" as const,
        assetCode: "USDC",
        assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      },
    ];

    it("renders 'Send XLM' when only XLM is available", () => {
      render(<TransactionPanel />);
      expect(
        screen.getByRole("button", { name: "Send XLM" }),
      ).toBeInTheDocument();
    });

    it("renders 'Send XLM' while XLM is the selected asset (multi-balance wallet)", () => {
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true, get client() { return getClient(); },
        balances,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);
      expect(
        screen.getByRole("button", { name: "Send XLM" }),
      ).toBeInTheDocument();
    });

    it("renders 'Send USDC' once the user switches the asset select to USDC", () => {
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true, get client() { return getClient(); },
        balances,
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);
      fireEvent.change(screen.getByLabelText("Asset"), {
        target: { value: "USDC" },
      });
      expect(screen.getByRole("button", { name: "Send USDC" })).toBeInTheDocument();
    });
  });

  describe("success state details (#563)", () => {
    it("gives both explorer links an accessible aria-label (#563)", async () => {
      const mockSubmit = vi
        .fn()
        .mockResolvedValue({ data: { hash: "txhash123", ledger: 100 }, error: null });
      mockGetClient(mockSubmit);
      vi.mocked(useSorokit).mockReturnValue({
        address: "GABC",
        isConnected: true,
        network: { name: "testnet", passphrase: "x", rpcUrl: "x", horizonUrl: "x" },
        balances: [{ asset: "XLM", balance: "100" }],
        client: getClient(),
      } as unknown as ReturnType<typeof useSorokit>);

      render(<TransactionPanel />);

      const validDest = VALID_DEST;
      fireEvent.change(screen.getByLabelText("Destination Address"), { target: { value: validDest } });
      fireEvent.change(screen.getByLabelText("Amount (XLM)"), { target: { value: "10" } });

      await reviewAndConfirm();
      await screen.findByText("Transaction submitted");

      // Scoped to the two links this change touches — TransactionStatusTracker
      // renders its own separate explorer link lower in the panel.
      const hashLink = screen.getByText("txhash123").closest("a")!;
      const badgeLink = screen.getByRole("link", {
        name: /view on stellar expert/i,
      });
      for (const link of [hashLink, badgeLink]) {
        expect(link).toHaveAccessibleName(expect.stringContaining("txhash123"));
        expect(link).toHaveAccessibleName(expect.stringMatching(/opens in a new tab/i));
      }
    });
  });
});
