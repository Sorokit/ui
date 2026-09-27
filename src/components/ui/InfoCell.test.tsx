import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { InfoCell } from "./InfoCell";

describe("InfoCell", () => {
  let writeTextSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.resolve() },
        configurable: true,
        writable: true,
      });
    }
  });

  beforeEach(() => {
    writeTextSpy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders label and value correctly", () => {
    render(<InfoCell label="Network" value="Testnet" />);

    expect(screen.getByText("Network")).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });

  it("applies monospace styling when mono is true", () => {
    render(<InfoCell label="Address" value="GBAMQXTQ...ZJQQQQ" mono />);

    const valueEl = screen.getByText("GBAMQXTQ...ZJQQQQ");
    expect(valueEl.className).toContain("font-mono");
  });

  it("applies custom className to the root container", () => {
    const { container } = render(
      <InfoCell label="Status" value="Active" className="custom-cell-class" />,
    );

    expect(container.firstElementChild).toHaveClass("custom-cell-class");
  });

  describe("copyable interaction", () => {
    it("does not render copy button when copyable is false or omitted", () => {
      render(<InfoCell label="Contract ID" value="CA123456" />);

      expect(
        screen.queryByRole("button", { name: /copy/i }),
      ).not.toBeInTheDocument();
    });

    it("renders copy button when copyable is true", () => {
      render(<InfoCell label="Contract ID" value="CA123456" copyable />);

      const copyBtn = screen.getByRole("button", {
        name: "Copy Contract ID",
      });
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn).toHaveAttribute("title", "Copy Contract ID");
    });

    it("writes to clipboard and updates button state to copied on click", async () => {
      render(<InfoCell label="Contract ID" value="CA123456" copyable />);

      const copyBtn = screen.getByRole("button", {
        name: "Copy Contract ID",
      });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledTimes(1);
      expect(writeTextSpy).toHaveBeenCalledWith("CA123456");

      const copiedBtn = screen.getByRole("button", {
        name: "Contract ID copied",
      });
      expect(copiedBtn).toBeInTheDocument();
      expect(copiedBtn).toHaveAttribute("title", "Copied!");
    });

    it("resets copied state after 2 seconds", async () => {
      vi.useFakeTimers();
      render(<InfoCell label="Contract ID" value="CA123456" copyable />);

      const copyBtn = screen.getByRole("button", {
        name: "Copy Contract ID",
      });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(
        screen.getByRole("button", { name: "Contract ID copied" }),
      ).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(
        screen.getByRole("button", { name: "Copy Contract ID" }),
      ).toBeInTheDocument();
    });

    it("handles clipboard rejection gracefully without throwing", async () => {
      writeTextSpy.mockRejectedValueOnce(new Error("Clipboard access denied"));

      render(<InfoCell label="Contract ID" value="CA123456" copyable />);

      const copyBtn = screen.getByRole("button", {
        name: "Copy Contract ID",
      });

      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith("CA123456");
      expect(
        screen.getByRole("button", { name: "Copy Contract ID" }),
      ).toBeInTheDocument();
    });
  });

  describe("testable connection probe", () => {
    it("does not render connection test button when testable is omitted", () => {
      render(<InfoCell label="RPC URL" value="https://rpc.stellar.org" />);

      expect(
        screen.queryByRole("button", { name: /test connection/i }),
      ).not.toBeInTheDocument();
    });

    it("renders test connection button when testable is true", () => {
      render(
        <InfoCell label="RPC URL" value="https://rpc.stellar.org" testable />,
      );

      expect(
        screen.getByRole("button", { name: /test connection/i }),
      ).toBeInTheDocument();
    });

    it("shows Reachable badge when connection probe succeeds", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      render(
        <InfoCell label="RPC URL" value="https://rpc.stellar.org" testable />,
      );

      const testBtn = screen.getByRole("button", { name: /test connection/i });

      await act(async () => {
        fireEvent.click(testBtn);
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://rpc.stellar.org",
        expect.objectContaining({
          method: "HEAD",
          mode: "no-cors",
        }),
      );

      expect(screen.getByText("Reachable")).toBeInTheDocument();
    });

    it("shows Unreachable badge when connection probe fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Network Error"),
      );

      render(
        <InfoCell label="RPC URL" value="https://invalid.rpc.node" testable />,
      );

      const testBtn = screen.getByRole("button", { name: /test connection/i });

      await act(async () => {
        fireEvent.click(testBtn);
      });

      expect(screen.getByText("Unreachable")).toBeInTheDocument();
    });
  });
});
