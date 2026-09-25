import { FlameIcon } from "@hugeicons/core-free-icons";
import { BulbIcon, CalculatorIcon, CircleGaugeIcon, ClockIcon, Refresh01Icon, ZapIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

interface GasOptimizerProps {
  className?: string;
  operations?: string[];
  refreshInterval?: number;
}

interface GasPriceData {
  baseFee: string;
  gasPrice: string;
  ledgerCloseTime: number;
  baseReserve: string;
}

interface OperationGasBreakdown {
  operationType: string;
  gasUnits: number;
  feeStroops: string;
  feeXlm: string;
}

interface FeeScenario {
  label: "low" | "average" | "high";
  gasPrice: string;
  totalFeeStroops: string;
  totalFeeXlm: string;
  savings: string;
}

interface GasEstimate {
  totalGasUnits: number;
  breakdown: OperationGasBreakdown[];
  scenarios: FeeScenario[];
  customMultiplier: number;
}

function formatStroops(stroops: string): string {
  const num = parseInt(stroops, 10);
  if (isNaN(num)) return stroops;
  return num.toLocaleString();
}

function formatXlm(xlm: string): string {
  const num = parseFloat(xlm);
  if (isNaN(num)) return xlm;
  return num.toFixed(7);
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function GasOptimizer({
  className,
  operations = ["payment"],
  refreshInterval = 0,
}: GasOptimizerProps) {
  const { client } = useSorokit();
  const [gasPriceData, setGasPriceData] = useState<GasPriceData | null>(null);
  const [estimate, setEstimate] = useState<GasEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customMultiplier, setCustomMultiplier] = useState(1);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  const loadGasData = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const [gasRes, feeRes] = await Promise.all([
        client.network.getGasPrice(),
        client.transaction.estimateDetailedFee({
          operations,
          feeMultiplier: customMultiplier,
        }),
      ]);

      if (gasRes.error) {
        setError(gasRes.error);
        return;
      }
      if (feeRes.error) {
        setError(feeRes.error);
        return;
      }

      setGasPriceData(gasRes.data);
      setEstimate(feeRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load gas data");
    } finally {
      setLoading(false);
    }
  }, [client, operations, customMultiplier]);

  const loadScenarios = useCallback(async () => {
    if (!estimate || !client) return;
    setScenarioError(null);
    try {
      const { data, error: err } = await client.transaction.getFeeScenarios({
        operations,
        baseGasUnits: estimate.totalGasUnits,
      });
      if (err) {
        setScenarioError(err);
        return;
      }
      if (data) {
        setEstimate((prev) =>
          prev ? { ...prev, scenarios: data } : prev,
        );
      }
    } catch (e) {
      setScenarioError(e instanceof Error ? e.message : "Failed to load scenarios");
    }
  }, [client, estimate, operations]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadGasData();
    }, 0);
    if (refreshInterval > 0) {
      const id = setInterval(() => {
        void loadGasData();
      }, refreshInterval);
      return () => {
        window.clearTimeout(timerId);
        clearInterval(id);
      };
    }
    return () => {
      window.clearTimeout(timerId);
    };
  }, [loadGasData, refreshInterval]);

  useEffect(() => {
    if (!estimate) return;
    let active = true;
    const timerId = window.setTimeout(() => {
      if (active) void loadScenarios();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [estimate, loadScenarios]);

  const handleMultiplierChange = (value: number) => {
    setCustomMultiplier(value);
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[13px] font-semibold text-ink">Gas Optimizer</h3>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Network gas stats & fee optimization
          </p>
        </div>
        <button
          onClick={() => void loadGasData()}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
          title="Refresh gas data"
          aria-label="Refresh gas data"
        >
          <HugeiconsIcon
            icon={Refresh01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      <div className="px-5 py-4" aria-live="polite" aria-atomic="true">
        {loading && !gasPriceData ? (
          <div className="flex flex-col gap-4">
            <div className="h-8 w-full rounded-lg bg-surface-2 animate-pulse" />
            <div className="h-24 rounded-lg bg-surface-2 animate-pulse" />
          </div>
        ) : error || scenarioError ? (
          <p className="text-[12px] text-red">{error || scenarioError}</p>
        ) : gasPriceData && estimate ? (
          <div className="flex flex-col gap-5">
            <NetworkStats gasPriceData={gasPriceData} />
            <GasPriceDisplay gasPriceData={gasPriceData} estimate={estimate} />
            <MultiplierSlider
              value={customMultiplier}
              onChange={handleMultiplierChange}
            />
            <OperationBreakdown breakdown={estimate.breakdown} />
            <FeeScenarios scenarios={estimate.scenarios} multiplier={customMultiplier} />
            <OptimizerSuggestions estimate={estimate} gasPriceData={gasPriceData} />
            <TotalFee estimate={estimate} multiplier={customMultiplier} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function NetworkStats({ gasPriceData }: { gasPriceData: GasPriceData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={CircleGaugeIcon} size={14} color="currentColor" className="text-brand" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Base Reserve</span>
          <span className="text-[13px] font-semibold text-ink">{gasPriceData.baseReserve} XLM</span>
        </div>
      </div>
      <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={ClockIcon} size={14} color="currentColor" className="text-brand" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Ledger Close</span>
          <span className="text-[13px] font-semibold text-ink">{formatTime(gasPriceData.ledgerCloseTime)}</span>
        </div>
      </div>
    </div>
  );
}

function GasPriceDisplay({ gasPriceData, estimate }: { gasPriceData: GasPriceData; estimate: GasEstimate }) {
  return (
    <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={ZapIcon} size={14} color="currentColor" className="text-brand" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Gas Price</span>
          <span className="text-[13px] font-semibold text-ink">
            {gasPriceData.gasPrice} stroops/op
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Total Gas</span>
        <span className="text-[13px] font-semibold text-ink ml-2">{estimate.totalGasUnits} units</span>
      </div>
    </div>
  );
}

function MultiplierSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-ink-2">Gas Price Multiplier</span>
        <span className="text-[13px] font-semibold text-brand">{value.toFixed(1)}x</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={2}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none bg-surface-2 cursor-pointer accent-brand"
        aria-label="Gas price multiplier"
      />
      <div className="flex justify-between text-[10px] text-ink-4">
        <span>0.5x</span>
        <span>1.0x</span>
        <span>2.0x</span>
      </div>
    </div>
  );
}

function OperationBreakdown({ breakdown }: { breakdown: OperationGasBreakdown[] }) {
  if (breakdown.length === 0) {
    return (
      <div className="rounded-lg bg-surface-2 border border-line px-4 py-3">
        <p className="text-[12px] text-ink-3">No operations to break down</p>
      </div>
    );
  }

  const totalGasUnits = breakdown.reduce((s, b) => s + b.gasUnits, 0);
  const totalFeeStroops = breakdown.reduce((s, b) => s + parseInt(b.feeStroops, 10), 0);
  const totalFeeXlm = breakdown.reduce((s, b) => s + parseFloat(b.feeXlm), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={CalculatorIcon} size={12} className="text-ink-3" strokeWidth={1.5} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">Cost Breakdown</span>
      </div>
      <div className="rounded-lg border border-line overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-surface-2">
              <th className="text-left px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">Operation</th>
              <th className="text-right px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">Gas Units</th>
              <th className="text-right px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">Fee</th>
              <th className="text-right px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">XLM</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr key={item.operationType} className="border-t border-line">
                <td className="px-3 py-2 text-ink-2 capitalize">{item.operationType.replace("_", " ")}</td>
                <td className="px-3 py-2 text-right text-ink font-mono">{item.gasUnits.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-ink font-mono">{formatStroops(item.feeStroops)}</td>
                <td className="px-3 py-2 text-right text-ink font-mono">{formatXlm(item.feeXlm)}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-surface-2">
              <td className="px-3 py-2 text-ink font-semibold capitalize">Total</td>
              <td className="px-3 py-2 text-right text-ink font-mono font-semibold">
                {totalGasUnits.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right text-ink font-mono font-semibold">
                {formatStroops(String(totalFeeStroops))}
              </td>
              <td className="px-3 py-2 text-right text-ink font-mono font-semibold">
                {formatXlm(totalFeeXlm.toFixed(7))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeeScenarios({ scenarios, multiplier: _multiplier }: { scenarios: FeeScenario[]; multiplier: number }) {
  const [activeScenario, setActiveScenario] = useState<string>("average");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={FlameIcon} size={12} className="text-ink-3" strokeWidth={1.5} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">Fee Scenarios</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {scenarios.map((scenario) => (
          <button
            key={scenario.label}
            onClick={() => setActiveScenario(scenario.label)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              activeScenario === scenario.label
                ? "border-brand bg-brand-dim-subtle"
                : "border-line bg-surface-2 hover:bg-surface",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-4 block">{scenario.label}</span>
            <span className="text-[15px] font-semibold text-ink block mt-0.5">
              {scenario.totalFeeStroops} str
            </span>
            <span className="text-[11px] text-ink-3 block">
              {formatXlm(scenario.totalFeeXlm)} XLM
            </span>
            <span className={cn(
              "text-[10px] font-semibold block mt-0.5",
              scenario.label === "low" ? "text-green" : scenario.label === "high" ? "text-red" : "text-ink-3",
            )}>
              {scenario.savings}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OptimizerSuggestions({ estimate, gasPriceData }: { estimate: GasEstimate; gasPriceData: GasPriceData }) {
  const suggestions: { icon: string; text: string; savings: string }[] = [];

  if (estimate.customMultiplier > 1) {
    const totalStroops = estimate.breakdown.reduce((s, b) => s + parseInt(b.feeStroops, 10), 0);
    const savingsStroops = String(Math.round(totalStroops * (estimate.customMultiplier - 1) / estimate.customMultiplier));
    suggestions.push({
      text: "Reducing gas multiplier to 1.0x could save you stroops",
      savings: `${savingsStroops} stroops`,
      icon: "⚡",
    });
  }

  if (estimate.customMultiplier < 1) {
    suggestions.push({
      text: "Lower multiplier may cause delayed transaction inclusion",
      savings: "Risk of failure",
      icon: "⚠️",
    });
  }

  const reserve = parseFloat(gasPriceData.baseReserve);
  if (reserve > 1) {
    suggestions.push({
      text: `Base reserve is high (${gasPriceData.baseReserve} XLM). Consider consolidating accounts.`,
      savings: "Lower reserve requirement",
      icon: "💡",
    });
  }

  const totalStroops = estimate.breakdown.reduce((s, b) => s + parseInt(b.feeStroops, 10), 0);
  if (totalStroops > 100000) {
    suggestions.push({
      text: "High total gas usage detected. Consider splitting into smaller transactions.",
      savings: "Reduced per-tx cost",
      icon: "🔄",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      text: "Your gas configuration looks optimal for current network conditions.",
      savings: "No changes needed",
      icon: "✅",
    });
  }

  return (
    <div className="rounded-lg bg-brand-dim-subtle border border-brand-dim px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
          <HugeiconsIcon icon={BulbIcon} size={12} className="text-brand" strokeWidth={1.5} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">Optimization Tips</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-ink-2">
            <span className="shrink-0 mt-0.5">{s.icon}</span>
            <span>{s.text}</span>
            <span className="ml-auto shrink-0 text-[10px] font-semibold text-brand">{s.savings}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TotalFee({ estimate, multiplier }: { estimate: GasEstimate; multiplier: number }) {
  const totalStroops = estimate.breakdown.reduce((s, b) => s + parseInt(b.feeStroops, 10), 0);
  const adjustedStroops = Math.round(totalStroops * multiplier);
  const adjustedXlm = (adjustedStroops / 10_000_000).toFixed(7);

  return (
    <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={FlameIcon} size={14} color="currentColor" className="text-brand" strokeWidth={1.5} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Estimated Total Fee</span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-ink">{formatStroops(String(adjustedStroops))}</span>
            <span className="text-[11px] text-ink-3">stroops</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">XLM</span>
        <span className="text-lg font-semibold text-ink ml-2">{formatXlm(adjustedXlm)}</span>
      </div>
    </div>
  );
}