import { useCallback, useEffect, useState } from "react";
import { useSorokit } from "@/context/useSorokit";
import type { FeeData } from "@/components/FeeEstimator"; // Or wherever it's defined

let globalFeeData: FeeData | null = null;
let globalLoading = false;
let globalError: string | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

let activeInterval: number | null = null;
let pollingCount = 0;

export function useFeeData(refreshInterval = 0, isVisible: boolean = true) {
  const { client } = useSorokit();
  const [, forceRender] = useState({});

  const load = useCallback(async () => {
    if (!client || globalLoading) return;
    globalLoading = true;
    notify();
    try {
      const { data, error } = await client.transaction.estimateFee();
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
      globalError = e instanceof Error ? e.message : "Request timed out";
    } finally {
      globalLoading = false;
      notify();
    }
  }, [client]);

  useEffect(() => {
    const cb = () => forceRender({});
    subscribers.add(cb);
    return () => {
      subscribers.delete(cb);
      if (subscribers.size === 0) {
        globalFeeData = null;
        globalLoading = false;
        globalError = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !client) return;

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
  }, [client, isVisible, refreshInterval, load]);

  return {
    fee: globalFeeData,
    loading: globalLoading,
    error: globalError,
    load,
  };
}
