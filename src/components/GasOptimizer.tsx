import {
  BulbIcon,
  CalculatorIcon,
  CircleGaugeIcon,
  ClockIcon,
  Download01Icon,
  FlameIcon,
  Refresh01Icon,
  Tick01Icon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

// Soroban Protocol Execution Limits
export const MIN_CPU_INSTRUCTIONS = 40_000;
export const MAX_CPU_INSTRUCTIONS = 100_000_000;
export const MIN_MEMORY_BYTES = 1_048_576; // 1 MiB (1,048,576 bytes) Soroban minimum requirement
export const MAX_MEMORY_BYTES = 41_943_040; // 40 MiB (41,943_040 bytes) Soroban protocol limit

export const SOROBAN_MIN_INSTRUCTIONS = MIN_CPU_INSTRUCTIONS;
export const SOROBAN_MAX_INSTRUCTIONS = MAX_CPU_INSTRUCTIONS;
export const SOROBAN_MIN_MEMORY = MIN_MEMORY_BYTES;
export const SOROBAN_MAX_MEMORY = MAX_MEMORY_BYTES;

export const SOROBAN_PROTOCOL_LIMITS = {
  instructions: {
    min: MIN_CPU_INSTRUCTIONS,
    max: MAX_CPU_INSTRUCTIONS,
  },
  memory: {
    min: MIN_MEMORY_BYTES,
    max: MAX_MEMORY_BYTES,
  },
} as const;

export type GasPresetName = "Conservative" | "Aggressive" | "Custom";

export interface GasPresetConfig {
  cpuInstructions: number;
  memoryBytes: number;
  multiplier: number;
}

export const GAS_PRESETS: Record<"Conservative" | "Aggressive", GasPresetConfig> = {
  Conservative: {
    cpuInstructions: 50_000_000,
    memoryBytes: 33_554_432, // 32 MiB
    multiplier: 1.0,
  },
  Aggressive: {
    cpuInstructions: 10_000_000,
    memoryBytes: 10_485_760, // 10 MiB
    multiplier: 1.5,
  },
};

export interface GasOptimizerConfig {
  version: string;
  network: string;
  preset: string;
  instructions: number;
  cpuInstructions: number;
  memory: number;
  memoryBytes: number;
  feeMultiplier: number;
  gasMultiplier: number;
  multiplier: number;
  gasPrice: string;
  baseFee: string;
  baseReserve: string;
  operations: string[];
  resources: {
    instructions: number;
    memory: number;
  };
  profile: {
    preset: string;
    instructions: number;
    memory: number;
    multiplier: number;
  };
}

export interface GasOptimizerProps {
  className?: string;
  operations?: string[];
  refreshInterval?: number;
  onExport?: (config: GasOptimizerConfig) => void;
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

function copyViaExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}

export function GasOptimizer({
  className,
  operations = ["payment"],
  refreshInterval = 0,
  onExport,
}: GasOptimizerProps) {
  const { client, network } = useSorokit();
  const [gasPriceData, setGasPriceData] = useState<GasPriceData | null>(null);
  const [estimate, setEstimate] = useState<GasEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Optimization preset & resource states
  const [preset, setPreset] = useState<GasPresetName>("Conservative");
  const [cpuInstructions, setCpuInstructions] = useState<number>(
    GAS_PRESETS.Conservative.cpuInstructions,
  );
  const [memoryBytes, setMemoryBytes] = useState<number>(
    GAS_PRESETS.Conservative.memoryBytes,
  );
  const [customMultiplier, setCustomMultiplier] = useState<number>(
    GAS_PRESETS.Conservative.multiplier,
  );
  const [exported, setExported] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string>("");

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
        setEstimate((prev) => (prev ? { ...prev, scenarios: data } : prev));
      }
    } catch (e) {
      setScenarioError(
        e instanceof Error ? e.message : "Failed to load scenarios",
      );
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

  const handlePresetSelect = (newPreset: GasPresetName) => {
    setPreset(newPreset);
    if (newPreset === "Conservative") {
      const config = GAS_PRESETS.Conservative;
      setCpuInstructions(config.cpuInstructions);
      setMemoryBytes(config.memoryBytes);
      setCustomMultiplier(config.multiplier);
      setAnnouncement(
        `Preset changed to Conservative. CPU instructions: ${config.cpuInstructions.toLocaleString()}, Memory: ${config.memoryBytes.toLocaleString()} bytes, Multiplier: ${config.multiplier.toFixed(1)}x`,
      );
    } else if (newPreset === "Aggressive") {
      const config = GAS_PRESETS.Aggressive;
      setCpuInstructions(config.cpuInstructions);
      setMemoryBytes(config.memoryBytes);
      setCustomMultiplier(config.multiplier);
      setAnnouncement(
        `Preset changed to Aggressive. CPU instructions: ${config.cpuInstructions.toLocaleString()}, Memory: ${config.memoryBytes.toLocaleString()} bytes, Multiplier: ${config.multiplier.toFixed(1)}x`,
      );
    } else {
      setAnnouncement(
        `Preset changed to Custom. CPU instructions: ${cpuInstructions.toLocaleString()}, Memory: ${memoryBytes.toLocaleString()} bytes, Multiplier: ${customMultiplier.toFixed(1)}x`,
      );
    }
  };

  const handleCpuChange = (val: number) => {
    const clamped = Math.max(
      MIN_CPU_INSTRUCTIONS,
      Math.min(MAX_CPU_INSTRUCTIONS, isNaN(val) ? MIN_CPU_INSTRUCTIONS : val),
    );
    setCpuInstructions(clamped);
    setPreset("Custom");
  };

  const handleMemoryChange = (val: number) => {
    const clamped = Math.max(
      MIN_MEMORY_BYTES,
      Math.min(MAX_MEMORY_BYTES, isNaN(val) ? MIN_MEMORY_BYTES : val),
    );
    setMemoryBytes(clamped);
    setPreset("Custom");
  };

  const handleMultiplierChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(2.0, isNaN(val) ? 1.0 : val));
    setCustomMultiplier(clamped);
    setPreset("Custom");
  };

  const getExportConfig = useCallback((): GasOptimizerConfig => {
    const netName =
      (typeof network === "string" ? network : network?.name) || "testnet";
    return {
      version: "1.0.0",
      network: netName,
      preset: preset.toLowerCase(),
      instructions: cpuInstructions,
      cpuInstructions,
      memory: memoryBytes,
      memoryBytes,
      feeMultiplier: customMultiplier,
      gasMultiplier: customMultiplier,
      multiplier: customMultiplier,
      gasPrice: gasPriceData?.gasPrice ?? "100",
      baseFee: gasPriceData?.baseFee ?? "100",
      baseReserve: gasPriceData?.baseReserve ?? "0.5",
      operations,
      resources: {
        instructions: cpuInstructions,
        memory: memoryBytes,
      },
      profile: {
        preset: preset.toLowerCase(),
        instructions: cpuInstructions,
        memory: memoryBytes,
        multiplier: customMultiplier,
      },
    };
  }, [
    network,
    preset,
    cpuInstructions,
    memoryBytes,
    customMultiplier,
    gasPriceData,
    operations,
  ]);

  const handleExport = useCallback(() => {
    const config = getExportConfig();
    const jsonString = JSON.stringify(config, null, 2);

    // Copy to clipboard
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(jsonString).catch(() => {
        copyViaExecCommand(jsonString);
      });
    } else {
      copyViaExecCommand(jsonString);
    }

    // Trigger download if supported in environment
    if (
      typeof window !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      typeof Blob !== "undefined"
    ) {
      try {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sorokit-gas-config.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Safe in non-browser or test environments
      }
    }

    onExport?.(config);
    setExported(true);
    setAnnouncement("Gas configuration exported to clipboard");
    setTimeout(() => {
      setExported(false);
    }, 2000);
  }, [getExportConfig, onExport]);

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface-2 hover:bg-surface text-ink-2 hover:text-ink text-[12px] font-medium transition-colors"
            title="Export configuration as JSON"
            aria-label="Export Config"
          >
            <HugeiconsIcon
              icon={exported ? Tick01Icon : Download01Icon}
              size={13}
              color="currentColor"
              strokeWidth={1.5}
              className={exported ? "text-green" : ""}
            />
            <span>{exported ? "Exported!" : "Export Config"}</span>
          </button>
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
      </div>

      <div className="px-5 py-4" aria-live="polite" aria-atomic="true">
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {announcement}
        </span>
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
            <PresetSelector preset={preset} onSelect={handlePresetSelect} />
            <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={CalculatorIcon}
                    size={12}
                    className="text-ink-3"
                    strokeWidth={1.5}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                    Execution Resource Limits
                  </span>
                </div>
                <span className="text-[10px] text-ink-4 font-mono">
                  Soroban Protocol Boundaries
                </span>
              </div>
              <CpuInstructionsSlider
                value={cpuInstructions}
                onChange={handleCpuChange}
              />
              <MemorySlider
                value={memoryBytes}
                onChange={handleMemoryChange}
              />
              <MultiplierSlider
                value={customMultiplier}
                onChange={handleMultiplierChange}
              />
            </div>
            <OperationBreakdown breakdown={estimate.breakdown} />
            <FeeScenarios
              scenarios={estimate.scenarios}
              multiplier={customMultiplier}
            />
            <OptimizerSuggestions
              estimate={estimate}
              gasPriceData={gasPriceData}
            />
            <TotalFee estimate={estimate} multiplier={customMultiplier} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PresetSelector({
  preset,
  onSelect,
}: {
  preset: GasPresetName;
  onSelect: (p: GasPresetName) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={ZapIcon}
            size={12}
            className="text-ink-3"
            strokeWidth={1.5}
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Optimization Preset
          </span>
        </div>
        <span className="text-[11px] text-ink-3">
          Active: <span className="font-semibold text-brand">{preset}</span>
        </span>
      </div>
      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="Optimization presets"
      >
        {(["Conservative", "Aggressive", "Custom"] as const).map((p) => {
          const isActive = preset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelect(p)}
              aria-pressed={isActive}
              className={cn(
                "rounded-lg border px-3 py-2 text-center text-[12px] font-medium transition-all",
                isActive
                  ? "border-brand bg-brand-dim text-brand font-semibold shadow-xs"
                  : "border-line bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CpuInstructionsSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="gas-cpu-instructions-slider"
          className="text-[11px] font-semibold text-ink-2"
        >
          CPU Instructions
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-semibold text-brand font-mono">
            {value.toLocaleString()}
          </span>
          <span className="text-[10px] text-ink-4">instructions</span>
        </div>
      </div>
      <input
        id="gas-cpu-instructions-slider"
        type="range"
        min={MIN_CPU_INSTRUCTIONS}
        max={MAX_CPU_INSTRUCTIONS}
        step={10000}
        value={value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          const clamped = Math.max(
            MIN_CPU_INSTRUCTIONS,
            Math.min(
              MAX_CPU_INSTRUCTIONS,
              isNaN(raw) ? MIN_CPU_INSTRUCTIONS : raw,
            ),
          );
          onChange(clamped);
        }}
        className="w-full h-1.5 rounded-lg appearance-none bg-surface-2 cursor-pointer accent-brand"
        aria-label="CPU instructions"
      />
      <div className="flex justify-between text-[10px] text-ink-4">
        <span>{MIN_CPU_INSTRUCTIONS.toLocaleString()} (min)</span>
        <span>50,000,000</span>
        <span>{MAX_CPU_INSTRUCTIONS.toLocaleString()} (max)</span>
      </div>
    </div>
  );
}

function MemorySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const mb = (value / (1024 * 1024)).toFixed(1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="gas-memory-slider"
          className="text-[11px] font-semibold text-ink-2"
        >
          Memory Limit
        </label>
        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-semibold text-brand font-mono">
            {mb} MB
          </span>
          <span className="text-[10px] text-ink-4">
            ({value.toLocaleString()} B)
          </span>
        </div>
      </div>
      <input
        id="gas-memory-slider"
        type="range"
        min={MIN_MEMORY_BYTES}
        max={MAX_MEMORY_BYTES}
        step={65536}
        value={value}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          const clamped = Math.max(
            MIN_MEMORY_BYTES,
            Math.min(
              MAX_MEMORY_BYTES,
              isNaN(raw) ? MIN_MEMORY_BYTES : raw,
            ),
          );
          onChange(clamped);
        }}
        className="w-full h-1.5 rounded-lg appearance-none bg-surface-2 cursor-pointer accent-brand"
        aria-label="Memory limit"
      />
      <div className="flex justify-between text-[10px] text-ink-4">
        <span>1.0 MB (min)</span>
        <span>20.0 MB</span>
        <span>40.0 MB (max)</span>
      </div>
    </div>
  );
}

function MultiplierSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="gas-multiplier-slider"
          className="text-[11px] font-semibold text-ink-2"
        >
          Gas Price Multiplier
        </label>
        <span className="text-[13px] font-semibold text-brand">
          {value.toFixed(1)}x
        </span>
      </div>
      <input
        id="gas-multiplier-slider"
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

function NetworkStats({ gasPriceData }: { gasPriceData: GasPriceData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={CircleGaugeIcon}
            size={14}
            color="currentColor"
            className="text-brand"
            strokeWidth={1.5}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Base Reserve
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {gasPriceData.baseReserve} XLM
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={ClockIcon}
            size={14}
            color="currentColor"
            className="text-brand"
            strokeWidth={1.5}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Ledger Close
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {formatTime(gasPriceData.ledgerCloseTime)}
          </span>
        </div>
      </div>
    </div>
  );
}

function GasPriceDisplay({
  gasPriceData,
  estimate,
}: {
  gasPriceData: GasPriceData;
  estimate: GasEstimate;
}) {
  return (
    <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={ZapIcon}
            size={14}
            color="currentColor"
            className="text-brand"
            strokeWidth={1.5}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Gas Price
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {gasPriceData.gasPrice} stroops/op
          </span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          Total Gas
        </span>
        <span className="text-[13px] font-semibold text-ink ml-2">
          {estimate.totalGasUnits} units
        </span>
      </div>
    </div>
  );
}

