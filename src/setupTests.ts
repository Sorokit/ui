import "@testing-library/jest-dom";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Node's experimental global Web Storage API (stable default as of Node 22+)
// shadows jsdom's own working localStorage implementation. Without a
// configured --localstorage-file it exposes a non-functional stub missing
// getItem/setItem/removeItem/clear, so any test that touches localStorage
// silently no-ops instead of exercising real read/write behavior. Install a
// real in-memory Storage implementation so localStorage behaves correctly
// regardless of the Node version running the suite.
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

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

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

vi.mock('@hugeicons/react', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, Loading01Icon: actual.Loading01Icon || (() => null) };
});
