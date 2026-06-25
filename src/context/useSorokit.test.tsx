import { renderHook, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSorokit } from "./useSorokit";
import { renderWithProvider } from "@/__tests__/utils";

// Note: we just need to ensure it throws without the provider.
describe("useSorokit", () => {
  it("throws an error when used outside of SorokitProvider", () => {
    // Suppress console.error for expected thrown error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    expect(() => renderHook(() => useSorokit())).toThrow(
      "[sorokit-ui] useSorokit must be used inside <SorokitProvider>"
    );

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
