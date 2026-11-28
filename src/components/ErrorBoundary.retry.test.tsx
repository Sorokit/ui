import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

function RecoverableChild({ shouldThrow }: { shouldThrow: boolean }) {
  const [count, setCount] = useState(0);

  if (shouldThrow) {
    throw new Error("Temporary render failure");
  }

  return (
    <div>
      <p data-testid="child-count">Child state: {count}</p>
      <button onClick={() => setCount((current) => current + 1)}>
        Increment child state
      </button>
    </div>
  );
}

function RetryHarness() {
  const [shouldThrow, setShouldThrow] = useState(false);

  return (
    <div>
      <button onClick={() => setShouldThrow(true)}>Cause error</button>
      <ErrorBoundary onRetry={() => setShouldThrow(false)}>
        <RecoverableChild shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </div>
  );
}

describe("ErrorBoundary retry recovery", () => {
  it("shows the fallback, retries the child, and clears stale child state", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RetryHarness />);

    // Establish child-local state before causing an error.
    fireEvent.click(screen.getByRole("button", { name: /increment child state/i }));
    expect(screen.getByTestId("child-count")).toHaveTextContent("Child state: 1");

    fireEvent.click(screen.getByRole("button", { name: /cause error/i }));

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Temporary render failure")).toBeInTheDocument();
    expect(screen.queryByTestId("child-count")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.queryByText("Temporary render failure")).not.toBeInTheDocument();
    expect(screen.getByTestId("child-count")).toHaveTextContent("Child state: 0");
  });
});
