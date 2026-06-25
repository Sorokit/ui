import { fireEvent,render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

const ThrowError = () => {
  throw new Error("Test error!");
};

describe("ErrorBoundary", () => {
  it("renders default fallback when child throws, and resets when try again is clicked", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Expect default fallback UI text
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test error!")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /try again/i });
    expect(resetBtn).toBeInTheDocument();

    // Clicking reset should try to re-render the children
    // (It will just throw again because we always throw in ThrowError, but it resets state)
    fireEvent.click(resetBtn);

    consoleSpy.mockRestore();
  });

  it("renders custom fallback prop and passes error and reset function", () => {
    const fallbackSpy = vi.fn().mockImplementation((error, reset) => (
      <div>
        <p>Custom Fallback</p>
        <p>{error.message}</p>
        <button onClick={reset}>Reset Custom</button>
      </div>
    ));

    // Suppress console.error for expected thrown error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={fallbackSpy}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(fallbackSpy).toHaveBeenCalled();
    expect(screen.getByText("Custom Fallback")).toBeInTheDocument();
    expect(screen.getByText("Test error!")).toBeInTheDocument();

    const resetBtn = screen.getByText("Reset Custom");
    expect(resetBtn).toBeInTheDocument();

    // Reset should be callable and reset the error state (though it will just throw again because we still render ThrowError)
    // but we can verify it doesn't crash.
    fireEvent.click(resetBtn);

    consoleSpy.mockRestore();
  });
});
