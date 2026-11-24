import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary, deriveErrorId } from "./ErrorBoundary";

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Boom({ message = "test error" }: { message?: string }): never {
  throw new Error(message);
}

function renderWithBoundary(opts: {
  dev?: boolean;
  isolate?: boolean;
  supportUrl?: string;
  onError?: ReturnType<typeof vi.fn>;
  onRetry?: ReturnType<typeof vi.fn>;
} = {}) {
  const { dev = false, ...rest } = opts;
  vi.stubEnv("DEV", dev);

  return render(
    <ErrorBoundary {...rest}>
      <Boom />
    </ErrorBoundary>
  );
}

// â”€â”€ deriveErrorId unit tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("deriveErrorId", () => {
  it("returns 8 hex characters", () => {
    const id = deriveErrorId("Error: boom\n  at Foo (foo.ts:1:1)");
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic for the same input", () => {
    const stack = "Error: same\n  at Bar (bar.ts:2:3)";
    expect(deriveErrorId(stack)).toBe(deriveErrorId(stack));
  });

  it("produces different IDs for different stacks", () => {
    expect(deriveErrorId("Error: a\n  at A")).not.toBe(
      deriveErrorId("Error: b\n  at B")
    );
  });

  it("handles undefined without throwing", () => {
    expect(() => deriveErrorId(undefined)).not.toThrow();
    expect(deriveErrorId(undefined)).toBe("00000000");
  });
});

// â”€â”€ ErrorBoundary component tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("ErrorBoundary â€” #1064", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllEnvs();
  });

  // â”€â”€ Error ID in UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("shows Error #<id> in the fallback UI in production mode", () => {
    vi.stubEnv("DEV", false);
    renderWithBoundary({ dev: false });

    const errorIdEl = screen.getByTestId("error-id");
    expect(errorIdEl.textContent).toMatch(/^Error #[0-9a-f]{8}$/);
  });

  it("shows Error #<id> in the fallback UI in dev mode", () => {
    vi.stubEnv("DEV", true);
    renderWithBoundary({ dev: true });

    const errorIdEl = screen.getByTestId("error-id");
    expect(errorIdEl.textContent).toMatch(/^Error #[0-9a-f]{8}$/);
  });

  it("shows the same ID in UI and in the console log", () => {
    vi.stubEnv("DEV", false);
    renderWithBoundary({ dev: false });

    const uiId = screen.getByTestId("error-id").textContent?.replace("Error #", "");

    // console.error was called with the error id in the message string
    const [firstArg] = consoleError.mock.calls[0] ?? [""];
    expect(firstArg).toContain(uiId);
  });

  // â”€â”€ Production mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("hides the error message text in production", () => {
    vi.stubEnv("DEV", false);
    renderWithBoundary({ dev: false });

    expect(screen.getByText("Details are hidden in production.")).toBeTruthy();
    expect(screen.queryByText("test error")).toBeNull();
  });

  it("logs full stack with the error ID in production", () => {
    vi.stubEnv("DEV", false);
    renderWithBoundary({ dev: false });

    expect(consoleError).toHaveBeenCalledOnce();
    const [msg, err] = consoleError.mock.calls[0];
    expect(msg).toMatch(/\[sorokit-ui\] Uncaught error \(id: [0-9a-f]{8}\)/);
    expect(err).toBeInstanceOf(Error);
  });

  // â”€â”€ Dev mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("shows the error message in dev mode", () => {
    vi.stubEnv("DEV", true);
    renderWithBoundary({ dev: true });

    expect(screen.getByText("test error")).toBeTruthy();
  });

  it("logs full stack with the error ID in dev mode", () => {
    vi.stubEnv("DEV", true);
    renderWithBoundary({ dev: true });

    expect(consoleError).toHaveBeenCalledOnce();
    const [msg] = consoleError.mock.calls[0];
    expect(msg).toMatch(/\[sorokit-ui\] Uncaught error \(id: [0-9a-f]{8}\)/);
  });

  // â”€â”€ onError callback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("calls onError instead of logging when provided", () => {
    const onError = vi.fn();
    vi.stubEnv("DEV", false);
    render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(consoleError).not.toHaveBeenCalled();
  });

  // â”€â”€ Fallback UI elements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("renders the default fallback with retry and reload buttons", () => {
    renderWithBoundary();

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(screen.getByText("Reload page")).toBeTruthy();
    expect(screen.getByText("Copy error details")).toBeTruthy();
  });

  it("renders a custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={(err) => <div>Custom: {err.message}</div>}>
        <Boom message="custom fallback error" />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom: custom fallback error")).toBeTruthy();
  });

  it("shows the supportUrl link when provided", () => {
    renderWithBoundary({ supportUrl: "https://support.example.com" });

    const link = screen.getByText("Report this issue");
    expect(link.getAttribute("href")).toBe("https://support.example.com");
  });

  // â”€â”€ Reset / retry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("calls onRetry and clears the error when Try again is clicked", async () => {
    const onRetry = vi.fn();
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) throw new Error("first render error");
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary onRetry={onRetry}>
        <MaybeThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByText("Try again"));

    rerender(
      <ErrorBoundary onRetry={onRetry}>
        <MaybeThrow />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText("Recovered")).toBeTruthy();
    });

    expect(onRetry).toHaveBeenCalledOnce();
  });

  // â”€â”€ isolate prop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("applies isolate styling when isolate=true", () => {
    renderWithBoundary({ isolate: true });

    // The outer container gets the isolate class
    const container = screen
      .getByText("Something went wrong")
      .closest(".min-h-\\[260px\\]");
    expect(container).toBeTruthy();
  });
});
