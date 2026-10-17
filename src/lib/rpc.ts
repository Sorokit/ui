const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 250;

export interface FetchRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  random?: () => number;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "AbortError"
  );
}

function abortError(): Error {
  if (typeof DOMException !== "undefined") {
    return new DOMException("The operation was aborted.", "AbortError");
  }
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function waitForRetry(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Fetch with bounded retries for transient RPC responses and network drops. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const maxRetries = Math.max(
    0,
    Math.floor(options.maxRetries ?? DEFAULT_MAX_RETRIES),
  );
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const signal = init?.signal ?? options.signal;

  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(input, { ...init, signal });
    } catch (error) {
      if (isAbortError(error) || !(error instanceof TypeError) || attempt >= maxRetries) {
        throw error;
      }

      const jitter = 0.5 + (options.random ?? Math.random)();
      await (options.wait ?? waitForRetry)(
        baseDelayMs * 2 ** attempt * jitter,
        signal,
      );
      continue;
    }

    if (!RETRYABLE_HTTP_STATUSES.has(response.status) || attempt >= maxRetries) {
      return response;
    }

    const jitter = 0.5 + (options.random ?? Math.random)();
    await (options.wait ?? waitForRetry)(
      baseDelayMs * 2 ** attempt * jitter,
      signal,
    );
  }
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Extract Horizon detail and Stellar operation result codes from an error body. */
export function formatStellarError(body: unknown): string | null {
  if (!isJsonObject(body)) return null;

  const rpcError = isJsonObject(body.error) ? body.error : null;
  const detail =
    (typeof body.detail === "string" && body.detail) ||
    (rpcError && typeof rpcError.message === "string" && rpcError.message) ||
    null;
  const extras = isJsonObject(body.extras)
    ? body.extras
    : rpcError && isJsonObject(rpcError.extras)
      ? rpcError.extras
      : null;
  const resultCodes = extras && isJsonObject(extras.result_codes)
    ? extras.result_codes
    : null;
  const operations = resultCodes?.operations;
  const operationCodes = Array.isArray(operations)
    ? operations.filter((code): code is string => typeof code === "string")
    : [];

  if (operationCodes.length === 0) return detail;
  const codes = `operation codes: ${operationCodes.join(", ")}`;
  return detail ? `${detail} (${codes})` : codes;
}