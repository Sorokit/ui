import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractEventFeed } from "./ContractEventFeed";
import { getClient } from "@/lib/client";
import type { SorokitClient, ContractEvent } from "@/lib/client";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

const CONTRACT_ID = "CAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

const MOCK_EVENT: ContractEvent = {
  id: "evt-1",
  type: "transfer",
  ledger: 123456,
  topics: ["GA...from", "GB...to"],
  value: { amount: 100 },
  createdAt: new Date("2024-01-01T12:00:00Z").toISOString(),
};

function mockGetEvents(result: { data: ContractEvent[] | null; error: string | null }) {
  vi.mocked(getClient).mockReturnValue({
    soroban: {
      getEvents: vi.fn().mockResolvedValue(result),
    },
  } as unknown as SorokitClient);
}

describe("ContractEventFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading skeleton on initial load", () => {
    vi.mocked(getClient).mockReturnValue({
      soroban: {
        getEvents: vi.fn().mockReturnValue(new Promise(() => {})),
      },
    } as unknown as SorokitClient);

    const { container } = render(
      <ContractEventFeed contractId={CONTRACT_ID} />,
    );
    act(() => { vi.advanceTimersByTime(0); });
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders events after loading", async () => {
    mockGetEvents({ data: [MOCK_EVENT], error: null });

    render(<ContractEventFeed contractId={CONTRACT_ID} />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("transfer")).toBeInTheDocument();
    });
  });

  it("renders 'No events found' when the events array is empty", async () => {
    mockGetEvents({ data: [], error: null });

    render(<ContractEventFeed contractId={CONTRACT_ID} />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("No events found")).toBeInTheDocument();
    });
  });

  it("renders an error message when getEvents returns an error", async () => {
    mockGetEvents({ data: null, error: "Contract not found" });

    render(<ContractEventFeed contractId={CONTRACT_ID} />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText("Contract not found")).toBeInTheDocument();
    });
  });

  it("starts polling when pollInterval > 0 and live is true", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getClient).mockReturnValue({
      soroban: { getEvents },
    } as unknown as SorokitClient);

    render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={500} />);

    // Initial load
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    // Advance past one poll interval
    act(() => { vi.advanceTimersByTime(500); });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
  });

  it("stops polling when the Live/Paused toggle is clicked", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getClient).mockReturnValue({
      soroban: { getEvents },
    } as unknown as SorokitClient);

    render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={500} />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    // Toggle to Paused
    fireEvent.click(screen.getByRole("button", { name: /live/i }));
    const callsAfterPause = getEvents.mock.calls.length;

    // Advance well past interval — no new calls should happen
    act(() => { vi.advanceTimersByTime(1500); });
    expect(getEvents).toHaveBeenCalledTimes(callsAfterPause);
  });

  it("triggers a new load when contractId changes", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getClient).mockReturnValue({
      soroban: { getEvents },
    } as unknown as SorokitClient);

    const { rerender } = render(
      <ContractEventFeed contractId={CONTRACT_ID} />,
    );
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    const NEW_ID = "CBBB4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";
    rerender(<ContractEventFeed contractId={NEW_ID} />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(getEvents).toHaveBeenCalledTimes(2);
      expect(getEvents).toHaveBeenLastCalledWith(NEW_ID, 10);
    });
  });

  // ── Accessibility (#120) ──────────────────────────────────────────────────
  describe("accessibility", () => {
    it("reflects polling state on the Live/Paused toggle via aria-pressed", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={500} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

      const toggle = screen.getByRole("button", { name: /live/i });
      // Live while polling…
      expect(toggle).toHaveAttribute("aria-pressed", "true");

      // …and Paused after toggling off.
      fireEvent.click(toggle);
      expect(
        screen.getByRole("button", { name: /paused/i }),
      ).toHaveAttribute("aria-pressed", "false");
    });

    it("announces new events through a polite live region", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [MOCK_EVENT], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      const { container } = render(
        <ContractEventFeed contractId={CONTRACT_ID} />,
      );
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() =>
        expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument(),
      );
    });
  });
});