function OperationBreakdown({
  breakdown,
}: {
  breakdown: OperationGasBreakdown[];
}) {
  if (breakdown.length === 0) {
    return (
      <div className="rounded-lg bg-surface-2 border border-line px-4 py-3">
        <p className="text-[12px] text-ink-3">No operations to break down</p>
      </div>
    );
  }

  const totalGasUnits = breakdown.reduce((s, b) => s + b.gasUnits, 0);
  const totalFeeStroops = breakdown.reduce(
    (s, b) => s + parseInt(b.feeStroops, 10),
    0,
  );
  const totalFeeXlm = breakdown.reduce((s, b) => s + parseFloat(b.feeXlm), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={CalculatorIcon}
          size={12}
          className="text-ink-3"
          strokeWidth={1.5}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          Cost Breakdown
        </span>
      </div>
      <div className="rounded-lg border border-line overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-surface-2">
              <th className="text-left px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">
                Operation
              </th>
              <th className="text-right px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">
                Gas Units
              </th>
              <th className="text-right px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">
                Fee
              </th>
              <th className="text-right px-3 py-2 font-semibold text-ink-3 text-[10px] uppercase tracking-wider">
                XLM
              </th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((item) => (
              <tr key={item.operationType} className="border-t border-line">
                <td className="px-3 py-2 text-ink-2 capitalize">
                  {item.operationType.replace("_", " ")}
                </td>
                <td className="px-3 py-2 text-right text-ink font-mono">
                  {item.gasUnits.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-ink font-mono">
                  {formatStroops(item.feeStroops)}
                </td>
                <td className="px-3 py-2 text-right text-ink font-mono">
                  {formatXlm(item.feeXlm)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line bg-surface-2">
              <td className="px-3 py-2 text-ink font-semibold capitalize">
                Total
              </td>
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

function FeeScenarios({
  scenarios,
  multiplier: _multiplier,
}: {
  scenarios: FeeScenario[];
  multiplier: number;
}) {
  const [activeScenario, setActiveScenario] = useState<string>("average");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <HugeiconsIcon
          icon={FlameIcon}
          size={12}
          className="text-ink-3"
          strokeWidth={1.5}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          Fee Scenarios
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {scenarios.map((scenario) => (
          <button
            key={scenario.label}
            type="button"
            onClick={() => setActiveScenario(scenario.label)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              activeScenario === scenario.label
                ? "border-brand bg-brand-dim-subtle"
                : "border-line bg-surface-2 hover:bg-surface",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-4 block">
              {scenario.label}
            </span>
            <span className="text-[15px] font-semibold text-ink block mt-0.5">
              {scenario.totalFeeStroops} str
            </span>
            <span className="text-[11px] text-ink-3 block">
              {formatXlm(scenario.totalFeeXlm)} XLM
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold block mt-0.5",
                scenario.label === "low"
                  ? "text-green"
                  : scenario.label === "high"
                    ? "text-red"
                    : "text-ink-3",
              )}
            >
              {scenario.savings}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OptimizerSuggestions({
  estimate,
  gasPriceData,
}: {
  estimate: GasEstimate;
  gasPriceData: GasPriceData;
}) {
  const suggestions: { icon: string; text: string; savings: string }[] = [];

  if (estimate.customMultiplier > 1) {
    const totalStroops = estimate.breakdown.reduce(
      (s, b) => s + parseInt(b.feeStroops, 10),
      0,
    );
    const savingsStroops = String(
      Math.round(
        (totalStroops * (estimate.customMultiplier - 1)) /
          estimate.customMultiplier,
      ),
    );
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

  const totalStroops = estimate.breakdown.reduce(
    (s, b) => s + parseInt(b.feeStroops, 10),
    0,
  );
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
        <HugeiconsIcon
          icon={BulbIcon}
          size={12}
          className="text-brand"
          strokeWidth={1.5}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">
          Optimization Tips
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {suggestions.map((s, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-[12px] text-ink-2"
          >
            <span className="shrink-0 mt-0.5">{s.icon}</span>
            <span>{s.text}</span>
            <span className="ml-auto shrink-0 text-[10px] font-semibold text-brand">
              {s.savings}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TotalFee({
  estimate,
  multiplier,
}: {
  estimate: GasEstimate;
  multiplier: number;
}) {
  const totalStroops = estimate.breakdown.reduce(
    (s, b) => s + parseInt(b.feeStroops, 10),
    0,
  );
  const adjustedStroops = Math.round(totalStroops * multiplier);
  const adjustedXlm = (adjustedStroops / 10_000_000).toFixed(7);

  return (
    <div className="rounded-lg bg-surface-2 border border-line px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-dim flex items-center justify-center shrink-0">
          <HugeiconsIcon
            icon={FlameIcon}
            size={14}
            color="currentColor"
            className="text-brand"
            strokeWidth={1.5}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Estimated Total Fee
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-ink">
              {formatStroops(String(adjustedStroops))}
            </span>
            <span className="text-[11px] text-ink-3">stroops</span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
          XLM
        </span>
        <span className="text-lg font-semibold text-ink ml-2">
          {formatXlm(adjustedXlm)}
        </span>
      </div>
    </div>
  );
}