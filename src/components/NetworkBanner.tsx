import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { NavSection } from "@/components/Sidebar";
import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

export interface BannerConfig {
  label: string | null;
  dot: string;
  bar: string;
  text: string;
  show: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  dotColor?: string;
}

export const BANNER_CONFIG: Record<string, BannerConfig> = {
  mainnet: {
    label: "Mainnet",
    dot: "bg-green",
    bar: "bg-success-dim-muted border-b border-success-dim",
    text: "text-green",
    show: false,
  },
  testnet: {
    label: "Testnet",
    dot: "bg-orange",
    bar: "bg-[rgba(249,115,22,0.06)] border-b border-[rgba(249,115,22,0.15)]",
    text: "text-orange",
    show: true,
  },
  futurenet: {
    label: "Futurenet",
    dot: "bg-purple",
    bar: "bg-[rgba(168,85,247,0.06)] border-b border-[rgba(168,85,247,0.15)]",
    text: "text-purple",
    show: true,
  },
  localnet: {
    label: "Localnet",
    dot: "bg-ink-3",
    bar: "bg-surface-2 border-b border-line",
    text: "text-ink-2",
    show: true,
  },
  standalone: {
    label: "Standalone",
    dot: "bg-ink-3",
    bar: "bg-surface-2 border-b border-line",
    text: "text-ink-2",
    show: true,
  },
  custom: {
    label: null,
    dot: "bg-ink-3",
    bar: "bg-surface-2 border-b border-line",
    text: "text-ink-2",
    show: true,
  },
};

const DEFAULT_STORAGE_KEY_PREFIX = "sorokit-banner-dismissed";

function getStorageDismissed(networkName: string, customKey?: string): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    if (customKey) {
      return window.sessionStorage.getItem(customKey) === "true";
    }
    return (
      window.sessionStorage.getItem(`${DEFAULT_STORAGE_KEY_PREFIX}-${networkName}`) === "true" ||
      window.sessionStorage.getItem(`sorokit-network-banner-dismissed-${networkName}`) === "true" ||
      window.sessionStorage.getItem("sorokit-network-banner-dismissed") === "true"
    );
  } catch {
    return false;
  }
}

function setStorageDismissed(networkName: string, customKey?: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const key = customKey ?? `${DEFAULT_STORAGE_KEY_PREFIX}-${networkName}`;
    window.sessionStorage.setItem(key, "true");
  } catch {
    // best effort in storage-restricted environments
  }
}

const MINIMIZED_KEY_PREFIX = "sorokit-banner-minimized";

function minimizedKey(networkName: string, customKey?: string): string {
  return customKey
    ? `${customKey}-minimized`
    : `${MINIMIZED_KEY_PREFIX}-${networkName}`;
}

function getStorageMinimized(networkName: string, customKey?: string): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    const key = minimizedKey(networkName, customKey);
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function setStorageMinimized(
  networkName: string,
  minimized: boolean,
  customKey?: string,
): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const key = minimizedKey(networkName, customKey);
    window.sessionStorage.setItem(key, String(minimized));
  } catch {
    // best effort in storage-restricted environments
  }
}

/** Round-trip time above which the RPC is reported as degraded. */
const DEFAULT_DEGRADED_LATENCY_MS = 500;
const DEFAULT_LATENCY_INTERVAL_MS = 30_000;

interface RpcHealth {
  latencyMs: number | null;
  failed: boolean;
}

/**
 * Periodically pings the RPC `getHealth` method and reports the round-trip
 * time. Only runs when `enabled`; aborts the in-flight request on cleanup.
 */
function useRpcLatency(
  rpcUrl: string | undefined,
  enabled: boolean,
  intervalMs: number,
): RpcHealth {
  const [health, setHealth] = useState<RpcHealth>({
    latencyMs: null,
    failed: false,
  });

  useEffect(() => {
    if (!enabled || !rpcUrl || typeof fetch === "undefined") return;
    let controller: AbortController | null = null;

    const probe = async () => {
      controller?.abort();
      controller = new AbortController();
      const started = performance.now();
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`RPC responded with ${res.status}`);
        setHealth({
          latencyMs: Math.round(performance.now() - started),
          failed: false,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setHealth({ latencyMs: null, failed: true });
      }
    };

    void probe();
    const timer = setInterval(() => void probe(), intervalMs);
    return () => {
      clearInterval(timer);
      controller?.abort();
    };
  }, [rpcUrl, enabled, intervalMs]);

  return health;
}

