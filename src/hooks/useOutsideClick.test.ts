import { fireEvent,renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useOutsideClick } from "./useOutsideClick";

describe("useOutsideClick", () => {
  it("fires callback on click outside the ref element", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useOutsideClick(handler));
    
    // Create a mock element and assign it to the ref
    const element = document.createElement("div");
    result.current.current = element;
    
    // Fire click on document body
    fireEvent.mouseDown(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire callback on click inside the ref element", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useOutsideClick(handler));
    
    const element = document.createElement("div");
    result.current.current = element;
    
    // Fire click on the element itself
    fireEvent.mouseDown(element);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when enabled is false", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useOutsideClick(handler, false));
    
    const element = document.createElement("div");
    result.current.current = element;
    
    fireEvent.mouseDown(document.body);
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes listener on unmount", () => {
    const handler = vi.fn();
    const { result, unmount } = renderHook(() => useOutsideClick(handler));
    
    const element = document.createElement("div");
    result.current.current = element;
    
    unmount();
    
    fireEvent.mouseDown(document.body);
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes event listeners when enabled toggles to false", () => {
    const handler = vi.fn();
    const insideNode = document.createElement("div");
    const outsideNode = document.createElement("div");
    document.body.appendChild(insideNode);
    document.body.appendChild(outsideNode);

    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { rerender } = renderHook(({ enabled }) => {
      const ref = useOutsideClick<HTMLDivElement>(handler, enabled);
      ref.current = insideNode;
      return ref;
    }, { initialProps: { enabled: true } });

    // Verify listeners are attached when enabled is true
    fireEvent.mouseDown(outsideNode);
    expect(handler).toHaveBeenCalledTimes(1);

    // Toggle enabled to false
    rerender({ enabled: false });

    // Verify cleanup was called
    const expectedOptions = { capture: true, passive: true };
    expect(removeSpy).toHaveBeenCalledWith("pointerdown", expect.any(Function), expectedOptions);
    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function), expectedOptions);
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function), expectedOptions);

    // Verify handler is not called after disabled
    handler.mockClear();
    fireEvent.mouseDown(outsideNode);
    fireEvent.pointerDown(outsideNode);
    fireEvent.touchStart(outsideNode);
    expect(handler).not.toHaveBeenCalled();
  });

  describe("explicit target rebinding (#955)", () => {
    it("uses the explicitly passed target as the outside boundary", () => {
      const handler = vi.fn();
      const target = document.createElement("div");
      const outside = document.createElement("div");
      document.body.appendChild(target);
      document.body.appendChild(outside);

      renderHook(() => useOutsideClick<HTMLDivElement>(handler, true, target));

      fireEvent.mouseDown(target);
      expect(handler).not.toHaveBeenCalled();

      fireEvent.mouseDown(outside);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("rebinds to a new target when the target element changes", () => {
      const handler = vi.fn();
      const first = document.createElement("div");
      const second = document.createElement("div");
      document.body.appendChild(first);
      document.body.appendChild(second);

      const { rerender } = renderHook(
        ({ target }) => useOutsideClick<HTMLDivElement>(handler, true, target),
        { initialProps: { target: first as HTMLDivElement | null } },
      );

      // Clicks inside the first target are ignored.
      fireEvent.mouseDown(first);
      expect(handler).not.toHaveBeenCalled();

      // Swap the boundary to the second element.
      rerender({ target: second });

      // The old boundary is now "outside".
      fireEvent.mouseDown(first);
      expect(handler).toHaveBeenCalledTimes(1);

      // The new boundary is respected.
      fireEvent.mouseDown(second);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not fire while the explicit target is null", () => {
      const handler = vi.fn();
      const outside = document.createElement("div");
      document.body.appendChild(outside);

      renderHook(() => useOutsideClick<HTMLDivElement>(handler, true, null));

      fireEvent.mouseDown(outside);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it("removes the exact document listeners that were added when disabled", () => {
    vi.restoreAllMocks();
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    const { rerender } = renderHook(
      ({ enabled }) => useOutsideClick(vi.fn(), enabled),
      { initialProps: { enabled: true } },
    );

    const eventTypes = ["pointerdown", "touchstart", "mousedown"] as const;
    const addedListeners = new Map<string, EventListenerOrEventListenerObject>();
    for (const [type, listener] of addSpy.mock.calls) {
      if (eventTypes.includes(type as (typeof eventTypes)[number])) {
        addedListeners.set(type, listener);
      }
    }
    expect(addedListeners.size).toBe(eventTypes.length);

    // Toggling enabled to false must remove the very same listener instances.
    rerender({ enabled: false });

    for (const type of eventTypes) {
      const removedCall = removeSpy.mock.calls.find(([eventType]) => eventType === type);
      expect(removedCall).toBeDefined();
      expect(removedCall?.[1]).toBe(addedListeners.get(type));
    }

    vi.restoreAllMocks();
  });

  it("reattaches event listeners when enabled toggles back to true", () => {
    const handler = vi.fn();
    const insideNode = document.createElement("div");
    const outsideNode = document.createElement("div");
    document.body.appendChild(insideNode);
    document.body.appendChild(outsideNode);

    const addSpy = vi.spyOn(document, "addEventListener");

    const { rerender } = renderHook(({ enabled }) => {
      const ref = useOutsideClick<HTMLDivElement>(handler, enabled);
      ref.current = insideNode;
      return ref;
    }, { initialProps: { enabled: true } });

    // Initial state: enabled
    const initialAddCount = addSpy.mock.calls.length;

    // Toggle to false
    rerender({ enabled: false });

    // Handler should not fire
    handler.mockClear();
    fireEvent.mouseDown(outsideNode);
    expect(handler).not.toHaveBeenCalled();

    // Toggle back to true
    rerender({ enabled: true });

    // Verify listeners were re-attached
    expect(addSpy.mock.calls.length).toBeGreaterThan(initialAddCount);

    // Handler should fire again
    fireEvent.mouseDown(outsideNode);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
