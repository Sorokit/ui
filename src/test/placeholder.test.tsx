/**
 * Smoke test for the shared test harness (#552). If jsdom, React Testing
 * Library or the jest-dom matchers wired up in `src/test/setup.ts` are
 * misconfigured, this file fails before any component test gets a chance to.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function HarnessProbe() {
  return (
    <section>
      <h1>Test harness ready</h1>
      <span data-testid="answer">42</span>
    </section>
  );
}

describe("test harness (#552)", () => {
  it("renders React components into jsdom", () => {
    render(<HarnessProbe />);

    expect(
      screen.getByRole("heading", { name: "Test harness ready" }),
    ).toBeInTheDocument();
  });

  it("exposes jest-dom matchers and the DOM globals tests rely on", () => {
    render(<HarnessProbe />);

    expect(screen.getByTestId("answer")).toHaveTextContent("42");
    expect(typeof document.createElement).toBe("function");
  });
});
