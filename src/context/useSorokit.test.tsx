import { renderHook, screen } from "@testing-library/react";
import { describe, expect,it } from "vitest";

import { renderWithProvider } from "@/__tests__/utils";

import { useSorokit } from "./useSorokit";

describe("useSorokit", () => {
  it("returns safe defaults when used outside of SorokitProvider", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useSorokit());
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.balances).toEqual([]);
    expect(result.current.error).toBeNull();

    consoleSpy.mockRestore();
  });

  it("reads context when wrapped with renderWithProvider", async () => {
    function TestConsumer() {
      const { network } = useSorokit();
      return <div>{network?.name ?? "loading"}</div>;
    }

    renderWithProvider(<TestConsumer />);

    expect(await screen.findByText("testnet")).toBeInTheDocument();
  });
});
