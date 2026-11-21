import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useSorokit } from "@/context/useSorokit";
import type { InvokeParams } from "@/lib/client";
import { cn, friendlyError } from "@/lib/utils";

type InvokeState = "idle" | "loading" | "success" | "error";

interface SorobanInvokeButtonProps {
  /** The contract invocation params */
  params: InvokeParams;
  /** Button label */
  label?: string;
  /** Tooltip text when connected */
  tooltip?: string;
  /** Maximum height in pixels for result container before scroll (default: 200) */
  maxResultHeight?: number;
  /** Show result inline below the button */
  showResult?: boolean;
  /** Called on success with the result data */
  onSuccess?: (data: unknown) => void;
  /** Called on error */
  onError?: (error: string) => void;
  /** Automatically reset state after this many milliseconds on success */
  autoResetAfter?: number;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Normalizes any thrown/rejected value into a display-safe string. Contract
 * panics and RPC failures don't always surface as a plain string or an
 * `Error` with a `.message` — some arrive as a bare object (e.g.
 * `{ panic: "..." }`), a nested error, or something unserializable — and
 * `friendlyError` expects a string. This extracts the best available text so
 * that step never itself throws.
 */
function toErrorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === "object") {
    const maybe = e as { message?: unknown; panic?: unknown; error?: unknown };
    if (typeof maybe.message === "string") return maybe.message;
    if (typeof maybe.panic === "string") return maybe.panic;
    if (typeof maybe.error === "string") return maybe.error;
    try {
      return JSON.stringify(e);
    } catch {
      return "Unknown error";
    }
  }
  return "Unknown error";
}

export function SorobanInvokeButton({
  params,
  label,
  tooltip,
  maxResultHeight = 200,
  showResult = true,
  onSuccess,
  onError,
  autoResetAfter,
  variant = "primary",
  size = "md",
  className,
}: SorobanInvokeButtonProps) {
  const { isConnected, client } = useSorokit();
  const [state, setState] = useState<InvokeState>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const isInvokingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  async function invoke() {
    if (
      !isConnected ||
      isInvokingRef.current ||
      !client ||
      !params.contractId?.trim() ||
      !params.method?.trim()
    )
      return;

    // Cancel previous requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isInvokingRef.current = true;
    setState("loading");
    setResult(null);
    setError(null);

    // Tracks whether this invocation reached a terminal (success/error)
    // state itself. The `finally` block below is the safety net: no matter
    // what shape the failure takes — a rejected promise, a thrown non-Error
    // value, a response that doesn't destructure cleanly, a bare contract
    // panic object — loading must never be left stuck on. The only
    // legitimate reason to skip that reset is this exact invocation having
    // been superseded by a newer one or the component having unmounted.
    let settled = false;
    try {
      const { data, error: err } =
        await client.soroban.invokeContract(params);
      if (signal.aborted) return;
      if (err) {
        const message = friendlyError(toErrorMessage(err));
        settled = true;
        setError(message);
        setState("error");
        onError?.(message);
        return;
      }
      settled = true;
      setResult(data);
      setState("success");
      onSuccess?.(data);

      // Auto-reset after specified delay if autoResetAfter is provided
      if (autoResetAfter && autoResetAfter > 0) {
        resetTimeoutRef.current = setTimeout(() => {
          setState("idle");
          setResult(null);
          setError(null);
        }, autoResetAfter);
      }
    } catch (e) {
      if (!signal.aborted) {
        const msg = friendlyError(toErrorMessage(e));
        settled = true;
        setError(msg);
        setState("error");
        onError?.(msg);
      }
    } finally {
      isInvokingRef.current = false;
      // If this invocation never resolved to success/error above and it
      // wasn't superseded or unmounted, force it out of "loading" so the
      // button can never get stuck.
      if (!settled && !signal.aborted && isMountedRef.current) {
        const msg = friendlyError("An unexpected error occurred while invoking the contract.");
        setError(msg);
        setState("error");
        onError?.(msg);
      }
    }
  }

  const buttonLabel = label ?? `${params.method}()`;
  const loadingLabel = !label ? `Invoking ${params.method}…` : "Invoking…";

  const missingArgs = !params.contractId?.trim() || !params.method?.trim();

  /**
   * The exact reason the button is inactive, so hovering over a disabled
   * button tells the user what to fix instead of just "nothing happens".
   * Order matters: a disconnected wallet is checked first since it blocks
   * everything else regardless of the params passed in.
   */
  const disabledReason = !isConnected
    ? "Connect wallet to invoke"
    : state === "loading"
      ? "Invocation already in progress"
      : missingArgs
        ? "Missing contract ID or method — nothing to invoke"
        : null;

  const isDisabled = disabledReason !== null;

  // Cleanup timeout and pending request on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Tooltip content={isDisabled ? disabledReason : tooltip ?? ""}>
          <Button
            variant={variant}
            size={size}
            loading={state === "loading"}
            disabled={isDisabled}
            onClick={invoke}
            title={isDisabled ? disabledReason ?? undefined : tooltip}
          >
            {state === "loading" ? loadingLabel : buttonLabel}
          </Button>
        </Tooltip>

        {state === "success" && (
          <Badge variant="success" dot>
            Done
          </Badge>
        )}
        {state === "error" && <Badge variant="error">Failed</Badge>}
        {(state === "success" || state === "error") && (
          <button
            type="button"
            aria-label="Reset invocation result"
            onClick={() => {
              if (resetTimeoutRef.current) {
                clearTimeout(resetTimeoutRef.current);
              }
              setState("idle");
              setResult(null);
              setError(null);
            }}
            className="text-[11px] text-ink-3 hover:text-ink-2 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {showResult && state === "success" && result !== null && (
        <div className="rounded-lg bg-success-dim-subtle border border-success-dim px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-1.5">
            Result
          </p>
          <div
            className="overflow-y-auto"
            style={{ maxHeight: `${maxResultHeight}px` }}
          >
            <pre className="text-[11px] font-mono text-ink-2 whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {showResult && state === "error" && error && (
        <div className="rounded-lg bg-error-dim-muted border border-error-dim px-4 py-3">
          <p className="text-[11px] text-red">{error}</p>
        </div>
      )}

      {!isConnected && (
        <p className="text-[11px] text-ink-3">Connect wallet to invoke</p>
      )}
    </div>
  );
}
