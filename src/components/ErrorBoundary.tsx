import { AlertCircleIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[sorokit-ui] Uncaught error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-base px-4">
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
                : "See the browser console for details."}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
