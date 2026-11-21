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

/** Soroban argument types that take a structured JSON value (issue #653). */
const COMPLEX_ARG_TYPES: ReadonlySet<string> = new Set([
  "vec",
  "map",
  "struct",
  "tuple",
  "sequence",
]);

/** Soroban contract IDs are exactly 56 chars: `C` + 55 base32 characters. */
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

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

/**
 * A reviewable stand-in for a Soroban authorization entry (#906). Methods
 * that take more than one `address` argument commonly need a signature from
 * each one (a multi-auth invocation), not just the account submitting the
 * transaction. Full XDR SorobanAuthorizationEntry parsing/encoding isn't
 * available anywhere in this client layer (sorokit-core's client.ts has no
 * auth-entry API to build on), so this stays a client-side review step: the
 * `address`-typed argument values on the selected method, each reviewable and
 * individually markable as "needs authorization" before the call is handed
 * off to whatever actually signs and submits it.
 */
export interface AuthEntryReview {
  argName: string;
  address: string;
  needsAuth: boolean;
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
    authEntries: AuthEntryReview[];
  }) => void;
}

/** The `address`-typed arguments of a method, in declaration order, each
 *  paired with its current raw value (blank if not yet filled in). These are
 *  the candidates a multi-auth invocation may need a signature from. */
function deriveAddressArgs(
  method: ContractMethod | undefined,
  argValues: Record<string, string>,
): { argName: string; address: string }[] {
  if (!method) return [];
  return method.args
    .filter((arg) => arg.type === "address")
    .map((arg) => ({ argName: arg.name, address: (argValues[arg.name] ?? "").trim() }));
}

function validateContractId(id: string): string | null {
  const value = id.trim();
  if (!value) return "Contract address is required";
  if (!value.startsWith("C")) return "Contract address must start with 'C'";
  if (value.length < 56) return "Contract address is too short";
  // Issue #653: enforce the full 56-char base32 format instead of the old
  // "starts with C and is at least 10 chars" check, which accepted invalid IDs.
  if (!CONTRACT_ID_PATTERN.test(value)) {
    return "Contract address is not a valid Soroban contract ID";
  }
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
    ? methodDef.args.map((arg) => ({
        name: arg.name,
        type: arg.type,
        value: args[arg.name] ?? null,
      }))
    : Object.entries(args).map(([name, value]) => ({
        name,
        value: value || null,
      }));

  // Issue #653: return a base64 SCVal/call preview rather than a pseudo-string,
  // so it can be copied into tools that expect an encoded payload.
  const json = JSON.stringify({ contractId, method, args: formattedArgs });
  try {
    return btoa(json);
  } catch {
    return json;
  }
}

/**
 * Recursively checks a parsed JSON value for the nested `vec`/`map`/`tuple`/
 * `struct` argument types (#906). `JSON.parse` alone only proves the text is
 * syntactically valid JSON; it says nothing about whether an element nested
 * several levels deep is actually usable as a Soroban value. Soroban has no
 * implicit null inside a vec/tuple/map entry the way JSON does, so `null`,
 * `undefined`, and empty-string elements anywhere in the structure, however
 * deeply nested, are flagged as a value the caller still needs to fill in
 * rather than being silently accepted (and later failing at the RPC layer
 * with a much less actionable error). An explicit Soroban `option` argument
 * is its own top-level type with its own input, not a bare null nested inside
 * one of these composite types, so there is no legitimate case where a
 * nested null/empty slot is intentional here.
 */
function findInvalidNestedValue(value: unknown, path: string): string | null {
  if (value === null || value === undefined) {
    return `${path} is empty — provide a value or remove this element`;
  }
  if (typeof value === "string" && value.trim() === "") {
    return `${path} is empty — provide a value or remove this element`;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const nested = findInvalidNestedValue(value[i], `${path}[${i}]`);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const nested = findInvalidNestedValue(entry, `${path}.${key}`);
      if (nested) return nested;
    }
    return null;
  }
  return null;
}

/** Validates a complex-type argument's raw text: syntactic JSON first, then a
 *  recursive structural pass. Returns null when the value is valid (or
 *  blank — an empty complex-type field is caught by the "all args filled"
 *  check elsewhere, not here). */
function validateComplexArgValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return "Invalid JSON";
  }
  return findInvalidNestedValue(parsed, "value");
}

const I128_MIN = -(2n ** 127n);
const I128_MAX = 2n ** 127n - 1n;
const U128_MIN = 0n;
const U128_MAX = 2n ** 128n - 1n;

