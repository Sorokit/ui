import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useSorokit } from "@/context/useSorokit";
import type { ClaimableBalance } from "@/lib/client";
import { cn, safeFormat, truncateAddress } from "@/lib/utils";

function isPredicateExpired(predicate: unknown, _currentTime: number): boolean {
  if (!predicate || typeof predicate !== "object") return false;
  const p = predicate as Record<string, unknown>;
  if (p.unconditional === true) return false;
  if (typeof p.timeBound === "object" && p.timeBound !== null) {
    const tb = p.timeBound as Record<string, unknown>;
    if (typeof tb.end === "number" && _currentTime > tb.end) return true;
    if (typeof tb.start === "number" && _currentTime < tb.start) return true;
  }
  if (typeof p.endTime === "number" && _currentTime > p.endTime) return true;
  if (Array.isArray(p.and)) return p.and.every((child: unknown) => isPredicateExpired(child, _currentTime));
  if (Array.isArray(p.or)) return p.or.some((child: unknown) => isPredicateExpired(child, _currentTime));
  if (typeof p.not === "object" && p.not !== null) return !isPredicateExpired(p.not, _currentTime);
  return false;
}

interface BalanceRowProps {
  cb: ClaimableBalance;
  confirmThreshold?: string;
  currentTime?: number;
  /**
   * Issue #441: called with the balance id once a claim resolves successfully so
   * the parent can drop the row from its list straight away (optimistic update)
   * instead of leaving a stale row behind a "Claimed" badge.
   */
  onClaimed?: (id: string) => void;
}

