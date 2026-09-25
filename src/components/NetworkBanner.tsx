import type { NavSection } from "@/components/Sidebar";
import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

export interface BannerConfig {
  label: string | null;
  dot: string;
  bar: string;
  text: string;
  show: boolean;
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
  custom: {
    label: null,
    dot: "bg-ink-3",
    bar: "bg-surface-2 border-b border-line",
    text: "text-ink-2",
    show: true,
  },
};

interface NetworkBannerProps {
  active?: NavSection;
  config?: Partial<Record<string, Partial<BannerConfig>>>;
  /** Always show even on mainnet */
  alwaysShow?: boolean;
  className?: string;
}

export function NetworkBanner({
  active,
  alwaysShow = false,
  config,
  className,
}: NetworkBannerProps) {
  const { network } = useSorokit();
  if (!network) return null;
  if (active === "network") return null;

  const cfg = {
    ...BANNER_CONFIG.custom,
    ...BANNER_CONFIG[network.name],
    ...config?.[network.name],
  };
  if (!alwaysShow && !cfg.show) return null;

  const label = cfg.label ?? network.name;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-medium transition-all duration-300",
        cfg.bar,
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      <span className={cfg.text}>
        You are on <strong>{label}</strong>
        {network.name !== "mainnet" && " — transactions use test funds only"}
      </span>
    </div>
  );
}
