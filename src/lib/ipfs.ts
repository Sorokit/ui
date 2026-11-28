/**
 * Public gateways tried in order when an `ipfs://` asset fails to load.
 * A 429 (rate limit) or 504 (gateway timeout) from one gateway says nothing
 * about the others, so every request walks this list before giving up.
 */
export const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://dweb.link/ipfs/",
] as const;

export const IPFS_GATEWAY_COUNT = IPFS_GATEWAYS.length;

/** Time allowed for a single gateway request before moving to the next one. */
export const IPFS_REQUEST_TIMEOUT_MS = 8_000;

/** CIDv0: base58btc multihash, always 46 characters starting with "Qm". */
const CID_V0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
/**
 * CIDv1 in its canonical base32 (lowercase, "b" multibase prefix) form, e.g.
 * "bafybei…" or "bafkrei…". Gateways also accept the base36 "k…" form used
 * for IPNS keys, so that is allowed too.
 */
const CID_V1_BASE32 = /^b[a-z2-7]{58,}$/;
const CID_V1_BASE36 = /^k[0-9a-z]{49,}$/;

export interface IpfsPath {
  cid: string;
  /** Sub-path inside the CID's DAG, without a leading slash ("" when none). */
  path: string;
}

/** True when `value` is a CIDv0 or a base32/base36 CIDv1 string. */
export function isValidCid(value: string): boolean {
  return CID_V0.test(value) || CID_V1_BASE32.test(value) || CID_V1_BASE36.test(value);
}

/**
 * Split an IPFS reference into its CID and nested file path. Accepts
 * `ipfs://<cid>[/path]`, the legacy `ipfs://ipfs/<cid>[/path]` form and
 * gateway URLs (`https://host/ipfs/<cid>[/path]`). Returns `null` for
 * anything else, including a malformed CID.
 */
export function parseIpfsUri(uri: string): IpfsPath | null {
  const trimmed = uri.trim();
  let rest: string;

  if (trimmed.toLowerCase().startsWith("ipfs://")) {
    rest = trimmed.slice("ipfs://".length).replace(/^\/*ipfs\//i, "");
  } else {
    const gatewayMatch = /^https?:\/\/[^/]+\/ipfs\/(.+)$/i.exec(trimmed);
    if (!gatewayMatch) return null;
    rest = gatewayMatch[1];
  }

  // Drop a query string or fragment; neither is part of the content path.
  rest = rest.replace(/[?#].*$/, "").replace(/^\/+/, "");
  const slash = rest.indexOf("/");
  const rawCid = slash === -1 ? rest : rest.slice(0, slash);
  const path = slash === -1 ? "" : rest.slice(slash + 1).replace(/\/+$/, "");

  // CIDv1 base32 is case-insensitive; gateways expect the lowercase form.
  const cid = CID_V0.test(rawCid) ? rawCid : rawCid.toLowerCase();
  if (!isValidCid(cid)) return null;

  return { cid, path };
}

/** CID path from an `ipfs://` URL, or null when the value is not an IPFS URL. */
export function ipfsContentPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith("ipfs://")) return null;

  const parsed = parseIpfsUri(trimmed);
  if (parsed) return parsed.path ? `${parsed.cid}/${parsed.path}` : parsed.cid;

  // Not a recognisable CID — pass the raw path through so a gateway can still
  // try it rather than failing outright.
  const path = trimmed.slice("ipfs://".length).replace(/^ipfs\//i, "");
  return path.length > 0 ? path : null;
}

/**
 * Map an `ipfs://` URL onto a gateway. `gatewayIndex` walks
 * {@link IPFS_GATEWAYS} after a load failure. Other URLs are returned as-is.
 */
export function resolveIpfsUrl(url: string, gatewayIndex = 0): string {
  const path = ipfsContentPath(url);
  if (path === null) return url;
  const index = Math.min(Math.max(gatewayIndex, 0), IPFS_GATEWAYS.length - 1);
  return `${IPFS_GATEWAYS[index]}${path}`;
}

/** Every gateway URL for an `ipfs://` URL, in fallback order. */
export function resolveIpfsUrls(url: string): string[] {
  if (ipfsContentPath(url) === null) return [url];
  return IPFS_GATEWAYS.map((_, index) => resolveIpfsUrl(url, index));
}

export interface FetchIpfsOptions {
  /** Per-gateway timeout in ms. Defaults to {@link IPFS_REQUEST_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Aborts the whole fallback chain, e.g. when the component unmounts. */
  signal?: AbortSignal;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Fetch an IPFS asset, failing over to the next gateway on a network error,
 * a non-2xx response (429 rate limit, 504 gateway timeout, …) or a request
 * that exceeds `timeoutMs`. Each attempt gets its own AbortController so a
 * stalled gateway is cancelled instead of hanging forever. Non-IPFS URLs are
 * fetched once with the same timeout.
 */
export async function fetchIpfsResource(
  url: string,
  { timeoutMs = IPFS_REQUEST_TIMEOUT_MS, signal, fetchImpl }: FetchIpfsOptions = {},
): Promise<Response> {
  const doFetch = fetchImpl ?? fetch;
  let lastError: unknown = null;

  for (const candidate of resolveIpfsUrls(url)) {
    if (signal?.aborted) throw new DOMException("IPFS request aborted", "AbortError");

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await doFetch(candidate, { signal: controller.signal });
      if (response.ok) return response;
      lastError = new Error(`IPFS gateway responded with HTTP ${response.status}`);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = controller.signal.aborted
        ? new Error(`IPFS gateway timed out after ${timeoutMs}ms`)
        : error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All IPFS gateways failed");
}