function BalanceRow({
  cb,
  confirmThreshold,
  currentTime = Date.now(),
  onClaimed,
}: BalanceRowProps) {
  const { client } = useSorokit();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const confirmRef = useRef<HTMLDialogElement>(null);

  const rawCode = cb.asset.includes(":") ? cb.asset.split(":")[0] : cb.asset;
  const assetCode = rawCode === "native" ? "XLM" : rawCode;
  const amountNum = parseFloat(cb.amount);
  const expired = cb.claimants.some((c) => isPredicateExpired(c.predicate, currentTime));

  // Resolves #580: properly handles claim errors and delegates row removal on success
  async function handleClaim() {
    if (confirmThreshold && amountNum >= parseFloat(confirmThreshold)) {
      setShowConfirm(true);
      return;
    }
    await doClaim();
  }

  async function doClaim() {
    if (!client) {
      // Issue #441: never leave the row stuck in a loading state when there is
      // no client to claim with - surface it instead.
      setClaimError("Wallet client unavailable");
      return;
    }
    setClaiming(true);
    setClaimError(null);
    setShowConfirm(false);
    try {
      const { data, error } = await client.account.claimBalance(cb.id);
      if (error) {
        // Issue #441: a failed claim shows an inline error and returns the
        // button to its normal state so the user can retry.
        setClaimError(error);
        setClaiming(false);
        return;
      }
      if (!data) {
        setClaimError("Claim did not complete");
        setClaiming(false);
        return;
      }
      setClaimed(true);
      setClaiming(false);
      // Issue #441: hand the id up so the parent removes this row immediately;
      // the local `claimed` flag only covers the standalone/no-handler case.
      onClaimed?.(cb.id);
    } catch (err) {
      // Issue #441: claimBalance may reject (network/wallet throw). Catching it
      // here keeps the rejection from escaping as an unhandled promise and
      // still re-enables the button.
      setClaimError(err instanceof Error ? err.message : "Claim failed");
      setClaiming(false);
    }
  }

  function handleCopyId() {
    // Issue #441: writeText returns a promise that rejects when the clipboard
    // is blocked - swallow it so it is never an unhandled rejection.
    void Promise.resolve(navigator.clipboard?.writeText(cb.id)).catch(() => {});
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1600);
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-line last:border-0 gap-4">
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">
            {safeFormat(cb.amount)}
          </span>
          <Badge variant="teal">{assetCode}</Badge>
          {expired && <Badge variant="error">Expired</Badge>}
          {claimed && (
            <Badge variant="success" dot live>
              Claimed
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-4">
            Sponsor
          </span>
          <span data-address>{truncateAddress(cb.sponsor, 8, 6)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-ink-3">{truncateAddress(cb.id, 8, 6)}</span>
          <button
            onClick={handleCopyId}
            aria-label={copiedId ? "Balance ID copied" : "Copy balance ID"}
            className="text-ink-4 hover:text-ink-2 transition-colors text-[10px] p-0.5"
          >
            {copiedId ? "✓" : "⎘"}
          </button>
        </div>
      </div>
      {!claimed && (
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Button
            size="sm"
            loading={claiming}
            disabled={expired}
            onClick={() => void handleClaim()}
            className={cn("shrink-0", expired && "opacity-40 cursor-not-allowed")}
          >
            Claim
          </Button>
          {claimError && (
            /* Issue #441: inline, wrapped (not truncated) and announced so a
               failed claim is actually visible on the affected row. */
            <span
              role="alert"
              data-testid={`claim-error-${cb.id}`}
              className="text-[10px] text-red max-w-[150px] text-right break-words"
            >
              {claimError}
            </span>
          )}
        </div>
      )}

      {showConfirm && (
        <dialog
          ref={confirmRef}
          open
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="rounded-xl border border-line bg-surface p-6 max-w-sm w-full shadow-xl">
            <h4 className="text-[14px] font-semibold text-ink mb-2">Confirm Claim</h4>
            <p className="text-[13px] text-ink-2 mb-4">
              You are about to claim {safeFormat(cb.amount)} {assetCode}. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={() => void doClaim()}>
                Confirm
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

export interface ClaimableBalanceCardProps {
  confirmThreshold?: string;
}

export function ClaimableBalanceCard({ confirmThreshold }: ClaimableBalanceCardProps) {
  const { isConnected, address, client } = useSorokit();
  const [balances, setBalances] = useState<ClaimableBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Issue #441: bumped after every successful claim to re-fetch the list so it
  // stays server-consistent.
  const [refreshKey, setRefreshKey] = useState(0);
  // Issue #441: ids claimed in this session. Horizon can still return a just
  // claimed balance for a short while, so the re-fetch is filtered against this
  // set - otherwise the row the user just claimed would pop back in.
  const claimedIdsRef = useRef<Set<string>>(new Set());
  // Issue #441: marks the next fetch as a post-claim refresh, which must not
  // swap the already-rendered rows out for the loading skeleton.
  const backgroundRefreshRef = useRef(false);

  useEffect(() => {
    claimedIdsRef.current = new Set();
  }, [address, client]);

  const handleClaimed = useCallback((id: string) => {
    // Issue #441: optimistic removal - the row disappears as soon as the claim
    // resolves, then we ask the server for a fresh list.
    claimedIdsRef.current.add(id);
    setBalances((prev) => prev.filter((b) => b.id !== id));
    backgroundRefreshRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!address || !client) {
      return;
    }

    const background = backgroundRefreshRef.current;
    backgroundRefreshRef.current = false;

    let active = true;
    const timerId = window.setTimeout(() => {
      if (!background) setLoading(true);
      setError(null);
      client
        .account.getClaimableBalances(address)
        .then(({ data, error: err }) => {
          if (!active) return;
          if (err) {
            setError(err);
            return;
          }
          setBalances(
            (data ?? []).filter((b) => !claimedIdsRef.current.has(b.id)),
          );
        })
        .catch((err: unknown) => {
          // Issue #441: a rejected fetch used to escape as an unhandled
          // rejection and pin the card in its loading state.
          if (!active) return;
          setError(
            err instanceof Error ? err.message : "Failed to load claimable balances",
          );
        })
        .finally(() => {
          if (active && !background) setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timerId);
    };
  }, [address, client, refreshKey]);

  if (!isConnected) return null;

  return (
    <div className="rounded-xl border border-line bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">
            Claimable Balances
          </h3>
          <p className="text-[12px] text-ink-3 mt-0.5">
            Pending balances available to claim
          </p>
        </div>
        {!loading && balances.length > 0 && (
          <Badge variant="warning">{balances.length} pending</Badge>
        )}
      </div>

      {loading ? (
        <SkeletonCard
          className="rounded-none border-0"
          structure={
            <div className="px-5 py-5 flex flex-col gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="h-4 w-28 rounded bg-surface-2 animate-pulse" />
                    <div className="h-3 w-36 rounded bg-surface-2 animate-pulse" />
                  </div>
                  <div className="h-8 w-16 rounded-lg bg-surface-2 animate-pulse" />
                </div>
              ))}
            </div>
          }
        />
      ) : error ? (
        <p className="text-[13px] text-red text-center py-10">{error}</p>
      ) : balances.length === 0 ? (
        <p className="text-[13px] text-ink-3 text-center py-10">
          No claimable balances
        </p>
      ) : (
        <div>
          {balances.map((cb) => (
            <BalanceRow
              key={cb.id}
              cb={cb}
              confirmThreshold={confirmThreshold}
              onClaimed={handleClaimed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
