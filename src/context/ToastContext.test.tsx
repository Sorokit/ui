import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastContainer } from "@/components/ui/Toast";

import { ToastProvider, useToast } from "./ToastContext";

/* ------------------------------------------------------------------ */
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

const latest: { current: ReturnType<typeof useToast> | null } = {
  current: null,
};

/** The toast API as of the most recent render. */
function api() {
  return latest.current!;
}

function Harness() {
  const toast = useToast();
  useEffect(() => {
    latest.current = toast;
  });
  return <ToastContainer toasts={toast.toasts} onDismiss={toast.removeToast} />;
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
}

function titles() {
  return screen.queryAllByRole("alert").map(
    (el) => el.querySelector("[id^='radix-']")?.textContent ?? el.textContent,
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("ToastContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws a helpful error when useToast is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Orphan() {
      useToast();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(
      "useToast must be used within a ToastProvider",
    );
    spy.mockRestore();
  });

  describe("queuing", () => {
    it("queues toasts in the order they were added", () => {
      renderToasts();
      act(() => {
        api().info("First");
        api().success("Second");
        api().error("Third");
      });

      expect(api().toasts.map((t) => t.title)).toEqual([
        "First",
        "Second",
        "Third",
      ]);
      expect(api().toasts.map((t) => t.type)).toEqual([
        "info",
        "success",
        "error",
      ]);
      expect(screen.getAllByRole("alert")).toHaveLength(3);
    });

    it("returns a unique id for every toast, even in the same tick", () => {
      renderToasts();
      let ids: string[] = [];
      act(() => {
        ids = [api().info("A"), api().info("B"), api().info("C")];
      });
      expect(new Set(ids).size).toBe(3);
      expect(api().toasts.map((t) => t.id)).toEqual(ids);
    });

    it("auto-dismisses each toast independently after its own duration", () => {
      renderToasts();
      act(() => {
        api().info("Short", { duration: 1000 });
        api().info("Long", { duration: 3000 });
        api().info("Sticky", { duration: 0 });
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(api().toasts.map((t) => t.title)).toEqual(["Long", "Sticky"]);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(api().toasts.map((t) => t.title)).toEqual(["Sticky"]);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(api().toasts.map((t) => t.title)).toEqual(["Sticky"]);
    });

    it("uses a 5s default duration", () => {
      renderToasts();
      act(() => {
        api().info("Default");
      });
      act(() => {
        vi.advanceTimersByTime(4999);
      });
      expect(api().toasts).toHaveLength(1);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(api().toasts).toHaveLength(0);
    });
  });

  describe("dismissal", () => {
    it("removeToast dismisses only the targeted toast", () => {
      renderToasts();
      let middle = "";
      act(() => {
        api().info("One");
        middle = api().info("Two");
        api().info("Three");
      });

      act(() => {
        api().removeToast(middle);
      });

      expect(api().toasts.map((t) => t.title)).toEqual(["One", "Three"]);
    });

    it("dismissAll clears every active toast", () => {
      renderToasts();
      act(() => {
        api().error("Failed to load account");
        api().error("Network unreachable", { duration: 0 });
        api().warning("Low balance");
      });
      expect(screen.getAllByRole("alert")).toHaveLength(3);

      act(() => {
        api().dismissAll();
      });

      expect(api().toasts).toHaveLength(0);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("accepts new toasts normally after dismissAll", () => {
      renderToasts();
      act(() => {
        api().info("A", { duration: 1000 });
        api().info("B", { duration: 2000 });
      });
      act(() => {
        api().dismissAll();
      });

      act(() => {
        api().info("Fresh", { duration: 5000 });
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      expect(api().toasts.map((t) => t.title)).toEqual(["Fresh"]);
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("keeps clearAll as a backwards-compatible alias of dismissAll", () => {
      renderToasts();
      expect(api().clearAll).toBe(api().dismissAll);
    });

    it("dismisses a toast from its close button", () => {
      renderToasts();
      act(() => {
        api().success("Saved", { duration: 0 });
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Dismiss success notification" }),
      );

      expect(api().toasts).toHaveLength(0);
    });
  });

  describe("Escape key", () => {
    it("dismisses the focused toast", () => {
      renderToasts();
      act(() => {
        api().info("Only", { duration: 0 });
      });

      const toast = screen.getByRole("alert");
      act(() => toast.focus());
      fireEvent.keyDown(toast, { key: "Escape" });

      expect(api().toasts).toHaveLength(0);
    });

    it("dismisses the focused toast, not the most recent one", () => {
      renderToasts();
      act(() => {
        api().info("Older", { duration: 0 });
        api().info("Newer", { duration: 0 });
      });

      const [older] = screen.getAllByRole("alert");
      act(() => older.focus());
      fireEvent.keyDown(older, { key: "Escape" });

      expect(api().toasts.map((t) => t.title)).toEqual(["Newer"]);
    });

    it("dismisses the toast when Escape is pressed on its close button", () => {
      renderToasts();
      act(() => {
        api().info("Keep", { duration: 0 });
        api().error("Close me", { duration: 0 });
      });

      const close = screen.getByRole("button", {
        name: "Dismiss error notification",
      });
      act(() => close.focus());
      fireEvent.keyDown(close, { key: "Escape" });

      expect(api().toasts.map((t) => t.title)).toEqual(["Keep"]);
    });

    it("moves focus to the next toast so repeated Escape clears the stack", () => {
      renderToasts();
      act(() => {
        api().info("A", { duration: 0 });
        api().info("B", { duration: 0 });
        api().info("C", { duration: 0 });
      });

      const [first] = screen.getAllByRole("alert");
      act(() => first.focus());

      for (const remaining of [2, 1, 0]) {
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
        expect(api().toasts).toHaveLength(remaining);
      }
    });

    it("ignores other keys", () => {
      renderToasts();
      act(() => {
        api().info("Stay", { duration: 0 });
      });
      const toast = screen.getByRole("alert");
      act(() => toast.focus());
      fireEvent.keyDown(toast, { key: "Enter" });
      expect(api().toasts).toHaveLength(1);
    });
  });

  describe("stacking", () => {
    it("renders every toast in a single viewport, oldest to newest", () => {
      renderToasts();
      act(() => {
        api().info("First", { duration: 0 });
        api().info("Second", { duration: 0 });
        api().info("Third", { duration: 0 });
      });

      const viewport = screen.getByTestId("toast-viewport");
      const items = Array.from(viewport.querySelectorAll("[data-toast-id]"));
      expect(items).toHaveLength(3);
      expect(items.map((el) => el.getAttribute("data-toast-id"))).toEqual(
        api().toasts.map((t) => t.id),
      );
      expect(titles()).toEqual(["First", "Second", "Third"]);
    });

    it("lays toasts out in normal flow with a gap so they cannot overlap", () => {
      renderToasts();
      act(() => {
        api().info("A", { duration: 0 });
        api().info("B", { duration: 0 });
      });

      const viewport = screen.getByTestId("toast-viewport");
      expect(viewport).toHaveClass("flex", "flex-col", "gap-2");

      for (const toast of screen.getAllByRole("alert")) {
        // Absolute/fixed children would take toasts out of flow and let them
        // pile up on top of one another.
        expect(toast.className).not.toMatch(/\b(absolute|fixed)\b/);
        // Flex items shrink by default; a crowded stack would squash them.
        expect(toast).toHaveClass("shrink-0");
      }
    });

    it("caps the viewport to the screen and scrolls instead of clipping", () => {
      renderToasts();
      act(() => {
        api().info("A", { duration: 0 });
      });

      const viewport = screen.getByTestId("toast-viewport");
      expect(viewport).toHaveClass(
        "max-h-[calc(100vh-2rem)]",
        "overflow-y-auto",
      );
    });

    it("gates the entry animation behind a reduced-motion-aware class", () => {
      renderToasts();
      act(() => {
        api().info("A", { duration: 0 });
      });
      expect(screen.getByRole("alert")).toHaveClass("animate-toast-in");
    });

    it("renders nothing once the queue is empty", () => {
      renderToasts();
      act(() => {
        api().info("A", { duration: 0 });
      });
      expect(screen.getByTestId("toast-viewport")).toBeInTheDocument();

      act(() => {
        api().dismissAll();
      });
      expect(screen.queryByTestId("toast-viewport")).not.toBeInTheDocument();
    });
  });
});
