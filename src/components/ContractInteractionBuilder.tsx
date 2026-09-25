import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useId, useMemo, useState } from "react";

import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export const SOROBAN_TYPES = [
  "address",
  "bool",
  "bytes",
  "bytesN",
  "duration",
  "i128",
  "i32",
  "i64",
  "map",
  "option",
  "sequence",
  "string",
  "struct",
  "symbol",
  "timepoint",
  "tuple",
  "u128",
  "u32",
  "u64",
  "vec",
  "void",
] as const;

type SorobanType = (typeof SOROBAN_TYPES)[number];

interface ContractMethodArg {
  name: string;
  type: SorobanType;
  description?: string;
}

interface ContractMethod {
  name: string;
  args: ContractMethodArg[];
  description?: string;
  returnType?: SorobanType;
}

export interface ContractSpec {
  contractId: string;
  methods: ContractMethod[];
}

export interface ContractInteractionBuilderProps {
  className?: string;
  spec?: ContractSpec;
  contractSpec?: ContractSpec;
  onInvoke?: (contractId: string, method: string, args: unknown[]) => void;
  onParamsReady?: (params: {
    contractId: string;
    method: string;
    args: unknown[];
    xdr: string;
  }) => void;
}

function validateContractId(id: string): string | null {
  if (!id) return "Contract address is required";
  if (!id.startsWith("C")) return "Contract address must start with 'C'";
  if (id.length < 10) return "Contract address is too short";
  return null;
}

function buildXdrPreview(
  contractId: string,
  method: string,
  args: Record<string, string>,
  methodDef: ContractMethod | undefined,
): string {
  if (!contractId || !method) return "";
  const formattedArgs = methodDef
    ? methodDef.args
        .map(
          (arg) => `  ${arg.name}: ${args[arg.name] ?? `<${arg.type}>`}`,
        )
        .join(",\n")
    : Object.entries(args)
        .map(([k, v]) => `  ${k}: ${v || "<value>"}`)
        .join(",\n");

  return `${contractId}.${method}(\n${formattedArgs}\n)`;
}

function renderArgInput(
  arg: ContractMethodArg,
  value: string,
  onChange: (val: string) => void,
) {
  const type = arg.type;

  if (type === "bool") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-brand"
        aria-label={arg.name}
      >
        <option value="">Select…</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (type === "i32" || type === "u32" || type === "i64" || type === "u64") {
    return (
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${arg.type}`}
        aria-label={arg.name}
      />
    );
  }

  if (type === "i128" || type === "u128") {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${arg.type} (e.g. 1000000)`}
        aria-label={arg.name}
      />
    );
  }

  if (type === "address") {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="G… or C…"
        aria-label={arg.name}
      />
    );
  }

  if (type === "string" || type === "symbol") {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Enter ${arg.type} value`}
        aria-label={arg.name}
      />
    );
  }

  if (type === "bytes" || type === "bytesN") {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Hex or base64 encoded bytes"
        aria-label={arg.name}
      />
    );
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${arg.type} value`}
      aria-label={arg.name}
    />
  );
}

