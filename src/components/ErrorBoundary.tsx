import {
  AlertCircleIcon,
  Copy01Icon,
  Refresh01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { cn } from "../lib/utils";
import { copyToClipboard } from "./AccountCard";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Called when the boundary catches an error. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * Called when the user retries, before the boundary clears its error state.
   * Use it to re-attempt the work that failed â€” e.g. re-initialising the
   * Sorokit client after `createSorokitClient()` threw â€” so the retried render
   * has a working dependency instead of throwing again immediately.
   */
  onRetry?: () => void;
  /** Render fallback content as an in-page scoped panel instead of a full-page state. */
  isolate?: boolean;
  /** Optional support URL shown in the default fallback. */
  supportUrl?: string;
}

interface State {
  error: Error | null;
  resetKey: number;
  componentStack: string | null;
  copied: boolean;
  /** Short ID derived from the error stack â€” shown in UI and logged together. */
  errorId: string | null;
}

/**
 * Derive a short, stable error ID from the stack string.
 *
 * Uses SubtleCrypto when available (all modern browsers and Node â‰¥ 15) and
 * falls back to a simple djb2 hash so the function is always synchronous and
 * never throws. The ID is 8 hex chars â€” long enough to be collision-resistant
 * in practice, short enough to screenshot and quote to support.
 */
function deriveErrorId(stack: string | undefined): string {
  if (!stack) return "00000000";

  // Fast djb2 fallback â€” works in every environment without async.
  let hash = 5381;
  for (let i = 0; i < stack.length; i++) {
    hash = ((hash << 5) + hash) ^ stack.charCodeAt(i);
    hash = hash >>> 0; // keep u32
  }
  return hash.toString(16).padStart(8, "0");
}

/** Catches descendant render errors and displays a recoverable fallback. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    resetKey: 0,
    componentStack: null,
    copied: false,
    errorId: null,
  };

  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    // errorId is set here so it is available on the very first render of the
    // fallback UI (getDerivedStateFromError runs before componentDidCatch).
    const errorId = deriveErrorId(error.stack);
    return { error, errorId };
  }

  componentWillUnmount() {
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = deriveErrorId(error.stack);
    this.setState({ error, componentStack: info.componentStack ?? null, errorId });

    if (this.props.onError) {
      this.props.onError(error, info);
      return;
    }

    // Always log the full stack with the error ID so support can correlate a
    // screenshot of the UI ("Error #abc12345") with the console output â€” even
    // in production where the full message is not shown to the user.
    console.error(`[sorokit-ui] Uncaught error (id: ${errorId}):`, error, info);
  }

  reset = () => {
    // Runs before the state clears so a re-initialisation attempt is already
    // done by the time children re-mount under the new resetKey.
    this.props.onRetry?.();
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.setState((state) => ({
      error: null,
      resetKey: state.resetKey + 1,
      componentStack: null,
      copied: false,
      errorId: null,
    }));
  };

  private buildDiagnostics() {
    const { error, componentStack, errorId } = this.state;
    const lines = [
      "sorokit-ui error report",
      `Error ID: ${errorId ?? "unknown"}`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "unknown"}`,
      `User agent: ${
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
      }`,
      "",
      `Message: ${error?.message ?? "Unknown error"}`,
    ];

    if (error?.stack) lines.push("", "Stack:", error.stack);
    if (componentStack) lines.push("", "Component stack:", componentStack);

    return lines.join("\n");
  }

  handleCopy = async () => {
    const ok = await copyToClipboard(this.buildDiagnostics());
    if (!ok) return;

    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
    this.setState({ copied: true });
    this.copyResetTimer = setTimeout(() => {
      this.copyResetTimer = null;
      this.setState({ copied: false });
    }, 2000);
  };

  render() {
    const { error, resetKey, componentStack, copied, errorId } = this.state;
    const { children, fallback, isolate, supportUrl } = this.props;

    if (!error) return <div key={resetKey}>{children}</div>;

    if (fallback) {
      const fallbackNode = fallback(error, this.reset);

      return isolate ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {fallbackNode}
        </div>
      ) : (
        fallbackNode
      );
    }

    return (
      <div
        className={cn(
          "flex items-center justify-center bg-base px-4",
          isolate
            ? "min-h-[260px] overflow-hidden rounded-xl border border-line bg-surface py-8"
            : "min-h-screen"
        )}
      >
        <div className="w-full max-w-[400px] flex flex-col items-center gap-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-error-dim border border-error-dim-strong flex items-center justify-center">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={24}
              color="currentColor"
              strokeWidth={1.5}
              className="text-red"
            />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-[18px] font-semibold text-ink">
              Something went wrong
            </h2>
            <p className="text-[13px] text-ink-3 leading-relaxed">
              An unexpected error occurred. You can try reloading the page or
              resetting the component.
            </p>
          </div>
          <div className="w-full rounded-xl border border-error-dim bg-error-dim-subtle px-5 py-4 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-2">
              Error
            </p>
            {/* Always show the error ID so users can share it with support
                without pasting a full stack. The full stack is in the console
                under the same ID, keeping production logs useful while keeping
                the UI clean. */}
            {errorId && (
              <p
                className="text-[11px] font-mono text-ink-3 mb-1"
                data-testid="error-id"
              >
                Error #{errorId}
              </p>
            )}
            <p className="text-[12px] font-mono text-red break-all">
              {import.meta.env.DEV
                ? error.message
                : "Details are hidden in production."}
            </p>
          </div>
          {supportUrl && (
            <a
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-brand hover:underline"
            >
              Report this issue
            </a>
          )}
          {import.meta.env.DEV && componentStack && (
            <details className="w-full rounded-xl border border-line bg-surface-2 px-4 py-3 text-left">
              <summary className="cursor-pointer text-[11px] font-medium text-ink-3">
                Show component stack
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] text-ink-3">
                {componentStack}
              </pre>
            </details>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleCopy}
              aria-live="polite"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-surface-2 border border-line hover:border-line-2 text-[13px] text-ink-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <HugeiconsIcon
                icon={copied ? Tick01Icon : Copy01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
              {copied ? "Copied!" : "Copy error details"}
            </button>
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-surface-2 border border-line hover:border-line-2 text-[13px] text-ink-2 transition-colors cursor-pointer"
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                size={14}
                color="currentColor"
                strokeWidth={1.5}
              />
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover transition-colors cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export { deriveErrorId };
