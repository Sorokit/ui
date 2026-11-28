import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchIpfsResource,
  IPFS_GATEWAYS,
  IPFS_REQUEST_TIMEOUT_MS,
  ipfsContentPath,
  isValidCid,
  parseIpfsUri,
  resolveIpfsUrl,
  resolveIpfsUrls,
} from "./ipfs";

const CID_V0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const CID_V1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const CID_V1_RAW = "bafkreidgvpkjawlxz6sffxzwgooowe5yt7i6wsyg236mfoks77nywkptdq";

describe("isValidCid", () => {
  it("accepts CIDv0 and base32 CIDv1 strings", () => {
    expect(isValidCid(CID_V0)).toBe(true);
    expect(isValidCid(CID_V1)).toBe(true);
    expect(isValidCid(CID_V1_RAW)).toBe(true);
  });

  it("rejects malformed CIDs", () => {
    expect(isValidCid("")).toBe(false);
    expect(isValidCid("Qm123")).toBe(false);
    // '0' and 'l' are not in base58btc.
    expect(isValidCid(`Qm0${CID_V0.slice(3)}`)).toBe(false);
    // '1' and '8' are not in the base32 alphabet.
    expect(isValidCid(`bafy18${CID_V1.slice(6)}`)).toBe(false);
    expect(isValidCid("not-a-cid")).toBe(false);
  });
});

describe("parseIpfsUri", () => {
  it("parses a CIDv1 base32 URI with a nested sub-path", () => {
    expect(parseIpfsUri(`ipfs://${CID_V1}/metadata.json`)).toEqual({
      cid: CID_V1,
      path: "metadata.json",
    });
    expect(parseIpfsUri(`ipfs://${CID_V1}/assets/images/1.png`)).toEqual({
      cid: CID_V1,
      path: "assets/images/1.png",
    });
  });

  it("parses CIDv0 URIs with and without a path", () => {
    expect(parseIpfsUri(`ipfs://${CID_V0}`)).toEqual({ cid: CID_V0, path: "" });
    expect(parseIpfsUri(`ipfs://${CID_V0}/0.json`)).toEqual({ cid: CID_V0, path: "0.json" });
  });

  it("handles the legacy ipfs://ipfs/ prefix", () => {
    expect(parseIpfsUri(`ipfs://ipfs/${CID_V1}/metadata.json`)).toEqual({
      cid: CID_V1,
      path: "metadata.json",
    });
  });

  it("parses existing gateway URLs so they can be re-routed", () => {
    expect(parseIpfsUri(`https://gateway.example.com/ipfs/${CID_V1}/a/b.json`)).toEqual({
      cid: CID_V1,
      path: "a/b.json",
    });
  });

  it("lowercases an upper-case CIDv1 and strips query strings and trailing slashes", () => {
    expect(parseIpfsUri(`ipfs://${CID_V1.toUpperCase()}/meta.json?x=1#top`)).toEqual({
      cid: CID_V1,
      path: "meta.json",
    });
    expect(parseIpfsUri(`ipfs://${CID_V1}/dir/`)).toEqual({ cid: CID_V1, path: "dir" });
  });

  it("returns null for non-IPFS URLs and invalid CIDs", () => {
    expect(parseIpfsUri("https://example.com/cat.png")).toBeNull();
    expect(parseIpfsUri("ipfs://not-a-cid/meta.json")).toBeNull();
    expect(parseIpfsUri("ipfs://")).toBeNull();
  });
});

