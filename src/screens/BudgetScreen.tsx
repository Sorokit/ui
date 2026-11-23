import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PieChart, type PieSlice } from "@/components/ui/PieChart";
import { computeBudgetBreakdown, convertXlmToUsd, formatUtcDate } from "@/lib/budget";
import type { Transaction } from "@/lib/client";

type AssetBreakdown = {
  asset: string;
  amount: number;
  percentage: number;
};

/** Chart palette tokens defined per-theme in index.css (contrast-checked for light and dark). */
const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const CATEGORY_STORAGE_KEY = "sorokit-budget-categories";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
type CategorySettings = Record<string, { name?: string; color?: string }>;

function loadCategorySettings(): CategorySettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY) ?? "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};

    return Object.fromEntries(Object.entries(stored).flatMap(([type, value]) => {
      if (!value || typeof value !== "object") return [];
      const name = typeof value.name === "string" ? value.name.trim() || undefined : undefined;
      const color = typeof value.color === "string" && HEX_COLOR.test(value.color)
        ? value.color
        : undefined;
      return [[type, { name, color }] as const];
    }));
  } catch {
    return {};
  }
}

/** Spending at or above this share of the limit is flagged as critical. */
const CRITICAL_THRESHOLD = 90;

/** Mock XLM price in USD; replace with a live price feed. */
const XLM_USD_RATE = 0.12;

const DEFAULT_LIMIT = 1500;
const DEFAULT_PERIOD_START = "2026-01-01T00:00:00Z";

const DEFAULT_TRANSACTIONS: Transaction[] = [
  {
    hash: "mock-payment-1",
    ledger: 1,
    createdAt: "2026-01-01T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "950",
    type: "Payment",
  },
  {
    hash: "mock-payment-2",
    ledger: 2,
    createdAt: "2026-01-02T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "950",
    type: "Payment",
  },
  {
    hash: "mock-swap-1",
    ledger: 3,
    createdAt: "2026-01-03T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "230",
    type: "Swap",
  },
  {
    hash: "mock-farming-1",
    ledger: 4,
    createdAt: "2026-01-04T00:00:00Z",
    successful: true,
    operationCount: 1,
    feePaid: "100",
    type: "Farming Deposit",
  },
];

/** Returns an inline error message for an invalid budget limit, or null when valid. */
function validateBudgetLimit(raw: string): string | null {
  if (raw.trim() === "") return "Budget limit is required.";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (value < 0) return "Budget limit cannot be negative.";
  if (value === 0) return "Budget limit must be greater than 0.";
  return null;
}

export interface BudgetScreenProps {
  transactions?: Transaction[];
}

