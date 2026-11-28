import { useEffect, useRef } from "react";

/**
 * Hook that calls a handler when a click or touch event occurs outside of the referenced element.
 * Listens to `pointerdown`, `touchstart`, and `mousedown` to ensure full compatibility with touch devices (iOS Safari).
 *
 * The target can either be the returned ref (assigned via `ref={ref}` or
 * `ref.current = node`) or passed explicitly as the third argument. Pass the
 * element explicitly when it is conditionally mounted: the listeners are
 * rebound whenever `target` changes, so a surface that mounts a different
 * popover/panel later still gets the correct "outside" boundary.
 */
export function useOutsideClick<T extends HTMLElement = HTMLElement>(
  handler: (event: Event) => void,
  enabled: boolean = true,
  target?: T | null,
) {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent | PointerEvent) => {
      const el = target ?? ref.current;
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      handlerRef.current(event);
    };

    // Capture phase + passive: iOS Safari never fires `click` for taps on
    // non-interactive elements, and ancestors that stop propagation would
    // otherwise swallow the event before it reaches `document`.
    const options: AddEventListenerOptions = { capture: true, passive: true };

    if (enabled) {
      document.addEventListener("pointerdown", listener, options);
      document.addEventListener("touchstart", listener, options);
      document.addEventListener("mousedown", listener, options);
    }

    // Always return a cleanup so that toggling `enabled` back to false (or
    // unmounting) cannot leave a dangling document-level listener behind.
    return () => {
      document.removeEventListener("pointerdown", listener, options);
      document.removeEventListener("touchstart", listener, options);
      document.removeEventListener("mousedown", listener, options);
    };
  }, [enabled, target]);

  return ref;
}
