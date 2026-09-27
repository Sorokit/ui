/**
 * ValidatorSearch — search field and performance filter controls for the
 * validator list. Controlled: all state lives in the parent via ValidatorFilter.
 */

import {
  Cancel01Icon,
  FilterHorizontalIcon,
  Search01Icon,
  SortingAZ01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/Button";
import type { ValidatorFilter, ValidatorSortField } from "@/lib/staking";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValidatorSearchProps {
  filter: ValidatorFilter;
  onChange: (next: ValidatorFilter) => void;
  /** Total validator count (before filter) */
  totalCount: number;
  /** Filtered result count */
  filteredCount: number;
  className?: string;
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: ValidatorSortField; label: string }[] = [
  { value: "apy", label: "APY" },
  { value: "commission", label: "Commission" },
  { value: "uptime", label: "Uptime" },
  { value: "totalStaked", label: "Total Staked" },
  { value: "rank", label: "Rank" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ValidatorSearch({
  filter,
  onChange,
  totalCount,
  filteredCount,
  className,
}: ValidatorSearchProps) {
  function patch(partial: Partial<ValidatorFilter>) {
    onChange({ ...filter, ...partial });
  }

  function toggleDirection() {
    patch({ sortDirection: filter.sortDirection === "desc" ? "asc" : "desc" });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none"
        >
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
        </span>
        <input
          type="search"
          value={filter.query}
          // Trim leading/trailing whitespace before it ever reaches the
          // filter — pasted validator addresses commonly carry surrounding
          // whitespace, which would otherwise fail every `includes()` match
          // in filterValidators().
          onChange={(e) => patch({ query: e.target.value.trim() })}
          placeholder="Search validators…"
          aria-label="Search validators"
          className={cn(
            "h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3.5",
            "text-[13px] text-ink placeholder:text-ink-4",
            "outline-none transition-colors",
            "focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            filter.query.length > 0 && "pr-9",
          )}
        />
        {filter.query.length > 0 && (
          <button
            type="button"
            onClick={() => patch({ query: "" })}
            aria-label="Clear search"
            className={cn(
              "absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded",
              "text-ink-3 hover:text-ink-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
            )}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              size={14}
              color="currentColor"
              strokeWidth={1.5}
            />
          </button>
        )}
      </div>

      {/* ── Filter + sort row ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter */}
        <div className="flex items-center gap-1">
          <HugeiconsIcon
            icon={FilterHorizontalIcon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-ink-3 shrink-0"
          />
          <select
            value={filter.status ?? "all"}
            onChange={(e) =>
              patch({ status: e.target.value as ValidatorFilter["status"] })
            }
            aria-label="Filter by status"
            className={cn(
              "h-8 rounded-lg border border-line bg-surface-2 px-2",
              "text-[12px] text-ink",
              "outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            )}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="jailed">Jailed</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Min APY */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="vs-min-apy"
            className="text-[11px] text-ink-3 whitespace-nowrap"
          >
            Min APY
          </label>
          <input
            id="vs-min-apy"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={filter.minApy ?? ""}
            onChange={(e) =>
              patch({
                minApy:
                  e.target.value === ""
                    ? undefined
                    : parseFloat(e.target.value),
              })
            }
            placeholder="0%"
            aria-label="Minimum APY percentage"
            className={cn(
              "h-8 w-20 rounded-lg border border-line bg-surface-2 px-2",
              "text-[12px] text-ink placeholder:text-ink-4",
              "outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            )}
          />
        </div>

        {/* Max commission */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="vs-max-commission"
            className="text-[11px] text-ink-3 whitespace-nowrap"
          >
            Max Fee
          </label>
          <input
            id="vs-max-commission"
            type="number"
            min="0"
            max="100"
            step="1"
            value={filter.maxCommission ?? ""}
            onChange={(e) =>
              patch({
                maxCommission:
                  e.target.value === ""
                    ? undefined
                    : parseFloat(e.target.value),
              })
            }
            placeholder="100%"
            aria-label="Maximum commission percentage"
            className={cn(
              "h-8 w-20 rounded-lg border border-line bg-surface-2 px-2",
              "text-[12px] text-ink placeholder:text-ink-4",
              "outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            )}
          />
        </div>

        {/* Sort field */}
        <div className="flex items-center gap-1 ml-auto">
          <HugeiconsIcon
            icon={SortingAZ01Icon}
            size={13}
            color="currentColor"
            strokeWidth={1.5}
            className="text-ink-3 shrink-0"
          />
          <select
            value={filter.sortField}
            onChange={(e) =>
              patch({ sortField: e.target.value as ValidatorSortField })
            }
            aria-label="Sort validators by"
            className={cn(
              "h-8 rounded-lg border border-line bg-surface-2 px-2",
              "text-[12px] text-ink",
              "outline-none transition-colors focus:border-line-2 focus:ring-1 focus:ring-brand-dim",
            )}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Direction toggle */}
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            onClick={toggleDirection}
            aria-label={`Sort ${filter.sortDirection === "desc" ? "ascending" : "descending"}`}
            title={
              filter.sortDirection === "desc"
                ? "Sort ascending"
                : "Sort descending"
            }
          >
            <span
              className={cn(
                "text-[13px] transition-transform inline-block",
                filter.sortDirection === "asc" && "rotate-180",
              )}
              aria-hidden="true"
            >
              ↓
            </span>
          </Button>
        </div>
      </div>

      {/* ── Result count ────────────────────────────────────────────────────── */}
      <p
        className="text-[11px] text-ink-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {filteredCount === totalCount
          ? `${totalCount} validator${totalCount !== 1 ? "s" : ""}`
          : `${filteredCount} of ${totalCount} validator${totalCount !== 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
