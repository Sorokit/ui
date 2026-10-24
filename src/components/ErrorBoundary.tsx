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
   * Use it to re-attempt the work that failed — e.g. re-initialising the
   * Sorokit client after `createSorokitClient()` threw — so the retried render
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
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    resetKey: 0,
    componentStack: null,
    copied: false,
  };

  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentWillUnmount() {
    if (this.copyResetTimer) clearTimeout(this.copyResetTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, componentStack: info.componentStack ?? null });

    if (this.props.onError) {
      this.props.onError(error, info);
      return;
    }

    if (import.meta.env.DEV) {
      console.error("[sorokit-ui] Uncaught error:", error, info.componentStack);
    }
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
    }));
  };

  private buildDiagnostics() {
    const { error, componentStack } = this.state;
    const lines = [
      "sorokit-ui error report",
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
    const { error, resetKey, componentStack, copied } = this.state;
    const { children, fallback, isolate, supportUrl } = this.props;

    if (!error) return <div key={resetKey}>{children}</div>;

    if (fallback) {
      const fallbackNode = fallback(error, this.reset);

      return isolate ? (
        <div
          className="overflow-hidden rounded-xl border border-line bg-surface"
        >
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
