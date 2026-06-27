import { act,fireEvent, render, screen } from "@testing-library/react";
import { afterEach,beforeEach, describe, expect, it, vi } from "vitest";

import { useSorokit } from "@/context/useSorokit";
import type { SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

import { SorobanScreen } from "./SorobanScreen";

vi.mock("@/context/useSorokit", () => ({
  useSorokit: vi.fn(),
}));

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

function mockClient() {
  vi.mocked(getClient).mockReturnValue({
    soroban: {
      invokeContract: vi.fn().mockReturnValue(new Promise(() => {})),
      getEvents: vi.fn().mockReturnValue(new Promise(() => {})),
    },
  } as unknown as SorokitClient);
}

describe("SorobanScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(useSorokit).mockReturnValue({
      isConnected: true,
      address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
    } as unknown as ReturnType<typeof useSorokit>);
    mockClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the screen heading", () => {
    render(<SorobanScreen />);
    expect(screen.getByText("Soroban")).toBeInTheDocument();
  });

  it("does not render ContractEventFeed when contractId is empty", () => {
    render(<SorobanScreen />);
    expect(screen.queryByText("Contract Events")).not.toBeInTheDocument();
  });

  it("renders ContractEventFeed when a contractId is entered", () => {
    render(<SorobanScreen />);

    const input = screen.getByPlaceholderText(/C\.\.\./i);
    fireEvent.change(input, {
      target: { value: "CAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA" },
    });

    act(() => { vi.advanceTimersByTime(0); });

    expect(screen.getByText("Contract Events")).toBeInTheDocument();
  });

  it("hides ContractEventFeed again when contractId is cleared", () => {
    render(<SorobanScreen />);

    const input = screen.getByPlaceholderText(/C\.\.\./i);
    fireEvent.change(input, {
      target: { value: "CAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA" },
    });
    act(() => { vi.advanceTimersByTime(0); });
    expect(screen.getByText("Contract Events")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText("Contract Events")).not.toBeInTheDocument();
  });

  it("does not render ContractEventFeed for a whitespace-only contractId", () => {
    render(<SorobanScreen />);

    const input = screen.getByPlaceholderText(/C\.\.\./i);
    fireEvent.change(input, { target: { value: "   " } });

    expect(screen.queryByText("Contract Events")).not.toBeInTheDocument();
  });
});
