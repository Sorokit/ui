import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { InvokeParams,SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

import { SorobanInvokeButton } from "./SorobanInvokeButton";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

const PARAMS: InvokeParams = {
  contractId: "CABC...CONTRACT",
  method: "transfer",
  args: [],
};

function mockInvokeContract(result: { data: unknown; error: string | null; status: string }) {
  vi.mocked(getClient).mockReturnValue({
    soroban: {
      invokeContract: vi.fn().mockResolvedValue(result),
    },
  } as unknown as SorokitClient);
}

describe("SorobanInvokeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSorokit).mockReturnValue({ isConnected: true, get client() { return getClient(); } } as unknown as ReturnType<typeof useSorokit>);
  });

  it("renders the method name as the button label by default", () => {
    mockInvokeContract({ data: null, error: null, status: "idle" });
    render(<SorobanInvokeButton params={PARAMS} />);
    expect(screen.getByRole("button", { name: "transfer()" })).toBeInTheDocument();
  });

  it("renders a custom label when the label prop is set", () => {
    mockInvokeContract({ data: null, error: null, status: "idle" });
    render(<SorobanInvokeButton params={PARAMS} label="Send" />);
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("shows 'Invoking {method}…' as the loading label while an invocation is in flight", async () => {
    let resolveInvoke: (value: {
      data: unknown;
      error: string | null;
      status: string;
    }) => void;
    vi.mocked(getClient).mockReturnValue({
      soroban: {
        invokeContract: vi
          .fn()
          .mockImplementation(() => new Promise((resolve) => { resolveInvoke = resolve; })),
      },
    } as unknown as SorokitClient);

    render(<SorobanInvokeButton params={PARAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    const button = screen.getByRole("button");
    expect(button.textContent).toContain("Invoking transfer…");
    expect(button).toBeDisabled();

    await act(async () => {
      resolveInvoke!({ data: { ok: true }, error: null, status: "success" });
    });
    expect(
      screen.getByRole("button", { name: "transfer()" }),
    ).toHaveTextContent("transfer()");
  });

  it("shows a generic 'Invoking…' loading label when a custom label is provided", async () => {
    let resolveInvoke: (value: {
      data: unknown;
      error: string | null;
      status: string;
    }) => void;
    vi.mocked(getClient).mockReturnValue({
      soroban: {
        invokeContract: vi
          .fn()
          .mockImplementation(() => new Promise((resolve) => { resolveInvoke = resolve; })),
      },
    } as unknown as SorokitClient);

    render(<SorobanInvokeButton params={PARAMS} label="Send" />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByRole("button").textContent).toContain("Invoking…");

    await act(async () => {
      resolveInvoke!({ data: { ok: true }, error: null, status: "success" });
    });
  });

  it("renders the tooltip prop as the button's title when connected", () => {
    mockInvokeContract({ data: null, error: null, status: "idle" });
    render(<SorobanInvokeButton params={PARAMS} tooltip="Runs transfer on-chain" />);
    expect(screen.getByRole("button", { name: "transfer()" })).toHaveAttribute(
      "title",
      "Runs transfer on-chain",
    );
  });

  it("falls back to a connect hint title when the wallet is not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      soroban: { invokeContract: vi.fn() },
    } as unknown as SorokitClient);

    render(<SorobanInvokeButton params={PARAMS} tooltip="Runs transfer on-chain" />);
    expect(screen.getByRole("button", { name: "transfer()" })).toHaveAttribute(
      "title",
      "Connect wallet to invoke",
    );
  });

  it("calls onSuccess with the returned data on a successful invocation", async () => {
    const onSuccess = vi.fn();
    mockInvokeContract({ data: { txHash: "abc" }, error: null, status: "success" });

    render(<SorobanInvokeButton params={PARAMS} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ txHash: "abc" }));
  });

  it("passes the invocation params to the client", async () => {
    const invokeContract = vi.fn().mockResolvedValue({
      data: { txHash: "abc" },
      error: null,
      status: "success",
    });
    vi.mocked(getClient).mockReturnValue({
      soroban: { invokeContract },
    } as unknown as SorokitClient);

    render(<SorobanInvokeButton params={PARAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(invokeContract).toHaveBeenCalledWith(PARAMS));
  });

  it("calls onError with the error message on a failed invocation", async () => {
    const onError = vi.fn();
    mockInvokeContract({ data: null, error: "Simulation failed", status: "error" });

    render(<SorobanInvokeButton params={PARAMS} onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    // friendlyError("Simulation failed") → "The contract call could not be simulated..."
    expect(onError.mock.calls[0]?.[0]).toMatch(/simulated/i);
  });

  it("shows Done badge on success", async () => {
    mockInvokeContract({ data: { result: 1 }, error: null, status: "success" });
    render(<SorobanInvokeButton params={PARAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    expect(screen.getByText(/"result": 1/)).toBeInTheDocument();
  });

  it("shows Failed badge on error", async () => {
    mockInvokeContract({ data: null, error: "Out of gas", status: "error" });
    render(<SorobanInvokeButton params={PARAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
  });

  it("renders the friendly error message in the result panel", async () => {
    // "Out of gas" doesn't match any friendlyError pattern → falls through to generic message
    mockInvokeContract({ data: null, error: "Out of gas", status: "error" });
    render(<SorobanInvokeButton params={PARAMS} showResult />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => screen.getByText("Failed"));
    expect(screen.getByText(/something went wrong while invoking/i)).toBeInTheDocument();
  });

  it("clears the success result when reset is clicked", async () => {
    mockInvokeContract({ data: { txHash: "abc" }, error: null, status: "success" });
    render(<SorobanInvokeButton params={PARAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Reset invocation result" }));

    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "transfer()" })).toBeEnabled();
  });

  it("hides the result block when showResult is false", async () => {
    mockInvokeContract({ data: { txHash: "abc" }, error: null, status: "success" });
    render(<SorobanInvokeButton params={PARAMS} showResult={false} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    expect(screen.queryByText("Result")).not.toBeInTheDocument();
    expect(screen.queryByText(/txHash/)).not.toBeInTheDocument();
  });

  it("hides the error block when showResult is false", async () => {
    mockInvokeContract({ data: null, error: "Out of gas", status: "error" });
    render(<SorobanInvokeButton params={PARAMS} showResult={false} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument());
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("caps the result container height with maxResultHeight for overflow", async () => {
    mockInvokeContract({ data: { txHash: "abc" }, error: null, status: "success" });
    render(<SorobanInvokeButton params={PARAMS} maxResultHeight={120} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    // The result container has a bounded max-height that scrolls on overflow.
    const resultScroller = screen.getByText(/txHash/).closest("div.overflow-y-auto");
    expect(resultScroller).toHaveStyle({ maxHeight: "120px" });
  });

  it("uses the default 200px max result height when maxResultHeight is not provided", async () => {
    mockInvokeContract({ data: { txHash: "abc" }, error: null, status: "success" });
    render(<SorobanInvokeButton params={PARAMS} />);
    fireEvent.click(screen.getByRole("button", { name: "transfer()" }));

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    const resultScroller = screen.getByText(/txHash/).closest("div.overflow-y-auto");
    expect(resultScroller).toHaveStyle({ maxHeight: "200px" });
  });

  it("disables the button and shows connect wallet hint when not connected", () => {
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: false,
    } as unknown as ReturnType<typeof useSorokit>);
    vi.mocked(getClient).mockReturnValue({
      soroban: { invokeContract: vi.fn() },
    } as unknown as SorokitClient);

    render(<SorobanInvokeButton params={PARAMS} />);
    expect(screen.getByRole("button", { name: "transfer()" })).toBeDisabled();
    expect(screen.getByText("Connect wallet to invoke")).toBeInTheDocument();
  });
});
