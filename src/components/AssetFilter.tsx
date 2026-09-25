import {
  ArrowDown01Icon,
  Cancel01Icon,
  Search01Icon,
  StarIcon as StarFillIcon,
  StarIcon,
  Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Balance } from "@/lib/client";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface AssetMeta {
  /** Whether the asset is officially verified on the network */
  isVerified?: boolean;
  /** User-visible name override (e.g. "USD Coin" for USDC) */
  displayName?: string;
  /** Network this asset was fetched from – used for network filter */
  network?: string;
  /** Popularity rank (lower = more popular) for "popularity" sort */
  popularityIndex?: number;
}

export type AssetItem = Balance & AssetMeta;

export type SortKey = "name" | "balance" | "popularity" | "default";

export type VerifiedFilter = "all" | "verified" | "unverified";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const FAVORITES_KEY = "sorokit-asset-favorites";
const CUSTOM_ASSETS_KEY = "sorokit-custom-assets";

const FILTER_TABS: { key: VerifiedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "verified", label: "Verified" },
  { key: "unverified", label: "Unverified" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "name", label: "Name" },
  { key: "balance", label: "Balance" },
  { key: "popularity", label: "Popularity" },
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getAssetCode(asset: AssetItem): string {
  if (asset.assetType === "native" && !asset.assetCode && !asset.asset) return "XLM";
  return asset.assetCode ?? asset.asset;
}

function getAssetKey(asset: AssetItem): string {
  const code = getAssetCode(asset);
  return asset.assetIssuer ? `${code}:${asset.assetIssuer}` : code;
}

function getAssetName(asset: AssetItem): string {
  if (
    asset.assetType === "native" &&
    (!asset.assetCode || asset.assetCode === "XLM") &&
    (!asset.asset || asset.asset === "XLM") &&
    !asset.displayName
  ) {
    return "Stellar Lumens";
  }
  return asset.displayName ?? asset.assetCode ?? asset.asset;
}

function parseBalance(balance: string): number {
  return Number.parseFloat(balance) || 0;
}



// ────────────────────────────────────────────────────────────────────────────
// localStorage hooks
// ────────────────────────────────────────────────────────────────────────────

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistFavorites(favorites: Set<string>) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  } catch {
    /* localStorage may be full or disabled */
  }
}

function loadCustomAssets(): AssetItem[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ASSETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AssetItem[];
  } catch {
    return [];
  }
}

function persistCustomAssets(assets: AssetItem[]) {
  try {
    localStorage.setItem(CUSTOM_ASSETS_KEY, JSON.stringify(assets));
  } catch {
    /* silent */
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Mobile keyboard handling
// ────────────────────────────────────────────────────────────────────────────

function useMobileKeyboardScroll(
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("visualViewport" in window) ||
      !inputRef.current
    )
      return;

    const el = inputRef.current;
    const originalMargin = "0px";

    const handler = () => {
      const viewport = window.visualViewport;
      if (!viewport) return;
      const keyboardVisible = viewport.height < window.screen.height * 0.8;
      if (keyboardVisible) {
        document.body.style.marginBottom = `${window.screen.height - viewport.height}px`;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        document.body.style.marginBottom = originalMargin;
      }
    };

    window.visualViewport?.addEventListener("resize", handler);
    return () => {
      window.visualViewport?.removeEventListener("resize", handler);
      document.body.style.marginBottom = originalMargin;
    };
  }, [inputRef]);
}


// ────────────────────────────────────────────────────────────────────────────
// DefaultAssetRow
// ────────────────────────────────────────────────────────────────────────────

interface DefaultAssetRowProps {
  asset: AssetItem;
  isFavorite: boolean;
  onFavoriteToggle: (asset: AssetItem) => void;
  onSelect?: (asset: AssetItem) => void;
  isFocused: boolean;
}

