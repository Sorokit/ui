import { AlertTriangle, ArrowUpDown, Info, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/Card";
import { Input } from "./ui/Input";

interface PoolReserves {
  fromReserves: number;
  toReserves: number;
}

const POOL_RESERVES: Record<string, PoolReserves> = {
  "XLM-USDC": { fromReserves: 100000, toReserves: 12000 },
  "USDC-XLM": { fromReserves: 12000, toReserves: 100000 },
  "XLM-USDT": { fromReserves: 100000, toReserves: 12000 },
  "USDT-XLM": { fromReserves: 12000, toReserves: 100000 },
  "XLM-EURC": { fromReserves: 100000, toReserves: 11000 },
  "EURC-XLM": { fromReserves: 11000, toReserves: 100000 },
  "USDC-USDT": { fromReserves: 50000, toReserves: 50000 },
  "USDT-USDC": { fromReserves: 50000, toReserves: 50000 },
};

const USD_PRICES: Record<string, number> = {
  XLM: 0.12,
  USDC: 1.00,
  USDT: 1.00,
  EURC: 1.10,
};

const ASSETS = ["XLM", "USDC", "USDT", "EURC"];

interface SwapSimulatorProps {
  className?: string;
  onSwap?: (params: {
    fromAsset: string;
    toAsset: string;
    amountIn: number;
    amountOut: number;
    priceImpact: number;
    slippage: number;
    liquiditySize: string;
  }) => void;
}

export function SwapSimulator({ className, onSwap }: SwapSimulatorProps) {
  const { isConnected, connectWallet } = useSorokit();

  // Swap State
  const [fromAsset, setFromAsset] = useState("XLM");
  const [toAsset, setToAsset] = useState("USDC");
  const [amountInStr, setAmountInStr] = useState("100");
  const [liquiditySize, setLiquiditySize] = useState<"low" | "medium" | "high">("medium");
  const [maxSlippageStr, setMaxSlippageStr] = useState("0.5");
  const [activeTab, setActiveTab] = useState<"impact" | "history">("impact");
  const [historyRange, setHistoryRange] = useState<"7d" | "30d">("7d");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState<boolean | null>(null);

  // SVG Chart Hover States
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Keep assets distinct
  const handleFromAssetChange = (val: string) => {
    setFromAsset(val);
    if (val === toAsset) {
      const remaining = ASSETS.filter((a) => a !== val);
      setToAsset(remaining[0] || val);
    }
  };

  const handleToAssetChange = (val: string) => {
    setToAsset(val);
    if (val === fromAsset) {
      const remaining = ASSETS.filter((a) => a !== val);
      setFromAsset(remaining[0] || val);
    }
  };

  const handleFlipAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
  };

  // Convert numbers safely
  const amountIn = useMemo(() => {
    const parsed = parseFloat(amountInStr);
    return isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  }, [amountInStr]);

  const maxSlippage = useMemo(() => {
    const parsed = parseFloat(maxSlippageStr);
    return isNaN(parsed) || parsed <= 0 || parsed > 50 ? 0.5 : parsed;
  }, [maxSlippageStr]);

  const isSlippageInvalid = useMemo(() => {
    const parsed = parseFloat(maxSlippageStr);
    return isNaN(parsed) || parsed <= 0 || parsed > 50;
  }, [maxSlippageStr]);

  // Compute Pool Reserves with Multiplier
  const { reservesFrom, reservesTo } = useMemo(() => {
    const pairKey = `${fromAsset}-${toAsset}`;
    const reverseKey = `${toAsset}-${fromAsset}`;
    let base = POOL_RESERVES[pairKey];
    let isReversed = false;

    if (!base && POOL_RESERVES[reverseKey]) {
      base = POOL_RESERVES[reverseKey];
      isReversed = true;
    }

    const multiplier = liquiditySize === "low" ? 0.1 : liquiditySize === "high" ? 10 : 1.0;
    const fromReserves = base ? (isReversed ? base.toReserves : base.fromReserves) * multiplier : 10000 * multiplier;
    const toReserves = base ? (isReversed ? base.fromReserves : base.toReserves) * multiplier : 10000 * multiplier;

    return { reservesFrom: fromReserves, reservesTo: toReserves };
  }, [fromAsset, toAsset, liquiditySize]);

  // Perform Constant Product calculations (0.3% fee)
  const feeRate = 0.003;
  const netAmountIn = amountIn * (1 - feeRate);

  const amountOut = useMemo(() => {
    if (amountIn <= 0) return 0;
    const out = (reservesTo * netAmountIn) / (reservesFrom + netAmountIn);
    return out;
  }, [amountIn, reservesFrom, reservesTo, netAmountIn]);

  const spotPrice = useMemo(() => {
    return reservesTo / reservesFrom;
  }, [reservesFrom, reservesTo]);

  const executionPrice = useMemo(() => {
    if (amountIn <= 0) return spotPrice;
    return amountOut / amountIn;
  }, [amountIn, amountOut, spotPrice]);

  const priceImpact = useMemo(() => {
    if (amountIn <= 0) return 0;
    const impact = 1 - executionPrice / spotPrice;
    return Math.max(0, impact * 100);
  }, [amountIn, executionPrice, spotPrice]);

  // USD Values
  const fromPriceUsd = USD_PRICES[fromAsset] || 1.0;
  const toPriceUsd = USD_PRICES[toAsset] || 1.0;
  const valueInUsd = amountIn * fromPriceUsd;
  const valueOutUsd = amountOut * toPriceUsd;

  // Slippage scenarios: output values and minimum received for 0.1%, 0.5%, 1%, 5%
  const slippageScenarios = useMemo(() => {
    return [0.1, 0.5, 1.0, 5.0].map((rate) => {
      const minReceived = amountOut * (1 - rate / 100);
      return {
        rate,
        minReceived,
        minReceivedUsd: minReceived * toPriceUsd,
      };
    });
  }, [amountOut, toPriceUsd]);

  // Check if actual price impact exceeds max slippage tolerance
  const isSlippageExceeded = useMemo(() => {
    return priceImpact > maxSlippage;
  }, [priceImpact, maxSlippage]);

  // Generate Price Impact Curve points
  const priceImpactCurvePoints = useMemo(() => {
    const points = [];
    const maxVal = Math.max(amountIn * 2, 500);
    const minVal = 1;
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
      const x = minVal + (i * (maxVal - minVal)) / steps;
      const xNet = x * (1 - feeRate);
      const yOut = (reservesTo * xNet) / (reservesFrom + xNet);
      const yPrice = yOut / x;
      // Normalise to Price Impact percentage
      const impact = 1 - yPrice / spotPrice;
      points.push({ x, y: Math.max(0, impact * 100) });
    }
    return points;
  }, [amountIn, reservesFrom, reservesTo, spotPrice]);

  // Generate Historical Prices (Deterministic based on sinus wave to keep code lean)
  const historicalPrices = useMemo(() => {
    const days = historyRange === "7d" ? 7 : 30;
    const basePrice = spotPrice;
    const data = [];
    // A fixed seed/frequency to generate deterministic wave
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayFactor = Math.sin(i * 0.4) * 0.05 + Math.cos(i * 0.1) * 0.03;
      const price = basePrice * (1 + dayFactor);
      data.push({
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        price,
      });
    }
    return data;
  }, [historyRange, spotPrice]);

  // Handle Swap submission
  const handleExecuteSwap = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    if (amountIn <= 0 || isSlippageInvalid) return;

    setIsSwapping(true);
    setSwapSuccess(null);

    // Simulate blockchain confirmation lag
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSwapping(false);
    setSwapSuccess(true);

    if (onSwap) {
      onSwap({
        fromAsset,
        toAsset,
        amountIn,
        amountOut,
        priceImpact,
        slippage: maxSlippage,
        liquiditySize,
      });
    }
  };

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-5 gap-6 max-w-5xl mx-auto p-2", className)}>
      {/* Swap Interface */}
      <div className="md:col-span-3 flex flex-col gap-5">
        <Card className="shadow-lg border-line relative overflow-hidden bg-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Swap Simulator</CardTitle>
              <CardDescription>Simulate Stellar/Soroban path payments and DEX pool Swaps</CardDescription>
            </div>
            <div className="flex bg-surface-2 p-1 rounded-lg border border-line-2">
              {(["low", "medium", "high"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setLiquiditySize(size)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded font-medium capitalize transition-colors",
                    liquiditySize === size
                      ? "bg-brand text-white shadow-sm"
                      : "text-ink-3 hover:text-ink"
                  )}
                >
                  {size} Liq
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/* Input Card */}
            <div className="bg-surface-2 rounded-xl p-4 border border-line-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-ink-3">From</span>
                {isConnected && (
                  <span className="text-[11px] text-ink-3">
                    Est. USD: ${valueInUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amountInStr}
                  onChange={(e) => setAmountInStr(e.target.value)}
                  className="bg-transparent border-0 outline-none text-[20px] font-semibold text-ink w-full h-auto p-0 focus:ring-0 focus:border-0"
                />
                <select
                  value={fromAsset}
                  onChange={(e) => handleFromAssetChange(e.target.value)}
                  className="bg-surface border border-line rounded-lg px-2.5 py-1 text-[13px] font-semibold text-ink outline-none"
                >
                  {ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Flip Button */}
            <div className="flex justify-center -my-2.5 relative z-10">
              <button
                onClick={handleFlipAssets}
                aria-label="Flip input and output assets"
                className="bg-surface border border-line hover:border-line-2 hover:bg-surface-2 p-2 rounded-full shadow-md text-ink-2 hover:text-ink transition-all active:scale-95"
              >
                <ArrowUpDown size={14} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Output Card */}
            <div className="bg-surface-2 rounded-xl p-4 border border-line-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold text-ink-3">To (Estimated)</span>
                {isConnected && (
                  <span className="text-[11px] text-ink-3">
                    Est. USD: ${valueOutUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <div className="text-[20px] font-semibold text-ink w-full select-all">
                  {amountOut.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 7 })}
                </div>
                <select
                  value={toAsset}
                  onChange={(e) => handleToAssetChange(e.target.value)}
                  className="bg-surface border border-line rounded-lg px-2.5 py-1 text-[13px] font-semibold text-ink outline-none"
                >
                  {ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price Calculations and Impact */}
            {amountIn > 0 && (
              <div className="bg-surface rounded-xl p-3 border border-line-2 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-ink-3">Exchange Rate:</span>
                  <span className="font-semibold text-ink">
                    1 {fromAsset} = {executionPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 5 })} {toAsset}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-ink-3">Price Impact:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-semibold",
                        priceImpact < 1.0 ? "text-green" : priceImpact < 5.0 ? "text-orange" : "text-red"
                      )}
                    >
                      {priceImpact.toFixed(2)}%
                    </span>
                    <Badge
                      variant={priceImpact < 1.0 ? "success" : priceImpact < 5.0 ? "warning" : "error"}
                      className="px-1.5 py-0.5 text-[9px]"
                    >
                      {priceImpact < 1.0 ? "Low" : priceImpact < 5.0 ? "Medium" : "High"}
                    </Badge>
                  </div>
                </div>
                <div className="flex justify-between items-center text-[12px]">
                  <span className="text-ink-3">Fee (0.3%):</span>
                  <span className="text-ink-2 font-medium">
                    {(amountIn * feeRate).toFixed(4)} {fromAsset}
                  </span>
                </div>
              </div>
            )}

            {/* Custom Max Slippage */}
            <div className="flex gap-4 items-end mt-1">
              <div className="flex-1">
                <Input
                  label="Max Slippage Tolerance (%)"
                  type="text"
                  value={maxSlippageStr}
                  onChange={(e) => setMaxSlippageStr(e.target.value)}
                  error={isSlippageInvalid ? "Slippage must be between 0.1% and 50%" : undefined}
                  className="h-8.5"
                />
              </div>
              <div className="flex gap-1.5 pb-0.5">
                {["0.1", "0.5", "1.0", "3.0"].map((val) => (
                  <button
                    key={val}
                    onClick={() => setMaxSlippageStr(val)}
                    className={cn(
                      "h-8 px-2 rounded-lg text-[11px] font-semibold border transition-all",
                      maxSlippageStr === val
                        ? "bg-brand text-white border-brand"
                        : "bg-surface text-ink-2 border-line hover:border-line-2"
                    )}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>

            {/* Warn user if price impact exceeds configured slippage tolerance */}
            {amountIn > 0 && isSlippageExceeded && (
              <div className="bg-error-dim border border-error-dim-strong rounded-xl p-3 flex gap-2 items-start">
                <AlertTriangle className="text-red shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-[12px] font-bold text-red">High Slippage Warning</h4>
                  <p className="text-[11px] text-red mt-0.5">
                    Estimated price impact of {priceImpact.toFixed(2)}% exceeds your slippage tolerance of {maxSlippage}%. The transaction will likely fail or incur heavy losses.
                  </p>
                </div>
              </div>
            )}

            {/* Success notification */}
            {swapSuccess && (
              <div className="bg-success-dim border border-success-dim-strong rounded-xl p-3 text-[12px] text-green">
                <strong>Swap Completed successfully!</strong> Swapped {amountInStr} {fromAsset} for {amountOut.toFixed(4)} {toAsset}.
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-2 border-t border-line">
            <Button
              className="w-full text-[13px] font-semibold py-2.5 h-auto transition-all active:scale-99"
              disabled={isSwapping || (isConnected && (amountIn <= 0 || isSlippageInvalid))}
              loading={isSwapping}
              onClick={handleExecuteSwap}
            >
              {isConnected ? (isSwapping ? "Executing Swap..." : "Swap Assets") : "Connect Wallet to Swap"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Slippage Scenarios & Visualisation Charts */}
      <div className="md:col-span-2 flex flex-col gap-5">
        {/* Slippage Card */}
        <Card className="bg-surface border-line shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5">
              <Info size={14} className="text-brand" />
              Slippage Scenarios
            </CardTitle>
            <CardDescription>Estimated output under various slippage tolerances</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col">
              {slippageScenarios.map((scenario) => (
                <div
                  key={scenario.rate}
                  className="flex items-center justify-between px-5 py-3 border-b border-line last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-ink">{scenario.rate}% Slippage</span>
                    <span className="text-[10px] text-ink-3">Minimum Received</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[12px] font-bold text-ink-2">
                      {scenario.minReceived.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 5 })} {toAsset}
                    </span>
                    <span className="text-[10px] text-ink-3">
                      ${scenario.minReceivedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts Visualisation Card */}
        <Card className="bg-surface border-line shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="flex border-b border-line px-2 pt-2 gap-1">
            <button
              onClick={() => setActiveTab("impact")}
              className={cn(
                "px-3 py-2 text-[12px] font-semibold border-b-2 transition-colors",
                activeTab === "impact"
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-3 hover:text-ink"
              )}
            >
              Price Impact Curve
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-3 py-2 text-[12px] font-semibold border-b-2 transition-colors",
                activeTab === "history"
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-3 hover:text-ink"
              )}
            >
              Price History
            </button>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-between">
            {activeTab === "impact" ? (
              <div className="flex-1 flex flex-col justify-between h-[180px]">
                <div className="flex items-center justify-between text-[11px] text-ink-3 mb-2">
                  <span className="flex items-center gap-1">
                    <TrendingUp size={11} className="text-teal" /> Price Impact (%) vs Size
                  </span>
                  <span>Max Size: {Math.max(amountIn * 2, 500)} {fromAsset}</span>
                </div>
                {/* SVG Render for Price Impact Curve */}
                <div className="relative flex-1 bg-surface-2 border border-line-2 rounded-lg p-2 h-[130px]">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid Lines */}
                    <line x1="0" y1="25" x2="100" y2="25" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="3" />

                    {/* Plot Line */}
                    <path
                      d={(() => {
                        const maxVal = Math.max(amountIn * 2, 500);
                        const maxY = Math.max(...priceImpactCurvePoints.map((p) => p.y), 1.0);
                        return priceImpactCurvePoints
                          .map((p, idx) => {
                            const xPct = (p.x / maxVal) * 100;
                            // Invert y so 0 is at bottom
                            const yPct = 100 - (p.y / maxY) * 90;
                            return `${idx === 0 ? "M" : "L"} ${xPct} ${yPct}`;
                          })
                          .join(" ");
                      })()}
                      fill="none"
                      stroke="var(--color-brand)"
                      strokeWidth="2"
                    />

                    {/* Gradient Fill Area */}
                    <path
                      d={(() => {
                        const maxVal = Math.max(amountIn * 2, 500);
                        const maxY = Math.max(...priceImpactCurvePoints.map((p) => p.y), 1.0);
                        const pathStr = priceImpactCurvePoints
                          .map((p, idx) => {
                            const xPct = (p.x / maxVal) * 100;
                            const yPct = 100 - (p.y / maxY) * 90;
                            return `${idx === 0 ? "M" : "L"} ${xPct} ${yPct}`;
                          })
                          .join(" ");
                        return `${pathStr} L 100 100 L 0 100 Z`;
                      })()}
                      fill="url(#grad)"
                      opacity="0.1"
                    />

                    <defs>
                      <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--color-brand)" />
                        <stop offset="100%" stopColor="transparent" />
                      </linearGradient>
                    </defs>

                    {/* Current trade point */}
                    {amountIn > 0 && (
                      <circle
                        cx={(() => {
                          const maxVal = Math.max(amountIn * 2, 500);
                          return (amountIn / maxVal) * 100;
                        })()}
                        cy={(() => {
                          const maxY = Math.max(...priceImpactCurvePoints.map((p) => p.y), 1.0);
                          return 100 - (priceImpact / maxY) * 90;
                        })()}
                        r="3.5"
                        fill="var(--color-brand)"
                        stroke="var(--color-base)"
                        strokeWidth="1.5"
                        className="animate-ping origin-center"
                      />
                    )}
                    {amountIn > 0 && (
                      <circle
                        cx={(() => {
                          const maxVal = Math.max(amountIn * 2, 500);
                          return (amountIn / maxVal) * 100;
                        })()}
                        cy={(() => {
                          const maxY = Math.max(...priceImpactCurvePoints.map((p) => p.y), 1.0);
                          return 100 - (priceImpact / maxY) * 90;
                        })()}
                        r="3.5"
                        fill="var(--color-brand)"
                        stroke="var(--color-base)"
                        strokeWidth="1.5"
                      />
                    )}
                  </svg>
                  <div className="absolute bottom-1 right-2 text-[9px] text-ink-3">
                    Size &rarr;
                  </div>
                  <div className="absolute top-1 left-2 text-[9px] text-ink-3">
                    Impact &uarr;
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between h-[180px]">
                <div className="flex items-center justify-between text-[11px] text-ink-3 mb-2">
                  <div className="flex bg-surface-2 p-0.5 rounded border border-line-2">
                    <button
                      onClick={() => setHistoryRange("7d")}
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded transition-colors",
                        historyRange === "7d" ? "bg-brand text-white" : "text-ink-3 hover:text-ink"
                      )}
                    >
                      7D
                    </button>
                    <button
                      onClick={() => setHistoryRange("30d")}
                      className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded transition-colors",
                        historyRange === "30d" ? "bg-brand text-white" : "text-ink-3 hover:text-ink"
                      )}
                    >
                      30D
                    </button>
                  </div>
                  <span>
                    {hoverIndex !== null
                      ? `${historicalPrices[hoverIndex]?.label}: ${historicalPrices[hoverIndex]?.price.toFixed(4)}`
                      : `Rate: ${fromAsset}/${toAsset}`}
                  </span>
                </div>

                <div className="relative flex-1 bg-surface-2 border border-line-2 rounded-lg p-2 h-[130px]">
                  <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid Lines */}
                    <line x1="0" y1="25" x2="100" y2="25" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="3" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="var(--color-line)" strokeWidth="0.5" strokeDasharray="3" />

                    {/* Historical Line path */}
                    <path
                      d={(() => {
                        const prices = historicalPrices.map((p) => p.price);
                        const min = Math.min(...prices) * 0.98;
                        const max = Math.max(...prices) * 1.02;
                        const spread = max - min || 1;
                        return historicalPrices
                          .map((p, idx) => {
                            const xPct = (idx / (historicalPrices.length - 1)) * 100;
                            const yPct = 100 - ((p.price - min) / spread) * 80 - 10;
                            return `${idx === 0 ? "M" : "L"} ${xPct} ${yPct}`;
                          })
                          .join(" ");
                      })()}
                      fill="none"
                      stroke="var(--color-teal)"
                      strokeWidth="2"
                    />

                    {/* Hover guide line */}
                    {hoverIndex !== null && (
                      <line
                        x1={(hoverIndex / (historicalPrices.length - 1)) * 100}
                        y1="0"
                        x2={(hoverIndex / (historicalPrices.length - 1)) * 100}
                        y2="100"
                        stroke="var(--color-brand)"
                        strokeWidth="0.75"
                        strokeDasharray="2"
                      />
                    )}

                    {/* Interactive points overlay */}
                    {historicalPrices.map((p, idx) => {
                      const prices = historicalPrices.map((x) => x.price);
                      const min = Math.min(...prices) * 0.98;
                      const max = Math.max(...prices) * 1.02;
                      const spread = max - min || 1;
                      const cx = (idx / (historicalPrices.length - 1)) * 100;
                      const cy = 100 - ((p.price - min) / spread) * 80 - 10;

                      return (
                        <g key={idx}>
                          {hoverIndex === idx && (
                            <circle cx={cx} cy={cy} r="3" fill="var(--color-teal)" stroke="var(--color-base)" strokeWidth="1" />
                          )}
                          {/* Invisible hover targets */}
                          <rect
                            x={cx - 100 / (historicalPrices.length - 1) / 2}
                            y="0"
                            width={100 / (historicalPrices.length - 1)}
                            height="100"
                            fill="transparent"
                            onMouseEnter={() => setHoverIndex(idx)}
                            onMouseLeave={() => setHoverIndex(null)}
                            style={{ cursor: "crosshair" }}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