export interface NetworkBannerProps {
  active?: NavSection;
  config?: Partial<Record<string, Partial<BannerConfig>>>;
  /** Always show even on mainnet */
  alwaysShow?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Layout positioning strategy. Defaults to "relative" so the banner flows in document order
   * without obscuring TopBar or navigation elements.
   */
  position?: "relative" | "sticky" | "fixed";
  /** Whether the banner can be dismissed for the current user session. Defaults to true. */
  dismissible?: boolean;
  /** Custom sessionStorage key or prefix for tracking dismiss state. */
  storageKey?: string;
  /** Callback invoked when the banner is dismissed. */
  onDismiss?: () => void;
  /** Custom background color (CSS string or hex) */
  backgroundColor?: string;
  /** Custom border color (CSS string or hex) */
  borderColor?: string;
  /** Custom text color (CSS string or hex) */
  textColor?: string;
  /** Custom dot indicator color (CSS string or hex) */
  dotColor?: string;
  /** Custom class for the dismiss button */
  dismissButtonClassName?: string;
  /**
   * Whether the banner can be collapsed into a compact status dot. The state
   * is kept in sessionStorage. Defaults to true.
   */
  minimizable?: boolean;
  /**
   * Externally measured RPC latency in milliseconds. When provided it is used
   * instead of the built-in probe.
   */
  latencyMs?: number | null;
  /** Ping the RPC endpoint (`getHealth`) to measure latency. Defaults to false. */
  monitorLatency?: boolean;
  /** Latency (ms) at or above which the RPC is shown as degraded. Defaults to 500. */
  degradedLatencyMs?: number;
  /** How often to re-measure latency when `monitorLatency` is on. Defaults to 30s. */
  latencyIntervalMs?: number;
}

