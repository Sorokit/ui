import { act,fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll,describe, expect, it, vi } from "vitest";

import { AddressDisplay } from "./AddressDisplay";

// Mock navigator.clipboard safely in JSDOM
const mockWriteText = vi.fn().mockResolvedValue(undefined);
beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
    },
    configurable: true,
    writable: true,
  });
});

describe("AddressDisplay", () => {
  const address = "GBAMQXTQ7IQKPZXJKZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQZJQQQQ";

  it("renders truncated address and copy button in tab order with correct aria-label", async () => {
    render(<AddressDisplay address={address} />);

    // Confirm address text is present (truncated format)
    expect(screen.getByText("GBAMQXTQ...ZJQQQQ")).toBeInTheDocument();

    // Confirm copy button exists with aria-label
    const copyBtn = screen.getByRole("button", { name: "Copy address" });
    expect(copyBtn).toBeInTheDocument();

    // Confirm it is focusable (in tab order)
    expect(copyBtn).not.toHaveAttribute("tabindex", "-1");

    // Click to copy and verify clipboard call
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(mockWriteText).toHaveBeenCalledWith(address);

    // Verify aria-label changes to "Address copied" after copy
    expect(screen.getByRole("button", { name: "Address copied" })).toBeInTheDocument();

    // Wait for the state to reset back to "Copy address"
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy address" })).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it("verifies copy button has visibility class (opacity-50 base opacity)", () => {
    render(<AddressDisplay address={address} />);

    const copyBtn = screen.getByRole("button", { name: "Copy address" });

    // Expect base opacity-50 for visibility (not opacity-0)
    expect(copyBtn.className).toContain("opacity-50");
    expect(copyBtn.className).not.toContain("opacity-0");
  });

  it("shows the full address when showFull is true", () => {
    render(<AddressDisplay address={address} showFull />);
    expect(screen.getByText(address)).toBeInTheDocument();
  });

  it("renders a label above the address when label prop is provided", () => {
    render(<AddressDisplay address={address} label="Destination" />);
    expect(screen.getByText("Destination")).toBeInTheDocument();
  });
});