describe("resolveIpfsUrl", () => {
  it("resolves a CIDv1 base32 URI with a sub-path to a valid gateway endpoint", () => {
    expect(resolveIpfsUrl(`ipfs://${CID_V1}/metadata.json`)).toBe(
      `https://ipfs.io/ipfs/${CID_V1}/metadata.json`,
    );
  });

  it("walks the gateway list by index and clamps out-of-range indexes", () => {
    const uri = `ipfs://${CID_V0}/0.json`;
    IPFS_GATEWAYS.forEach((gateway, i) => {
      expect(resolveIpfsUrl(uri, i)).toBe(`${gateway}${CID_V0}/0.json`);
    });
    expect(resolveIpfsUrl(uri, 99)).toBe(`${IPFS_GATEWAYS.at(-1)}${CID_V0}/0.json`);
    expect(resolveIpfsUrl(uri, -1)).toBe(`${IPFS_GATEWAYS[0]}${CID_V0}/0.json`);
  });

  it("leaves non-IPFS URLs untouched", () => {
    expect(resolveIpfsUrl("https://example.com/cat.png")).toBe("https://example.com/cat.png");
  });

  it("includes Cloudflare, ipfs.io and Pinata in the fallback list", () => {
    const urls = resolveIpfsUrls(`ipfs://${CID_V1}`);
    expect(urls).toHaveLength(IPFS_GATEWAYS.length);
    expect(urls.some((u) => u.startsWith("https://cloudflare-ipfs.com/ipfs/"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://ipfs.io/ipfs/"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://gateway.pinata.cloud/ipfs/"))).toBe(true);
  });

  it("passes through a non-CID ipfs:// path rather than failing", () => {
    expect(ipfsContentPath("ipfs://bafytestcid/cat.png")).toBe("bafytestcid/cat.png");
  });
});

describe("fetchIpfsResource", () => {
  const uri = `ipfs://${CID_V1}/metadata.json`;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first successful gateway response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await fetchIpfsResource(uri, { fetchImpl });
    expect(await res.text()).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${IPFS_GATEWAYS[0]}${CID_V1}/metadata.json`);
  });

  it("fails over to the next gateway on HTTP 429 and 504", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response("", { status: 504 }))
      .mockResolvedValueOnce(new Response("third", { status: 200 }));

    const res = await fetchIpfsResource(uri, { fetchImpl });
    expect(await res.text()).toBe("third");
    expect(fetchImpl.mock.calls.map((c) => c[0])).toEqual([
      `${IPFS_GATEWAYS[0]}${CID_V1}/metadata.json`,
      `${IPFS_GATEWAYS[1]}${CID_V1}/metadata.json`,
      `${IPFS_GATEWAYS[2]}${CID_V1}/metadata.json`,
    ]);
  });

  it("fails over when a gateway throws a network error", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response("second", { status: 200 }));

    const res = await fetchIpfsResource(uri, { fetchImpl });
    expect(await res.text()).toBe("second");
  });

  it("aborts a stalled gateway after 8 seconds and moves to the next one", async () => {
    expect(IPFS_REQUEST_TIMEOUT_MS).toBe(8_000);
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal;
      signals.push(signal);
      if (signals.length === 1) {
        // Never responds — only the abort signal can end it.
        return new Promise<Response>((_, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
      }
      return Promise.resolve(new Response("fallback", { status: 200 }));
    });

    const pending = fetchIpfsResource(uri, { fetchImpl: fetchImpl as unknown as typeof fetch });
    await vi.advanceTimersByTimeAsync(IPFS_REQUEST_TIMEOUT_MS - 1);
    expect(signals[0].aborted).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    const res = await pending;
    expect(signals[0].aborted).toBe(true);
    expect(await res.text()).toBe("fallback");
  });

  it("rejects with a timeout error once every gateway stalls", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const pending = fetchIpfsResource(uri, { fetchImpl: fetchImpl as unknown as typeof fetch });
    const assertion = expect(pending).rejects.toThrow(/timed out after 8000ms/);
    await vi.advanceTimersByTimeAsync(IPFS_REQUEST_TIMEOUT_MS * IPFS_GATEWAYS.length);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(IPFS_GATEWAYS.length);
  });

  it("rejects with the last HTTP error when every gateway fails", async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(new Response("", { status: 429 })));
    await expect(fetchIpfsResource(uri, { fetchImpl })).rejects.toThrow("HTTP 429");
    expect(fetchImpl).toHaveBeenCalledTimes(IPFS_GATEWAYS.length);
  });

  it("stops the fallback chain when the caller aborts", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const pending = fetchIpfsResource(uri, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: controller.signal,
    });
    const assertion = expect(pending).rejects.toThrow("aborted");
    controller.abort();
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetches non-IPFS URLs once with the same timeout", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("img", { status: 200 }));
    await fetchIpfsResource("https://example.com/cat.png", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://example.com/cat.png");
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
