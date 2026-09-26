/** Public gateways tried in order when an `ipfs://` asset fails to load. */
export const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
] as const;

export const IPFS_GATEWAY_COUNT = IPFS_GATEWAYS.length;

/** CID path from an `ipfs://` URL, or null when the value is not an IPFS URL. */
export function ipfsContentPath(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.toLowerCase().startsWith("ipfs://")) return null;
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