/**
 * Safely parses a u128/i128 argument's raw text into a BigInt (#906). A bare
 * `BigInt(str)` call throws `SyntaxError: Cannot convert <value> to a BigInt`
 * on anything that isn't a clean integer literal (decimals, empty strings,
 * stray whitespace, "0x" prefixes BigInt doesn't accept the way parseInt
 * does, or plain non-numeric text), which would otherwise crash the render
 * instead of showing the user an inline error. Also range-checks the result
 * against the signed/unsigned 128-bit bounds so an out-of-range value is
 * caught here rather than failing opaquely once it reaches the contract.
 */
function parseSorobanInt128(raw: string, type: "i128" | "u128"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^-?\d+$/.test(trimmed)) {
    return `Enter a whole number for ${type} (no decimals, letters, or symbols)`;
  }
  let parsed: bigint;
  try {
    parsed = BigInt(trimmed);
  } catch {
    return `"${trimmed}" is not a valid ${type} value`;
  }
  const [min, max] = type === "i128" ? [I128_MIN, I128_MAX] : [U128_MIN, U128_MAX];
  if (parsed < min || parsed > max) {
    return `Value is out of range for ${type} (${min} to ${max})`;
  }
  return null;
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
    // Issue #906: u128/i128 need BigInt-range validation — a plain `number`
    // input silently loses precision above 2^53, and a bare `BigInt(value)`
    // call throws on anything that isn't a clean integer literal.
    const int128Error = parseSorobanInt128(value, type);
    return (
      <div className="flex flex-col gap-1">
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${arg.type} (e.g. 1000000)`}
          aria-label={arg.name}
          aria-invalid={int128Error ? true : undefined}
        />
        {int128Error && (
          <p role="alert" className="text-[11px] text-red">
            {int128Error}
          </p>
        )}
      </div>
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

  if (COMPLEX_ARG_TYPES.has(type)) {
    // Issue #653: complex Soroban types get a structured JSON input with live
    // validation instead of a plain unvalidated text field. Issue #906: that
    // validation is now recursive, so an empty/null element nested inside a
    // vec, tuple, map, or struct is caught too, not just top-level syntax.
    const jsonError = validateComplexArgValue(value);
    return (
      <div className="flex flex-col gap-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${type} as JSON`}
          aria-label={arg.name}
          aria-invalid={jsonError ? true : undefined}
          rows={3}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-mono text-ink outline-none focus:ring-1 focus:ring-brand"
        />
        {jsonError && (
          <p role="alert" className="text-[11px] text-red">
            {jsonError}
          </p>
        )}
      </div>
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
  /** argName -> whether the user has marked that address argument as
   *  requiring its own authorization entry. Defaults to true whenever a new
   *  address-typed argument appears, since a multi-auth method's whole point
   *  is that more than one party needs to sign. */
  const [authRequired, setAuthRequired] = useState<Record<string, boolean>>({});

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

  const addressArgs = useMemo(
    () => deriveAddressArgs(activeMethod, argValues),
    [activeMethod, argValues],
  );

  const authEntries: AuthEntryReview[] = useMemo(
    () =>
      addressArgs.map(({ argName, address }) => ({
        argName,
        address,
        needsAuth: authRequired[argName] ?? true,
      })),
    [addressArgs, authRequired],
  );

  const handleAuthToggle = useCallback((argName: string) => {
    setAuthRequired((prev) => ({ ...prev, [argName]: !(prev[argName] ?? true) }));
  }, []);

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
      setAuthRequired({});
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
      authEntries,
    });
    onInvoke?.(contractId, selectedMethod, args);
  }, [
    contractId,
    selectedMethod,
    activeMethod,
    argValues,
    xdrPreview,
    authEntries,
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

        {authEntries.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
              Authorization Entries
            </span>
            <p className="text-[11px] text-ink-3">
              This method takes {authEntries.length} address arguments. Review which ones need their own authorization entry before invoking.
            </p>
            <div className="flex flex-col gap-2">
              {authEntries.map((entry) => (
                <div
                  key={entry.argName}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-medium text-ink-2">Signer: {entry.argName}</span>
                    <span className="text-[11px] font-mono text-ink-3 truncate">
                      {entry.address || "(not set)"}
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-ink-2 shrink-0">
                    <input
                      type="checkbox"
                      checked={entry.needsAuth}
                      onChange={() => handleAuthToggle(entry.argName)}
                      aria-label={`${entry.argName} requires authorization`}
                    />
                    Requires auth
                  </label>
                </div>
              ))}
            </div>
          </div>
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
