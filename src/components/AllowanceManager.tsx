import {
  ArrowDown01Icon,
  ChevronDownIcon,
  ClockIcon,
  Delete01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { useSorokit } from "@/context/useSorokit";
import type { AllowanceEntry } from "@/lib/client";
import { cn } from "@/lib/utils";

interface AllowanceManagerProps {
  className?: string;
}

function formatAssetName(entry: AllowanceEntry): string {
  if (entry.tokenCode && entry.tokenCode !== "XLM") {
    return entry.tokenCode;
  }
  if (entry.asset === "native") {
    return "XLM";
  }
  return entry.asset;
}

function formatCurrency(amount: string, tokenCode?: string): string {
  if (!tokenCode || tokenCode === "XLM") {
    return amount;
  }
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return num.toFixed(2);
}

function isExpired(expirationDate?: string): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

function truncateAddress(address: string, start = 8, end = 6): string {
  if (address.length <= start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

export function AllowanceManager({ className }: AllowanceManagerProps) {
  const { address, isConnected, client } = useSorokit();
  const [allowances, setAllowances] = useState<AllowanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Record<string, 'increase' | 'decrease' | 'revoke' | null>>({});

  const sourceAccount = address || "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34KZVN";

  const loadAllowances = useCallback(async () => {
    try {
      const { data, error: err } = await client.allowance.getAllowances(sourceAccount);
      if (err) {
        setError(err);
        return;
      }
      setAllowances(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load allowances");
    } finally {
      setLoading(false);
    }
  }, [client, sourceAccount]);

  useEffect(() => {
    let active = true;
    if (!isConnected || !address || !client) {
      return;
    }
    client
      .allowance.getAllowances(sourceAccount)
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) {
          setError(err);
        } else {
          setAllowances(data ?? []);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Failed to load allowances");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [address, client, isConnected, sourceAccount]);

  const handleIncrease = async (entry: AllowanceEntry) => {
    const key = `${entry.asset}-${entry.spender}`;
    setProcessing(prev => ({ ...prev, [key]: 'increase' }));

    try {
      const params = {
        sourceAccount,
        asset: entry.asset,
        spender: entry.spender,
        amount: "100.00",
      };

      const { error: err } = await client.allowance.approveAllowance(params);
      if (err) {
        setError(err);
        return;
      }

      await loadAllowances();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to increase allowance");
    } finally {
      setProcessing(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleDecrease = async (entry: AllowanceEntry, newAmount: string) => {
    const key = `${entry.asset}-${entry.spender}`;
    setProcessing(prev => ({ ...prev, [key]: 'decrease' }));

    try {
      const params = {
        sourceAccount,
        asset: entry.asset,
        spender: entry.spender,
        amount: newAmount,
      };

      const { error: err } = await client.allowance.approveAllowance(params);
      if (err) {
        setError(err);
        return;
      }

      await loadAllowances();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decrease allowance");
    } finally {
      setProcessing(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleRevoke = async (entry: AllowanceEntry) => {
    const key = `${entry.asset}-${entry.spender}`;
    setProcessing(prev => ({ ...prev, [key]: 'revoke' }));

    try {
      const params = {
        sourceAccount,
        asset: entry.asset,
        spender: entry.spender,
      };

      const { error: err } = await client.allowance.revokeAllowance(params);
      if (err) {
        setError(err);
        return;
      }

      await loadAllowances();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke allowance");
    } finally {
      setProcessing(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleRetry = useCallback(() => {
    setError(null);
    void loadAllowances();
  }, [loadAllowances]);

  if (!isConnected || !address) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <p className="text-[14px] font-medium text-ink">Connect your wallet</p>
          <p className="text-[12px] text-ink-3 mt-1">Connect your wallet to manage allowances</p>
        </div>
      </div>
    );
  }

  const renderAllowanceCard = (entry: AllowanceEntry) => {
    const isExp = isExpired(entry.expirationDate);
    const isProcessingIncrease = processing[`${entry.asset}-${entry.spender}`] === 'increase';
    const isProcessingDecrease = processing[`${entry.asset}-${entry.spender}`] === 'decrease';
    const isProcessingRevoke = processing[`${entry.asset}-${entry.spender}`] === 'revoke';
    const isExpanded = expanded === `${entry.asset}-${entry.spender}`;
    const tokenCode = formatAssetName(entry);

    return (
      <div
        key={`${entry.asset}-${entry.spender}`}
        className="rounded-xl border border-line bg-surface overflow-hidden transition-all duration-200 hover:border-line-2"
      >
        <div
          className="px-5 py-4 cursor-pointer"
          onClick={() => setExpanded(isExpanded ? null : `${entry.asset}-${entry.spender}`)}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold text-ink truncate">
                  {tokenCode}
                </span>
                {isExp && (
                  <Badge variant="error" className="text-[10px]">EXPIRED</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-[12px] text-ink-3">
                <span className="font-mono truncate" title={entry.spender}>
                  {truncateAddress(entry.spender)}
                </span>
                {entry.spenderName && (
                  <span className="text-ink-4">({entry.spenderName})</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-semibold text-ink">
                {formatCurrency(entry.amount, tokenCode)}
              </div>
              <div className="text-[11px] text-ink-4"> Allowance</div>
            </div>
            <HugeiconsIcon
              icon={ChevronDownIcon}
              size={16}
              color="currentColor"
              strokeWidth={1.5}
              className={cn(
                "text-ink-3 shrink-0 transition-transform",
                isExpanded ? "rotate-180" : ""
              )}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="px-5 py-4 border-t border-line bg-surface-2 animate-in fade-in">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Token Code</span>
                  <div className="text-[13px] text-ink font-mono mt-0.5">
                    {tokenCode}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">Spender</span>
                  <div className="text-[13px] text-ink font-mono break-all mt-0.5">
                    {entry.spender}
                  </div>
                </div>
              </div>

              {entry.expirationDate && (
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={ClockIcon}
                    size={12}
                    className="text-ink-3"
                    strokeWidth={1.5}
                  />
                  <span className="text-[12px] text-ink-2">
                    Expires: {new Date(entry.expirationDate).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-line">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4 mb-2">ACTIONS</div>
                <div className="flex flex-wrap gap-2">
                  <IncreaseButton entry={entry} onIncrease={handleIncrease} processing={isProcessingIncrease} />
                  <DecreaseDialog entry={entry} onDecrease={handleDecrease} processing={isProcessingDecrease} />
                  <RevokeButton entry={entry} onRevoke={handleRevoke} processing={isProcessingRevoke} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Allowance Management</h3>
            <p className="text-[12px] text-ink-3 mt-0.5">
              Manage allowances granted to contracts
            </p>
          </div>
          <button
            onClick={() => void handleRetry()}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-40"
            title="Refresh"
            aria-label="Refresh allowances"
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
          {loading && allowances.length === 0 ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-line bg-surface p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-surface-2" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 w-24 rounded bg-surface-2" />
                      <div className="h-3 w-32 rounded bg-surface-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-error-dim flex items-center justify-center shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-ink">Failed to load allowances</p>
                <p className="text-[12px] text-red mt-0.5">{error}</p>
                <button
                  onClick={() => void handleRetry()}
                  className="text-[12px] text-brand font-medium hover:text-brand-dim mt-2"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : allowances.length === 0 ? (
            <p className="text-[13px] text-ink-3 text-center py-10">
              No allowances found
            </p>
          ) : (
            <div className="space-y-3">
              {allowances.map(renderAllowanceCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IncreaseButton({
  entry,
  onIncrease,
  processing,
}: {
  entry: AllowanceEntry;
  onIncrease: (entry: AllowanceEntry) => void;
  processing: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onIncrease(entry);
      }}
      disabled={processing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-dim hover:bg-brand text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Increase allowance"
    >
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        size={14}
        color="currentColor"
        strokeWidth={1.5}
        className="rotate-180"
      />
      <span className="text-[12px] font-medium">
        {processing ? 'Processing...' : 'Increase'}
      </span>
    </button>
  );
}

function DecreaseDialog({
  entry,
  onDecrease,
  processing,
}: {
  entry: AllowanceEntry;
  onDecrease: (entry: AllowanceEntry, amount: string) => void;
  processing: boolean;
}) {
  const [show, setShow] = useState(false);
  const [amount, setAmount] = useState('');

  const handleDecrease = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    onDecrease(entry, amount);
    setShow(false);
    setAmount('');
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShow(true);
        }}
        disabled={processing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-line hover:bg-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Decrease allowance"
      >
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          color="currentColor"
          strokeWidth={1.5}
        />
        <span className="text-[12px] font-medium text-ink">Decrease</span>
      </button>

      {show && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShow(false);
              setAmount('');
            }
          }}
        >
          <div
            className="bg-surface rounded-xl border border-line p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-ink mb-1">Decrease Allowance</h3>
            <p className="text-[13px] text-ink-3 mb-4">
              Current: {formatCurrency(entry.amount, formatAssetName(entry))}
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="decrease-amount" className="text-[12px] font-medium text-ink-3 mb-1 block">
                  New Amount
                </label>
                <input
                  id="decrease-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 rounded-lg border border-line bg-surface-2 px-3 text-[14px] text-ink outline-none focus:border-line-2 focus:ring-1 focus:ring-brand-dim"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => {
                    setShow(false);
                    setAmount('');
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-line bg-surface-2 text-[14px] font-medium text-ink hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecrease}
                  disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) >= parseFloat(entry.amount)}
                  className="flex-1 px-4 py-2 rounded-lg bg-red hover:bg-red-dim text-white text-[14px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Decrease
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RevokeButton({
  entry,
  onRevoke,
  processing,
}: {
  entry: AllowanceEntry;
  onRevoke: (entry: AllowanceEntry) => void;
  processing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleRevoke = () => {
    onRevoke(entry);
    setConfirming(false);
  };

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
        disabled={processing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-dim hover:bg-red text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Revoke allowance"
      >
        {processing ? (
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-1" />
        ) : (
          <HugeiconsIcon
            icon={Delete01Icon}
            size={14}
            color="currentColor"
            strokeWidth={1.5}
          />
        )}
        <span className="text-[12px] font-medium">
          {processing ? 'Processing...' : 'Revoke'}
        </span>
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirming(false);
            }
          }}
        >
          <div
            className="bg-surface rounded-xl border border-line p-5 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-semibold text-ink mb-2">Confirm Revoke</h3>
            <p className="text-[13px] text-ink-3 mb-4">
              Are you sure you want to revoke the allowance for <span className="font-medium text-ink">{formatAssetName(entry)}</span> to <span className="font-mono">{truncateAddress(entry.spender)}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-line bg-surface-2 text-[14px] font-medium text-ink hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                className="flex-1 px-4 py-2 rounded-lg bg-red hover:bg-red-dim text-white text-[14px] font-medium transition-colors"
              >
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}