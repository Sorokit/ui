import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDocumentVisible } from "@/hooks/useDocumentVisible";

describe("useDocumentVisible debug", () => {
  it("tracks visibilitychange", () => {
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(false);
  });
});
