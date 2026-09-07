import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach,describe, expect, it, vi } from "vitest";

import type { ContractEvent,SorokitClient } from "@/lib/client";
import { getClient } from "@/lib/client";

import { ContractEventFeed } from "./ContractEventFeed";

vi.mock("@/lib/client", () => ({
  getClient: vi.fn(),
}));

// Issue #442 / context refactor: the components read their client from
// SorokitContext, so the hook is routed at the same `getClient` mock every test
// below configures. Without this the mocked client never reaches the component.
vi.mock("@/context/useSorokit", async () => {
  const { getClient } = await import("@/lib/client");
  return {
    useSorokit: () => ({
      client: getClient(),
      isConnected: true,
      address: "GTEST",
    }),
  };
});


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

const mockCreateObjectURL = vi.fn(() => "blob:mock");
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

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

  it("fetches events on mount with the contractId and the default limit", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [MOCK_EVENT], error: null });
    vi.mocked(getClient).mockReturnValue({
      soroban: { getEvents },
    } as unknown as SorokitClient);

    render(<ContractEventFeed contractId={CONTRACT_ID} />);
    act(() => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(getEvents).toHaveBeenCalledWith(CONTRACT_ID, 10, undefined);
    });
    expect(getEvents).toHaveBeenCalledTimes(1);
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

  it("restarts polling when the Live/Paused toggle is turned back on", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getClient).mockReturnValue({
      soroban: { getEvents },
    } as unknown as SorokitClient);

    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      },
    );

    render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={500} />);
    act(() => { vi.advanceTimersByTime(0); });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    // Pause polling.
    fireEvent.click(screen.getByRole("button", { name: /live/i }));
    const callsAfterPause = getEvents.mock.calls.length;

    act(() => { vi.advanceTimersByTime(1500); });
    expect(getEvents).toHaveBeenCalledTimes(callsAfterPause);

    // Resume polling — a fresh interval starts, so one more call fires per
    // poll interval.
    fireEvent.click(screen.getByRole("button", { name: /paused/i }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(getEvents).toHaveBeenCalledTimes(callsAfterPause + 1);

    act(() => { vi.advanceTimersByTime(500); });
    expect(getEvents).toHaveBeenCalledTimes(callsAfterPause + 2);
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
      expect(getEvents).toHaveBeenLastCalledWith(NEW_ID, 10, undefined);
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

  // ── Event type filtering (#263) ───────────────────────────────────────────
  describe("event type filtering", () => {
    const MULTI_TYPE_EVENTS: ContractEvent[] = [
      { ...MOCK_EVENT, id: "evt-transfer", type: "transfer" },
      { ...MOCK_EVENT, id: "evt-mint", type: "mint" },
      { ...MOCK_EVENT, id: "evt-burn", type: "burn" },
    ];

    it("renders a toggle button per distinct event type present in the feed", async () => {
      mockGetEvents({ data: MULTI_TYPE_EVENTS, error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /transfer \(1\)/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /mint \(1\)/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /burn \(1\)/i })).toBeInTheDocument();
      });
    });

    it("shows every type as active by default", async () => {
      mockGetEvents({ data: MULTI_TYPE_EVENTS, error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /transfer \(1\)/i })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      });
    });

    it("filters the displayed events when a type toggle is clicked", async () => {
      mockGetEvents({ data: MULTI_TYPE_EVENTS, error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByRole("button", { name: /transfer \(1\)/i }));

      // Turn off "mint" and "burn", leaving only "transfer" events visible.
      fireEvent.click(screen.getByRole("button", { name: /mint \(1\)/i }));
      fireEvent.click(screen.getByRole("button", { name: /burn \(1\)/i }));

      expect(screen.getAllByText("transfer")).toHaveLength(1);
      expect(screen.queryByText("mint")).not.toBeInTheDocument();
      expect(screen.queryByText("burn")).not.toBeInTheDocument();
    });

    it("re-enables a type when its toggle is clicked again", async () => {
      mockGetEvents({ data: MULTI_TYPE_EVENTS, error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByRole("button", { name: /mint \(1\)/i }));

      const mintToggle = screen.getByRole("button", { name: /mint \(1\)/i });
      fireEvent.click(mintToggle);
      expect(screen.queryByText("mint")).not.toBeInTheDocument();

      fireEvent.click(mintToggle);
      expect(screen.getByText("mint")).toBeInTheDocument();
    });

    it("shows a 'no events match' message when every type is filtered out", async () => {
      mockGetEvents({ data: MULTI_TYPE_EVENTS, error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByRole("button", { name: /transfer \(1\)/i }));

      fireEvent.click(screen.getByRole("button", { name: /transfer \(1\)/i }));
      fireEvent.click(screen.getByRole("button", { name: /mint \(1\)/i }));
      fireEvent.click(screen.getByRole("button", { name: /burn \(1\)/i }));

      expect(
        screen.getByText("No events match the selected filters"),
      ).toBeInTheDocument();
    });

    it("respects the filterTypes prop as the initial active set", async () => {
      mockGetEvents({ data: MULTI_TYPE_EVENTS, error: null });
      render(
        <ContractEventFeed contractId={CONTRACT_ID} filterTypes={["transfer"]} />,
      );
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByText("transfer")).toBeInTheDocument();
      });
      expect(screen.queryByText("mint")).not.toBeInTheDocument();
      expect(screen.queryByText("burn")).not.toBeInTheDocument();
    });
  });

  // ── Event value truncation (#263) ─────────────────────────────────────────
  describe("event value truncation", () => {
    function eventWithValue(value: unknown): ContractEvent {
      return { ...MOCK_EVENT, id: "evt-value", value };
    }

    it("renders short values without a Show more toggle", async () => {
      mockGetEvents({ data: [eventWithValue({ a: 1 })], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
    });

    it("truncates values exceeding maxValueLength and shows a 'Show more' toggle", async () => {
      const longValue = { data: "x".repeat(300) };
      mockGetEvents({ data: [eventWithValue(longValue)], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} maxValueLength={50} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
      });
      const fullJson = JSON.stringify(longValue, null, 2);
      expect(screen.queryByText(fullJson)).not.toBeInTheDocument();
    });

    it("expands to the full value when 'Show more' is clicked, then collapses on 'Show less'", async () => {
      const longValue = { data: "y".repeat(300) };
      mockGetEvents({ data: [eventWithValue(longValue)], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} maxValueLength={50} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByRole("button", { name: /show more/i }));

      fireEvent.click(screen.getByRole("button", { name: /show more/i }));
      const pre = document.querySelector("pre");
      expect(pre?.textContent).toBe(JSON.stringify(longValue, null, 2));
      expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /show less/i }));
      expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
    });

    it("defaults maxValueLength to 200 characters", async () => {
      const value = { data: "z".repeat(180) };
      mockGetEvents({ data: [eventWithValue(value)], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      // JSON.stringify(value, null, 2) is under 200 chars, so no toggle should appear.
      await waitFor(() => {
        expect(screen.getByText(/"data"/)).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
    });
  });

  // ── Last-updated relative timestamp (#263) ────────────────────────────────
  describe("last-updated timestamp", () => {
    it("does not show a timestamp when polling is disabled", async () => {
      mockGetEvents({ data: [], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => screen.getByText("No events found"));
      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
    });

    it("shows 'Updated just now' immediately after a poll while live", async () => {
      mockGetEvents({ data: [], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={5000} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByText("Updated just now")).toBeInTheDocument();
      });
    });

    it("updates the relative time string once a second while polling", async () => {
      mockGetEvents({ data: [], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={60_000} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("Updated just now"));

      act(() => { vi.advanceTimersByTime(12_000); });
      await waitFor(() => {
        expect(screen.getByText("Updated 12s ago")).toBeInTheDocument();
      });

      act(() => { vi.advanceTimersByTime(120_000); });
      await waitFor(() => {
        expect(screen.getByText(/Updated \dm ago/)).toBeInTheDocument();
      });
    });

    it("hides the last-updated timestamp once paused", async () => {
      mockGetEvents({ data: [], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={60_000} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("Updated just now"));

      fireEvent.click(screen.getByRole("button", { name: /live/i }));
      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();

      act(() => { vi.advanceTimersByTime(30_000); });
      expect(screen.queryByText(/updated/i)).not.toBeInTheDocument();
    });
  });

  describe("JSON export (#352)", () => {
    it("is disabled when there are no events", async () => {
      mockGetEvents({ data: [], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
      });
    });

    it("exports a blob containing the exact events JSON", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("transfer"));

      fireEvent.click(screen.getByRole("button", { name: /export/i }));

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
      const blob = mockCreateObjectURL.mock.calls[0]![0] as Blob;
      expect(blob.type).toBe("application/json");
      const text = await blob.text();
      expect(JSON.parse(text)).toEqual([MOCK_EVENT]);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock");
    });

    it("names the downloaded file after the contract ID", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("transfer"));

      let downloadName: string | null = null;
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(function (this: HTMLAnchorElement) {
          downloadName = this.download;
        });

      fireEvent.click(screen.getByRole("button", { name: /export/i }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(downloadName).toBe(`contract-events-${CONTRACT_ID}.json`);
      clickSpy.mockRestore();
    });
  });

  describe("topic copy (#352)", () => {
    beforeEach(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
      });
    });

    it("copies the exact topic value to the clipboard when its copy button is clicked", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("GA...from"));

      const copyButtons = screen.getAllByTitle("Copy topic");
      await act(async () => {
        fireEvent.click(copyButtons[0]!);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("GA...from");
    });

    it("copies each topic independently by its own button", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("GB...to"));

      const copyButtons = screen.getAllByTitle("Copy topic");
      expect(copyButtons).toHaveLength(2);

      await act(async () => {
        fireEvent.click(copyButtons[1]!);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("GB...to");
      expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith("GA...from");
    });

    it("does not toggle event-row interactions when the copy button is clicked", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });
      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => screen.getByText("GA...from"));

      // handleCopy calls stopPropagation(); clicking it must not throw or
      // bubble into unrelated row-level click handlers.
      await act(async () => {
        fireEvent.click(screen.getAllByTitle("Copy topic")[0]!);
      });
    });
  });

  describe("fromLedger prop (#352)", () => {
    it("passes fromLedger through to getEvents", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      render(<ContractEventFeed contractId={CONTRACT_ID} fromLedger={987654} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(getEvents).toHaveBeenCalledWith(CONTRACT_ID, 10, 987654);
      });
    });

    it("passes undefined for fromLedger when not provided", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      render(<ContractEventFeed contractId={CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(getEvents).toHaveBeenCalledWith(CONTRACT_ID, 10, undefined);
      });
    });

    it("re-fetches when fromLedger changes", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      const { rerender } = render(
        <ContractEventFeed contractId={CONTRACT_ID} fromLedger={100} />,
      );
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => expect(getEvents).toHaveBeenCalledWith(CONTRACT_ID, 10, 100));

      rerender(<ContractEventFeed contractId={CONTRACT_ID} fromLedger={200} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() => {
        expect(getEvents).toHaveBeenCalledWith(CONTRACT_ID, 10, 200);
      });
    });
  });

  describe("stale events and loading recovery", () => {
    const OTHER_CONTRACT_ID =
      "CBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNB";

    it("clears the previous contract's events when contractId changes", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });

      const { rerender } = render(
        <ContractEventFeed contractId={CONTRACT_ID} />,
      );
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => expect(screen.getByText("transfer")).toBeInTheDocument());

      // New contract's fetch never settles, so anything still on screen can
      // only be left over from the previous contract.
      vi.mocked(getClient).mockReturnValue({
        soroban: {
          getEvents: vi.fn().mockReturnValue(new Promise(() => {})),
        },
      } as unknown as SorokitClient);

      rerender(<ContractEventFeed contractId={OTHER_CONTRACT_ID} />);

      expect(screen.queryByText("transfer")).not.toBeInTheDocument();
    });

    it("does not keep stale events when the new contract's fetch errors", async () => {
      mockGetEvents({ data: [MOCK_EVENT], error: null });

      const { rerender } = render(
        <ContractEventFeed contractId={CONTRACT_ID} />,
      );
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => expect(screen.getByText("transfer")).toBeInTheDocument());

      mockGetEvents({ data: null, error: "RPC unavailable" });
      rerender(<ContractEventFeed contractId={OTHER_CONTRACT_ID} />);
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() =>
        expect(screen.getByText("RPC unavailable")).toBeInTheDocument(),
      );
      expect(screen.queryByText("transfer")).not.toBeInTheDocument();
    });

    it("returns loading to false after getEvents reports an error", async () => {
      mockGetEvents({ data: null, error: "RPC unavailable" });

      const { container } = render(
        <ContractEventFeed contractId={CONTRACT_ID} />,
      );
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() =>
        expect(screen.getByText("RPC unavailable")).toBeInTheDocument(),
      );
      // The skeleton is gone, so loading settled rather than sticking on.
      expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });

    it("returns loading to false after getEvents rejects", async () => {
      vi.mocked(getClient).mockReturnValue({
        soroban: {
          getEvents: vi.fn().mockRejectedValue(new Error("network down")),
        },
      } as unknown as SorokitClient);

      const { container } = render(
        <ContractEventFeed contractId={CONTRACT_ID} />,
      );
      act(() => { vi.advanceTimersByTime(0); });

      await waitFor(() =>
        expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument(),
      );
    });
  });

  // ── Polling stale-closure regression (#582) ──────────────────────────────
  // The polling interval used to close over the `load` instance captured when
  // the effect first ran, so changing the `contractId` prop kept polling the
  // OLD contract. These tests pin the fixed behaviour: the interval restarts
  // with the current contractId.
  describe("polling contractId switching (#582)", () => {
    const NEW_ID =
      "CBBB4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

    it("restarts polling for the new contractId after the prop changes", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      const { rerender } = render(
        <ContractEventFeed contractId={CONTRACT_ID} pollInterval={500} />,
      );
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));
      expect(getEvents).toHaveBeenLastCalledWith(CONTRACT_ID, 10, undefined);

      rerender(<ContractEventFeed contractId={NEW_ID} pollInterval={500} />);
      act(() => { vi.advanceTimersByTime(0); });

      // The restarted effect loads the new contract immediately, then keeps
      // polling it. Capture the call count here so the stale-closure check
      // only examines calls made *after* the switch.
      await waitFor(() => {
        expect(getEvents).toHaveBeenLastCalledWith(NEW_ID, 10, undefined);
      });
      const callsAfterSwitch = getEvents.mock.calls.length;

      // Advance past one full poll interval. The stale-closure bug (#582)
      // would keep calling with the OLD contractId here; the fixed code must
      // use NEW_ID for every poll after the switch.
      act(() => { vi.advanceTimersByTime(500); });
      await waitFor(() => {
        expect(getEvents.mock.calls.length).toBeGreaterThan(callsAfterSwitch);
      });

      const postSwitchIds = getEvents.mock.calls
        .slice(callsAfterSwitch)
        .map(([id]) => id);
      expect(postSwitchIds).not.toContain(CONTRACT_ID);
      expect(postSwitchIds.every((id) => id === NEW_ID)).toBe(true);
    });

    it("resumes polling for the current contract when Live is toggled back on", async () => {
      const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
      vi.mocked(getClient).mockReturnValue({
        soroban: { getEvents },
      } as unknown as SorokitClient);

      render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={500} />);
      act(() => { vi.advanceTimersByTime(0); });
      await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByRole("button", { name: /live/i }));
      const pausedCount = getEvents.mock.calls.length;
      act(() => { vi.advanceTimersByTime(1500); });
      expect(getEvents).toHaveBeenCalledTimes(pausedCount);

      fireEvent.click(screen.getByRole("button", { name: /paused/i }));
      act(() => { vi.advanceTimersByTime(500); });

      await waitFor(() => {
        expect(getEvents).toHaveBeenCalledTimes(pausedCount + 1);
      });
      expect(getEvents).toHaveBeenLastCalledWith(CONTRACT_ID, 10, undefined);
    });
  });
});

