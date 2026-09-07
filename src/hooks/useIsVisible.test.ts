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
  observedNode: Element | null = null;
  disconnected = false;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
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
});