export function ContractInteractionBuilder({
  className,
  spec: externalSpecProp,
  contractSpec,
  onInvoke,
  onParamsReady,
}: ContractInteractionBuilderProps) {
  const externalSpec = externalSpecProp ?? contractSpec;
  const titleId = useId();
  const [contractId, setContractId] = useState(
    externalSpec?.contractId ?? "",
  );
  const [contractError, setContractError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [argValues, setArgValues] = useState<Record<string, string>>({});

  const [prevExternalSpec, setPrevExternalSpec] = useState(externalSpec);
  if (prevExternalSpec !== externalSpec) {
    setPrevExternalSpec(externalSpec);
    if (externalSpec) {
      setContractId(externalSpec.contractId);
    }
  }

  const activeMethod = useMemo(() => {
    if (!externalSpec || !selectedMethod) return undefined;
    return externalSpec.methods.find((m: ContractMethod) => m.name === selectedMethod);
  }, [externalSpec, selectedMethod]);

  const xdrPreview = useMemo(() => {
    return buildXdrPreview(
      contractId,
      selectedMethod,
      argValues,
      activeMethod,
    );
  }, [contractId, selectedMethod, argValues, activeMethod]);

  const handleContractIdChange = useCallback(
    (value: string) => {
      setContractId(value);
      setContractError(validateContractId(value));
    },
    [],
  );

  const handleMethodSelect = useCallback(
    (method: string) => {
      setSelectedMethod(method);
      if (externalSpec) {
        const methodDef = externalSpec.methods.find((m: ContractMethod) => m.name === method);
        if (methodDef) {
          const initial: Record<string, string> = {};
          methodDef.args.forEach((arg: ContractMethodArg) => {
            initial[arg.name] = "";
          });
          setArgValues(initial);
        }
      }
    },
    [externalSpec],
  );

  const handleArgChange = useCallback(
    (argName: string, value: string) => {
      setArgValues((prev) => ({ ...prev, [argName]: value }));
    },
    [],
  );

  const handleCopyXdr = useCallback(async () => {
    if (!xdrPreview) return;
    try {
      await navigator.clipboard.writeText(xdrPreview);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = xdrPreview;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }, [xdrPreview]);

  const handleGenerateParams = useCallback(() => {
    if (!contractId || !selectedMethod) return;
    const args = activeMethod
      ? activeMethod.args.map((arg: ContractMethodArg) => argValues[arg.name] ?? "")
      : Object.values(argValues);
    onParamsReady?.({
      contractId,
      method: selectedMethod,
      args,
      xdr: xdrPreview,
    });
    onInvoke?.(contractId, selectedMethod, args);
  }, [
    contractId,
    selectedMethod,
    activeMethod,
    argValues,
    xdrPreview,
    onParamsReady,
    onInvoke,
  ]);

  const allArgsFilled = activeMethod
    ? activeMethod.args.every((arg: ContractMethodArg) => argValues[arg.name]?.trim())
    : true;

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
      role="region"
      aria-labelledby={titleId}
    >
      <div className="px-5 py-4 border-b border-line">
        <h3 id={titleId} className="text-[13px] font-semibold text-ink">
          Contract Interaction Builder
        </h3>
        <p className="text-[11px] text-ink-3 mt-0.5">
          Build Soroban contract calls interactively
        </p>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="contract-id-input"
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4"
          >
            Contract Address
          </label>
          <Input
            id="contract-id-input"
            type="text"
            value={contractId}
            onChange={(e) => handleContractIdChange(e.target.value)}
            placeholder="C…"
            aria-invalid={!!contractError || undefined}
            aria-describedby={contractError ? "contract-id-error" : undefined}
          />
          {contractError && (
            <p
              id="contract-id-error"
              role="alert"
              className="text-[11px] text-red"
            >
              {contractError}
            </p>
          )}
        </div>

        {externalSpec && externalSpec.methods.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="method-select"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4"
            >
              Method
            </label>
            <select
              id="method-select"
              value={selectedMethod}
              onChange={(e) => handleMethodSelect(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">Select a method…</option>
              {externalSpec.methods.map((method: ContractMethod) => (
                <option key={method.name} value={method.name}>
                  {method.name}
                  {method.description ? ` — ${method.description}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeMethod && activeMethod.args.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Arguments
            </span>
            {activeMethod.args.map((arg: ContractMethodArg) => (
              <div key={arg.name} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-ink-2">
                    {arg.name}
                  </span>
                  <span className="text-[10px] text-ink-4 font-mono">
                    {arg.type}
                  </span>
                  {arg.description && (
                    <span
                      className="text-[10px] text-ink-4 cursor-help ml-auto"
                      title={arg.description}
                      aria-label={arg.description}
                    >
                      ⓘ
                    </span>
                  )}
                </div>
                {renderArgInput(arg, argValues[arg.name] ?? "", (val) =>
                  handleArgChange(arg.name, val),
                )}
              </div>
            ))}
          </div>
        )}

        {activeMethod && activeMethod.args.length === 0 && (
          <p className="text-[12px] text-ink-3">
            This method takes no arguments.
          </p>
        )}

        {xdrPreview && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                Generated Call Preview
              </span>
              <button
                type="button"
                onClick={handleCopyXdr}
                className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                aria-label="Copy generated XDR"
              >
                <HugeiconsIcon
                  icon={Copy01Icon}
                  size={12}
                  color="currentColor"
                  strokeWidth={1.5}
                />
                Copy
              </button>
            </div>
            <pre className="rounded-lg bg-surface-2 border border-line p-3 text-[11px] font-mono text-ink-2 whitespace-pre-wrap break-all">
              {xdrPreview}
            </pre>
          </div>
        )}

        {onParamsReady && (
          <button
            type="button"
            disabled={
              !contractId || !selectedMethod || (!!activeMethod && !allArgsFilled)
            }
            onClick={handleGenerateParams}
            className={cn(
              "w-full h-9 rounded-lg text-[13px] font-medium transition-colors",
              "bg-brand text-white hover:bg-brand-hover",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            Generate Contract Call
          </button>
        )}
      </div>
    </div>
  );
}