// ── Issue #442: stale closures, single mount fetch, runtime poll changes ─────
describe("ContractEventFeed — issue #442", () => {
  const OTHER_ID = "CBBB4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA";

  function mockEvents(getEvents: ReturnType<typeof vi.fn>) {
    vi.mocked(getClient).mockReturnValue({
      soroban: { getEvents },
    } as unknown as SorokitClient);
  }

  function evt(id: string, topic: string): ContractEvent {
    return { ...MOCK_EVENT, id, topics: [topic] };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires exactly one request on mount, even with polling enabled", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    mockEvents(getEvents);

    render(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={1000} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    // Well short of the first poll — the polling effect must not have fetched.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(getEvents).toHaveBeenCalledTimes(1);
  });

  it("starts polling when pollInterval goes from 0 to a positive value at runtime", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    mockEvents(getEvents);

    const { rerender } = render(
      <ContractEventFeed contractId={CONTRACT_ID} pollInterval={0} />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(getEvents).toHaveBeenCalledTimes(1);

    rerender(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={1000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
  });

  it("re-arms the timer at the new period when pollInterval changes", async () => {
    const getEvents = vi.fn().mockResolvedValue({ data: [], error: null });
    mockEvents(getEvents);

    const { rerender } = render(
      <ContractEventFeed contractId={CONTRACT_ID} pollInterval={1000} />,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));

    rerender(<ContractEventFeed contractId={CONTRACT_ID} pollInterval={5000} />);

    // The old 1s timer must be gone…
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(getEvents).toHaveBeenCalledTimes(2);

    // …and the new 5s one armed.
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(3));
  });

  it("discards an in-flight response belonging to the previous contractId", async () => {
    let resolveOld!: (value: {
      data: ContractEvent[] | null;
      error: string | null;
    }) => void;
    const oldPending = new Promise<{
      data: ContractEvent[] | null;
      error: string | null;
    }>((resolve) => {
      resolveOld = resolve;
    });

    const getEvents = vi
      .fn()
      .mockReturnValueOnce(oldPending)
      .mockResolvedValue({ data: [evt("evt-new", "NEW-EVT")], error: null });
    mockEvents(getEvents);

    const { rerender } = render(<ContractEventFeed contractId={CONTRACT_ID} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(1));

    // Switch contracts while the first request is still in flight.
    rerender(<ContractEventFeed contractId={OTHER_ID} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await waitFor(() => expect(getEvents).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("NEW-EVT")).toBeInTheDocument();

    // The stale response lands late and must be dropped.
    await act(async () => {
      resolveOld({ data: [evt("evt-old", "OLD-EVT")], error: null });
    });

    expect(screen.queryByText("OLD-EVT")).not.toBeInTheDocument();
    expect(screen.getByText("NEW-EVT")).toBeInTheDocument();
  });
});