/** Displays budget limits and spending breakdowns with editable transaction categories. */
export function BudgetScreen({ transactions }: BudgetScreenProps = {}) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    "monthly",
  );
  const [budgetLimitInput, setBudgetLimitInput] = useState(String(DEFAULT_LIMIT));
  const [lastValidLimit, setLastValidLimit] = useState(DEFAULT_LIMIT);
  const budgetLimitError = validateBudgetLimit(budgetLimitInput);
  // Invalid input never reaches the calculations; keep the last valid limit.
  const budgetLimit = lastValidLimit;
  const [currentSpent, setCurrentSpent] = useState(1280);
  const [periodStart, setPeriodStart] = useState(DEFAULT_PERIOD_START);
  const [xlmAmountInput, setXlmAmountInput] = useState("");
  const xlmAsUsd = convertXlmToUsd(Number(xlmAmountInput), XLM_USD_RATE);
  const [warningThreshold, setWarningThreshold] = useState(80); // 80% default
  const [lockTransactions, setLockTransactions] = useState(false);

  // Asset breakdown mock data
  const [assets] = useState<AssetBreakdown[]>([
    { asset: "XLM", amount: 800, percentage: 62.5 },
    { asset: "USDC", amount: 480, percentage: 37.5 },
  ]);

  const txBreakdown = useMemo(
    () => computeBudgetBreakdown(transactions ?? DEFAULT_TRANSACTIONS),
    [transactions],
  );

  const [categorySettings, setCategorySettings] = useState(loadCategorySettings);
  const [draft, setDraft] = useState<CategorySettings | null>(null);
  const [pickerColors, setPickerColors] = useState<string[]>([]);
  const [categoryError, setCategoryError] = useState(false);

  const updateCategory = (type: string, settings: CategorySettings[string]) => {
    setDraft((previous) => ({
      ...previous,
      [type]: { ...previous?.[type], ...settings },
    }));
  };

  const saveCategories = () => {
    if (!draft) return;
    const saved = Object.fromEntries(Object.entries(draft).map(([type, settings]) => [
      type,
      { ...settings, name: settings.name?.trim() || undefined },
    ]));
    try {
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(saved));
      setCategorySettings(saved);
      setDraft(null);
      setCategoryError(false);
    } catch {
      setCategoryError(true);
    }
  };

  const pieSlices: PieSlice[] = useMemo(() => {
    if (txBreakdown.categories.length === 0) return [];

    if (txBreakdown.hasSingleLargeTransaction && txBreakdown.splitCategories) {
      const type = txBreakdown.categories[0].type;
      const settings = categorySettings[type];
      return txBreakdown.splitCategories.map((item, idx) => ({
        key: `split-${idx}`,
        label: (settings?.name ?? type) + item.label.slice(type.length),
        value: item.amount,
        color: (idx === 0 ? settings?.color : undefined) ?? CHART_COLORS[idx],
      }));
    }

    return txBreakdown.categories.map((cat, idx) => ({
      key: cat.type,
      label: categorySettings[cat.type]?.name ?? cat.type,
      value: cat.amount,
      color: categorySettings[cat.type]?.color ?? CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [txBreakdown, categorySettings]);

  // Calculations
  const hasBudget = budgetLimit > 0;
  const percentageUsed = hasBudget ? (currentSpent / budgetLimit) * 100 : 0;
  const isOverBudget = percentageUsed >= 100;
  const isCriticalLimit =
    percentageUsed >= CRITICAL_THRESHOLD && !isOverBudget;
  const isApproachingLimit =
    percentageUsed >= warningThreshold && percentageUsed < CRITICAL_THRESHOLD;

  /** Start a fresh period: zero out spending and stamp the reset time (UTC). */
  const handleResetBudget = () => {
    setCurrentSpent(0);
    setPeriodStart(new Date().toISOString());
  };

  /** Remove the budget limit entirely; the user must enter a new one. */
  const handleClearBudget = () => {
    setBudgetLimitInput("");
    setLastValidLimit(0);
  };

  // Export report simulation
  const [exportMessage, setExportMessage] = useState("");

  const handleExportCSV = () => {
    setExportMessage("Generating CSV report...");
    setTimeout(() => {
      setExportMessage(
        "Report exported as sorokit-spending-report.csv successfully!",
      );
    }, 1000);
  };

  const handleExportPDF = () => {
    setExportMessage("Generating PDF document...");
    setTimeout(() => {
      setExportMessage(
        "Report exported as sorokit-spending-report.pdf successfully!",
      );
    }, 1000);
  };

  return (
    <div className="space-y-6" data-testid="budget-screen">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-ink">
          Budget & Transaction Limits
        </h2>
        <p className="text-[13px] text-ink-3">
          Set daily, weekly, or monthly limits and configure security
          checkpoints to control spending.
        </p>
      </div>

      {/* Progress & Alert warnings */}
      <Card className="border-line bg-surface">
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[12px] text-ink-3 font-semibold uppercase">
                Spending Progress
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[24px] font-extrabold text-ink">
                  ${currentSpent}
                </span>
                <span className="text-ink-3" data-testid="budget-limit-display">
                  {hasBudget ? `/ $${budgetLimit}` : "No limit set"}
                </span>
              </div>
              <p className="text-[11px] text-ink-3 mt-1" data-testid="period-start">
                Period started {formatUtcDate(periodStart)}
              </p>
            </div>
            <div>
              <select
                className="bg-surface-2 border border-line rounded px-2.5 py-1 text-[12px] text-ink font-semibold"
                value={period}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setPeriod(e.target.value as "daily" | "weekly" | "monthly")
                }
              >
                <option value="daily">Daily Period</option>
                <option value="weekly">Weekly Period</option>
                <option value="monthly">Monthly Period</option>
              </select>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-surface-2 h-3 rounded-full overflow-hidden border border-line relative">
            <div
              className={`h-full transition-all duration-300 ${
                isOverBudget
                  ? "bg-red"
                  : isCriticalLimit
                    ? "bg-red"
                    : isApproachingLimit
                      ? "bg-orange"
                      : "bg-brand"
              }`}
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            />
          </div>

          {(isCriticalLimit || isOverBudget) && (
            <div
              role="alert"
              data-testid="budget-alert-banner"
              className={`rounded-lg border px-3 py-2 text-[12px] font-medium ${
                isOverBudget
                  ? "border-error-dim bg-error-dim text-red"
                  : "border-warning-dim bg-warning-dim text-warning"
              }`}
            >
              {isOverBudget
                ? `Budget exceeded: you have spent ${percentageUsed.toFixed(1)}% of your ${period} limit.`
                : `Warning: you have spent ${percentageUsed.toFixed(1)}% of your ${period} limit.`}
            </div>
          )}

          <div className="flex justify-between items-center text-[12px] text-ink-2">
            <span>{percentageUsed.toFixed(1)}% of budget utilized</span>
            <div className="flex gap-2">
              {isOverBudget && <Badge variant="error">Limit Exceeded</Badge>}
              {isCriticalLimit && (
                <Badge variant="warning">
                  Critical (&gt;{CRITICAL_THRESHOLD}%)
                </Badge>
              )}
              {isApproachingLimit && (
                <Badge variant="warning">
                  Approaching Limit (&gt;{warningThreshold}%)
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget controls & limits setup */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Configure Limits</CardTitle>
            <CardDescription>
              Adjust spending limits and thresholds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Input
                label="Set Budget Limit ($)"
                type="number"
                min="0"
                step="any"
                value={budgetLimitInput}
                error={budgetLimitError ?? undefined}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBudgetLimitInput(raw);
                  if (validateBudgetLimit(raw) === null) {
                    setLastValidLimit(Number(raw));
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={handleResetBudget}>
                Reset budget
              </Button>
              <Button variant="secondary" size="sm" className="flex-1" onClick={handleClearBudget}>
                Clear budget
              </Button>
            </div>

            <div className="space-y-1">
              <Input
                label="Convert XLM to USD"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={xlmAmountInput}
                onChange={(e) => setXlmAmountInput(e.target.value)}
              />
              <p className="text-[11px] text-ink-3" data-testid="xlm-usd-result">
                ≈ ${xlmAsUsd.toFixed(2)} USD (1 XLM = ${XLM_USD_RATE})
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-ink-2 flex justify-between">
                <span>Warning Threshold</span>
                <span className="font-semibold">{warningThreshold}%</span>
              </label>
              <input
                type="range"
                min="50"
                max={CRITICAL_THRESHOLD}
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(Number(e.target.value))}
                className="w-full accent-brand"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-surface-2 rounded-lg border border-line">
              <div>
                <p className="text-[12px] font-semibold text-ink">
                  Lock Transactions on Exceed
                </p>
                <p className="text-[10px] text-ink-3">
                  Prevent new payouts if budget exceeds limit.
                </p>
              </div>
              <input
                type="checkbox"
                checked={lockTransactions}
                onChange={(e) => setLockTransactions(e.target.checked)}
                className="w-4 h-4 accent-brand cursor-pointer"
                data-testid="lock-checkbox"
              />
            </div>
          </CardContent>
        </Card>

        {/* Breakdown by asset & transaction type */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Breakdown</CardTitle>
            <CardDescription>
              Visual breakdown by asset and operation type.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual PieChart */}
            {pieSlices.length > 0 && (
              <div
                className="flex flex-col items-center justify-center p-2"
                data-testid="budget-pie-chart-wrapper"
              >
                <PieChart
                  slices={pieSlices}
                  size={180}
                  innerRadius={0.5}
                  centerLabel={
                    txBreakdown.hasSingleLargeTransaction ? (
                      <span
                        className="text-[11px] font-bold text-ink"
                        data-testid="pie-single-large-label"
                      >
                        100.0%
                      </span>
                    ) : undefined
                  }
                />
              </div>
            )}

            {/* Single Large Transaction handling (#1141) */}
            {txBreakdown.hasSingleLargeTransaction && (
              <div
                role="status"
                data-testid="single-large-tx-notice"
                className="rounded-lg border border-line bg-surface-2 p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-ink">
                    Single Large Transaction
                  </span>
                  <Badge variant="teal" data-testid="single-large-badge">
                    100.0% of Spending
                  </Badge>
                </div>
                <p className="text-[11px] text-ink-3">
                  This period's budget is dominated by a single large transaction. Showing split category breakdown for visual readability.
                </p>
                {txBreakdown.splitCategories && (
                  <div
                    className="pt-2 space-y-1 border-t border-line"
                    data-testid="split-category-display"
                  >
                    {txBreakdown.splitCategories.map((item, index) => (
                      <div
                        key={item.label}
                        className="flex justify-between text-[11px] text-ink-2"
                      >
                        <span>{pieSlices[index].label}</span>
                        <span className="font-semibold text-ink">
                          ${item.amount} ({item.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* By Asset */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-ink-3 uppercase">
                By Asset
              </p>
              <div className="space-y-2">
                {assets.map((asset, index) => (
                  <div
                    key={asset.asset}
                    className="flex justify-between items-center text-[12px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-ink">
                        {asset.asset}
                      </span>
                    </div>
                    <span className="text-ink-2">
                      ${asset.amount} ({asset.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Operation Type */}
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-ink-3 uppercase">
                  By Transaction Type
                </p>
                {draft ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => {
                      setDraft(null);
                      setCategoryError(false);
                    }}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={saveCategories}>Save</Button>
                  </div>
                ) : txBreakdown.categories.length > 0 && (
                  <Button type="button" variant="secondary" onClick={(event) => {
                    const style = getComputedStyle(event.currentTarget);
                    setPickerColors(CHART_COLORS.map((token) => {
                      const color = style.getPropertyValue(token.slice(4, -1)).trim();
                      return HEX_COLOR.test(color) ? color : "#000000";
                    }));
                    setDraft(categorySettings);
                  }}>
                    Edit
                  </Button>
                )}
              </div>
              {categoryError && <p role="alert" className="text-xs text-red">Could not save category settings.</p>}
              <div className="space-y-2">
                {txBreakdown.categories.map((tx, index) => (
                  <div
                    key={tx.type}
                    className="flex justify-between items-center gap-2 text-[12px]"
                  >
                    {draft ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          type="color"
                          aria-label={`${tx.type} category color`}
                          value={draft[tx.type]?.color ?? pickerColors[index % CHART_COLORS.length]}
                          onChange={(event) => updateCategory(tx.type, { color: event.target.value })}
                          className="h-8 w-9 shrink-0 cursor-pointer"
                        />
                        <Input
                          aria-label={`${tx.type} category name`}
                          value={draft[tx.type]?.name ?? tx.type}
                          onChange={(event) => updateCategory(tx.type, { name: event.target.value })}
                        />
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-ink-2">
                        <span
                          className="w-2.5 h-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: categorySettings[tx.type]?.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
                          aria-hidden="true"
                        />
                        {categorySettings[tx.type]?.name ?? tx.type} ({tx.count} txs)
                      </span>
                    )}
                    <strong className="text-ink">${tx.amount}</strong>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical analytics & reports export */}
      <Card>
        <CardHeader>
          <CardTitle>Spending Analytics & Exports</CardTitle>
          <CardDescription>
            Export and inspect transaction reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-surface-2 border border-line rounded-lg text-center space-y-1">
            <p className="text-[12px] font-semibold text-ink">
              Historical Spending Analytics
            </p>
            <p className="text-[11px] text-ink-3">
              Daily average: $42.66 | Weekly average: $298.60
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleExportCSV}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
          </div>
          {exportMessage && (
            <p
              className="text-[11px] text-brand text-center font-semibold mt-1"
              data-testid="export-status"
            >
              {exportMessage}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
