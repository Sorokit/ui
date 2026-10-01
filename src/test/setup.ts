/**
 * Global Vitest setup (#552).
 *
 * Loaded through the `test.setupFiles` entry in `vite.config.ts`, so every test
 * file gets the same environment: jest-dom matchers, automatic cleanup between
 * tests, and the jsdom shims the component suite depends on.
 */
import "@testing-library/jest-dom";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// jsdom ships working Web Storage implementations, but Node's experimental
// global Web Storage API (stable default as of Node 22+) can shadow them with a
// non-functional stub that is missing getItem/setItem/removeItem/clear whenever
// no --localstorage-file is configured, making any web-storage assertion
// silently no-op. A real in-memory Storage implementation is installed for both
// stores below, so read/write behavior is exercised regardless of the Node
// version running the suite.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

for (const key of ["localStorage", "sessionStorage"] as const) {
  Object.defineProperty(globalThis, key, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}

// jsdom implements neither ResizeObserver nor pointer capture, both of which
// Radix's popper-positioned primitives (Tooltip, Select, DropdownMenu) call
// during layout. Without these, rendering any of them throws before a single
// assertion runs. Minimal no-op stand-ins are enough: jsdom reports zero-sized
// boxes anyway, so real measurements would be meaningless here.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    configurable: true,
    writable: true,
  });
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// Some icon exports are missing from older builds of the icon set; stub the one
// the bundle imports eagerly so a missing export can never fail the suite.
vi.mock("@hugeicons/react", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, Loading01Icon: actual.Loading01Icon || (() => null) };
});
