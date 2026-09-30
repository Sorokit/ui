import { renderHook, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOutsideClick } from "./useOutsideClick";

describe("useOutsideClick", () => {
  it("fires callback on click outside the ref element", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useOutsideClick(handler));
    
    // Create a mock element and assign it to the ref
    const element = document.createElement("div");
    result.current.current = element as any;
    
    // Fire click on document body
    fireEvent.mouseDown(document.body);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire callback on click inside the ref element", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useOutsideClick(handler));
    
    const element = document.createElement("div");
    result.current.current = element as any;
    
    // Fire click on the element itself
    fireEvent.mouseDown(element);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not fire when enabled is false", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useOutsideClick(handler, false));
    
    const element = document.createElement("div");
    result.current.current = element as any;
    
    fireEvent.mouseDown(document.body);
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes listener on unmount", () => {
    const handler = vi.fn();
    const { result, unmount } = renderHook(() => useOutsideClick(handler));
    
    const element = document.createElement("div");
    result.current.current = element as any;
    
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
    expect(removeSpy).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("touchstart", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));

    // Verify handler is not called after disabled
    handler.mockClear();
    fireEvent.mouseDown(outsideNode);
    fireEvent.pointerDown(outsideNode);
    fireEvent.touchStart(outsideNode);
    expect(handler).not.toHaveBeenCalled();
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