export function NetworkBanner({
  active,
  alwaysShow = false,
  config,
  className,
  style,
  position = "relative",
  dismissible = true,
  storageKey,
  onDismiss,
  backgroundColor,
  borderColor,
  textColor,
  dotColor,
  dismissButtonClassName,
  minimizable = true,
  latencyMs: latencyMsProp,
  monitorLatency = false,
  degradedLatencyMs = DEFAULT_DEGRADED_LATENCY_MS,
  latencyIntervalMs = DEFAULT_LATENCY_INTERVAL_MS,
}: NetworkBannerProps) {
  const { network } = useSorokit();
  const networkName = network?.name;

  const [dismissedMap, setDismissedMap] = useState<Record<string, boolean>>({});

  const [minimizedMap, setMinimizedMap] = useState<Record<string, boolean>>({});
  const isMinimized = Boolean(
    minimizable &&
      networkName &&
      (minimizedMap[networkName] ?? getStorageMinimized(networkName, storageKey)),
  );

  const probed = useRpcLatency(
    network?.rpcUrl,
    monitorLatency && latencyMsProp === undefined,
    latencyIntervalMs,
  );
  const latencyMs = latencyMsProp ?? probed.latencyMs;
  const rpcFailed = latencyMsProp === undefined && probed.failed;
  const isDegraded =
    rpcFailed || (latencyMs !== null && latencyMs >= degradedLatencyMs);
  const healthText = rpcFailed
    ? "RPC unreachable"
    : latencyMs !== null
      ? `Latency: ${latencyMs}ms`
      : null;

  const isSessionDismissed = networkName
    ? getStorageDismissed(networkName, storageKey)
    : false;
  const isDismissed = Boolean(
    networkName && (dismissedMap[networkName] || isSessionDismissed),
  );

  const cfg = networkName
    ? {
        ...BANNER_CONFIG.custom,
        ...BANNER_CONFIG[networkName],
        ...config?.[networkName],
      }
    : BANNER_CONFIG.custom;

  const isVisible = Boolean(
    network &&
      active !== "network" &&
      (alwaysShow || cfg.show) &&
      !isDismissed,
  );

  const bannerRef = useRef<HTMLDivElement>(null);

  const updateHeight = useCallback(() => {
    if (!bannerRef.current || typeof document === "undefined") return;
    const measured =
      bannerRef.current.getBoundingClientRect().height ||
      bannerRef.current.offsetHeight ||
      0;
    const height = measured > 0 ? measured : 32;
    document.documentElement.style.setProperty(
      "--banner-height",
      `${height}px`,
    );
  }, []);

  // Fallback for environments without ResizeObserver (#876)
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    if (!isVisible) {
      document.documentElement.style.setProperty("--banner-height", "0px");
      return;
    }

    if (typeof ResizeObserver === "undefined") {
      const measured =
        bannerRef.current?.getBoundingClientRect().height ||
        bannerRef.current?.offsetHeight ||
        0;
      const height = measured > 0 ? measured : 32;
      document.documentElement.style.setProperty(
        "--banner-height",
        `${height}px`,
      );
    }
  }, [isVisible]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isVisible) {
      document.documentElement.style.setProperty("--banner-height", "0px");
      return;
    }

    updateHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateHeight)
        : null;

    if (bannerRef.current && resizeObserver) {
      resizeObserver.observe(bannerRef.current);
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateHeight);
    }

    return () => {
      resizeObserver?.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateHeight);
      }
      if (typeof document !== "undefined") {
        document.documentElement.style.setProperty("--banner-height", "0px");
      }
    };
  }, [isVisible, networkName, updateHeight]);

  const handleDismiss = useCallback(() => {
    if (networkName) {
      setDismissedMap((prev) => ({ ...prev, [networkName]: true }));
      setStorageDismissed(networkName, storageKey);
    }
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--banner-height", "0px");
    }
    onDismiss?.();
  }, [networkName, storageKey, onDismiss]);

  const handleToggleMinimized = () => {
    if (!networkName) return;
    const next = !isMinimized;
    setMinimizedMap((prev) => ({ ...prev, [networkName]: next }));
    setStorageMinimized(networkName, next, storageKey);
  };

  if (!isVisible || !network) return null;

  const label = cfg.label ?? network.name;
  const effectiveBgColor = backgroundColor ?? cfg.backgroundColor;
  const effectiveBorderColor = borderColor ?? cfg.borderColor;
  const effectiveTextColor = textColor ?? cfg.textColor;
  const effectiveDotColor = dotColor ?? cfg.dotColor;

  const positionClasses: Record<"relative" | "sticky" | "fixed", string> = {
    relative: "relative",
    sticky: "sticky top-0 z-40",
    fixed: "fixed top-0 left-0 right-0 z-40",
  };

  const containerStyle: React.CSSProperties = {
    ...(effectiveBgColor ? { backgroundColor: effectiveBgColor } : {}),
    ...(effectiveBorderColor
      ? {
          borderColor: effectiveBorderColor,
          borderBottomColor: effectiveBorderColor,
        }
      : {}),
    ...style,
  };

  const dotStyle: React.CSSProperties = {
    ...(effectiveDotColor ? { backgroundColor: effectiveDotColor } : {}),
  };

  const textStyle: React.CSSProperties = {
    ...(effectiveTextColor ? { color: effectiveTextColor } : {}),
  };

  const healthIndicator =
    isDegraded && healthText ? (
      <span
        data-testid="network-banner-latency"
        className="inline-flex items-center gap-1 rounded-full bg-black/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-orange"
      >
        <span className="w-1 h-1 rounded-full bg-orange" aria-hidden="true" />
        {healthText}
      </span>
    ) : null;

  const dotEl = (
    <span
      className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)}
      style={dotStyle}
      data-testid="network-banner-dot"
    />
  );

  return (
    <div
      ref={bannerRef}
      role="status"
      aria-live="polite"
      aria-label="Network status banner"
      data-testid="network-banner"
      data-minimized={isMinimized ? "true" : undefined}
      className={cn(
        "flex items-center text-[11px] font-medium transition-all duration-300",
        isMinimized ? "justify-end px-3 py-1" : "justify-between px-4 py-2",
        positionClasses[position],
        cfg.bar,
        className,
      )}
      style={containerStyle}
    >
      {isMinimized ? (
        <button
          type="button"
          onClick={handleToggleMinimized}
          aria-label={`Expand network banner: ${label}${isDegraded && healthText ? `, ${healthText}` : ""}`}
          aria-expanded={false}
          data-testid="network-banner-expand"
          className="inline-flex items-center gap-1.5 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-current"
        >
          {dotEl}
          <span className={cn("sr-only", cfg.text)}>{label}</span>
          {healthIndicator}
        </button>
      ) : (
        <>
          <div className="flex-1 min-w-[20px]" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            {dotEl}
            <span className={cfg.text} style={textStyle}>
              You are on <strong>{label}</strong>
              {network.name !== "mainnet" &&
                " — transactions use test funds only"}
            </span>
            {healthIndicator}
          </div>
          <div className="flex-1 min-w-[20px] flex justify-end items-center gap-1">
            {minimizable && (
              <button
                type="button"
                onClick={handleToggleMinimized}
                aria-label="Minimize banner"
                aria-expanded={true}
                data-testid="network-banner-minimize"
                className={cn(
                  "inline-flex items-center justify-center p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 shrink-0 focus:outline-none focus:ring-1 focus:ring-current",
                  dismissButtonClassName,
                )}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M2 6h8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
            {dismissible && (
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss banner"
                className={cn(
                  "inline-flex items-center justify-center p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 shrink-0 focus:outline-none focus:ring-1 focus:ring-current",
                  dismissButtonClassName,
                )}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={12}
                  color="currentColor"
                  strokeWidth={2}
                />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