function DefaultAssetRow({
  asset,
  isFavorite,
  onFavoriteToggle,
  onSelect,
  isFocused,
}: DefaultAssetRowProps) {
  const code = getAssetCode(asset);
  const name = getAssetName(asset);
  const balance = parseBalance(asset.balance);
  const shortCode = code.slice(0, 2).toUpperCase();

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors cursor-pointer",
        isFocused ? "bg-surface-2" : "hover:bg-surface-2",
      )}
      onClick={() => onSelect?.(asset)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(asset);
        }
      }}
      data-asset-row={getAssetKey(asset)}
    >
      <button
        type="button"
        className={cn(
          "flex-shrink-0 transition-opacity",
          isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onFavoriteToggle(asset);
        }}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <HugeiconsIcon
          icon={isFavorite ? StarFillIcon : StarIcon}
          size={14}
          className={cn(
            isFavorite ? "text-yellow" : "text-ink-4",
          )}
        />
      </button>

      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-dim text-[11px] font-bold text-brand">
        {shortCode}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="truncate text-[13px] font-medium text-ink">
            {code}
          </span>
          {name !== code && (
            <span className="truncate text-[11px] text-ink-4">{name}</span>
          )}
        </div>
        {asset.assetIssuer && (
          <div className="truncate text-[11px] text-ink-4">
            {asset.assetIssuer.slice(0, 8)}…
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <span className="text-[13px] font-medium text-ink">
          {balance.toLocaleString(undefined, { maximumFractionDigits: 7 })}
        </span>
        {asset.isVerified && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/10 text-[10px] text-green-500">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// AssetFilterSkeleton
// ────────────────────────────────────────────────────────────────────────────

interface AssetFilterSkeletonProps {
  className?: string;
  rowCount?: number;
}

export function AssetFilterSkeleton({ className, rowCount = 6 }: AssetFilterSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Search skeleton */}
      <div className="h-9 w-full animate-pulse rounded-lg bg-surface-3" />

      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-20 animate-pulse rounded-full bg-surface-3"
          />
        ))}
      </div>

      {/* Sort bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-3" />
        <div className="h-4 w-16 animate-pulse rounded bg-surface-3" />
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rowCount }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <div className="h-4 w-4 animate-pulse rounded bg-surface-3" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-3" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-24 animate-pulse rounded bg-surface-3" />
            <div className="h-3 w-16 animate-pulse rounded bg-surface-3" />
          </div>
          <div className="h-3.5 w-20 animate-pulse rounded bg-surface-3" />
        </div>
      ))}
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// AssetFilter
// ────────────────────────────────────────────────────────────────────────────

interface AssetFilterProps {
  assets: AssetItem[];
  onAssetSelect?: (asset: AssetItem) => void;
  className?: string;
  countLabel?: (filtered: number, total: number) => string;
  showNetworkFilter?: boolean;
  allowCustomAssets?: boolean;
  renderRow?: (asset: AssetItem, isFavorite: boolean) => ReactNode;
}

function AssetFilter({
  assets,
  onAssetSelect: onSelect,
  showNetworkFilter = true,
  allowCustomAssets = false,
  className,
  countLabel,
  renderRow,
}: AssetFilterProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("all");
  const [networkFilter, setNetworkFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [customAssets, setCustomAssets] = useState<AssetItem[]>(loadCustomAssets);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [customIssuer, setCustomIssuer] = useState("");

  // ── Refs ───────────────────────────────────────────────────────────────────
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // ── Mobile keyboard scroll ─────────────────────────────────────────────────
  useMobileKeyboardScroll(inputRef);

  // ── Merged asset list ──────────────────────────────────────────────────────
  const allAssets = useMemo<AssetItem[]>(
    () => [...assets, ...customAssets],
    [assets, customAssets],
  );

  // ── Favorite check helper ──────────────────────────────────────────────────
  const isFav = useCallback(
    (asset: AssetItem) => favorites.has(getAssetKey(asset)),
    [favorites],
  );

  // ── Filtered & sorted assets ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allAssets;

    // Verified filter
    if (verifiedFilter === "verified") {
      list = list.filter((a) => a.isVerified);
    } else if (verifiedFilter === "unverified") {
      list = list.filter((a) => !a.isVerified);
    }

    // Network filter
    if (networkFilter) {
      list = list.filter((a) => a.network === networkFilter);
    }

    // Favorites only
    if (showFavoritesOnly) {
      list = list.filter((a) => favorites.has(getAssetKey(a)));
    }

    // Search
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      list = list.filter((a) => {
        const code = getAssetCode(a).toLowerCase();
        const name = getAssetName(a).toLowerCase();
        const issuer = (a.assetIssuer ?? "").toLowerCase();
        return code.includes(q) || name.includes(q) || issuer.includes(q);
      });
    }

    // Sort
    const sorted = [...list];
    sorted.sort((a, b) => {
      // Favorites always first
      const aFav = favorites.has(getAssetKey(a)) ? 1 : 0;
      const bFav = favorites.has(getAssetKey(b)) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      if (sortKey === "name") {
        return getAssetName(a).localeCompare(getAssetName(b));
      }
      if (sortKey === "balance") {
        return parseBalance(b.balance) - parseBalance(a.balance);
      }
      if (sortKey === "popularity") {
        const pa = a.popularityIndex ?? 999;
        const pb = b.popularityIndex ?? 999;
        return pa - pb;
      }
      // Default sort: native first, then by code
      if (a.assetType === "native") return -1;
      if (b.assetType === "native") return 1;
      return getAssetCode(a).localeCompare(getAssetCode(b));
    });

    return sorted;
  }, [allAssets, verifiedFilter, networkFilter, showFavoritesOnly, favorites, deferredSearch, sortKey]);


  // ── Toggle favorite ────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    (asset: AssetItem) => {
      const key = getAssetKey(asset);
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        persistFavorites(next);
        return next;
      });
    },
    [],
  );

  // ── Add custom asset ───────────────────────────────────────────────────────
  const addCustomAsset = useCallback(() => {
    const code = customCode.trim().toUpperCase();
    if (!code) return;
    const issuer = customIssuer.trim() || undefined;
    const newAsset: AssetItem = {
      asset: code,
      assetCode: code,
      assetIssuer: issuer,
      assetType: code === "XLM" && !issuer ? "native" : "credit_alphanum4",
      balance: "0",
      isVerified: false,
    };
    const updated = [...customAssets, newAsset];
    setCustomAssets(updated);
    persistCustomAssets(updated);
    setCustomCode("");
    setCustomIssuer("");
    setAddingCustom(false);
  }, [customCode, customIssuer, customAssets]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filtered.length === 0) return;

      const scrollIntoView = (index: number) => {
        if (!listRef.current) return;
        const rows = listRef.current.querySelectorAll("[data-asset-row]");
        const row = rows[index] as HTMLElement | undefined;
        if (row) row.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      };

      const clamp = (i: number) => Math.max(0, Math.min(i, filtered.length - 1));

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = clamp(prev + 1);
            scrollIntoView(next);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = clamp(prev - 1);
            scrollIntoView(next);
            return next;
          });
          break;
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          scrollIntoView(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(filtered.length - 1);
          scrollIntoView(filtered.length - 1);
          break;
        case "Enter":
          if (focusedIndex >= 0 && focusedIndex < filtered.length) {
            e.preventDefault();
            onSelect?.(filtered[focusedIndex]);
          }
          break;
        case "Escape":
          setSearch("");
          setShowSortDropdown(false);
          setFocusedIndex(-1);
          break;
      }
    },
    [filtered, focusedIndex, onSelect],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(e.target as Node) &&
        sortBtnRef.current &&
        !sortBtnRef.current.contains(e.target as Node)
      ) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Extract unique networks ────────────────────────────────────────────────
  const extractedNetworks = useMemo<string[]>(() => {
    const nets = new Set<string>();
    assets.forEach((a) => {
      if (a.network) nets.add(a.network);
    });
    return [...nets];
  }, [assets]);

  // ── Reset focused index when filtered list changes ─────────────────────────
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setFocusedIndex(0); }, [filtered]);


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={cn("flex flex-col", className)}>
      {/* ── Search bar ────────────────────────────────────────────────────── */}
      <div className="relative px-4 pb-2 pt-3">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
        />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search assets…"
          className="w-full rounded-lg border border-line bg-surface-2 h-9 pl-9 pr-9 text-[13px] text-ink placeholder:text-ink-4 outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2"
            aria-label="Clear search"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        )}
      </div>

      {/* ── Verified filter tabs + favorites toggle ───────────────────────── */}
      <div className="flex items-center gap-2 px-4 pb-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setVerifiedFilter(tab.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
              verifiedFilter === tab.key
                ? "bg-brand-dim text-brand border border-[rgba(86,69,212,0.25)]"
                : "bg-surface-3 text-ink-4 hover:text-ink-2",
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((p) => !p)}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              showFavoritesOnly
                ? "text-yellow"
                : "text-ink-4 hover:text-ink-2",
            )}
            aria-label={showFavoritesOnly ? "Show all" : "Favorites only"}
          >
            <HugeiconsIcon
              icon={showFavoritesOnly ? StarFillIcon : StarIcon}
              size={14}
            />
          </button>
        </div>
      </div>


      {/* ── Network filter ─────────────────────────────────────────────────── */}
      {showNetworkFilter && extractedNetworks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          <button
            type="button"
            onClick={() => setNetworkFilter(null)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              !networkFilter
                ? "bg-brand-dim text-brand border border-[rgba(86,69,212,0.25)]"
                : "bg-surface-3 text-ink-4 hover:text-ink-2",
            )}
          >
            All networks
          </button>
          {extractedNetworks.map((net) => (
            <button
              key={net}
              type="button"
              onClick={() => setNetworkFilter(net)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                networkFilter === net
                  ? "bg-brand-dim text-brand border border-[rgba(86,69,212,0.25)]"
                  : "bg-surface-3 text-ink-4 hover:text-ink-2",
              )}
            >
              {net.charAt(0).toUpperCase() + net.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* ── Sort bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-line px-4 pb-2">
        <span className="text-[12px] text-ink-4">
          {countLabel
            ? countLabel(filtered.length, allAssets.length)
            : `${filtered.length} asset${filtered.length !== 1 ? "s" : ""}`}
        </span>
        <div className="relative">
          <button
            ref={sortBtnRef}
            type="button"
            onClick={() => setShowSortDropdown((p) => !p)}
            className="flex items-center gap-1 text-[12px] text-ink-4 hover:text-ink-2"
          >
            Sort: {SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Default"}
            <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5" />
          </button>
          {showSortDropdown && (
            <div
              ref={sortDropdownRef}
              className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-line bg-surface shadow-lg"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    setSortKey(opt.key);
                    setShowSortDropdown(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                    sortKey === opt.key ? "text-ink" : "text-ink-4",
                  )}
                >
                  {sortKey === opt.key && (
                    <HugeiconsIcon icon={Tick01Icon} className="h-3.5 w-3.5 text-ink" />
                  )}
                  <span className={sortKey === opt.key ? "font-medium" : ""}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* ── Asset list ─────────────────────────────────────────────────────── */}
      <div
        ref={listRef}
        className="max-h-[440px] overflow-y-auto py-1"
        role="listbox"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-[13px] text-ink-4">No assets found</span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-1 text-[12px] text-ink-4 underline hover:text-ink-2"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          filtered.map((asset, index) =>
            renderRow ? (
              <div key={getAssetKey(asset)}>{renderRow(asset, isFav(asset))}</div>
            ) : (
              <DefaultAssetRow
                key={getAssetKey(asset)}
                asset={asset}
                isFavorite={isFav(asset)}
                onFavoriteToggle={toggleFavorite}
                onSelect={onSelect}
                isFocused={index === focusedIndex}
              />
            ),
          )
        )}
      </div>

      {/* ── Custom asset form ────────────────────────────────────────────── */}
      {allowCustomAssets && (
        <div className="border-t border-line px-4 py-2">
          {addingCustom ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="Asset code (e.g. USDC)"
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-4 outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim"
              />
              <input
                type="text"
                value={customIssuer}
                onChange={(e) => setCustomIssuer(e.target.value)}
                placeholder="Issuer (optional)"
                className="w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-4 outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addCustomAsset}
                  className="rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-surface hover:opacity-90"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCustom(false);
                    setCustomCode("");
                    setCustomIssuer("");
                  }}
                  className="rounded-lg bg-surface-3 px-3 py-1.5 text-[13px] text-ink-4 hover:text-ink-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingCustom(true)}
              className="w-full rounded-lg border border-dashed border-line px-3 py-1.5 text-[13px] text-ink-4 hover:text-ink-2"
            >
              + Add custom asset
            </button>
          )}
        </div>
      )}

      {/* ── Keyboard hint footer ──────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 border-t border-line px-4 py-2">
        <span className="text-[11px] text-ink-4">↑↓ Navigate</span>
        <span className="text-[11px] text-ink-4">↵ Select</span>
      </div>
    </div>
  );
}

export { AssetFilter };

