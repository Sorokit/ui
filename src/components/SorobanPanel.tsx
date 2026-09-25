import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSorokit } from "@/context/useSorokit";

import { ContractInteractionDebugger } from "./ContractInteractionDebugger";

type State = "idle" | "loading" | "success" | "error";

interface SorobanPanelProps {
  contractId: string;
  onContractIdChange: (contractId: string) => void;
  mode?: "invoke" | "simulate";
}

const CONTRACT_HISTORY_KEY = "sorokit-soroban-contract-history";
const CONTRACT_HISTORY_LIMIT = 10;
const CONTRACT_HISTORY_DATALIST_ID = "sorokit-soroban-contract-history-list";

function parseArgsInput(raw: string): {
  parsedArgs: unknown[];
  errorMessage: string | null;
} {
  if (!raw.trim()) return { parsedArgs: [], errorMessage: null };

  try {
    const parsed = JSON.parse(raw.trim());
    if (!Array.isArray(parsed)) {
      return {
        parsedArgs: [],
        errorMessage: 'Arguments must be a JSON array (e.g. ["arg1", 42])',
      };
    }
    return { parsedArgs: parsed, errorMessage: null };
  } catch {
    return { parsedArgs: [], errorMessage: "Invalid JSON in arguments" };
  }
}

function extractTxHash(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const maybeHash = data as { hash?: unknown; txHash?: unknown };
  if (typeof maybeHash.hash === "string") return maybeHash.hash;
  if (typeof maybeHash.txHash === "string") return maybeHash.txHash;
  return null;
}

