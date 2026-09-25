import { useId, useMemo, useState } from "react";

import { useSorokit } from "@/context/useSorokit";
import { cn } from "@/lib/utils";

type Timeframe = "7d" | "30d" | "90d";

interface DataPoint {
  date: string;
  value: number;
}

interface AssetBalance {
  asset: string;
  data: DataPoint[];
  color: string;
}

type AssetTab = "XLM" | string;

interface AccountBalanceChartProps {
  className?: string;
  title?: string;
  /** Balance history data per asset. Falls back to mock data if empty. */
  balanceHistory?: AssetBalance[];
}

const TIMEFRAMES: { label: string; value: Timeframe; days: number }[] = [
  { label: "7d", value: "7d", days: 7 },
  { label: "30d", value: "30d", days: 30 },
  { label: "90d", value: "90d", days: 90 },
];

const ASSET_COLORS: Record<string, string> = {
  XLM: "#55852b",
  USDC: "#2775ca",
  USDT: "#26a17b",
};

function generateMockData(
  days: number,
  baseValue: number,
  volatility: number,
): DataPoint[] {
  const data: DataPoint[] = [];
  let value = baseValue;
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    value = Math.max(0, value + (Math.random() - 0.45) * volatility);
    data.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(value * 10000) / 10000,
    });
  }

  return data;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatValue(value: number): string {
  if (value >= 1000)
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toFixed(2);
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  onHover?: (point: DataPoint | null) => void;
}

function LineChart({
  data,
  width = 400,
  height = 200,
  color = "#55852b",
  onHover,
}: LineChartProps) {
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const rangeY = maxY - minY || 1;

  const xScale = (i: number) =>
    padding.left +
    (i / (data.length - 1)) * (width - padding.left - padding.right);
  const yScale = (v: number) =>
    padding.top +
    (1 - (v - minY) / rangeY) * (height - padding.top - padding.bottom);

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(d.value)}`)
    .join(" ");

  const areaD = `${pathD} L${xScale(data.length - 1)},${height - padding.bottom} L${xScale(0)},${height - padding.bottom} Z`;

  const yTicks = 5;
  const yTickValues = Array.from(
    { length: yTicks },
    (_, i) => Math.round((minY + (rangeY * i) / (yTicks - 1)) * 100) / 100,
  );

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`Line chart with ${data.length} data points`}
    >
      <defs>
        <linearGradient
          id={`gradient-${color.replace("#", "")}`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {yTickValues.map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={yScale(v)}
            x2={width - padding.right}
            y2={yScale(v)}
            stroke="var(--color-line)"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={yScale(v) + 3}
            textAnchor="end"
            className="fill-ink-3 text-[10px] font-mono"
          >
            {formatValue(v)}
          </text>
        </g>
      ))}

      <path d={areaD} fill={`url(#gradient-${color.replace("#", "")})`} />

      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {width > 300 &&
        data
          .filter(
            (_, i) =>
              i === 0 ||
              i === data.length - 1 ||
              i % Math.ceil(data.length / 6) === 0,
          )
          .map((d, i) => {
            const dataIndex = data.indexOf(d);
            return (
              <text
                key={i}
                x={xScale(dataIndex)}
                y={height - 8}
                textAnchor="middle"
                className="fill-ink-4 text-[9px]"
              >
                {formatDate(d.date)}
              </text>
            );
          })}

      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.value)}
          r={3}
          fill="var(--color-surface)"
          stroke={color}
          strokeWidth={2}
          className="cursor-pointer hover:r-[5]"
          onMouseEnter={() => onHover?.(d)}
          onMouseLeave={() => onHover?.(null)}
        />
      ))}
    </svg>
  );
}

