import { useState } from "react";

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

interface AssetBreakdown {
  asset: string;
  amount: number;
  percentage: number;
}

interface TxBreakdown {
  type: string;
  amount: number;
  count: number;
}

export function BudgetScreen() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    "monthly",
  );
  const [budgetLimit, setBudgetLimit] = useState(1500);
  const [currentSpent] = useState(1280);
  const [warningThreshold, setWarningThreshold] = useState(80); // 80% default
  const [lockTransactions, setLockTransactions] = useState(false);

  // Asset breakdown mock data
  const [assets] = useState<AssetBreakdown[]>([
    { asset: "XLM", amount: 800, percentage: 62.5 },
    { asset: "USDC", amount: 480, percentage: 37.5 },
  ]);

  // Tx type breakdown mock data
  const [txTypes] = useState<TxBreakdown[]>([
    { type: "Payment", amount: 950, count: 14 },
    { type: "Swap", amount: 230, count: 4 },
    { type: "Farming Deposit", amount: 100, count: 1 },
  ]);

  // Calculations
  const percentageUsed = (currentSpent / budgetLimit) * 100;
  const isApproachingLimit =
    percentageUsed >= warningThreshold && percentageUsed < 95;
  const isCriticalLimit = percentageUsed >= 95;
  const isOverBudget = currentSpent > budgetLimit;

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
                <span className="text-ink-3">/ ${budgetLimit}</span>
              </div>
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

          <div className="flex justify-between items-center text-[12px] text-ink-2">
            <span>{percentageUsed.toFixed(1)}% of budget utilized</span>
            <div className="flex gap-2">
              {isOverBudget && <Badge variant="error">Limit Exceeded</Badge>}
              {isCriticalLimit && !isOverBudget && (
                <Badge variant="error">Critical (&gt;95%)</Badge>
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
                value={budgetLimit}
                onChange={(e) => setBudgetLimit(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-medium text-ink-2 flex justify-between">
                <span>Warning Threshold</span>
                <span className="font-semibold">{warningThreshold}%</span>
              </label>
              <input
                type="range"
                min="50"
                max="95"
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
            {/* By Asset */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-ink-3 uppercase">
                By Asset
              </p>
              <div className="space-y-2">
                {assets.map((asset) => (
                  <div
                    key={asset.asset}
                    className="flex justify-between items-center text-[12px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-brand" />
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
              <p className="text-[11px] font-bold text-ink-3 uppercase">
                By Transaction Type
              </p>
              <div className="space-y-2">
                {txTypes.map((tx) => (
                  <div
                    key={tx.type}
                    className="flex justify-between items-center text-[12px]"
                  >
                    <span className="text-ink-2">
                      {tx.type} ({tx.count} txs)
                    </span>
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