function readContractHistory(): string[] {
  try {
    const raw = localStorage.getItem(CONTRACT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function addContractToHistory(contractId: string, current: string[]): string[] {
  const next = [contractId, ...current.filter((id) => id !== contractId)].slice(
    0,
    CONTRACT_HISTORY_LIMIT,
  );
  try {
    localStorage.setItem(CONTRACT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (e.g. private browsing) — history is best-effort
  }
  return next;
}

function buildCurlCommand(
  contractId: string,
  method: string,
  args: unknown[],
): string {
  const body = JSON.stringify({ contractId, method, args }, null, 2);
  return `curl -X POST https://soroban-rpc.example.com/invoke \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
}

export function SorobanPanel({
  contractId,
  onContractIdChange,
  mode = "invoke",
}: SorobanPanelProps) {
  const { isConnected, address, client } = useSorokit();
  const [method, setMethod] = useState("");
  const [args, setArgs] = useState("");
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curlCopied, setCurlCopied] = useState(false);
  const [contractHistory, setContractHistory] = useState<string[]>(() =>
    readContractHistory(),
  );
  const [abiOpen, setAbiOpen] = useState(false);
  const [abiRaw, setAbiRaw] = useState("");
  const [abiMethods, setAbiMethods] = useState<string[]>([]);
  const [abiError, setAbiError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const argsRef = useRef(args);
  const formId = useId();

  useEffect(() => {
    argsRef.current = args;
  });

  const prevContractIdRef = useRef(contractId);
  useEffect(() => {
    if (prevContractIdRef.current !== contractId) {
      prevContractIdRef.current = contractId;
      setResult(null);
      setError(null);
      setState("idle");
    }
  }, [contractId]);

  const isArgsJsonValid = useMemo(() => {
    if (!args.trim()) return true;
    try {
      JSON.parse(args);
      return true;
    } catch {
      return false;
    }
  }, [args]);

  const canInvoke =
    Boolean(isConnected && contractId.trim() && method.trim()) &&
    isArgsJsonValid &&
    state !== "loading";

  async function doInvoke() {
    if (!canInvoke) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setState("loading");
    setError(null);
    setResult(null);
    setTxHash(null);
    try {
      const { parsedArgs, errorMessage } = parseArgsInput(argsRef.current);
      if (errorMessage) {
        if (!signal.aborted) setError(errorMessage);
        if (!signal.aborted) setState("error");
        return;
      }
      if (!client) return;
      const soroban = client.soroban;
      if (mode === "simulate") {
        const { data, error: err } = await soroban.simulateContract({
          contractId: contractId.trim(),
          method: method.trim(),
          args: parsedArgs,
          sourceAccount: address ?? undefined,
        });
        if (signal.aborted) return;
        if (err) {
          setError(err);
          setState("error");
          return;
        }
        setResult(data);
        setTxHash(extractTxHash(data));
        setState("success");
        setContractHistory((prev) =>
          addContractToHistory(contractId.trim(), prev),
        );
      } else {
        const { data, error: err } = await soroban.invokeContract({
          contractId: contractId.trim(),
          method: method.trim(),
          args: parsedArgs,
          sourceAccount: address ?? undefined,
        });
        if (signal.aborted) return;
        if (err) {
          setError(err);
          setState("error");
          return;
        }
        setResult(data);
        setTxHash(extractTxHash(data));
        setState("success");
        setContractHistory((prev) =>
          addContractToHistory(contractId.trim(), prev),
        );
      }
    } catch (e: unknown) {
      if (signal.aborted) return;
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "An unexpected error occurred while invoking the contract.";
      setError(message);
      setState("error");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "loading") return;
    doInvoke();
  }

  function handleLoadAbi() {
    setAbiError(null);
    try {
      const parsed = JSON.parse(abiRaw);
      const methods: string[] = [];
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry.name && typeof entry.name === "string") {
            methods.push(entry.name);
          }
        }
      } else if (parsed.spec && Array.isArray(parsed.spec)) {
        for (const entry of parsed.spec) {
          if (entry.name && typeof entry.name === "string") {
            methods.push(entry.name);
          }
        }
      }
      if (methods.length === 0) {
        setAbiError("No method names found in the ABI spec");
        return;
      }
      setAbiMethods(methods);
    } catch {
      setAbiError("Invalid JSON — check the format and try again");
    }
  }

  const handleCopyCurl = useCallback(() => {
    const { parsedArgs } = parseArgsInput(argsRef.current);
    const curl = buildCurlCommand(contractId.trim(), method.trim(), parsedArgs);
    navigator.clipboard.writeText(curl);
  }, [contractId, method]);

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            {mode === "simulate" ? "Contract Simulate" : "Contract Invoke"}
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            {mode === "simulate"
              ? "Simulate a Soroban smart contract call (read-only)"
              : "Call a Soroban smart contract method"}
          </p>
        </div>
        <Badge variant={mode === "simulate" ? "warning" : "teal"}>
          {mode === "simulate" ? "Simulate" : "Soroban"}
        </Badge>
      </div>

      <div className="px-6 py-6">
        {!isConnected ? (
          <p className="text-[13px] text-ink-3 text-center py-8">
            Connect your wallet to {mode === "simulate" ? "simulate" : "invoke"} contracts
          </p>
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Contract ID"
              placeholder="C..."
              value={contractId}
              onChange={(e) => onContractIdChange(e.target.value)}
              disabled={state === "loading"}
              list={
                contractHistory.length > 0
                  ? CONTRACT_HISTORY_DATALIST_ID
                  : undefined
              }
            />
            {contractHistory.length > 0 && (
              <datalist id={CONTRACT_HISTORY_DATALIST_ID}>
                {contractHistory.map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="soroban-method"
                  className="text-[12px] font-medium text-ink-2"
                >
                  Method
                </label>
                <span className="text-[10px] text-ink-4">
                  {method.length}/64
                </span>
              </div>
              <input
                id="soroban-method"
                type="text"
                placeholder="transfer, balance, mint…"
                value={method}
                onChange={(e) => setMethod(e.target.value.slice(0, 64))}
                disabled={state === "loading"}
                maxLength={64}
                className="w-full rounded-lg border border-line bg-surface-2 px-4 py-2 text-[13px] text-ink placeholder:text-ink-4 outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim transition-colors disabled:opacity-40"
                list={abiMethods.length > 0 ? "soroban-abi-methods" : undefined}
              />
              {abiMethods.length > 0 && (
                <datalist id="soroban-abi-methods">
                  {abiMethods.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
            </div>
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
                onInput={(e) => {
                  const textarea = e.currentTarget;
                  textarea.rows = Math.max(
                    3,
                    textarea.value.split("\n").length,
                  );
                  textarea.style.height = "auto";
                  textarea.style.height = `${textarea.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void doInvoke();
                  }
                }}
                disabled={state === "loading"}
                rows={4}
                aria-invalid={args.trim() !== "" && !isArgsJsonValid}
                aria-describedby={
                  args.trim() !== "" && !isArgsJsonValid
                    ? "soroban-args-error"
                    : undefined
                }
                className="w-full resize-y min-h-[80px] rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] font-mono text-ink placeholder:text-ink-4 outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim transition-colors disabled:opacity-40"
              />
              {args.trim() !== "" && !isArgsJsonValid && (
                <p id="soroban-args-error" className="text-[11px] text-red">
                  Invalid JSON in arguments
                </p>
              )}
            </div>

            {state !== "idle" && (
              <div className="relative min-h-32" aria-live="polite">
                {state === "loading" && (
                  <div
                    role="status"
                    aria-label={mode === "simulate" ? "Simulating contract" : "Invoking contract"}
                    className="absolute inset-0 flex h-full min-h-32 flex-col gap-3 rounded-lg border border-line bg-surface-2 p-5"
                  >
                    <span className="sr-only">{mode === "simulate" ? "Simulating contract" : "Invoking contract"}</span>
                    <div className="h-4 w-24 animate-pulse rounded bg-line" />
                    <div className="h-3 w-full animate-pulse rounded bg-line" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-line" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
                  </div>
                )}

                {state === "success" && result !== null && (
                  <div className="flex flex-col gap-3 rounded-lg border border-success-dim bg-success-dim-subtle px-5 py-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="success" dot>
                        {mode === "simulate" ? "Simulation Result" : "Result"}
                      </Badge>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const curl = buildCurlCommand(contractId.trim(), method.trim(), parseArgsInput(args).parsedArgs);
                          navigator.clipboard.writeText(curl);
                          setCurlCopied(true);
                          setTimeout(() => setCurlCopied(false), 1600);
                        }}
                      >
                        {curlCopied ? "Copied" : "Copy as cURL"}
                      </Button>
                    </div>
                    <pre className="text-[12px] font-mono text-ink-2 whitespace-pre-wrap break-all">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                )}

                {(state === "success" || state === "error") && (
                  <ContractInteractionDebugger
                    contractId={contractId.trim()}
                    method={method.trim()}
                    args={parseArgsInput(args).parsedArgs}
                    state={state}
                    result={result}
                    txHash={txHash}
                    error={error}
                  />
                )}

                {state === "error" && error && (
                  <div className="rounded-lg bg-error-dim-muted border border-error-dim px-5 py-4">
                    <p className="text-[13px] text-red">{error}</p>
                  </div>
                )}

                {(state === "success" || state === "error") && (
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyCurl}
                    >
                      Copy as cURL
                    </Button>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </div>

      <div className="px-5 py-4 border-t border-line flex items-center gap-3">
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
        {state === "success" && mode === "invoke" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const curl = buildCurlCommand(contractId.trim(), method.trim(), parseArgsInput(args).parsedArgs);
              navigator.clipboard.writeText(curl);
              setCurlCopied(true);
              setTimeout(() => setCurlCopied(false), 1600);
            }}
          >
            {curlCopied ? "Copied" : "Copy as cURL"}
          </Button>
        )}
        <Button
          type="submit"
          form={formId}
          size="md"
          loading={state === "loading"}
          // `canInvoke` already requires state !== "loading".
          disabled={!canInvoke}
        >
          {state === "loading"
            ? mode === "simulate"
              ? "Simulating…"
              : "Invoking…"
            : mode === "simulate"
              ? "Simulate Contract"
              : "Invoke Contract"}
        </Button>
      </div>

      <div className="border-t border-line">
        <button
          type="button"
          onClick={() => setAbiOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-3 text-[12px] font-medium text-ink-2 hover:bg-surface-2 transition-colors"
        >
          <span>Load ABI</span>
          <span className="text-[10px]">{abiOpen ? "▾" : "▸"}</span>
        </button>
        {abiOpen && (
          <div className="px-6 pb-4 flex flex-col gap-3">
            <textarea
              placeholder="Paste contract ABI / spec JSON here…"
              value={abiRaw}
              onChange={(e) => setAbiRaw(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-[12px] font-mono text-ink placeholder:text-ink-4 outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim transition-colors resize-y"
            />
            {abiError && (
              <p className="text-[11px] text-red">{abiError}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleLoadAbi} disabled={!abiRaw.trim()}>
                Load
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAbiRaw("");
                  setAbiError(null);
                  setAbiMethods([]);
                }}
              >
                Clear
              </Button>
            </div>
            {abiMethods.length > 0 && (
              <p className="text-[11px] text-ink-3">
                {abiMethods.length} method{abiMethods.length !== 1 ? "s" : ""} loaded
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
