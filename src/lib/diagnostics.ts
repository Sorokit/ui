/**
 * Turn Soroban simulation failures into plain-English explanations.
 *
 * A failed simulation comes back as a host error string (e.g.
 * `HostError: Error(WasmVm, InvalidAction)`) followed by diagnostic events,
 * which may be pretty-printed by the RPC client or left as raw base64 XDR.
 * Showing either verbatim is useless to most users, so this pulls out the
 * contract's panic message and the host error code and describes them.
 */

export interface ContractPanic {
  /** Plain-English summary suitable for display. */
  summary: string;
  /** The panic message the contract emitted, when one was found. */
  panicMessage: string | null;
  /** Host error type/code, e.g. `{ type: "Contract", code: "#3" }`. */
  hostError: { type: string; code: string } | null;
}

/** Explanations for the host error codes users actually hit. */
const HOST_ERROR_DESCRIPTIONS: Record<string, string> = {
  "WasmVm:InvalidAction": "The contract panicked (trapped) while executing.",
  "WasmVm:InvalidInput": "The contract was called with arguments it could not decode.",
  "Budget:ExceededLimit": "The contract ran out of its CPU or memory budget.",
  "Storage:MissingValue": "The contract tried to read a ledger entry that does not exist.",
  "Storage:ExceededLimit": "The contract exceeded the ledger read/write footprint.",
  "Auth:InvalidAction": "A required authorization signature was missing or invalid.",
  "Value:InvalidInput": "The contract received a value of the wrong type.",
  "Object:IndexBounds": "The contract accessed a vector or map index that is out of bounds.",
  "Object:UnexpectedSize": "The contract received data of an unexpected size.",
  "Context:InvalidAction": "The contract made a call that is not allowed in this context.",
  "Crypto:InvalidInput": "A signature or hash passed to the contract was malformed.",
};

const HOST_ERROR_PATTERN = /Error\(\s*([A-Za-z]+)\s*,\s*(#?\d+|[A-Za-z]+)\s*\)/;

/** Panic message from Rust's `panic!` / `unwrap` / `expect` in contract code. */
const PANIC_PATTERNS = [
  /panicked at '([^']+)'/,
  /panicked at [^\n:]+(?::\d+){0,2}:\s*\n?\s*([^\n"\]]+)/,
  /"(?:caller|contract) panicked[^"]*:\s*([^"]+)"/i,
  /\bpanic(?:ked)?:\s*"?([^"\n\]]+)"?/i,
];

/** Strings worth inspecting: the text itself plus any decoded base64 blobs. */
function candidateTexts(raw: string): string[] {
  const texts = [raw];
  // Base64-encoded XDR diagnostic events. SCVal strings and symbols are stored
  // as length-prefixed UTF-8, so the printable runs inside the decoded bytes
  // include the panic message without needing a full XDR decoder.
  for (const blob of raw.match(/[A-Za-z0-9+/]{24,}={0,2}/g) ?? []) {
    const printable = decodeBase64Printable(blob);
    if (printable) texts.push(printable);
  }
  return texts;
}

function decodeBase64Printable(blob: string): string | null {
  let binary: string;
  try {
    binary = atob(blob);
  } catch {
    return null;
  }
  const runs = binary.match(/[\x20-\x7e]{4,}/g);
  return runs ? runs.join("\n") : null;
}

function findPanicMessage(texts: string[]): string | null {
  for (const text of texts) {
    for (const pattern of PANIC_PATTERNS) {
      const match = pattern.exec(text);
      if (match?.[1]?.trim()) return match[1].trim();
    }
  }
  // Decoded XDR with a "panic"/"error" topic but no `panicked at` wrapper:
  // fall back to the longest readable sentence after it.
  for (const text of texts.slice(1)) {
    const lines = text.split("\n");
    const topic = lines.findIndex((line) => /^(panic|error)$/i.test(line.trim()));
    if (topic !== -1) {
      const message = lines
        .slice(topic + 1)
        .find((line) => /[a-z]{2,}\s+[a-z]{2,}/i.test(line));
      if (message) return message.trim();
    }
  }
  return null;
}

/**
 * Extract a contract panic from a simulation error. Returns `null` when the
 * text doesn't look like a contract/host failure at all (e.g. a plain
 * network error), so callers can show it as-is.
 */
export function parseContractPanic(raw: string | null | undefined): ContractPanic | null {
  if (!raw) return null;

  const texts = candidateTexts(raw);
  const panicMessage = findPanicMessage(texts);

  let hostError: ContractPanic["hostError"] = null;
  for (const text of texts) {
    const match = HOST_ERROR_PATTERN.exec(text);
    if (match) {
      hostError = { type: match[1], code: match[2] };
      break;
    }
  }

  if (!panicMessage && !hostError) return null;

  let summary: string;
  if (hostError?.type === "Contract") {
    const code = hostError.code.replace(/^#/, "");
    summary = `The contract rejected the call with its own error code ${code}.`;
  } else if (hostError) {
    summary =
      HOST_ERROR_DESCRIPTIONS[`${hostError.type}:${hostError.code}`] ??
      `The contract failed with a ${hostError.type} error (${hostError.code}).`;
  } else {
    summary = HOST_ERROR_DESCRIPTIONS["WasmVm:InvalidAction"];
  }

  if (panicMessage) summary = `${summary} Reason: "${panicMessage}".`;

  return { summary, panicMessage, hostError };
}
