import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InfoCell } from "./InfoCell";

describe("InfoCell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label and value", () => {
    render(<InfoCell label="Endpoint" value="https://horizon.stellar.org" />);

    expect(screen.getByText("Endpoint")).toBeInTheDocument();
    expect(screen.getByText("https://horizon.stellar.org")).toBeInTheDocument();
  });

  it("applies monospace styling when mono is true", () => {
    render(
      <InfoCell label="Public Key" value="GBRP...1234" mono />,
    );

    const valueSpan = screen.getByText("GBRP...1234");
    expect(valueSpan).toHaveClass("font-mono", "text-[12px]");
  });

  it("applies regular font styling when mono is omitted or false", () => {
    render(<InfoCell label="Network" value="Testnet" />);

    const valueSpan = screen.getByText("Testnet");
    expect(valueSpan).not.toHaveClass("font-mono");
  });

  it("forwards custom className to the root container", () => {
    const { container } = render(
      <InfoCell
        label="Status"
        value="Operational"
        className="custom-info-cell"
      />,
    );

    expect(container.firstChild).toHaveClass("custom-info-cell");
  });

  describe("copy functionality", () => {
    it("does not render copy button when copyable is omitted or false", () => {
      render(<InfoCell label="Address" value="GBRP..." />);

      expect(
        screen.queryByRole("button", { name: /copy/i }),
      ).not.toBeInTheDocument();
    });

    it("renders copy button and copies value to clipboard on click", async () => {
      vi.useFakeTimers();
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      render(<InfoCell label="Public Key" value="GBRP123456" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy Public Key" });
      expect(copyBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith("GBRP123456");

      // Verify copied feedback state
      expect(
        screen.getByRole("button", { name: "Public Key copied" }),
      ).toBeInTheDocument();
      expect(screen.getByTitle("Copied!")).toBeInTheDocument();

      // Advance timer to verify reset after 2000ms
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      expect(
        screen.getByRole("button", { name: "Copy Public Key" }),
      ).toBeInTheDocument();
      expect(screen.getByTitle("Copy Public Key")).toBeInTheDocument();
    });

    it("handles clipboard failure gracefully without throwing", async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });

      render(<InfoCell label="API Key" value="secret-123" copyable />);

      const copyBtn = screen.getByRole("button", { name: "Copy API Key" });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextMock).toHaveBeenCalledWith("secret-123");
      // Button remains in uncopied state
      expect(screen.getByRole("button", { name: "Copy API Key" })).toBeInTheDocument();
    });
  });

  describe("connection testing functionality", () => {
    it("does not render test button when testable is omitted or false", () => {
      render(<InfoCell label="RPC Node" value="https://soroban-rpc.stellar.org" />);

      expect(
        screen.queryByRole("button", { name: /test connection/i }),
      ).not.toBeInTheDocument();
    });

    it("renders test button and handles successful connection probe", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <InfoCell
          label="RPC Endpoint"
          value="https://soroban-rpc.stellar.org"
          testable
        />,
      );

      const testBtn = screen.getByRole("button", { name: /test connection/i });
      expect(testBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(testBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith("https://soroban-rpc.stellar.org", {
        method: "HEAD",
        mode: "no-cors",
        signal: expect.any(Object),
      });

      await waitFor(() => {
        expect(screen.getByText("Reachable")).toBeInTheDocument();
      });
    });

    it("handles failed connection probe and shows unreachable badge", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network timeout"));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <InfoCell
          label="RPC Endpoint"
          value="https://dead-node.example.com"
          testable
        />,
      );

      const testBtn = screen.getByRole("button", { name: /test connection/i });

      await act(async () => {
        fireEvent.click(testBtn);
      });

      await waitFor(() => {
        expect(screen.getByText("Unreachable")).toBeInTheDocument();
      });
    });
  });
});
