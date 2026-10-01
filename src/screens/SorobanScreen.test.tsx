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
    expect(screen.getAllByText("Soroban")).toHaveLength(2);
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

  describe("localStorage pre-fill and saved contracts (#347, #350)", () => {
    const CONTRACT_A = "CAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    const CONTRACT_B = "CBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNB";

    beforeEach(() => {
      localStorage.clear();
    });

    it("pre-fills contractId from the most recent entry in localStorage on mount", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify([CONTRACT_A, CONTRACT_B]),
      );

      render(<SorobanScreen />);

      const input = screen.getByPlaceholderText(/C\.\.\./i) as HTMLInputElement;
      expect(input.value).toBe(CONTRACT_A);
    });

    it("renders the saved-contracts dropdown with a single entry", () => {
      localStorage.setItem("sorokit-soroban-contract-history", JSON.stringify([CONTRACT_A]));

      render(<SorobanScreen />);

      expect(screen.getByText("Saved Contracts")).toBeInTheDocument();
    });

    it("lists saved contracts in a dropdown and applies one on click", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify([CONTRACT_A, CONTRACT_B]),
      );

      render(<SorobanScreen />);

      expect(screen.getByText("Saved Contracts")).toBeInTheDocument();
      const labelA = `${CONTRACT_A.slice(0, 6)}…${CONTRACT_A.slice(-4)}`;
      const labelB = `${CONTRACT_B.slice(0, 6)}…${CONTRACT_B.slice(-4)}`;
      expect(screen.getByText(labelA)).toBeInTheDocument();
      const buttonB = screen.getByText(labelB);
      expect(buttonB).toBeInTheDocument();

      fireEvent.click(buttonB);

      const input = screen.getByPlaceholderText(/C\.\.\./i) as HTMLInputElement;
      expect(input.value).toBe(CONTRACT_B);
    });

    it("ignores malformed JSON in localStorage and starts with an empty contractId", () => {
      localStorage.setItem("sorokit-soroban-contract-history", "not-json{{{");

      render(<SorobanScreen />);

      const input = screen.getByPlaceholderText(/C\.\.\./i) as HTMLInputElement;
      expect(input.value).toBe("");
      expect(screen.queryByText("Saved Contracts")).not.toBeInTheDocument();
    });

    it("does not pre-fill an invalid contract id that is first in history", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify(["not-a-valid-contract", CONTRACT_A]),
      );

      render(<SorobanScreen />);

      const input = screen.getByPlaceholderText(/C\.\.\./i) as HTMLInputElement;
      expect(input.value).toBe("");
    });

    it("removes a single saved contract from the dropdown and storage", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify([CONTRACT_A, CONTRACT_B]),
      );

      render(<SorobanScreen />);

      fireEvent.click(
        screen.getByRole("button", {
          name: `Remove ${CONTRACT_A.slice(0, 6)}…${CONTRACT_A.slice(-4)} from saved contracts`,
        }),
      );

      expect(screen.queryByText(`${CONTRACT_A.slice(0, 6)}…${CONTRACT_A.slice(-4)}`)).not.toBeInTheDocument();
      expect(
        JSON.parse(localStorage.getItem("sorokit-soroban-contract-history") ?? "[]"),
      ).toEqual([CONTRACT_B]);
    });

    it("reads localStorage.getItem exactly once on mount, not on subsequent re-renders (#815)", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify([CONTRACT_A]),
      );

      const getSpy = vi.spyOn(window.localStorage, "getItem");

      const { rerender } = render(<SorobanScreen />);

      // Record how many times getItem was called during the initial mount.
      const callsAfterMount = getSpy.mock.calls.length;
      expect(callsAfterMount).toBeGreaterThan(0);

      // Trigger two additional re-renders by updating the context mock.
      rerender(<SorobanScreen />);
      rerender(<SorobanScreen />);

      // getItem must not have been called any additional times after mount.
      expect(getSpy.mock.calls.length).toBe(callsAfterMount);

      getSpy.mockRestore();
    });

    it("clears all saved contracts", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify([CONTRACT_A, CONTRACT_B]),
      );

      render(<SorobanScreen />);

      fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

      expect(screen.queryByText("Saved Contracts")).not.toBeInTheDocument();
      expect(
        JSON.parse(localStorage.getItem("sorokit-soroban-contract-history") ?? "[]"),
      ).toEqual([]);
    });

    it("shows the full contract id as a title on each saved-contract button", () => {
      localStorage.setItem(
        "sorokit-soroban-contract-history",
        JSON.stringify([CONTRACT_A]),
      );

      render(<SorobanScreen />);

      expect(screen.getByTitle(CONTRACT_A)).toBeInTheDocument();
    });
  });

  describe("Stellar Expert link (#347, #350)", () => {
    const CONTRACT_ID = "CAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

    beforeEach(() => {
      localStorage.clear();
    });

    it("links to the testnet Stellar Expert contract page", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
        network: { name: "testnet" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<SorobanScreen />);
      const input = screen.getByPlaceholderText(/C\.\.\./i);
      fireEvent.change(input, { target: { value: CONTRACT_ID } });

      const link = screen.getByRole("link", { name: /Stellar Expert/i });
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
      );
    });

    it("links to the public (mainnet) Stellar Expert contract page", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
        network: { name: "mainnet" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<SorobanScreen />);
      const input = screen.getByPlaceholderText(/C\.\.\./i);
      fireEvent.change(input, { target: { value: CONTRACT_ID } });

      const link = screen.getByRole("link", { name: /Stellar Expert/i });
      expect(link).toHaveAttribute(
        "href",
        `https://stellar.expert/explorer/public/contract/${CONTRACT_ID}`,
      );
    });

    it("renders no Stellar Expert link for an unrecognized network", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
        network: { name: "futurenet" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<SorobanScreen />);
      const input = screen.getByPlaceholderText(/C\.\.\./i);
      fireEvent.change(input, { target: { value: CONTRACT_ID } });

      expect(screen.queryByRole("link", { name: /Stellar Expert/i })).not.toBeInTheDocument();
    });

    it("renders no Stellar Expert link when contractId is empty", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
        network: { name: "testnet" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<SorobanScreen />);

      expect(screen.queryByRole("link", { name: /Stellar Expert/i })).not.toBeInTheDocument();
    });

    it("renders no Stellar Expert link for a non-empty but invalid contract id", () => {
      vi.mocked(useSorokit).mockReturnValue({
        isConnected: true,
        address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA",
        network: { name: "testnet" },
      } as unknown as ReturnType<typeof useSorokit>);

      render(<SorobanScreen />);
      const input = screen.getByPlaceholderText(/C\.\.\./i);
      fireEvent.change(input, { target: { value: "not-a-valid-contract" } });

      expect(screen.queryByRole("link", { name: /Stellar Expert/i })).not.toBeInTheDocument();
    });
  });
});
