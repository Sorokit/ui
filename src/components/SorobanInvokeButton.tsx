import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

  async function invoke() {
    if (!isConnected || isInvokingRef.current || !client) return;

    // Cancel previous requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    isInvokingRef.current = true;
    setState("loading");
    setResult(null);
    setError(null);

    try {
      const { data, error: err } =
        await client.soroban.invokeContract(params);
      if (signal.aborted) return;
      if (err) {
        const message = friendlyError(err);
        setError(message);
        setState("error");
        onError?.(message);
        return;
      }
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
        const rawMessage = e instanceof Error ? e.message : "Unknown error";
        const msg = friendlyError(rawMessage);
        setError(msg);
        setState("error");
        onError?.(msg);
      }
    } finally {
      isInvokingRef.current = false;
    }
  }

  const buttonLabel = label ?? `${params.method}()`;
  const loadingLabel = !label ? `Invoking ${params.method}…` : "Invoking…";

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant={variant}
          size={size}
          loading={state === "loading"}
          disabled={!isConnected || state === "loading"}
          onClick={invoke}
          title={!isConnected ? "Connect wallet to invoke" : tooltip}
        >
          {state === "loading" ? loadingLabel : buttonLabel}
        </Button>

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
