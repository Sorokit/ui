import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";

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
}: NetworkBannerProps) {
  const { network } = useSorokit();
  const networkName = network?.name;

  const [dismissedMap, setDismissedMap] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isVisible) {
      document.documentElement.style.setProperty("--banner-height", "0px");
      return;
    }

    const updateHeight = () => {
      if (!bannerRef.current || typeof document === "undefined") return;
      const measured =
        bannerRef.current.offsetHeight ||
        bannerRef.current.getBoundingClientRect().height ||
        0;
      const height = measured > 0 ? measured : 32;
      document.documentElement.style.setProperty(
        "--banner-height",
        `${height}px`,
      );
    };

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
  }, [isVisible, networkName]);

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

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label="Network status banner"
      data-testid="network-banner"
      className={cn(
        "flex items-center justify-between px-4 py-2 text-[11px] font-medium transition-all duration-300",
        positionClasses[position],
        cfg.bar,
        className,
      )}
      style={containerStyle}
    >
      <div className="flex-1 min-w-[20px]" aria-hidden="true" />
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)}
          style={dotStyle}
          data-testid="network-banner-dot"
        />
        <span className={cfg.text} style={textStyle}>
          You are on <strong>{label}</strong>
          {network.name !== "mainnet" && " — transactions use test funds only"}
        </span>
      </div>
      <div className="flex-1 min-w-[20px] flex justify-end">
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
    </div>
  );
}