export function AccountBalanceChart({
  className,
  title = "Account Balance History",
  balanceHistory,
}: AccountBalanceChartProps) {
  const titleId = useId();
  const { isConnected, balances } = useSorokit();
  const [timeframe, setTimeframe] = useState<Timeframe>("7d");
  const [activeTab, setActiveTab] = useState<AssetTab>("XLM");
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  const assets: AssetBalance[] = useMemo(() => {
    if (balanceHistory && balanceHistory.length > 0) return balanceHistory;

    if (!isConnected) return [];
    if (balances.length === 0) return [];

    const items: AssetBalance[] = [];

    const xlmBalance = balances.find((b) => b.assetType === "native");
    items.push({
      asset: "XLM",
      data: generateMockData(
        TIMEFRAMES.find((t) => t.value === "7d")!.days,
        xlmBalance ? parseFloat(xlmBalance.balance) : 10000,
        500,
      ),
      color: ASSET_COLORS.XLM,
    });

    balances
      .filter((b) => b.assetType !== "native")
      .slice(0, 3)
      .forEach((b) => {
        const code = b.assetCode ?? b.asset;
        items.push({
          asset: code,
          data: generateMockData(
            TIMEFRAMES.find((t) => t.value === "7d")!.days,
            parseFloat(b.balance),
            parseFloat(b.balance) * 0.1,
          ),
          color: ASSET_COLORS[code] ?? "#a855f7",
        });
      });

    return items;
  }, [balanceHistory, isConnected, balances]);

  const timeframeDays =
    TIMEFRAMES.find((t) => t.value === timeframe)?.days ?? 7;

  const effectiveActiveTab =
    assets.length > 0 && !assets.some((a) => a.asset === activeTab)
      ? assets[0].asset
      : activeTab;

  const activeAsset = assets.find((a) => a.asset === effectiveActiveTab);
  const chartData = useMemo(() => {
    if (!activeAsset) return [];
    return activeAsset.data.slice(-timeframeDays);
  }, [activeAsset, timeframeDays]);

  const currentValue =
    chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
  const startValue = chartData.length > 0 ? chartData[0].value : 0;
  const change = currentValue - startValue;
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface overflow-hidden",
        className,
      )}
      role="region"
      aria-labelledby={titleId}
    >
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <div>
          <h3 id={titleId} className="text-[14px] font-semibold text-ink">
            {title}
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            Historical balance trends
          </p>
        </div>
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTimeframe(t.value as Timeframe)}
              className={cn(
                "text-[11px] font-medium px-2 py-1 rounded-md transition-colors",
                timeframe === t.value
                  ? "bg-surface-2 text-ink"
                  : "text-ink-3 hover:text-ink-2",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!isConnected ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          Connect your wallet to view balance history
        </p>
      ) : assets.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          No balance data available
        </p>
      ) : (
        <div>
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {assets.map((a) => (
                <button
                  key={a.asset}
                  type="button"
                  onClick={() => setActiveTab(a.asset)}
                  className={cn(
                    "text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors",
                    effectiveActiveTab === a.asset
                      ? "bg-brand-dim text-brand"
                      : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {a.asset}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  type="button"
                  onClick={() => setTimeframe(tf.value)}
                  className={cn(
                    "text-[11px] font-medium px-2 py-1 rounded-md transition-colors",
                    timeframe === tf.value
                      ? "bg-surface-2 text-ink"
                      : "text-ink-4 hover:text-ink-3",
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-baseline gap-2 px-5 py-1">
            <span className="text-[22px] font-semibold text-ink tabular-nums">
              {formatValue(hoveredPoint?.value ?? currentValue)}
            </span>
            <span className="text-[11px] text-ink-3">{activeTab}</span>
            <span
              className={cn(
                "text-[11px] font-medium ml-2",
                change >= 0 ? "text-green" : "text-red",
              )}
            >
              {change >= 0 ? "+" : ""}
              {formatValue(change)} ({changePct >= 0 ? "+" : ""}
              {changePct.toFixed(1)}%)
            </span>
          </div>

          {hoveredPoint && (
            <p className="text-[10px] text-ink-4 px-5">
              {formatDate(hoveredPoint.date)}
            </p>
          )}

          <div className="px-2 py-2">
            <LineChart
              data={chartData}
              color={activeAsset?.color ?? "#55852b"}
              onHover={setHoveredPoint}
            />
          </div>

          {!balanceHistory && (
            <p className="text-[10px] text-ink-4 text-center pb-3">
              Chart shows simulated data. Pass real balance history via
              balanceHistory prop or integrate sorokit-core's streaming API.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
