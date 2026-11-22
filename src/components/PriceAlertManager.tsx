import { Bell, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

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
import { useOptionalToast } from "@/context/ToastContext";

export const PRICE_ALERTS_STORAGE_KEY = "sorokit:price-alerts";
export const PRICE_ALERT_HISTORY_STORAGE_KEY = "sorokit:price-alert-history";

export type AlertCondition = "above" | "below" | "percent_change";

export interface PriceAlert {
  id: string;
  asset: string;
  condition: AlertCondition;
  threshold: number;
  basePrice?: number;
  active: boolean;
  createdAt: number;
}

export interface PriceAlertHistoryItem {
  id: string;
  alertId: string;
  asset: string;
  condition: AlertCondition;
  threshold: number;
  triggerPrice: number;
  triggeredAt: number;
}

export function loadPriceAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(PRICE_ALERTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePriceAlerts(alerts: PriceAlert[]): void {
  try {
    localStorage.setItem(PRICE_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // storage unavailable
  }
}

export function loadPriceAlertHistory(): PriceAlertHistoryItem[] {
  try {
    const raw = localStorage.getItem(PRICE_ALERT_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePriceAlertHistory(history: PriceAlertHistoryItem[]): void {
  try {
    localStorage.setItem(PRICE_ALERT_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable
  }
}

export interface PriceAlertManagerProps {
  currentPrice?: number;
  asset?: string;
  onAlertTriggered?: (item: PriceAlertHistoryItem) => void;
  className?: string;
}

export function PriceAlertManager({
  currentPrice = 0.1054,
  asset = "XLM",
  onAlertTriggered,
  className,
}: PriceAlertManagerProps) {
  const toastContext = useOptionalToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => {
    const loaded = loadPriceAlerts();
    if (loaded.length > 0) return loaded;
    return [
      {
        id: "default-1",
        asset,
        condition: "above",
        threshold: 0.12,
        active: true,
        createdAt: Date.now(),
      },
      {
        id: "default-2",
        asset,
        condition: "below",
        threshold: 0.09,
        active: true,
        createdAt: Date.now(),
      },
    ];
  });

  const [history, setHistory] = useState<PriceAlertHistoryItem[]>(
    loadPriceAlertHistory,
  );
  const [newAsset, setNewAsset] = useState(asset);
  const [newCondition, setNewCondition] = useState<AlertCondition>("above");
  const [newThreshold, setNewThreshold] = useState("");
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  // Check alerts against current price
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;

    let triggeredAny = false;
    const nextAlerts = alerts.map((alert) => {
      if (!alert.active || alert.asset !== asset) return alert;

      let triggered = false;
      if (alert.condition === "above" && currentPrice >= alert.threshold) {
        triggered = true;
      } else if (alert.condition === "below" && currentPrice <= alert.threshold) {
        triggered = true;
      } else if (
        alert.condition === "percent_change" &&
        alert.basePrice &&
        alert.basePrice > 0
      ) {
        const changePct =
          Math.abs((currentPrice - alert.basePrice) / alert.basePrice) * 100;
        if (changePct >= alert.threshold) {
          triggered = true;
        }
      }

      if (triggered) {
        triggeredAny = true;
        const historyItem: PriceAlertHistoryItem = {
          id: "hist-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
          alertId: alert.id,
          asset: alert.asset,
          condition: alert.condition,
          threshold: alert.threshold,
          triggerPrice: currentPrice,
          triggeredAt: Date.now(),
        };

        const note = `${alert.asset} has crossed threshold ${alert.condition} ${alert.threshold}! Current price: $${currentPrice.toFixed(4)}`;
        setLastNotification(note);

        if (toastContext?.addToast) {
          toastContext.addToast({
            title: "Price Alert Triggered",
            message: note,
            type: "warning",
          });
        }

        onAlertTriggered?.(historyItem);

        setHistory((prevHistory) => {
          const updatedHistory = [historyItem, ...prevHistory];
          savePriceAlertHistory(updatedHistory);
          return updatedHistory;
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("sorokit:price-alert-triggered", {
              detail: historyItem,
            }),
          );
        }

        return { ...alert, active: false };
      }

      return alert;
    });

    if (triggeredAny) {
      queueMicrotask(() => {
        setAlerts(nextAlerts);
        savePriceAlerts(nextAlerts);
      });
    }
  }, [currentPrice, asset, alerts, onAlertTriggered, toastContext]);

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const thresholdNum = parseFloat(newThreshold);
    if (isNaN(thresholdNum) || thresholdNum <= 0) return;

    const newAlert: PriceAlert = {
      id: "alert-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      asset: newAsset.trim() || asset,
      condition: newCondition,
      threshold: thresholdNum,
      basePrice: currentPrice,
      active: true,
      createdAt: Date.now(),
    };

    const updated = [...alerts, newAlert];
    setAlerts(updated);
    savePriceAlerts(updated);
    setNewThreshold("");
  };

  const removeAlert = useCallback(
    (id: string) => {
      const updated = alerts.filter((a) => a.id !== id);
      setAlerts(updated);
      savePriceAlerts(updated);
    },
    [alerts],
  );

  const toggleAlertActive = useCallback(
    (id: string) => {
      const updated = alerts.map((a) =>
        a.id === id ? { ...a, active: !a.active, basePrice: currentPrice } : a,
      );
      setAlerts(updated);
      savePriceAlerts(updated);
    },
    [alerts, currentPrice],
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    savePriceAlertHistory([]);
  }, []);

  return (
    <div className={`space-y-6 ${className ?? ""}`} data-testid="price-alert-manager">
      {/* Triggered Notification Banner */}
      {lastNotification && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 p-3 rounded-lg bg-warning-dim border border-warning text-[12px] text-ink"
          data-testid="price-alert-notification"
        >
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-warning shrink-0" />
            <span>{lastNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setLastNotification(null)}
            className="text-ink-3 hover:text-ink text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Alert Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Price Alert Settings</CardTitle>
          <CardDescription>
            Configure notification thresholds for asset price movements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={handleAddAlert}
            className="space-y-3"
            data-testid="create-alert-form"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-medium text-ink-3 block mb-1">
                  Asset
                </label>
                <select
                  aria-label="Alert asset"
                  className="w-full bg-surface-2 border border-line rounded px-2.5 py-1.5 text-[12px] text-ink outline-none"
                  value={newAsset}
                  onChange={(e) => setNewAsset(e.target.value)}
                  data-testid="alert-asset-select"
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                  <option value="EURC">EURC</option>
                  <option value="AQUA">AQUA</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink-3 block mb-1">
                  Condition
                </label>
                <select
                  aria-label="Alert condition"
                  className="w-full bg-surface-2 border border-line rounded px-2.5 py-1.5 text-[12px] text-ink outline-none"
                  value={newCondition}
                  onChange={(e) =>
                    setNewCondition(e.target.value as AlertCondition)
                  }
                  data-testid="alert-condition-select"
                >
                  <option value="above">Price rises above</option>
                  <option value="below">Price falls below</option>
                  <option value="percent_change">Price changes by &gt;= %</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-ink-3 block mb-1">
                  Threshold
                </label>
                <Input
                  aria-label="Alert threshold"
                  placeholder={
                    newCondition === "percent_change"
                      ? "e.g. 5 (%)"
                      : "e.g. 0.12 ($)"
                  }
                  type="number"
                  step="any"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  data-testid="alert-threshold-input"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              data-testid="create-alert-button"
              disabled={!newThreshold}
            >
              Set Price Alert
            </Button>
          </form>

          {/* Active Alerts List */}
          <div className="pt-2">
            <h4 className="text-[12px] font-semibold text-ink-2 mb-2">
              Active Alerts ({alerts.filter((a) => a.active).length})
            </h4>
            <div
              className="divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface-2"
              data-testid="active-alerts-list"
            >
              {alerts.length === 0 ? (
                <p className="p-3 text-[12px] text-ink-3">No alerts configured</p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-2.5 flex items-center justify-between gap-3 text-[12px]"
                    data-testid={`alert-item-${alert.id}`}
                  >
                    <div>
                      <span className="font-semibold text-ink">{alert.asset}</span>{" "}
                      <span className="text-ink-3">
                        {alert.condition === "above"
                          ? "rises above"
                          : alert.condition === "below"
                            ? "falls below"
                            : "changes by"}
                      </span>{" "}
                      <strong className="text-ink font-mono">
                        {alert.condition === "percent_change"
                          ? `${alert.threshold}%`
                          : `$${alert.threshold}`}
                      </strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAlertActive(alert.id)}
                        title={alert.active ? "Pause alert" : "Activate alert"}
                      >
                        <Badge variant={alert.active ? "success" : "default"}>
                          {alert.active ? "Active" : "Triggered/Off"}
                        </Badge>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAlert(alert.id)}
                        aria-label="Delete alert"
                        className="text-ink-3 hover:text-red transition-colors p-1"
                        data-testid={`delete-alert-button-${alert.id}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Alert History</CardTitle>
            <CardDescription>Log of triggered price alerts.</CardDescription>
          </div>
          {history.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              data-testid="clear-alert-history-button"
              className="text-xs text-ink-3"
            >
              Clear Log
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div data-testid="alert-history">
            {history.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-ink-3">
                No alerts have been triggered yet
              </p>
            ) : (
              <div className="divide-y divide-line border border-line rounded-lg overflow-hidden bg-surface-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between text-[12px]"
                    data-testid={`history-item-${item.id}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{item.asset}</span>
                        <Badge variant="warning" dot>
                          Triggered
                        </Badge>
                      </div>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        Triggered at ${item.triggerPrice.toFixed(4)} (Threshold:{" "}
                        {item.condition} {item.threshold})
                      </p>
                    </div>
                    <span className="text-[10px] text-ink-4">
                      {new Date(item.triggeredAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
