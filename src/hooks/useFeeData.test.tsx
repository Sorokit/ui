import { act, fireEvent, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProvider } from "@/__tests__/utils";
import { createMockClient } from "@/lib/mock-client";

import { useFeeData } from "./useFeeData";

interface FeeState {
  fee: { baseFee: string; recommended: string } | null;
  loading: boolean;
  error: string | null;
}

function FeeProbe({
  refreshInterval = 0,
  isVisible = true,
  onState,
}: {
  refreshInterval?: number;
  isVisible?: boolean;
  onState?: (state: FeeState) => void;
}) {
  const { fee, loading, error } = useFeeData(refreshInterval, isVisible);

  useEffect(() => {
    onState?.({ fee, loading, error });
  }, [fee, loading, error, onState]);

  return (
    <div data-testid="fee">
      {fee ? `${fee.baseFee}/${fee.recommended}` : loading ? "loading" : "none"}
    </div>
  );
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("useFeeData (#955 visibility pause)", () => {
  beforeEach(() => {
    setVisibility("visible");
  });

  it("loads fee data on mount", async () => {
    vi.useFakeTimers();
    const client = createMockClient();
    const estimateFee = vi.spyOn(client.transaction, "estimateFee");

    renderWithProvider(<FeeProbe />, { client });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(estimateFee).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("fee")).toHaveTextContent("100/1000");
  });

  it("polls on the requested interval while visible", async () => {
    vi.useFakeTimers();
    const client = createMockClient();
    const estimateFee = vi.spyOn(client.transaction, "estimateFee");

    renderWithProvider(<FeeProbe refreshInterval={5000} />, { client });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(estimateFee).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(estimateFee).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(estimateFee).toHaveBeenCalledTimes(3);
  });

  it("pauses polling while the tab is hidden and refreshes on return", async () => {
    vi.useFakeTimers();
    const client = createMockClient();
    const estimateFee = vi.spyOn(client.transaction, "estimateFee");

    renderWithProvider(<FeeProbe refreshInterval={5000} />, { client });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(estimateFee).toHaveBeenCalledTimes(1);

    // Background the tab: the polling interval should be torn down.
    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(estimateFee).toHaveBeenCalledTimes(1);

    // Foregrounding refreshes immediately and re-arms the interval.
    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(estimateFee).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(estimateFee).toHaveBeenCalledTimes(3);
  });

  it("does not poll while the caller reports the component invisible", async () => {
    vi.useFakeTimers();
    const client = createMockClient();
    const estimateFee = vi.spyOn(client.transaction, "estimateFee");

    renderWithProvider(
      <FeeProbe refreshInterval={5000} isVisible={false} />,
      { client },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(estimateFee).not.toHaveBeenCalled();
  });

  it("picks up polling again when the component becomes visible", async () => {
    vi.useFakeTimers();
    const client = createMockClient();
    const estimateFee = vi.spyOn(client.transaction, "estimateFee");

    function ToggleProbe() {
      const [visible, setVisible] = useState(false);
      return (
        <>
          <button onClick={() => setVisible(true)}>show</button>
          <FeeProbe refreshInterval={5000} isVisible={visible} />
        </>
      );
    }

    renderWithProvider(<ToggleProbe />, { client });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(estimateFee).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "show" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(estimateFee).toHaveBeenCalledTimes(1);
  });
});
