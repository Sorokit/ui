import { useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useSorokit } from "@/context/useSorokit";
import type { InvokeParams } from "@/lib/client";
import { getClient } from "@/lib/client";
import { cn, friendlyError } from "@/lib/utils";

type InvokeState = "idle" | "loading" | "success" | "error";

interface SorobanInvokeButtonProps {
  /** The contract invocation params */
  params: InvokeParams;
  /** Button label */
  label?: string;
  /** Show result inline below the button */
  showResult?: boolean;
  /** Called on success with the result data */
  onSuccess?: (data: unknown) => void;
  /** Called on error */
  onError?: (error: string) => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function SorobanInvokeButton({
  params,
  label,
  showResult = true,
  onSuccess,
  onError,
  variant = "primary",
  size = "md",
  className,
}: SorobanInvokeButtonProps) {
  const { isConnected } = useSorokit();
  const [state, setState] = useState<InvokeState>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const isInvokingRef = useRef(false);

  async function invoke() {
    if (!isConnected || isInvokingRef.current) return;

    isInvokingRef.current = true;
    setState("loading");
    setResult(null);
    setError(null);

    try {
      const { data, error: err } =
        await getClient().soroban.invokeContract(params);
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
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : "Unknown error";
      const msg = friendlyError(rawMessage);
      setError(msg);
      setState("error");
      onError?.(msg);
    } finally {
      isInvokingRef.current = false;
    }
  }

  const buttonLabel = label ?? `${params.method}()`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant={variant}
          size={size}
          loading={state === "loading"}
          disabled={!isConnected || state === "loading"}
          onClick={invoke}
          title={!isConnected ? "Connect wallet to invoke" : undefined}
        >
          {state === "loading" ? "Invoking…" : buttonLabel}
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
          <pre className="text-[11px] font-mono text-ink-2 whitespace-pre-wrap break-all">
            {JSON.stringify(result, null, 2)}
          </pre>
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
