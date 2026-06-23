import { useState } from "react";
import { useSorokit } from "@/context/SorokitProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { getClient } from "@/lib/client";

type State = "idle" | "loading" | "success" | "error";

export function SorobanPanel() {
  const { isConnected, address } = useSorokit();
  const [contractId, setContractId] = useState("");
  const [method, setMethod] = useState("");
  const [args, setArgs] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const canInvoke = isConnected && contractId.trim() && method.trim();

  async function invoke(e: React.FormEvent) {
    e.preventDefault();
    if (!canInvoke) return;
    setState("loading");
    setError(null);
    setResult(null);
    try {
      let parsedArgs: unknown[] = [];
      if (args.trim()) {
        try {
          parsedArgs = JSON.parse(args.trim());
        } catch {
          setError("Invalid JSON in arguments");
          setState("error");
          return;
        }
      }
      const { data, error: err } = await getClient().soroban.invokeContract({
        contractId: contractId.trim(),
        method: method.trim(),
        args: parsedArgs,
        sourceAccount: address ?? undefined,
      });
      if (err) {
        setError(err);
        setState("error");
        return;
      }
      setResult(data);
      setState("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Contract Invoke
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            Call a Soroban smart contract method
          </p>
        </div>
        <Badge variant="teal">Soroban</Badge>
      </div>

      <div className="px-6 py-6">
        {!isConnected ? (
          <p className="text-[13px] text-ink-3 text-center py-8">
            Connect your wallet to invoke contracts
          </p>
        ) : (
          <form onSubmit={invoke} className="flex flex-col gap-5">
            <Input
              label="Contract ID"
              placeholder="C..."
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              disabled={state === "loading"}
            />
            <Input
              label="Method"
              placeholder="transfer, balance, mint…"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={state === "loading"}
            />
            <div className="flex flex-col gap-2">
              <label
                htmlFor="soroban-args"
                className="text-[12px] font-medium text-ink-2"
              >
                Arguments (JSON array)
              </label>
              <textarea
                id="soroban-args"
                placeholder='["arg1", 42]'
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                disabled={state === "loading"}
                rows={3}
                className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] font-mono text-ink placeholder:text-ink-4 outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim transition-colors resize-none disabled:opacity-40"
              />
            </div>

            {state === "success" && result !== null && (
              <div className="rounded-lg bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.15)] px-5 py-4 flex flex-col gap-3">
                <Badge variant="success" dot>
                  Result
                </Badge>
                <pre className="text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
            {state === "error" && error && (
              <div className="rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.15)] px-5 py-4">
                <p className="text-[13px] text-red">{error}</p>
              </div>
            )}
          </form>
        )}
      </div>

      <div className="px-6 py-4 border-t border-line flex items-center gap-3">
        {(state === "success" || state === "error") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setState("idle");
              setResult(null);
              setError(null);
            }}
          >
            Clear
          </Button>
        )}
        <Button
          size="md"
          loading={state === "loading"}
          disabled={!canInvoke}
          onClick={invoke as unknown as React.MouseEventHandler}
        >
          {state === "loading" ? "Invoking…" : "Invoke Contract"}
        </Button>
      </div>
    </div>
  );
}
