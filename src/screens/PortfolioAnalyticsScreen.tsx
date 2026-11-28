import { useEffect, useMemo, useState } from "react";

import { LineChart } from "@/components/AccountBalanceChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PieChart } from "@/components/ui/PieChart";
import { useSorokit } from "@/context/useSorokit";
import { balanceAssetKey, fetchAccountOperations } from "@/lib/account-operations";
import type { Operation } from "@/lib/client";
import { getClient } from "@/lib/client";
import {
  buildHoldingsSeries,
  buildValueSeries,
  rankPerformers,
} from "@/lib/portfolio-analytics";
import { cn } from "@/lib/utils";

const PRICES_KEY = "sorokit-portfolio-prices";
const PRESETS = [7, 30, 90] as const;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function loadPrices(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PRICES_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

function money(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PortfolioAnalyticsScreen() {
  const { address, balances, client: contextClient } = useSorokit();
  const [startDate, setStartDate] = useState(() => isoDaysAgo(29));
  const [endDate, setEndDate] = useState(() => isoDaysAgo(0));
  const [prices, setPrices] = useState<Record<string, number>>(loadPrices);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchAccountOperations(contextClient ?? getClient(), address)
      .then((ops) => {
        if (cancelled) return;
        setOperations(ops);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOperations([]);
        setError(err instanceof Error ? err.message : "Could not load history.");
      });
    return () => {
      cancelled = true;
    };
  }, [address, contextClient]);

  useEffect(() => {
    try {
      localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    } catch {
      // Prices still apply for this session when storage is unavailable.
    }
  }, [prices]);

  const assets = useMemo(
    () =>
      [
        ...new Set(
          balances
            .filter((b) => b.assetType !== "liquidity_pool_shares")
            .map(balanceAssetKey),
        ),
      ],
    [balances],
  );
  const validRange = Boolean(startDate && endDate && startDate <= endDate);
  const series = useMemo(
    () =>
      address && validRange
        ? buildHoldingsSeries(balances, operations, address, startDate, endDate)
        : { dates: [], holdings: {} },
    [address, balances, operations, startDate, endDate, validRange],
  );
  const valueSeries = useMemo(() => buildValueSeries(series, prices), [series, prices]);
  const performers = useMemo(() => rankPerformers(series, prices), [series, prices]);
  const slices = assets
    .map((asset) => {
      const amounts = series.holdings[asset] ?? [];
      const latest = amounts[amounts.length - 1] ?? 0;
      return { key: asset, label: asset, value: latest * (prices[asset] ?? 0) };
    })
    .filter((slice) => slice.value > 0);
  const hasPrices = slices.length > 0;

  function setPreset(days: number) {
    setStartDate(isoDaysAgo(days - 1));
    setEndDate(isoDaysAgo(0));
  }

  function updatePrice(asset: string, value: string) {
    setPrices((current) => {
      const next = { ...current };
      const price = Number(value);
      if (value === "" || !Number.isFinite(price) || price < 0) delete next[asset];
      else next[asset] = price;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5" data-testid="portfolio-analytics-screen">
      <div>
        <h2 className="text-[15px] font-semibold text-ink leading-none">
          Portfolio Analytics
        </h2>
        <p className="text-[11px] text-ink-3 mt-0.5">
          Values use the prices below, so changes reflect holdings rather than
          market price movement.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[12px] text-red">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Date range and prices</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-2">
            {PRESETS.map((days) => {
              const active =
                startDate === isoDaysAgo(days - 1) && endDate === isoDaysAgo(0);
              return (
                <button
                  key={days}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPreset(days)}
                  className={cn(
                    "h-8 rounded-md px-2.5 text-[12px] font-medium transition-colors",
                    active ? "bg-brand-dim text-brand" : "text-ink-3 hover:bg-surface-2",
                  )}
                >
                  {days}d
                </button>
              );
            })}
            <Input
              type="date"
              label="From"
              aria-label="Analytics from date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              type="date"
              label="To"
              aria-label="Analytics to date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {!validRange && (
            <p role="alert" className="text-[12px] text-red">
              Choose a from date on or before the to date.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {assets.map((asset) => (
              <Input
                key={asset}
                type="number"
                min="0"
                step="any"
                label={`${asset} price`}
                value={prices[asset] ?? ""}
                onChange={(e) => updatePrice(asset, e.target.value)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {!hasPrices ? (
        <p className="py-6 text-center text-[13px] text-ink-3">
          Enter a price for at least one held asset to see your analytics.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChart slices={slices} ariaLabel="Portfolio allocation by value" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>Portfolio value over the selected range</CardDescription>
            </CardHeader>
            <CardContent>
              <LineChart data={valueSeries} color="#5645D4" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top performers</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="divide-y divide-line" data-testid="top-performers">
                {performers.map((item, index) => (
                  <li key={item.asset} className="flex items-center justify-between py-2">
                    <span className="text-[13px] font-medium text-ink">
                      {index + 1}. {item.asset}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] font-medium tabular-nums",
                        item.change >= 0 ? "text-green" : "text-red",
                      )}
                    >
                      {item.change >= 0 ? "+" : ""}
                      {money(item.change)}
                      {item.changePct !== null &&
                        ` (${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(1)}%)`}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
