import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsVisible } from "./useIsVisible";

/**
 * A controllable IntersectionObserver stub. Real IntersectionObserver
 * entries only arrive asynchronously after layout, which jsdom never
 * performs — tests drive visibility changes explicitly via
 * `triggerIntersection(entry)` instead of relying on real layout/scroll.
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observedNode: Element | null = null;
  disconnected = false;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(node: Element) {
    this.observedNode = node;
  }

  unobserve() {
    this.observedNode = null;
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("useIsVisible", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts visible (optimistic) before the observer fires", () => {
    const { result } = renderHook(() => useIsVisible<HTMLDivElement>());
    const [, isVisible] = result.current;
    expect(isVisible).toBe(true);
  });

  it("does nothing until the ref is attached to a node", () => {
    renderHook(() => useIsVisible<HTMLDivElement>());
    // No node was ever assigned to ref.current, so observe() is never
    // called and no observer instance should have been constructed with
    // an observed node.
    expect(
      MockIntersectionObserver.instances.every((i) => i.observedNode === null),
    ).toBe(true);
  });

  it("updates to false when the observed element is not intersecting", () => {
    const node = document.createElement("div");
    const { result, rerender } = renderHook(() => {
      const [ref, isVisible] = useIsVisible<HTMLDivElement>();
      // Attach the node on every render, the way a component's `ref={ref}`
      // JSX prop would on mount.
      ref.current = node;
      return { ref, isVisible };
    });

    // Manually drive the effect that calls observe() by attaching the node
    // before the first effect run, then forcing the effect to have run via
    // renderHook's act-wrapped initial render.
    expect(MockIntersectionObserver.instances.length).toBe(1);
    act(() => {
      MockIntersectionObserver.instances[0]!.trigger(false);
    });
    rerender();
    expect(result.current.isVisible).toBe(false);
  });

  it("updates back to true when the observed element becomes intersecting again", () => {
    const node = document.createElement("div");
    const { result, rerender } = renderHook(() => {
      const [ref, isVisible] = useIsVisible<HTMLDivElement>();
      ref.current = node;
      return { ref, isVisible };
    });

    act(() => {
      MockIntersectionObserver.instances[0]!.trigger(false);
    });
    rerender();
    expect(result.current.isVisible).toBe(false);

    act(() => {
      MockIntersectionObserver.instances[0]!.trigger(true);
    });
    rerender();
    expect(result.current.isVisible).toBe(true);
  });

  it("disconnects the observer on unmount", () => {
    const node = document.createElement("div");
    const { unmount } = renderHook(() => {
      const [ref] = useIsVisible<HTMLDivElement>();
      ref.current = node;
      return ref;
    });

    expect(MockIntersectionObserver.instances.length).toBe(1);
    unmount();
    expect(MockIntersectionObserver.instances[0]!.disconnected).toBe(true);
  });

  describe("observer options (#955)", () => {
    it("uses the default threshold of 0 when no options are given", () => {
      const node = document.createElement("div");
      renderHook(() => {
        const [ref] = useIsVisible<HTMLDivElement>();
        ref.current = node;
        return ref;
      });

      expect(MockIntersectionObserver.instances[0]!.options).toMatchObject({
        threshold: 0,
      });
    });

    it("forwards a custom threshold and rootMargin to the observer", () => {
      const node = document.createElement("div");
      renderHook(() => {
        const [ref] = useIsVisible<HTMLDivElement>({
          threshold: 0.5,
          rootMargin: "200px",
        });
        ref.current = node;
        return ref;
      });

      expect(MockIntersectionObserver.instances[0]!.options).toMatchObject({
        threshold: 0.5,
        rootMargin: "200px",
      });
    });

    it("forwards an array of thresholds", () => {
      const node = document.createElement("div");
      renderHook(() => {
        const [ref] = useIsVisible<HTMLDivElement>({ threshold: [0, 0.5, 1] });
        ref.current = node;
        return ref;
      });

      expect(MockIntersectionObserver.instances[0]!.options?.threshold).toEqual([
        0, 0.5, 1,
      ]);
    });

    it("recreates the observer when rootMargin changes", () => {
      const node = document.createElement("div");
      const { rerender } = renderHook(
        ({ margin }) => {
          const [ref] = useIsVisible<HTMLDivElement>({ rootMargin: margin });
          ref.current = node;
          return ref;
        },
        { initialProps: { margin: "0px" } },
      );

      expect(MockIntersectionObserver.instances.length).toBe(1);
      rerender({ margin: "100px" });

      expect(MockIntersectionObserver.instances.length).toBe(2);
      expect(MockIntersectionObserver.instances[0]!.disconnected).toBe(true);
      expect(MockIntersectionObserver.instances[1]!.options).toMatchObject({
        rootMargin: "100px",
      });
    });

    it("does not recreate the observer when an equivalent threshold array is passed again", () => {
      const node = document.createElement("div");
      const { rerender } = renderHook(() => {
        const [ref] = useIsVisible<HTMLDivElement>({ threshold: [0, 1] });
        ref.current = node;
        return ref;
      });

      expect(MockIntersectionObserver.instances.length).toBe(1);
      // A fresh array identity, same values — should not tear down the observer.
      rerender();

      expect(MockIntersectionObserver.instances.length).toBe(1);
    });
  });

  it("fails open (stays visible) when IntersectionObserver is unavailable", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);

    const node = document.createElement("div");
    const { result } = renderHook(() => {
      const [ref, isVisible] = useIsVisible<HTMLDivElement>();
      ref.current = node;
      return isVisible;
    });

    expect(result.current).toBe(true);
  });

  it("returns true (fails open) when window.IntersectionObserver is deleted", () => {
    vi.unstubAllGlobals();
    const win = window as unknown as Record<string, unknown>;
    const originalIO = win.IntersectionObserver;
    delete win.IntersectionObserver;

    try {
      const node = document.createElement("div");
      const { result, unmount } = renderHook(() => {
        const [ref, isVisible] = useIsVisible<HTMLDivElement>();
        ref.current = node;
        return isVisible;
      });

      expect(typeof window.IntersectionObserver).toBe("undefined");
      expect(result.current).toBe(true);
      expect(MockIntersectionObserver.instances.length).toBe(0);
      expect(() => unmount()).not.toThrow();
    } finally {
      win.IntersectionObserver = originalIO;
    }
  });
});
