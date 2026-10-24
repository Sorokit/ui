import { useCallback, useEffect, useState } from "react";

import type { FeeData } from "@/components/FeeEstimator"; // Or wherever it's defined
import { useSorokit } from "@/context/useSorokit";

let globalFeeData: FeeData | null = null;
let globalLoading = false;
let globalError: string | null = null;
const subscribers = new Set<() => void>();
// Network the cached fee data belongs to, and a generation counter bumped on
// every network switch so a request still in flight for the old network can
// never write its (stale) result into the new network's cache.
let globalNetworkKey: string | null = null;
let globalGeneration = 0;

function notify() {
  subscribers.forEach((cb) => cb());
}

let activeInterval: number | null = null;
let pollingCount = 0;

function networkKey(network: { name?: string; passphrase?: string } | null | undefined): string | null {
  if (!network) return null;
  return `${network.name ?? ""}|${network.passphrase ?? ""}`;
}

export function useFeeData(refreshInterval = 0, isVisible: boolean = true) {
  const { client, network } = useSorokit();
  const [, forceRender] = useState({});
  const currentNetworkKey = networkKey(network);

  // #955 — pause polling while the tab is backgrounded. Browsers throttle
  // timers in hidden tabs anyway, so the poll buys nothing there but still
  // costs network requests; `visibilitychange` lets the interval be cleared
  // outright and re-armed with a fresh estimate when the tab comes back.
  const [tabVisible, setTabVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : document.visibilityState !== "hidden",
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      setTabVisible(document.visibilityState !== "hidden");
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const load = useCallback(async () => {
    if (!client || globalLoading) return;
    const generation = globalGeneration;
    globalLoading = true;
    notify();
    try {
      const { data, error } = await client.transaction.estimateFee();
      if (generation !== globalGeneration) return;
      if (error) {
        globalError = error;
      } else if (data) {
        globalFeeData = {
          baseFee: Math.max(100, parseInt(data.baseFee || "0", 10) || 0).toString(),
          recommended: Math.max(100, parseInt(data.recommended || "0", 10) || 0).toString(),
        };
        globalError = null;
      }
    } catch (e) {
      if (generation !== globalGeneration) return;
      globalError = e instanceof Error ? e.message : "Request timed out";
    } finally {
      if (generation === globalGeneration) {
        globalLoading = false;
        notify();
      }
    }
  }, [client]);

  // Issue #958: on a network switch, drop the previous network's fees at once
  // (instead of showing them until the next polling tick) and fetch fresh
  // ones. Several mounted estimators share this cache; the first to see the
  // new network key performs the reset, the rest find it already current.
  useEffect(() => {
    if (currentNetworkKey === globalNetworkKey) return;
    const isSwitch = globalNetworkKey !== null && currentNetworkKey !== null;
    globalNetworkKey = currentNetworkKey;
    if (!isSwitch) return;

    globalGeneration++;
    globalFeeData = null;
    globalError = null;
    globalLoading = false;
    notify();
    void load();
  }, [currentNetworkKey, load]);

  useEffect(() => {
    const cb = () => forceRender({});
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
      if (subscribers.size === 0) {
        globalFeeData = null;
        globalLoading = false;
        globalError = null;
        globalNetworkKey = null;
        globalGeneration++;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !tabVisible || !client) return;

    // Always fetch immediately on mount/resume, unless already loading
    if (!globalLoading) {
      void load();
    }

    if (refreshInterval > 0) {
      pollingCount++;
      if (pollingCount === 1 && !activeInterval) {
        activeInterval = window.setInterval(() => {
          if (!globalLoading) void load();
        }, refreshInterval);
      }
      
      return () => {
        pollingCount--;
        if (pollingCount === 0 && activeInterval !== null) {
          clearInterval(activeInterval);
          activeInterval = null;
        }
      };
    }
  }, [client, isVisible, tabVisible, refreshInterval, load]);

  return {
    fee: globalFeeData,
    loading: globalLoading,
    error: globalError,
    load,
  };
}
