import { fireEvent,render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  fillMissingTimestamps,
  parseHistoricalData,
  parseTimestamp,
  TIMEFRAME_MS,
} from "@/lib/chart-data";

import { ChartingScreen } from "./ChartingScreen";

describe("ChartingScreen", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders Charting Screen heading and price feed", () => {
    render(<ChartingScreen />);
    expect(screen.getByText("Advanced Charting")).toBeInTheDocument();
    expect(screen.getByText("Live Feed")).toBeInTheDocument();
  });

  it("allows selecting timeframe and toggling chart type", () => {
    render(<ChartingScreen />);
    
    // Switch timeframe
    const tfBtn = screen.getByRole("button", { name: "15m" });
    fireEvent.click(tfBtn);
    expect(screen.getByText(/Rendering candlestick chart \(15m\)/i)).toBeInTheDocument();

    // Toggle Chart Type
    const lineBtn = screen.getByRole("button", { name: "Line Chart" });
    fireEvent.click(lineBtn);
    expect(screen.getByText(/Rendering line chart \(15m\)/i)).toBeInTheDocument();
  });

  it("can toggle technical indicators", () => {
    render(<ChartingScreen />);
    
    // Default SMA should be On
    expect(screen.getByText("SMA Overlay")).toBeInTheDocument();

    // Toggle Bollinger Bands On
    const bbBtn = screen.getByRole("button", { name: /BOLLINGER/i });
    fireEvent.click(bbBtn);
    expect(screen.getByText("Bollinger Envelopes")).toBeInTheDocument();
  });

  it("can manage price alerts", () => {
    render(<ChartingScreen />);
    
    const input = screen.getByPlaceholderText(/Price e.g. 0.11/i);
    const submitBtn = screen.getByRole("button", { name: "Create Alert" });

    fireEvent.change(input, { target: { value: "0.155" } });
    fireEvent.click(submitBtn);

    expect(screen.getByText("$0.155")).toBeInTheDocument();
  });

  it("persists indicator selections across reloads", () => {
    const { unmount } = render(<ChartingScreen />);
    expect(screen.queryByText("EMA Overlay")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /EMA/i }));
    fireEvent.click(screen.getByRole("button", { name: /SMA/i }));
    unmount();

    render(<ChartingScreen />);
    expect(screen.getByText("EMA Overlay")).toBeInTheDocument();
    expect(screen.queryByText("SMA Overlay")).not.toBeInTheDocument();
  });

  it("toggles the volume indicator", () => {
    render(<ChartingScreen />);
    expect(screen.getByText("Volume Bars")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /VOLUME/i }));
    expect(screen.queryByText("Volume Bars")).not.toBeInTheDocument();
  });

  it("keeps crosshair position when switching timeframe", () => {
    render(<ChartingScreen />);
    const canvas = screen.getByTestId("chart-canvas");
    fireEvent.mouseMove(canvas, { clientX: 40, clientY: 30 });
    expect(screen.getByTestId("chart-crosshair")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    expect(screen.getByTestId("chart-crosshair")).toBeInTheDocument();
  });
});

describe("historical data parsing", () => {
  it("parses ISO, seconds and milliseconds timestamps", () => {
    const iso = "2024-01-01T00:00:00Z";
    const ms = Date.parse(iso);
    expect(parseTimestamp(iso)).toBe(ms);
    expect(parseTimestamp(ms / 1000)).toBe(ms);
    expect(parseTimestamp(ms)).toBe(ms);
    expect(parseTimestamp(String(ms))).toBe(ms);
  });

  it("rejects invalid timestamps", () => {
    expect(parseTimestamp("not-a-date")).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
    expect(parseTimestamp(-5)).toBeNull();
    expect(parseTimestamp("")).toBeNull();
  });

  it("parses, sorts, de-duplicates and drops malformed rows", () => {
    const rows = [
      { time: 2000000000000, open: "0.11", high: 0.12, low: 0.1, close: 0.115, volume: 5 },
      { time: 1000000000000, open: 0.1, high: 0.11, low: 0.09, close: 0.105 },
      { time: 1000000000000, open: 0.2, high: 0.21, low: 0.19, close: 0.205 },
      { time: "garbage", open: 1, high: 1, low: 1, close: 1 },
      { time: 1500000000000, open: 1, high: 1, low: 1 },
    ];
    const parsed = parseHistoricalData(rows);
    expect(parsed.map((p) => p.time)).toEqual([1000000000000, 2000000000000]);
    expect(parsed[0].open).toBe(0.2);
    expect(parsed[0].volume).toBe(0);
    expect(parsed[1].open).toBe(0.11);
  });

  it("imputes missing timestamps with flat zero-volume candles", () => {
    const step = TIMEFRAME_MS["1h"];
    const base = Date.parse("2024-01-01T00:00:00Z");
    const points = parseHistoricalData([
      { time: base, open: 1, high: 2, low: 1, close: 1.5, volume: 10 },
      { time: base + 3 * step, open: 1.6, high: 2, low: 1.5, close: 1.8, volume: 4 },
    ]);
    const filled = fillMissingTimestamps(points, step);
    expect(filled).toHaveLength(4);
    expect(filled.map((p) => p.time)).toEqual([base, base + step, base + 2 * step, base + 3 * step]);
    expect(filled[1]).toMatchObject({ open: 1.5, close: 1.5, volume: 0, imputed: true });
    expect(filled[2]).toMatchObject({ close: 1.5, imputed: true });
    expect(filled[3].imputed).toBeUndefined();
  });

  it("returns input unchanged when there are no gaps or no data", () => {
    expect(fillMissingTimestamps([], 1000)).toEqual([]);
    const pts = parseHistoricalData([
      { time: 1000000000000, open: 1, high: 1, low: 1, close: 1 },
      { time: 1000000060000, open: 1, high: 1, low: 1, close: 1 },
    ]);
    expect(fillMissingTimestamps(pts, 60000)).toEqual(pts);
  });
});
