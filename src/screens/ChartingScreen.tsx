import { useEffect, useState } from "react";

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

interface PriceAlert {
  id: string;
  price: number;
  condition: "above" | "below";
  active: boolean;
}

export function ChartingScreen() {
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "1h" | "1d">(
    "1h",
  );
  const [chartType, setChartType] = useState<"candlestick" | "line">(
    "candlestick",
  );

  // Indicators active state
  const [indicators, setIndicators] = useState({
    sma: true,
    ema: false,
    rsi: true,
    macd: false,
    bollinger: false,
  });

  // Price alerts state
  const [alerts, setAlerts] = useState<PriceAlert[]>([
    { id: "1", price: 0.12, condition: "above", active: true },
    { id: "2", price: 0.09, condition: "below", active: true },
  ]);
  const [newAlertPrice, setNewAlertPrice] = useState("");
  const [newAlertCond, setNewAlertCond] = useState<"above" | "below">("above");

  // Drawing tools state
  const [drawTool, setDrawTool] = useState<"none" | "trend" | "horizontal">(
    "none",
  );
  const [drawnLines, setDrawnLines] = useState<
    { type: string; value: string }[]
  >([]);

  // Simulation price
  const [currentPrice, setCurrentPrice] = useState(0.1054);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.5) * 0.002;
        const nextPrice = Number((prev + change).toFixed(4));

        // Trigger alert warnings if threshold crossed
        alerts.forEach((alert) => {
          if (alert.active) {
            if (alert.condition === "above" && nextPrice >= alert.price) {
              alert.active = false; // deactivate after trigger
            } else if (
              alert.condition === "below" &&
              nextPrice <= alert.price
            ) {
              alert.active = false;
            }
          }
        });
        return nextPrice;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [alerts]);

  const toggleIndicator = (key: keyof typeof indicators) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertPrice) return;
    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      price: Number(newAlertPrice),
      condition: newAlertCond,
      active: true,
    };
    setAlerts([...alerts, newAlert]);
    setNewAlertPrice("");
  };

  const removeAlert = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  const addDrawnLine = () => {
    if (drawTool === "none") return;
    setDrawnLines([
      ...drawnLines,
      {
        type: drawTool,
        value:
          drawTool === "horizontal"
            ? `Support at $${currentPrice.toFixed(4)}`
            : "Trend line (0.101 -> 0.105)",
      },
    ]);
    setDrawTool("none");
  };

  return (
    <div className="space-y-6" data-testid="charting-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-ink">Advanced Charting</h2>
          <p className="text-[13px] text-ink-3">
            Real-time technical analysis tools for Stellar assets.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[20px] font-bold text-ink">
            ${currentPrice.toFixed(4)}
          </p>
          <Badge variant="success" dot live>
            Live Feed
          </Badge>
        </div>
      </div>

      {/* Chart Control Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
          {/* Timeframes */}
          <div className="flex gap-1" data-testid="timeframe-selectors">
            {(["1m", "5m", "15m", "1h", "1d"] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </Button>
            ))}
          </div>

          {/* Chart Type Toggle */}
          <div className="flex gap-1">
            <Button
              variant={chartType === "candlestick" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setChartType("candlestick")}
            >
              Candlesticks
            </Button>
            <Button
              variant={chartType === "line" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setChartType("line")}
            >
              Line Chart
            </Button>
          </div>

          {/* Drawing Tools */}
          <div className="flex gap-2 items-center">
            <span className="text-[11px] font-semibold text-ink-3">Draw:</span>
            <Button
              variant={drawTool === "trend" ? "primary" : "secondary"}
              size="sm"
              onClick={() =>
                setDrawTool(drawTool === "trend" ? "none" : "trend")
              }
            >
              Trend Line
            </Button>
            <Button
              variant={drawTool === "horizontal" ? "primary" : "secondary"}
              size="sm"
              onClick={() =>
                setDrawTool(drawTool === "horizontal" ? "none" : "horizontal")
              }
            >
              Support/Resistance
            </Button>
            {drawTool !== "none" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={addDrawnLine}
                className="text-brand"
              >
                Place Line
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Chart Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-surface relative overflow-hidden min-h-[300px]">
            <CardHeader className="py-3 flex justify-between items-center">
              <CardTitle className="text-[12px] uppercase tracking-wider text-ink-3">
                XLM / USDC
              </CardTitle>
              <div className="flex gap-2">
                {indicators.sma && <Badge variant="primary">SMA Overlay</Badge>}
                {indicators.ema && <Badge variant="teal">EMA Overlay</Badge>}
                {indicators.bollinger && (
                  <Badge variant="purple">Bollinger Bands</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-[240px] flex items-center justify-center bg-surface-2 relative">
              {/* Mock visual representation of the active chart selection */}
              <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
                <div className="text-[10px] text-ink-4">0.1100</div>
                <div className="text-[10px] text-ink-4">0.1050</div>
                <div className="text-[10px] text-ink-4">0.1000</div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-[13px] font-semibold text-ink">
                  Rendering {chartType} chart ({timeframe})
                </p>
                <p className="text-[11px] text-ink-3">
                  Drawing Tool:{" "}
                  <strong className="text-brand">{drawTool}</strong> | Lines:{" "}
                  {drawnLines.length}
                </p>
              </div>

              {/* Bollinger Bands visual indicator */}
              {indicators.bollinger && (
                <div className="absolute inset-x-0 top-1/4 bottom-1/4 bg-purple-500/5 border-y border-dashed border-purple-500/20 flex items-center justify-center">
                  <span className="text-[9px] text-purple-400">
                    Bollinger Envelopes
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Volume Indicator bars below price chart */}
          <Card className="bg-surface">
            <CardHeader className="py-2.5">
              <CardTitle className="text-[11px] text-ink-3">
                Volume Bars
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[50px] flex items-end gap-1 p-2 bg-surface-2">
              <div className="w-full bg-green/20 h-[30%] rounded-t-sm" />
              <div className="w-full bg-red/20 h-[60%] rounded-t-sm" />
              <div className="w-full bg-green/20 h-[80%] rounded-t-sm" />
              <div className="w-full bg-green/20 h-[40%] rounded-t-sm" />
              <div className="w-full bg-red/20 h-[50%] rounded-t-sm" />
            </CardContent>
          </Card>

          {/* RSI Indicator section */}
          {indicators.rsi && (
            <Card className="bg-surface">
              <CardHeader className="py-2.5">
                <CardTitle className="text-[11px] text-ink-3">
                  Relative Strength Index (RSI 14)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[70px] flex items-center justify-between p-3 bg-surface-2 relative">
                <div className="absolute top-1/4 inset-x-0 border-t border-dotted border-red/20" />
                <div className="absolute bottom-1/4 inset-x-0 border-t border-dotted border-green/20" />
                <span className="text-[11px] text-ink-2 font-mono z-10">
                  RSI: 54.32 (Neutral)
                </span>
                <span className="text-[9px] text-ink-4 absolute right-3 top-2">
                  Overbought &gt; 70
                </span>
                <span className="text-[9px] text-ink-4 absolute right-3 bottom-2">
                  Oversold &lt; 30
                </span>
              </CardContent>
            </Card>
          )}

          {/* MACD Indicator section */}
          {indicators.macd && (
            <Card className="bg-surface">
              <CardHeader className="py-2.5">
                <CardTitle className="text-[11px] text-ink-3">
                  MACD (12, 26, 9)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[70px] flex items-center justify-between p-3 bg-surface-2">
                <span className="text-[11px] text-ink-2 font-mono">
                  MACD: 0.00045 | Signal: 0.00021
                </span>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar indicators selector + price alerts */}
        <div className="space-y-6">
          {/* Indicators Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Indicators</CardTitle>
              <CardDescription>Select overlays and indicators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-col gap-2">
                {(
                  Object.keys(indicators) as Array<keyof typeof indicators>
                ).map((ind) => (
                  <button
                    key={ind}
                    onClick={() => toggleIndicator(ind)}
                    className={`w-full flex justify-between items-center p-2 rounded-lg border text-[12px] text-left transition-all ${
                      indicators[ind]
                        ? "bg-brand-dim border-brand text-brand font-semibold"
                        : "bg-surface-2 border-line text-ink-2 hover:bg-surface-3"
                    }`}
                  >
                    <span>{ind.toUpperCase()}</span>
                    <Badge variant={indicators[ind] ? "primary" : "default"}>
                      {indicators[ind] ? "On" : "Off"}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Price Alert Management */}
          <Card>
            <CardHeader>
              <CardTitle>Price Alerts</CardTitle>
              <CardDescription>
                Setup alerts for execution notification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddAlert} className="space-y-3">
                <div className="flex gap-2">
                  <select
                    className="bg-surface-2 border border-line rounded px-2 text-[12px] text-ink"
                    value={newAlertCond}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setNewAlertCond(e.target.value as "above" | "below")
                    }
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                  <Input
                    placeholder="Price e.g. 0.11"
                    type="number"
                    step="0.0001"
                    value={newAlertPrice}
                    onChange={(e) => setNewAlertPrice(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary" className="w-full">
                  Create Alert
                </Button>
              </form>

              <div className="divide-y divide-line pt-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0"
                  >
                    <div>
                      <span className="text-[12px] text-ink-2 font-semibold">
                        Price {alert.condition}
                      </span>{" "}
                      <strong className="text-[12px] text-ink font-mono">
                        ${alert.price}
                      </strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={alert.active ? "success" : "default"}>
                        {alert.active ? "Active" : "Triggered"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAlert(alert.id)}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
