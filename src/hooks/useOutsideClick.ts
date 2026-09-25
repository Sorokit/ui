import { useEffect, useRef } from "react";

/**
 * Hook that calls a handler when a click or touch event occurs outside of the referenced element.
 * Listens to `pointerdown`, `touchstart`, and `mousedown` to ensure full compatibility with touch devices (iOS Safari).
 */
export function useOutsideClick<T extends HTMLElement = HTMLElement>(
  handler: (event: Event) => void,
  enabled: boolean = true,
) {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent | PointerEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      handlerRef.current(event);
    };

    document.addEventListener("pointerdown", listener);
    document.addEventListener("touchstart", listener);
    document.addEventListener("mousedown", listener);

    return () => {
      document.removeEventListener("pointerdown", listener);
      document.removeEventListener("touchstart", listener);
      document.removeEventListener("mousedown", listener);
    };
  }, [enabled]);

  return ref;
}
